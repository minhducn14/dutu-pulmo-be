"""
Image processing utilities for DICOM and regular images.
"""
import os
import logging
import numpy as np
import cv2

logger = logging.getLogger(__name__)

# DICOM processing imports (optional)
try:
    import pydicom
    from pydicom.pixel_data_handlers.util import apply_voi_lut
    from skimage import exposure
    DICOM_SUPPORT = True
except ImportError:
    DICOM_SUPPORT = False
    logger.warning("DICOM support not available. Install: pip install pydicom scikit-image")


class ImageProcessor:
    """Service for processing medical images (DICOM, JPEG, PNG)."""
    
    def __init__(self, target_size: int = 1024, apply_hist_eq: bool = True):
        """
        Initialize image processor.
        
        Args:
            target_size: Default target size for resizing
            apply_hist_eq: Apply histogram equalization for DICOM files
        """
        self.target_size = target_size
        self.apply_hist_eq = apply_hist_eq
    
    @staticmethod
    def is_dicom_supported() -> bool:
        """Check if DICOM processing is available."""
        return DICOM_SUPPORT
    
    @staticmethod
    def read_dicom_to_array(path: str, voi_lut: bool = True, fix_monochrome: bool = True) -> np.ndarray:
        """
        Convert DICOM file to numpy array with proper processing.
        
        Args:
            path: Path to DICOM file
            voi_lut: Apply VOI LUT transformation for human-friendly view
            fix_monochrome: Fix inverted monochrome images
        
        Returns:
            Normalized uint8 numpy array (0-255)
        """
        if not DICOM_SUPPORT:
            raise RuntimeError("DICOM support not available. Install pydicom and scikit-image.")
        
        dicom = pydicom.read_file(path)
        
        # Apply VOI LUT if available (transforms raw data to human-friendly view)
        if voi_lut:
            data = apply_voi_lut(dicom.pixel_array, dicom)
        else:
            data = dicom.pixel_array
        
        # Fix inverted monochrome images (MONOCHROME1)
        if fix_monochrome and hasattr(dicom, 'PhotometricInterpretation'):
            if dicom.PhotometricInterpretation == "MONOCHROME1":
                data = np.amax(data) - data
        
        # Normalize to 0-255 range
        data = data - np.min(data)
        if np.max(data) > 0:
            data = data / np.max(data)
        data = (data * 255).astype(np.uint8)
        
        return data
    
    @staticmethod
    def apply_histogram_equalization(image_array: np.ndarray) -> np.ndarray:
        """
        Apply histogram equalization for better contrast.
        
        Args:
            image_array: Input image array (uint8)
        
        Returns:
            Equalized image array (uint8)
        """
        if not DICOM_SUPPORT:
            # Fallback to OpenCV CLAHE
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            return clahe.apply(image_array)
        
        equalized = exposure.equalize_hist(image_array)
        return (equalized * 255).astype(np.uint8)
    
    @staticmethod
    def detect_dicom(filepath: str) -> bool:
        """
        Detect if file is DICOM format.
        
        Args:
            filepath: Path to file
        
        Returns:
            True if DICOM file detected
        """
        file_ext = os.path.splitext(filepath)[1].lower()
        
        # Check by extension
        if file_ext in ['.dcm', '.dicom']:
            return True
        
        # Check by header if extension is ambiguous
        if file_ext == '' or file_ext not in ['.jpg', '.jpeg', '.png', '.bmp', '.gif']:
            try:
                with open(filepath, 'rb') as f:
                    header = f.read(132)
                    if len(header) >= 132 and header[128:132] == b'DICM':
                        return True
            except:
                pass
        
        return False
    
    def process(self, filepath: str, target_size: int = None, apply_hist_eq: bool = None) -> str:
        """
        Process uploaded image file (DICOM, JPEG, PNG).
        Converts to standardized format for YOLO inference.
        
        Args:
            filepath: Path to uploaded file
            target_size: Target size for resizing (None to use default)
            apply_hist_eq: Apply histogram equalization (None to use default)
        
        Returns:
            Path to processed image file (JPEG format)
        """
        target_size = target_size if target_size is not None else self.target_size
        apply_hist_eq = apply_hist_eq if apply_hist_eq is not None else self.apply_hist_eq
        
        is_dicom = self.detect_dicom(filepath)
        
        if is_dicom:
            if not DICOM_SUPPORT:
                raise RuntimeError("DICOM file detected but DICOM support not available. "
                                 "Install: pip install pydicom scikit-image")
            
            logger.info(f"Processing DICOM file: {filepath}")
            
            # Read and process DICOM
            image_array = self.read_dicom_to_array(filepath)
            
            # Apply histogram equalization for better contrast
            if apply_hist_eq:
                image_array = self.apply_histogram_equalization(image_array)
            
            # Convert to RGB (YOLO expects 3 channels)
            if len(image_array.shape) == 2:
                image_array = cv2.cvtColor(image_array, cv2.COLOR_GRAY2RGB)
            
            # Resize if needed
            if target_size:
                image_array = cv2.resize(image_array, (target_size, target_size), 
                                        interpolation=cv2.INTER_LANCZOS4)
            
            # Save as JPEG for YOLO
            processed_path = filepath.rsplit('.', 1)[0] + '_processed.jpg'
            cv2.imwrite(processed_path, cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR))
            logger.info(f"DICOM converted to: {processed_path}")
            return processed_path
        
        else:
            # Regular image file (JPEG, PNG, etc.)
            logger.info(f"Processing regular image: {filepath}")
            
            # Load image
            image = cv2.imread(filepath)
            if image is None:
                raise ValueError(f"Could not read image: {filepath}")
            
            # Resize if needed
            if target_size:
                image = cv2.resize(image, (target_size, target_size), 
                                  interpolation=cv2.INTER_LANCZOS4)
                # Save resized image
                processed_path = filepath.rsplit('.', 1)[0] + '_processed.jpg'
                cv2.imwrite(processed_path, image)
                return processed_path
            
            return filepath


# Default instance
image_processor = ImageProcessor()
