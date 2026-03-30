"""
Flask API for Lung X-Ray Analysis
YOLO11 + Threshold-based Diagnosis Rules
Version 3.2.0 - Production Grade (ENV-based config)
"""

import logging
import os
from flask import Flask
from flask_cors import CORS
from flasgger import Swagger

from config import Config
from routes.predict import predict_bp
from routes.rules import rules_bp
from models.disease_config import DISEASE_RULES


# ==============================
# 🔧 LOGGING
# ==============================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ==============================
# 🌍 ENVIRONMENT CONFIG
# ==============================
ENV = os.getenv("FLASK_ENV", "development")
APP_HOST = os.getenv("APP_HOST")

IS_PROD = ENV == "production"
IS_STAGING = ENV == "staging"

logger.info(f"🌍 ENV: {ENV}")
logger.info(f"🌐 APP_HOST: {APP_HOST}")


# ==============================
# 🌐 DETECT HOST + SCHEME
# ==============================
if ENV in ["production", "staging"]:
    if not APP_HOST:
        raise ValueError("❌ APP_HOST must be set in staging/production")

    HOST = APP_HOST
    SCHEME = "https"

else:
    HOST = f"localhost:{Config.PORT}"
    SCHEME = "http"


logger.info(f"🌐 Using: {SCHEME}://{HOST}")


# ==============================
# 🚀 INIT APP
# ==============================
app = Flask(__name__)
CORS(app)


# ==============================
# 📄 SWAGGER TEMPLATE
# ==============================
swagger_template = {
    "swagger": "2.0",
    "info": {
        "title": "Lung Diagnosis API",
        "description": """
## 🏥 API Phân tích X-Quang Phổi

Sử dụng **YOLO11** + **Threshold-based Priority Rules** để phát hiện 14 bệnh lý phổi.

### 📁 Định dạng ảnh hỗ trợ:
- DICOM (.dcm, .dicom)
- JPEG/PNG

### ☁️ Cloud Storage:
- Upload Cloudinary (optional)

### ⚠️ Lưu ý:
Hệ thống chỉ hỗ trợ sàng lọc, không thay thế chẩn đoán bác sĩ.
        """,
        "version": "3.2.0",
        "contact": {
            "name": "Support",
            "email": "support@lungdiagnosis.ai"
        }
    },
    "host": HOST,
    "basePath": "/",
    "schemes": [SCHEME],  # 🔥 QUAN TRỌNG: fix mixed content
    "tags": [
        {"name": "Diagnosis", "description": "X-Ray diagnosis endpoints"},
        {"name": "Rules", "description": "Diagnosis rules"},
        {"name": "Health", "description": "System health"}
    ]
}


# ==============================
# ⚙️ SWAGGER CONFIG
# ==============================
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


# Init Swagger
swagger = Swagger(app, template=swagger_template, config=swagger_config)


# ==============================
# 🔌 REGISTER ROUTES
# ==============================
app.register_blueprint(predict_bp)
app.register_blueprint(rules_bp)


# ==============================
# ❤️ HEALTH CHECK
# ==============================
@app.route('/health', methods=['GET'])
def health_check():
    """
    Health Check
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
        "env": ENV,
        "version": "3.2.0",
        "host": HOST,
        "scheme": SCHEME,
        "services": {
            "cloudinary": Config.is_cloudinary_configured() and CLOUDINARY_AVAILABLE,
            "dicom_support": True
        }
    }


# ==============================
# 🚀 MAIN
# ==============================
if __name__ == '__main__':
    logger.info("🏥 Starting Lung Diagnosis API v3.2.0...")
    logger.info(f"📁 Model path: {Config.get_model_path()}")
    logger.info(f"🔬 Diseases: {len(DISEASE_RULES)}")
    logger.info(f"☁️ Cloudinary: {'ON' if Config.is_cloudinary_configured() else 'OFF'}")

    # preload model
    from routes.predict import get_model
    model = get_model()

    if model:
        logger.info("✅ Model pre-loaded successfully")
    else:
        logger.warning("⚠️ Model not loaded")

    logger.info(f"🌐 Server running at: {SCHEME}://{HOST}")
    logger.info(f"📄 Swagger docs: {SCHEME}://{HOST}/docs")

    app.run(
        host='0.0.0.0',
        port=Config.PORT,
        debug=Config.FLASK_DEBUG
    )