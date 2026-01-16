"""
Lung diagnosis analyzer with threshold-based priority rules.
"""
from typing import List, Dict, Any, Optional
import numpy as np

from models.disease_config import (
    RiskLevel, DiseaseConfig, DISEASE_RULES, 
    RISK_COLORS, RISK_PRIORITY
)


class LungDiagnosisAnalyzer:
    """
    Analyzer based on specific thresholds and risk priorities.
    Implements the complete diagnostic rules from the specification.
    """
    
    def __init__(self, detections: List[Dict[str, Any]]):
        """
        Initialize analyzer with YOLO detections.
        
        Args:
            detections: List of detection dicts with 'label', 'conf', 'bbox'
        """
        self.raw_detections = detections
        self.validated_findings = []
        self.gray_zone_findings = []
        
        self._process_detections()

    def _get_confidence_level(self, label: str, conf: float, rule: DiseaseConfig) -> str:
        """
        Determine confidence level based on probability and disease-specific thresholds.
        
        Confidence Level Rules:
        - Pneumothorax: High ≥0.80, Medium 0.60-0.79
        - Benign: High ≥0.90, Medium 0.80-0.89
        - High Risk & Warning: High ≥0.85, Medium below 0.85
        """
        # Critical: Pneumothorax
        if label == "Pneumothorax":
            return "High" if conf >= 0.80 else "Medium"
        
        # Benign group
        if rule.risk == RiskLevel.BENIGN:
            return "High" if conf >= 0.90 else "Medium"
        
        # High Risk & Warning groups
        return "High" if conf >= 0.85 else "Medium"

    def _process_detections(self):
        """Filter and classify detections based on thresholds."""
        for d in self.raw_detections:
            label = d['label']
            conf = d['conf']
            
            if label not in DISEASE_RULES:
                continue
                
            rule = DISEASE_RULES[label]
            
            # Check if detection meets threshold
            if conf >= rule.threshold:
                conf_level = self._get_confidence_level(label, conf, rule)

                self.validated_findings.append({
                    "label": label,
                    "name_vn": rule.name_vn,
                    "probability": conf,
                    "risk_level": rule.risk.value,
                    "threshold": rule.threshold,
                    "confidence_level": conf_level,
                    "recommendation": rule.recommendation,
                    "bbox": d.get('bbox'),
                    # Internal sorting keys
                    "_risk_priority": self._get_risk_priority(rule.risk),
                    "_internal_rank": rule.priority_rank
                })
            elif 0.50 <= conf < rule.threshold:
                # Gray zone: between 0.50 and threshold
                self.gray_zone_findings.append({
                    "label": label,
                    "name_vn": rule.name_vn,
                    "probability": conf,
                    "required_threshold": rule.threshold,
                    "bbox": d.get('bbox')
                })

    def _get_risk_priority(self, risk: RiskLevel) -> int:
        """Map risk level to priority (Lower value = Higher priority)."""
        return RISK_PRIORITY.get(risk, 99)

    def _get_risk_color(self, risk_value: str) -> str:
        """Get color code for risk level."""
        return RISK_COLORS.get(risk_value, "#808080")

    def _format_gray_zone_note(self) -> str:
        """Generate gray zone recommendation note."""
        if not self.gray_zone_findings:
            return "Không có tổn thương nào đạt ngưỡng xác nhận."
        
        if len(self.gray_zone_findings) >= 2:
            labels = [f"{g['name_vn']} ({g['probability']:.1%})" 
                     for g in self.gray_zone_findings[:3]]
            return (f"Phát hiện {len(self.gray_zone_findings)} tổn thương ở vùng xám "
                   f"cần theo dõi: {', '.join(labels)}. Khuyến nghị tái khám hoặc "
                   f"chụp lại để đánh giá rõ hơn.")
        
        g = self.gray_zone_findings[0]
        return (f"Nghi ngờ {g['name_vn']} ({g['probability']:.1%}) nhưng chưa đạt "
               f"ngưỡng xác nhận ({g['required_threshold']:.1%}). Khuyến nghị theo dõi.")

    def evaluate(self) -> Dict[str, Any]:
        """
        Generate final diagnosis report.
        
        Returns:
            Comprehensive diagnostic result following priority rules:
            1. No findings → UNCERTAIN with gray zone notes
            2. Multiple findings → Sort by risk priority, internal rank, probability
            3. Primary diagnosis = highest priority finding
        """
        
        # Case 1: No valid findings
        if not self.validated_findings:
            gray_zone_note = self._format_gray_zone_note()
            
            return {
                "diagnosis_status": "UNCERTAIN",
                "primary_diagnosis": {
                    "label": "Uncertain",
                    "name_vn": "Không rõ ràng / Chưa phát hiện bất thường rõ rệt",
                    "risk_level": "Uncertain",
                    "recommendation": gray_zone_note,
                    "color": "#808080"
                },
                "findings": [],
                "gray_zone_notes": self.gray_zone_findings,
                "total_findings": 0
            }

        # Case 2: Sort findings by Priority Rule
        # Priority: Risk Group (Critical→High Risk→Warning→Benign) 
        #           → Internal Rank → Probability (desc)
        self.validated_findings.sort(key=lambda x: (
            x['_risk_priority'], 
            x['_internal_rank'], 
            -x['probability']
        ))

        # Case 3: Select Primary Diagnosis (Top 1)
        primary = self.validated_findings[0]
        
        primary_diag_output = {
            "label": primary['label'],
            "name_vn": primary['name_vn'],
            "risk_level": primary['risk_level'],
            "confidence_level": primary['confidence_level'],
            "recommendation": primary['recommendation'],
            "color": self._get_risk_color(primary['risk_level']),
            "probability": primary['probability']
        }

        # Case 4: Format findings output (Clean up internal keys)
        final_findings = []
        for f in self.validated_findings:
            final_findings.append({
                "label": f['label'],
                "name_vn": f['name_vn'],
                "probability": f['probability'],
                "risk_level": f['risk_level'],
                "confidence_level": f['confidence_level'],
                "recommendation": f['recommendation'],
                "bbox": f['bbox']
            })

        return {
            "diagnosis_status": "DETECTED",
            "primary_diagnosis": primary_diag_output,
            "findings": final_findings,
            "gray_zone_notes": self.gray_zone_findings,
            "total_findings": len(final_findings)
        }

    def _hex_to_bgr(self, hex_color: str) -> tuple:
        """Convert hex color to BGR for OpenCV."""
        hex_color = hex_color.lstrip('#')
        r, g, b = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
        return (b, g, r)

    def draw_result_image(self, image_path: str) -> Optional[np.ndarray]:
        """
        Draw bounding boxes on image based on validated findings.
        Uses risk-level colors for each bbox.
        
        Args:
            image_path: Path to original image file
            
        Returns:
            Annotated image as numpy array (BGR format) or None if no findings
        """
        if not self.validated_findings and not self.gray_zone_findings:
            return None
        
        try:
            import cv2
            
            # Read image
            img = cv2.imread(image_path)
            if img is None:
                return None
            
            # Draw bboxes for each validated finding
            for finding in self.validated_findings:
                bbox = finding.get('bbox')
                if not bbox:
                    continue
                
                # Get coordinates
                x1 = int(bbox['x1'])
                y1 = int(bbox['y1'])
                x2 = int(bbox['x2'])
                y2 = int(bbox['y2'])
                
                # Get color based on risk level
                risk_level = finding.get('risk_level', 'Uncertain')
                hex_color = RISK_COLORS.get(risk_level, '#808080')
                color = self._hex_to_bgr(hex_color)
                
                # Draw rectangle (thickness=2)
                cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
                
                # Prepare label text
                label = finding.get('label', '')
                prob = finding.get('probability', 0)
                label_text = f"{label} {prob:.1%}"
                
                # Calculate text size for background (larger font for visibility)
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 0.7
                thickness = 2
                (text_width, text_height), baseline = cv2.getTextSize(
                    label_text, font, font_scale, thickness
                )
                
                # Determine label position (above bbox or inside if near top edge)
                label_bg_height = text_height + 12
                
                if y1 >= label_bg_height:
                    # Draw label above bbox
                    bg_y1 = y1 - label_bg_height
                    bg_y2 = y1
                    text_y = y1 - 6
                else:
                    # Draw label inside bbox (at top)
                    bg_y1 = y1
                    bg_y2 = y1 + label_bg_height
                    text_y = y1 + text_height + 6
                
                # Draw background rectangle for text
                cv2.rectangle(
                    img, 
                    (x1, bg_y1), 
                    (x1 + text_width + 8, bg_y2), 
                    color, 
                    -1  # Filled
                )
                
                # Draw text (white color)
                cv2.putText(
                    img, 
                    label_text,
                    (x1 + 4, text_y),
                    font,
                    font_scale,
                    (255, 255, 255),
                    thickness
                )
            
            # Draw gray zone findings (dashed cyan boxes - visible on X-ray)
            uncertain_color = self._hex_to_bgr('#00FFFF')  # Cyan - stands out on X-ray
            for finding in self.gray_zone_findings:
                bbox = finding.get('bbox')
                if not bbox:
                    continue
                
                x1 = int(bbox['x1'])
                y1 = int(bbox['y1'])
                x2 = int(bbox['x2'])
                y2 = int(bbox['y2'])
                
                # Draw dashed rectangle
                dash_length = 10
                gap_length = 5
                
                # Top edge
                for x in range(x1, x2, dash_length + gap_length):
                    cv2.line(img, (x, y1), (min(x + dash_length, x2), y1), uncertain_color, 2)
                # Bottom edge
                for x in range(x1, x2, dash_length + gap_length):
                    cv2.line(img, (x, y2), (min(x + dash_length, x2), y2), uncertain_color, 2)
                # Left edge
                for y in range(y1, y2, dash_length + gap_length):
                    cv2.line(img, (x1, y), (x1, min(y + dash_length, y2)), uncertain_color, 2)
                # Right edge
                for y in range(y1, y2, dash_length + gap_length):
                    cv2.line(img, (x2, y), (x2, min(y + dash_length, y2)), uncertain_color, 2)
                
                # Label with "?" suffix to indicate uncertainty
                label = finding.get('label', '')
                prob = finding.get('probability', 0)
                label_text = f"{label}? {prob:.1%}"
                
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 0.7
                thickness = 2
                (text_width, text_height), _ = cv2.getTextSize(
                    label_text, font, font_scale, thickness
                )
                
                # Determine label position
                label_bg_height = text_height + 12
                if y1 >= label_bg_height:
                    bg_y1 = y1 - label_bg_height
                    bg_y2 = y1
                    text_y = y1 - 6
                else:
                    bg_y1 = y1
                    bg_y2 = y1 + label_bg_height
                    text_y = y1 + text_height + 6
                
                # Draw background and text
                cv2.rectangle(img, (x1, bg_y1), (x1 + text_width + 8, bg_y2), uncertain_color, -1)
                cv2.putText(img, label_text, (x1 + 4, text_y), font, font_scale, (0, 0, 0), thickness)
            
            return img
            
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to draw result image: {e}")
            return None
