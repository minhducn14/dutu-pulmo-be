"""
Rules routes for lung diagnosis API.
"""
import logging
from flask import Blueprint, jsonify

from models.disease_config import DISEASE_RULES

logger = logging.getLogger(__name__)

# Create Blueprint
rules_bp = Blueprint('rules', __name__)


@rules_bp.route('/api/v1/rules', methods=['GET'])
def get_rules():
    """
    Get Diagnosis Rules
    Lấy danh sách 14 bệnh lý với ngưỡng và khuyến nghị
    ---
    tags:
      - Rules
    responses:
      200:
        description: Danh sách luật chẩn đoán
        schema:
          type: object
          properties:
            success:
              type: boolean
            data:
              type: array
              items:
                type: object
                properties:
                  label:
                    type: string
                    example: Pneumothorax
                  name_en:
                    type: string
                  name_vn:
                    type: string
                    example: Tràn khí màng phổi
                  risk_level:
                    type: string
                    enum: [Critical, High Risk, Warning, Benign]
                  threshold:
                    type: number
                    example: 0.60
                  priority_rank:
                    type: integer
                  recommendation:
                    type: string
            total:
              type: integer
              example: 14
    """
    rules_list = []
    for key, rule in DISEASE_RULES.items():
        rules_list.append({
            "label": key,
            "name_en": rule.name_en,
            "name_vn": rule.name_vn,
            "risk_level": rule.risk.value,
            "threshold": rule.threshold,
            "priority_rank": rule.priority_rank,
            "recommendation": rule.recommendation
        })
    
    # Sort by risk priority
    risk_order = {"Critical": 1, "High Risk": 2, "Warning": 3, "Benign": 4}
    rules_list.sort(key=lambda x: (risk_order.get(x['risk_level'], 99), x['priority_rank']))
    
    return jsonify({"success": True, "data": rules_list, "total": len(rules_list)})
