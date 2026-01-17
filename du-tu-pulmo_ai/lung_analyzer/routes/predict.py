"""
Prediction routes for lung X-ray analysis.
"""
import os
import io
import base64
import uuid
import logging

from flask import Blueprint, request, jsonify
from PIL import Image

from config import Config
from models.disease_config import VINBIGDATA_LABELS
from services.image_processor import ImageProcessor
from services.diagnosis_analyzer import LungDiagnosisAnalyzer
from services.cloudinary_service import CloudinaryService

logger = logging.getLogger(__name__)

# Create Blueprint
predict_bp = Blueprint('predict', __name__)

# Initialize services
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

# YOLO Model (lazy loaded)
_model = None


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
    logger.info("API predict_xray")
    try:
        if not cloudinary_service.configured:
            return jsonify({
                "success": False, 
                "error": "Cloudinary not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env"
            }), 500
        
        if 'image' not in request.files:
            return jsonify({"success": False, "error": "No image uploaded"}), 400
        
        file = request.files['image']
        
        # Save uploaded file locally (temporary)
        file_id = str(uuid.uuid4())
        filename = f"{file_id}_{file.filename}"
        filepath = os.path.join(Config.UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        # Process image (handles DICOM, JPEG, PNG automatically)
        try:
            processed_filepath = image_processor.process(filepath)
        except Exception as img_err:
            logger.warning(f"Image processing failed, using original file: {img_err}")
            processed_filepath = filepath
        
        # Upload original/processed image to Cloudinary
        original_upload = cloudinary_service.upload_image(
            processed_filepath,
            public_id=f"{file_id}_original",
            subfolder="originals"
        )
        if not original_upload.get('success'):
            return jsonify({
                "success": False, 
                "error": f"Failed to upload original image: {original_upload.get('error')}"
            }), 500
        
        original_image_url = original_upload.get('url')
        logger.info(f"Uploaded original to Cloudinary: {original_image_url}")
        
        # Run inference with visualization
        detections, annotated_img = run_inference(
            processed_filepath, 
            conf_threshold=Config.CONF_THRESHOLD, 
            with_visualization=True
        )
        # Analyze using diagnostic rules
        analyzer = LungDiagnosisAnalyzer(detections)
        result = analyzer.evaluate()
        
        # Process and upload annotated image (raw YOLO output)
        # annotated_image_url = None
        annotated_path = None
        
        if annotated_img is not None:
            import cv2
            pil_img = Image.fromarray(cv2.cvtColor(annotated_img, cv2.COLOR_BGR2RGB))
            
            # Save annotated image locally (temporary)
            annotated_filename = f"{file_id}_annotated.jpg"
            annotated_path = os.path.join(Config.OUTPUT_FOLDER, annotated_filename)
            pil_img.save(annotated_path, format='JPEG', quality=85)
            
            # Upload annotated image to Cloudinary
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
        
        # Generate evaluated result image (with risk-level colored bboxes)
        evaluated_image_url = None
        evaluated_path = None
        
        evaluated_img = analyzer.draw_result_image(processed_filepath)
        if evaluated_img is not None:
            import cv2
            pil_eval_img = Image.fromarray(cv2.cvtColor(evaluated_img, cv2.COLOR_BGR2RGB))
            
            # Save evaluated image locally (temporary)
            evaluated_filename = f"{file_id}_evaluated.jpg"
            evaluated_path = os.path.join(Config.OUTPUT_FOLDER, evaluated_filename)
            pil_eval_img.save(evaluated_path, format='JPEG', quality=85)
            
            # Upload evaluated image to Cloudinary
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
        
        # Cleanup: Delete local files after successful upload
        files_to_delete = [filepath]  # Original uploaded file
        
        # Add processed file if different from original
        if processed_filepath != filepath:
            files_to_delete.append(processed_filepath)
        
        # Add annotated file if exists
        if annotated_path:
            files_to_delete.append(annotated_path)
        
        # Add evaluated file if exists
        if evaluated_path:
            files_to_delete.append(evaluated_path)
        
        for file_to_delete in files_to_delete:
            try:
                if os.path.exists(file_to_delete):
                    os.remove(file_to_delete)
                    logger.info(f"Deleted local file: {file_to_delete}")
            except Exception as del_err:
                logger.warning(f"Failed to delete local file {file_to_delete}: {del_err}")
        
        return jsonify({
            "success": True,
            "file_id": file_id,
            "data": result,
            "original_image_url": original_image_url,
            "annotated_image_url": annotated_image_url,
            "evaluated_image_url": evaluated_image_url
        })
        
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

