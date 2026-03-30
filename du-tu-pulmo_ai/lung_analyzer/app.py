"""
Flask API for Lung X-Ray Analysis
YOLO11 + Threshold-based Diagnosis Rules
Version 3.2.0 - Modular Architecture with Cloudinary Support
"""
import logging
from flask import Flask
from flask_cors import CORS
from flasgger import Swagger

from config import Config
from routes.predict import predict_bp
from routes.rules import rules_bp
from models.disease_config import DISEASE_RULES


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


app = Flask(__name__)
CORS(app)


swagger_template = {
    "swagger": "2.0",
    "info": {
        "title": "Lung Diagnosis API",
        "description": """
## 🏥 API Phân tích X-Quang Phổi

Sử dụng **YOLO11** + **Threshold-based Priority Rules** để phát hiện 14 bệnh lý phổi.

### 📁 Định dạng ảnh hỗ trợ:
- **DICOM** (.dcm, .dicom) - Tự động xử lý VOI LUT, histogram equalization
- **JPEG/PNG** - Ảnh X-quang thông thường

### ☁️ Cloud Storage:
- Hỗ trợ upload ảnh lên **Cloudinary** (tùy chọn)
- Set `upload_to_cloud=true` khi gọi API

### Nhóm nguy cơ:
- 🔴 **Critical**: Pneumothorax (Tràn khí màng phổi) - CẤP CỨU
- 🟠 **High Risk**: Nodule/Mass, Pleural effusion, Consolidation, Infiltration, Atelectasis
- 🟡 **Warning**: ILD, Pulmonary fibrosis, Cardiomegaly, Lung Opacity, Pleural thickening
- 🟢 **Benign**: Aortic enlargement, Calcification, Other lesion

### Lưu ý:
⚠️ Hệ thống chỉ hỗ trợ sàng lọc, **KHÔNG** thay thế chẩn đoán của bác sĩ.
        """,
        "version": "3.2.0",
        "contact": {
            "name": "Lung Diagnosis API Support",
            "email": "support@lungdiagnosis.ai"
        },
        "license": {
            "name": "MIT License"
        }
    },
    "basePath": "/",
    "schemes": ["http", "https"],
    "tags": [
        {"name": "Diagnosis", "description": "X-Ray diagnosis endpoints"},
        {"name": "Rules", "description": "Diagnosis rules information"}
    ]
}

swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec",
            "route": "/apispec.json",
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/docs"
}

swagger = Swagger(app, template=swagger_template, config=swagger_config)


app.register_blueprint(predict_bp)
app.register_blueprint(rules_bp)


@app.route('/health', methods=['GET'])
def health_check():
    """
    Health Check
    Kiểm tra trạng thái API
    ---
    tags:
      - Health
    responses:
      200:
        description: API status
    """
    from services.cloudinary_service import CLOUDINARY_AVAILABLE
    
    return {
        "status": "healthy",
        "version": "3.2.0",
        "services": {
            "cloudinary": Config.is_cloudinary_configured() and CLOUDINARY_AVAILABLE,
            "dicom_support": True
        }
    }


if __name__ == '__main__':
    logger.info("🏥 Starting Lung Diagnosis API v3.2.0...")
    logger.info(f"📁 Model path: {Config.get_model_path()}")
    logger.info(f"📜 System: Threshold-based Priority Rules")
    logger.info(f"🔬 Supported diseases: {len(DISEASE_RULES)}")
    logger.info(f"☁️ Cloudinary: {'Configured' if Config.is_cloudinary_configured() else 'Not configured'}")
    

    from routes.predict import get_model
    model = get_model()
    if model:
        logger.info("✅ Model pre-loaded successfully")
    else:
        logger.warning("⚠️ Model not loaded - check MODEL_PATH")
    
    logger.info(f"🚀 Server starting on http://localhost:{Config.PORT}")
    logger.info("🚀 Swagger docs available at http://localhost:5000/docs")
    app.run(host='0.0.0.0', port=Config.PORT, debug=Config.FLASK_DEBUG)