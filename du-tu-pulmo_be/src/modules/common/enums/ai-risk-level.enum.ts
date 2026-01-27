export enum AiRiskLevelEnum {
  CRITICAL = 'Critical',
  HIGH_RISK = 'High Risk',
  WARNING = 'Warning',
  BENIGN = 'Benign',
  UNCERTAIN = 'Uncertain',
}

export const AI_RISK_COLORS: Record<AiRiskLevelEnum, string> = {
  [AiRiskLevelEnum.CRITICAL]: '#DC0000',
  [AiRiskLevelEnum.HIGH_RISK]: '#FF4500',
  [AiRiskLevelEnum.WARNING]: '#FFA500',
  [AiRiskLevelEnum.BENIGN]: '#00CC66',
  [AiRiskLevelEnum.UNCERTAIN]: '#808080',
};
