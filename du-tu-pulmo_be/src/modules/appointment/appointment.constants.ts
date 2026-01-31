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
