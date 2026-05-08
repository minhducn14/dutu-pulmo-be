"""
Gemini AI Validator - Kiểm tra ảnh có phải X-quang phổi không.
"""
import json
import logging
import re

from PIL import Image

logger = logging.getLogger(__name__)


class GeminiXrayValidator:
    """
    Dùng Gemini Vision để xác minh ảnh đầu vào có phải
    X-quang lồng ngực (Chest X-ray / CXR) không trước khi
    đưa vào pipeline YOLO.
    """

    PROMPT = """
You are a medical image classifier. Carefully examine the image provided.

Determine whether the image is a **chest X-ray (CXR / lung radiograph)**.

Respond ONLY with a valid JSON object in this exact format (no markdown, no extra text):
{
  "is_chest_xray": true,
  "confidence": "high",
  "reason": "The image shows a standard PA chest radiograph with visible lung fields, ribcage, and mediastinum."
}

Rules:
- "is_chest_xray" must be true ONLY if the image is clearly a medical chest radiograph (PA, AP, or lateral view).
- "confidence" must be one of: "high", "medium", "low".
- "reason" must be a concise explanation in English (1-2 sentences).
- If the image is a selfie, photo, CT scan, MRI, ultrasound, or anything other than a plain chest X-ray film, set "is_chest_xray" to false.
"""

    def __init__(self, api_key: str):
        """
        Args:
            api_key: Google Gemini API key
        """
        if not api_key:
            raise ValueError("GEMINI_API_KEY is required for GeminiXrayValidator")

        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel("gemini-2.5-flash-lite")
            self._available = True
            logger.info("✅ GeminiXrayValidator initialized successfully")
        except ImportError:
            self._available = False
            logger.warning("⚠️ google-generativeai not installed. Gemini validation disabled.")

    @property
    def available(self) -> bool:
        """Kiểm tra Gemini SDK có sẵn không."""
        return self._available

    def validate(self, image_path: str) -> dict:
        """
        Kiểm tra ảnh tại image_path có phải X-quang phổi không.

        Args:
            image_path: Đường dẫn đến file ảnh đã được pre-process

        Returns:
            {
                "is_valid": bool,        # True nếu là chest X-ray
                "confidence": str,       # "high" | "medium" | "low"
                "reason": str,           # Lý do từ Gemini
                "skipped": bool          # True nếu validation bị bỏ qua (Gemini không khả dụng)
            }
        """
        if not self._available:
            logger.warning("Gemini validation skipped: SDK not available")
            return {
                "is_valid": True,
                "confidence": "low",
                "reason": "Gemini validation skipped (SDK not installed)",
                "skipped": True
            }

        try:
            img = Image.open(image_path).convert("RGB")
            response = self.model.generate_content([self.PROMPT, img])
            raw_text = response.text.strip()

            logger.debug(f"Gemini raw response: {raw_text}")

            # Parse JSON từ response
            parsed = self._parse_response(raw_text)

            is_valid = parsed.get("is_chest_xray", False)
            confidence = parsed.get("confidence", "low")
            reason = parsed.get("reason", "No reason provided")

            logger.info(
                f"Gemini validation → is_chest_xray={is_valid}, "
                f"confidence={confidence}, reason={reason}"
            )

            return {
                "is_valid": is_valid,
                "confidence": confidence,
                "reason": reason,
                "skipped": False
            }

        except Exception as e:
            # Nếu Gemini lỗi (quota, network...) → fail-open để không block pipeline
            logger.error(f"Gemini validation error (fail-open): {e}", exc_info=True)
            return {
                "is_valid": True,
                "confidence": "low",
                "reason": f"Gemini validation failed, proceeding anyway: {str(e)}",
                "skipped": True
            }

    @staticmethod
    def _parse_response(raw_text: str) -> dict:
        """
        Parse JSON từ text response của Gemini.
        Xử lý trường hợp Gemini trả về markdown code block.
        """
        # Bỏ markdown code fences nếu có
        cleaned = re.sub(r"```(?:json)?", "", raw_text).strip().strip("`").strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # Fallback: tìm JSON object trong text
            match = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    pass

        logger.warning(f"Could not parse Gemini JSON response: {raw_text!r}")
        return {"is_chest_xray": True, "confidence": "low", "reason": "Parse error"}
