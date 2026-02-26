export const DECISION_SOURCES = [
  'AI_ONLY',
  'DOCTOR_ONLY',
  'DOCTOR_REVIEWED_AI',
] as const;

export type DecisionSource = (typeof DECISION_SOURCES)[number];
