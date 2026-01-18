"""
Configuration management using environment variables.
"""
import os
from dotenv import load_dotenv


load_dotenv()


class Config:
    """Application configuration from environment variables."""
    
    FLASK_ENV = os.getenv('FLASK_ENV', 'development')
    FLASK_DEBUG = os.getenv('FLASK_DEBUG', 'true').lower() == 'true'
    PORT = int(os.getenv('PORT', 5000))
    
    MODEL_PATH = os.getenv('MODEL_PATH', 'model/train/weights/best.pt')
    
    CLOUDINARY_CLOUD_NAME = os.getenv('CLOUDINARY_CLOUD_NAME', '')
    CLOUDINARY_API_KEY = os.getenv('CLOUDINARY_API_KEY', '')
    CLOUDINARY_API_SECRET = os.getenv('CLOUDINARY_API_SECRET', '')
    CLOUDINARY_FOLDER = os.getenv('CLOUDINARY_FOLDER', 'lung_xray')
    
    IMAGE_TARGET_SIZE = int(os.getenv('IMAGE_TARGET_SIZE', 1024))
    APPLY_HISTOGRAM_EQ = os.getenv('APPLY_HISTOGRAM_EQ', 'true').lower() == 'true'
    
    CONF_THRESHOLD = float(os.getenv('CONF_THRESHOLD', 0.40))
    
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    OUTPUT_FOLDER = os.path.join(BASE_DIR, 'outputs')
    
    @classmethod
    def is_cloudinary_configured(cls) -> bool:
        """Check if Cloudinary is properly configured."""
        return all([
            cls.CLOUDINARY_CLOUD_NAME,
            cls.CLOUDINARY_API_KEY,
            cls.CLOUDINARY_API_SECRET
        ])
    
    @classmethod
    def get_model_path(cls) -> str:
        """Get absolute model path."""
        if os.path.isabs(cls.MODEL_PATH):
            return cls.MODEL_PATH
        return os.path.join(cls.BASE_DIR, cls.MODEL_PATH)



os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
os.makedirs(Config.OUTPUT_FOLDER, exist_ok=True)
