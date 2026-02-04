export const APPOINTMENT_BASE_RELATIONS = [
  'patient',
  'patient.user',
  'patient.user.account',
  'doctor',
  'doctor.user',
  'doctor.user.account',
  'hospital',
  'timeSlot',
];

export const APPOINTMENT_AUTH_RELATIONS = [
  'patient',
  'patient.user',
  'doctor',
  'doctor.user',
  'hospital',
  'timeSlot',
];

export const CHECKIN_TIME_THRESHOLDS = {
  IN_CLINIC: {
    EARLY_MINUTES: 30,
    LATE_MINUTES: 15,
  },
  VIDEO: {
    EARLY_MINUTES: 60,
    LATE_MINUTES: 30,
  },
};
