"""
Cloudinary service for cloud image storage.
"""
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


try:
    import cloudinary
    import cloudinary.uploader
    import cloudinary.api
    CLOUDINARY_AVAILABLE = True
except ImportError:
    CLOUDINARY_AVAILABLE = False
    logger.warning("Cloudinary not installed. Run: pip install cloudinary")


class CloudinaryService:
    """Service for uploading and managing images on Cloudinary."""
    
    def __init__(self, cloud_name: str, api_key: str, api_secret: str, folder: str = "lung_xray"):
        """
        Initialize Cloudinary service.
        
        Args:
            cloud_name: Cloudinary cloud name
            api_key: Cloudinary API key
            api_secret: Cloudinary API secret
            folder: Default folder for uploads
        """
        self.folder = folder
        self.configured = False
        
        if not CLOUDINARY_AVAILABLE:
            logger.warning("Cloudinary package not available")
            return
        
        if all([cloud_name, api_key, api_secret]):
            cloudinary.config(
                cloud_name=cloud_name,
                api_key=api_key,
                api_secret=api_secret,
                secure=True
            )
            self.configured = True
            logger.info(f"Cloudinary configured for cloud: {cloud_name}")
        else:
            logger.warning("Cloudinary credentials not provided")
    
    def upload_image(
        self, 
        file_path: str, 
        public_id: Optional[str] = None,
        subfolder: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Upload image to Cloudinary.
        
        Args:
            file_path: Local path to image file
            public_id: Custom public ID (optional)
            subfolder: Subfolder within main folder (optional)
            **kwargs: Additional Cloudinary upload options
        
        Returns:
            Upload result dictionary with url, public_id, etc.
        """
        if not self.configured:
            raise RuntimeError("Cloudinary not configured")
        

        folder = self.folder
        if subfolder:
            folder = f"{folder}/{subfolder}"
        

        upload_options = {
            "folder": folder,
            "resource_type": "image",
            **kwargs
        }
        
        if public_id:
            upload_options["public_id"] = public_id
        
        try:
            result = cloudinary.uploader.upload(file_path, **upload_options)
            logger.info(f"Uploaded to Cloudinary: {result.get('secure_url')}")
            return {
                "success": True,
                "url": result.get("secure_url"),
                "public_id": result.get("public_id"),
                "width": result.get("width"),
                "height": result.get("height"),
                "format": result.get("format"),
                "bytes": result.get("bytes"),
                "created_at": result.get("created_at")
            }
        except Exception as e:
            logger.error(f"Cloudinary upload failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def upload_from_base64(
        self, 
        base64_data: str, 
        public_id: Optional[str] = None,
        subfolder: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Upload image from base64 string.
        
        Args:
            base64_data: Base64 encoded image (with or without data URI prefix)
            public_id: Custom public ID (optional)
            subfolder: Subfolder within main folder (optional)
        
        Returns:
            Upload result dictionary
        """
        if not self.configured:
            raise RuntimeError("Cloudinary not configured")
        

        if not base64_data.startswith("data:"):
            base64_data = f"data:image/jpeg;base64,{base64_data}"
        
        folder = self.folder
        if subfolder:
            folder = f"{folder}/{subfolder}"
        
        upload_options = {
            "folder": folder,
            "resource_type": "image"
        }
        
        if public_id:
            upload_options["public_id"] = public_id
        
        try:
            result = cloudinary.uploader.upload(base64_data, **upload_options)
            logger.info(f"Uploaded base64 to Cloudinary: {result.get('secure_url')}")
            return {
                "success": True,
                "url": result.get("secure_url"),
                "public_id": result.get("public_id")
            }
        except Exception as e:
            logger.error(f"Cloudinary base64 upload failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def delete_image(self, public_id: str) -> bool:
        """
        Delete image from Cloudinary.
        
        Args:
            public_id: Public ID of the image to delete
        
        Returns:
            True if deleted successfully
        """
        if not self.configured:
            return False
        
        try:
            result = cloudinary.uploader.destroy(public_id)
            return result.get("result") == "ok"
        except Exception as e:
            logger.error(f"Cloudinary delete failed: {e}")
            return False
    
    def get_url(self, public_id: str, **transformations) -> str:
        """
        Get URL for an image with optional transformations.
        
        Args:
            public_id: Public ID of the image
            **transformations: Cloudinary transformations (width, height, crop, etc.)
        
        Returns:
            Image URL
        """
        if not self.configured:
            return ""
        
        return cloudinary.CloudinaryImage(public_id).build_url(**transformations)
