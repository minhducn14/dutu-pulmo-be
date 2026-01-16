"""
Disease configuration and diagnosis rules.
VinBigData 14 disease labels with thresholds and recommendations.
"""
from enum import Enum


class RiskLevel(Enum):
    """Risk level classification for diseases."""
    CRITICAL = "Critical"
    HIGH_RISK = "High Risk"
    WARNING = "Warning"
    BENIGN = "Benign"
    UNCERTAIN = "Uncertain"


class DiseaseConfig:
    """Configuration for a single disease/finding."""
    
    def __init__(self, id_code: int, name_en: str, name_vn: str, risk: RiskLevel, 
                 threshold: float, recommendation: str, priority_rank: int):
        self.id = id_code
        self.name_en = name_en
        self.name_vn = name_vn
        self.risk = risk
        self.threshold = threshold
        self.recommendation = recommendation
        self.priority_rank = priority_rank  # Lower number = higher priority within the group


# VinBigData 14 disease labels (ordered by class ID)
VINBIGDATA_LABELS = [
    "Aortic enlargement",    # 0
    "Atelectasis",           # 1
    "Calcification",         # 2
    "Cardiomegaly",          # 3
    "Consolidation",         # 4
    "ILD",                   # 5
    "Infiltration",          # 6
    "Lung Opacity",          # 7
    "Nodule/Mass",           # 8
    "Other lesion",          # 9
    "Pleural effusion",      # 10
    "Pleural thickening",    # 11
    "Pneumothorax",          # 12
    "Pulmonary fibrosis",    # 13
]


# Full Diagnosis Rules Table
DISEASE_RULES = {
    # Critical Group
    "Pneumothorax": DiseaseConfig(
        12, "Pneumothorax", "Tràn khí màng phổi", RiskLevel.CRITICAL, 0.60,
        "ĐI CẤP CỨU NGAY để đánh giá & xử trí. Không trì hoãn.", 1
    ),
    
    # High Risk Group
    "Nodule/Mass": DiseaseConfig(
        8, "Nodule/Mass", "Nốt / Khối u", RiskLevel.HIGH_RISK, 0.70,
        "Ưu tiên cao: Khám chuyên khoa ngực/hô hấp TRONG 1-2 TUẦN. Cân nhắc CT ngực để loại trừ u ác tính.", 1
    ),
    "Pleural effusion": DiseaseConfig(
        10, "Pleural effusion", "Tràn dịch màng phổi", RiskLevel.HIGH_RISK, 0.75,
        "Khám sớm trong 3-5 ngày. Đánh giá nguyên nhân: tim mạch, nhiễm trùng, ác tính.", 2
    ),
    "Consolidation": DiseaseConfig(
        4, "Consolidation", "Đông đặc phổi", RiskLevel.HIGH_RISK, 0.75,
        "Khám bác sĩ trong 3-5 ngày. Xét nghiệm viêm (CRP, BC máu) nếu có triệu chứng.", 3
    ),
    "Infiltration": DiseaseConfig(
        6, "Infiltration", "Thâm nhiễm", RiskLevel.HIGH_RISK, 0.75,
        "Khám hô hấp trong 5-7 ngày. Theo dõi tiến triển, đối chiếu triệu chứng.", 4
    ),
    "Atelectasis": DiseaseConfig(
        1, "Atelectasis", "Xẹp phổi", RiskLevel.HIGH_RISK, 0.75,
        "Khám hô hấp trong 1 tuần. Cân nhắc CT nếu nghi tắc nghẽn hoặc không cải thiện.", 5
    ),

    # Warning Group
    "ILD": DiseaseConfig(
        5, "ILD", "Bệnh phổi mô kẽ", RiskLevel.WARNING, 0.75,
        "Khám hô hấp trong 2-4 tuần. Cân nhắc HRCT, test chức năng hô hấp.", 1
    ),
    "Pulmonary fibrosis": DiseaseConfig(
        13, "Pulmonary fibrosis", "Xơ phổi", RiskLevel.WARNING, 0.75,
        "Theo dõi dài hạn. Đánh giá chức năng hô hấp (SpO2, spirometry) nếu có triệu chứng.", 2
    ),
    "Cardiomegaly": DiseaseConfig(
        3, "Cardiomegaly", "Bóng tim to", RiskLevel.WARNING, 0.75,
        "Khám tim mạch trong 2-4 tuần. Cân nhắc siêu âm tim, ECG nếu có triệu chứng tim.", 3
    ),
    "Lung Opacity": DiseaseConfig(
        7, "Lung Opacity", "Mờ phế trường", RiskLevel.WARNING, 0.75,
        "Theo dõi 2-4 tuần. Đối chiếu triệu chứng. Có thể cần chụp lại hoặc CT nếu không cải thiện.", 4
    ),
    "Pleural thickening": DiseaseConfig(
        11, "Pleural thickening", "Dày màng phổi", RiskLevel.WARNING, 0.75,
        "Thường mạn tính. Theo dõi định kỳ 3-6 tháng nếu không có triệu chứng.", 5
    ),

    # Benign Group
    "Aortic enlargement": DiseaseConfig(
        0, "Aortic enlargement", "Phình/Giãn động mạch chủ", RiskLevel.BENIGN, 0.80,
        "Theo dõi định kỳ. Cân nhắc khám tim mạch nếu có yếu tố nguy cơ (THA, ĐTĐ, tuổi >60).", 1
    ),
    "Calcification": DiseaseConfig(
        2, "Calcification", "Vôi hóa", RiskLevel.BENIGN, 0.80,
        "Thường là di chứng cũ (lao, viêm). Theo dõi định kỳ 6-12 tháng.", 2
    ),
    "Other lesion": DiseaseConfig(
        9, "Other lesion", "Tổn thương khác", RiskLevel.BENIGN, 0.80,
        "Đánh giá theo mô tả cụ thể. Thường không cấp tính, theo dõi định kỳ.", 3
    ),
}


# Risk color mapping
RISK_COLORS = {
    "Critical": "#DC0000",
    "High Risk": "#FF4500",
    "Warning": "#FFA500",
    "Benign": "#00CC66",
    "Uncertain": "#808080"
}


# Priority order for risk levels (lower = higher priority)
RISK_PRIORITY = {
    RiskLevel.CRITICAL: 1,
    RiskLevel.HIGH_RISK: 2,
    RiskLevel.WARNING: 3,
    RiskLevel.BENIGN: 4
}
