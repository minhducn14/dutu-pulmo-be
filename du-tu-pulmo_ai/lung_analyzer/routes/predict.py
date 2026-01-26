"""
Prediction routes for lung X-ray analysis.
"""
import os
import io
import base64
import uuid
import logging
import requests

from flask import Blueprint, request, jsonify
from PIL import Image

import time
import cv2
from functools import wraps

from config import Config
from models.disease_config import VINBIGDATA_LABELS
from services.image_processor import ImageProcessor
from services.diagnosis_analyzer import LungDiagnosisAnalyzer
from services.cloudinary_service import CloudinaryService

logger = logging.getLogger(__name__)

predict_bp = Blueprint('predict', __name__)

image_processor = ImageProcessor(
    target_size=Config.IMAGE_TARGET_SIZE,
    apply_hist_eq=Config.APPLY_HISTOGRAM_EQ
)

cloudinary_service = CloudinaryService(
    cloud_name=Config.CLOUDINARY_CLOUD_NAME,
    api_key=Config.CLOUDINARY_API_KEY,
    api_secret=Config.CLOUDINARY_API_SECRET,
    folder=Config.CLOUDINARY_FOLDER
)

_model = None

# --- UTILITY CLASS FOR PERFORMANCE ---
class PerformanceTimer:
    """Utility class to measure execution time of different steps."""
    def __init__(self):
        self.metrics = {}
        self.start_times = {}
        self.total_start = time.perf_counter()

    def start(self, step_name: str):
        """Start measuring a step."""
        self.start_times[step_name] = time.perf_counter()

    def stop(self, step_name: str):
        """Stop measuring a step and record duration in ms."""
        if step_name in self.start_times:
            duration = (time.perf_counter() - self.start_times[step_name]) * 1000
            self.metrics[f"{step_name}_ms"] = round(duration, 2)
            del self.start_times[step_name]

    def get_metrics(self):
        """Get all recorded metrics and total time."""
        total_duration = (time.perf_counter() - self.total_start) * 1000
        self.metrics["total_process_ms"] = round(total_duration, 2)
        return self.metrics

def get_model():
    """Lazy load YOLO model."""
    global _model
    if _model is None:
        try:
            from ultralytics import YOLO
            model_path = Config.get_model_path()
            if os.path.exists(model_path):
                logger.info(f"Loading YOLO model from {model_path}")
                _model = YOLO(model_path)
                logger.info("✅ Model loaded successfully")
            else:
                logger.warning(f"Model file not found at {model_path}")
        except ImportError:
            logger.error("ultralytics not installed")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
    return _model


def require_api_key(f):
    """Decorator to validate API key from NestJS."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        expected_key = os.getenv('INTERNAL_API_KEY', 'dev-key')
        
        if api_key != expected_key:
            logger.warning(f"Invalid API key attempt: {api_key}")
            abort(401, 'Unauthorized: Invalid API key')
        
        return f(*args, **kwargs)
    return decorated_function


def run_inference(image_path: str, conf_threshold: float = 0.40, with_visualization: bool = False):
    """
    Run YOLO inference on image.
    
    Args:
        image_path: Path to image file
        conf_threshold: Confidence threshold
        with_visualization: Return annotated image
    
    Returns:
        If with_visualization=False: List of detections
        If with_visualization=True: Tuple of (detections, annotated_image)
    """
    model = get_model()
    if model is None:
        raise RuntimeError("Model not loaded")
    
    results = model.predict(source=image_path, conf=conf_threshold,iou=0.45, save=False, verbose=False)
    
    detections = []
    annotated_image = None
    
    for result in results:
        if with_visualization:
            annotated_image = result.plot()
        
        boxes = result.boxes
        if boxes is not None:
            for box in boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                xyxy = box.xyxy[0].tolist()
                
                label = VINBIGDATA_LABELS[cls_id] if cls_id < len(VINBIGDATA_LABELS) else f"Class_{cls_id}"

                detections.append({
                    "label": label,
                    "class_id": cls_id,
                    "conf": round(conf, 4),
                    "bbox": {
                        "x1": round(xyxy[0], 2),
                        "y1": round(xyxy[1], 2),
                        "x2": round(xyxy[2], 2),
                        "y2": round(xyxy[3], 2)
                    }
                })
    
    # detections.sort(key=lambda x: x['conf'], reverse=True)
    
    if with_visualization:
        return detections, annotated_image
    return detections


@predict_bp.route('/api/v1/predict', methods=['POST'])
def predict_xray():
    """
    Predict from Image
    Upload ảnh X-quang và nhận kết quả chẩn đoán + ảnh đã detect
    Ảnh gốc và ảnh annotated sẽ được upload lên Cloudinary
    ---
    tags:
      - Diagnosis
    consumes:
      - multipart/form-data
    parameters:
      - in: formData
        name: image
        type: file
        required: true
        description: Ảnh X-quang phổi (DICOM, JPEG, PNG)
    responses:
      200:
        description: Kết quả chẩn đoán kèm URL ảnh trên Cloudinary
        schema:
          type: object
          properties:
            success:
              type: boolean
            file_id:
              type: string
            data:
              type: object
            original_image_url:
              type: string
              description: URL ảnh gốc trên Cloudinary
            annotated_image_url:
              type: string
              description: URL ảnh đã detect trên Cloudinary
      400:
        description: No image uploaded
      500:
        description: Server error or Cloudinary not configured
    """
    
    timer = PerformanceTimer()
    logger.info("API predict_xray v1 called")
    
    try:
        # 1. Validation & Setup
        if not cloudinary_service.configured:
            return jsonify({"success": False, "error": "Cloudinary not configured"}), 500
        
        if 'image' not in request.files:
            return jsonify({"success": False, "error": "No image uploaded"}), 400
        
        file = request.files['image']
        file_id = str(uuid.uuid4())
        filename = f"{file_id}_{file.filename}"
        filepath = os.path.join(Config.UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        # 2. Pre-processing
        timer.start('preprocess')
        try:
            processed_filepath = image_processor.process(filepath)
        except Exception as img_err:
            logger.warning(f"Processing failed: {img_err}")
            processed_filepath = filepath
        timer.stop('preprocess')
        
        # 3. Upload Original (Network Bound)
        timer.start('upload_original')
        original_upload = cloudinary_service.upload_image(
            processed_filepath,
            public_id=f"{file_id}_original",
            subfolder="originals"
        )
        timer.stop('upload_original')

        if not original_upload.get('success'):
            return jsonify({"success": False, "error": "Upload failed"}), 500
        original_image_url = original_upload.get('url')
        
        # 4. Model Inference (GPU/CPU Bound)
        timer.start('inference')
        detections, annotated_img = run_inference(
            processed_filepath, 
            conf_threshold=Config.CONF_THRESHOLD, 
            with_visualization=True
        )
        timer.stop('inference')

        # 5. Analysis Logic (CPU Bound)
        timer.start('analysis')
        analyzer = LungDiagnosisAnalyzer(detections)
        result = analyzer.evaluate()
        timer.stop('analysis')
        
        # 6. Visualization & Post-processing
        timer.start('visualization')
        annotated_image_url = None
        evaluated_image_url = None
        annotated_path = None
        evaluated_path = None
        
        # Save & Upload Annotated Image (YOLO Output)
        if annotated_img is not None:
            pil_img = Image.fromarray(cv2.cvtColor(annotated_img, cv2.COLOR_BGR2RGB))
            annotated_filename = f"{file_id}_annotated.jpg"
            annotated_path = os.path.join(Config.OUTPUT_FOLDER, annotated_filename)
            pil_img.save(annotated_path, format='JPEG', quality=85)
            
            up_res = cloudinary_service.upload_image(annotated_path, public_id=f"{file_id}_annotated", subfolder="predictions")
            if up_res.get('success'):
                annotated_image_url = up_res.get('url')

        # Save & Upload Evaluated Image (Risk Colors)
        evaluated_img = analyzer.draw_result_image(processed_filepath)
        if evaluated_img is not None:
            pil_eval_img = Image.fromarray(cv2.cvtColor(evaluated_img, cv2.COLOR_BGR2RGB))
            evaluated_filename = f"{file_id}_evaluated.jpg"
            evaluated_path = os.path.join(Config.OUTPUT_FOLDER, evaluated_filename)
            pil_eval_img.save(evaluated_path, format='JPEG', quality=85)
            
            up_res = cloudinary_service.upload_image(evaluated_path, public_id=f"{file_id}_evaluated", subfolder="evaluated")
            if up_res.get('success'):
                evaluated_image_url = up_res.get('url')
        timer.stop('visualization')
        
        # 7. Cleanup
        timer.start('cleanup')
        files_to_delete = [filepath, processed_filepath, annotated_path, evaluated_path]
        for f in files_to_delete:
            if f and os.path.exists(f):
                try:
                    os.remove(f)
                except: pass
        timer.stop('cleanup')
        
        # Get final metrics
        metrics = timer.get_metrics()
        logger.info(f"Processed {file_id} in {metrics['total_process_ms']}ms")

        return jsonify({
            "success": True,
            "file_id": file_id,
            "data": result,
            "images": {
                "original": original_image_url,
                "annotated": annotated_image_url,
                "evaluated": evaluated_image_url
            },
            "performance": metrics
        })
        
    except Exception as e:
        logger.error(f"Prediction error: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@predict_bp.route('/api/v2/predict', methods=['POST'])
@require_api_key
def predict_xray_v2():
    """
    Predict from Image URL
    Accept image URL from NestJS (already on Cloudinary)
    Return diagnosis results only (no image upload)
    ---
    tags:
      - Diagnosis
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - image_url
          properties:
            image_url:
              type: string
              description: URL of image on Cloudinary
              example: https://res.cloudinary.com/xxx/image/upload/v1/medical_images/original/xxx.jpg
    responses:
      200:
        description: Diagnosis result
        schema:
          type: object
          properties:
            success:
              type: boolean
            file_id:
              type: string
            data:
              type: object
            original_image_url:
              type: string
            annotated_image_url:
              type: string
              description: Always null (images managed by NestJS)
            evaluated_image_url:
              type: string
              description: Always null (images managed by NestJS)
      400:
        description: Missing image_url
      401:
        description: Unauthorized (invalid API key)
      500:
        description: Server error
    """
    correlation_id = request.headers.get('X-Correlation-Id', 'unknown')
    logger.info(f"[{correlation_id}] API predict_xray called")
    
    try:
        data = request.get_json()
        if not data or 'image_url' not in data:
            return jsonify({
                "success": False, 
                "error": "Missing image_url in request body"
            }), 400
        
        image_url = data['image_url']
        logger.info(f"[{correlation_id}] Processing image from: {image_url}")
        
        file_id = str(uuid.uuid4())
        filename = f"{file_id}_temp.jpg"
        filepath = os.path.join(Config.UPLOAD_FOLDER, filename)
        
        try:
            response = requests.get(image_url, timeout=30)
            response.raise_for_status()
            
            with open(filepath, 'wb') as f:
                f.write(response.content)
            
            logger.info(f"[{correlation_id}] Downloaded image: {len(response.content)} bytes")
            
        except Exception as download_err:
            logger.error(f"[{correlation_id}] Failed to download image: {download_err}")
            return jsonify({
                "success": False,
                "error": f"Failed to download image: {str(download_err)}"
            }), 400
        
        try:
            processed_filepath = image_processor.process(filepath)
        except Exception as img_err:
            logger.warning(f"[{correlation_id}] Image processing failed, using original: {img_err}")
            processed_filepath = filepath
        
        detections, annotated_img = run_inference(
            processed_filepath, 
            conf_threshold=Config.CONF_THRESHOLD, 
            with_visualization=True
        )
        
        analyzer = LungDiagnosisAnalyzer(detections)
        result = analyzer.evaluate()
        
        annotated_path = None
        
        if annotated_img is not None:
            import cv2
            pil_img = Image.fromarray(cv2.cvtColor(annotated_img, cv2.COLOR_BGR2RGB))
            
            annotated_filename = f"{file_id}_annotated.jpg"
            annotated_path = os.path.join(Config.OUTPUT_FOLDER, annotated_filename)
            pil_img.save(annotated_path, format='JPEG', quality=85)
            
            annotated_upload = cloudinary_service.upload_image(
                annotated_path,
                public_id=f"{file_id}_annotated",
                subfolder="predictions"
            )
            if annotated_upload.get('success'):
                annotated_image_url = annotated_upload.get('url')
                logger.info(f"Uploaded annotated to Cloudinary: {annotated_image_url}")
            else:
                logger.warning(f"Failed to upload annotated image: {annotated_upload.get('error')}")
        
        evaluated_image_url = None
        evaluated_path = None
        
        evaluated_img = analyzer.draw_result_image(processed_filepath)
        if evaluated_img is not None:
            import cv2
            pil_eval_img = Image.fromarray(cv2.cvtColor(evaluated_img, cv2.COLOR_BGR2RGB))
            
            evaluated_filename = f"{file_id}_evaluated.jpg"
            evaluated_path = os.path.join(Config.OUTPUT_FOLDER, evaluated_filename)
            pil_eval_img.save(evaluated_path, format='JPEG', quality=85)
            
            evaluated_upload = cloudinary_service.upload_image(
                evaluated_path,
                public_id=f"{file_id}_evaluated",
                subfolder="evaluated"
            )
            if evaluated_upload.get('success'):
                evaluated_image_url = evaluated_upload.get('url')
                logger.info(f"Uploaded evaluated to Cloudinary: {evaluated_image_url}")
            else:
                logger.warning(f"Failed to upload evaluated image: {evaluated_upload.get('error')}")
        
        files_to_delete = [filepath]  
        
        if processed_filepath != filepath:
            files_to_delete.append(processed_filepath)
        
        if annotated_path:
            files_to_delete.append(annotated_path)
        
        if evaluated_path:
            files_to_delete.append(evaluated_path)
        
        for file_to_delete in files_to_delete:
            try:
                if os.path.exists(file_to_delete):
                    os.remove(file_to_delete)
                    logger.info(f"Deleted local file: {file_to_delete}")
            except Exception as del_err:
                logger.warning(f"Failed to delete local file {file_to_delete}: {del_err}")
        
        logger.info(f"[{correlation_id}] Analysis complete: {result['diagnosis_status']}")
        
        return jsonify({
            "success": True,
            "file_id": file_id,
            "data": result,
            "original_image_url": image_url,
            "annotated_image_url": annotated_image_url,
            "evaluated_image_url": evaluated_image_url
        })
        
    except Exception as e:
        logger.error(f"[{correlation_id}] Prediction error: {e}", exc_info=True)
        return jsonify({
            "success": False, 
            "error": str(e)
        }), 500

@predict_bp.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint for monitoring
    ---
    tags:
      - Health
    responses:
      200:
        description: Service is healthy
        schema:
          type: object
          properties:
            status:
              type: string
              example: ok
            model_loaded:
              type: boolean
    """
    model = get_model()
    return jsonify({
        "status": "ok",
        "model_loaded": model is not None
    })