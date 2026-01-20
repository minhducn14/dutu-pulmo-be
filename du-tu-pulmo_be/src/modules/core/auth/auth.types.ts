export type VerifyEmailResult =
  | { status: 'SUCCESS' }
  | { status: 'INVALID_TOKEN' }
  | { status: 'ALREADY_VERIFIED' }
  | { status: 'EXPIRED_TOKEN'; email: string }
  | { status: 'SERVER_ERROR' };

export type ResendVerificationResult =
  | { status: 'SUCCESS' }
  | { status: 'EMAIL_NOT_FOUND' }
  | { status: 'ALREADY_VERIFIED' }
  | { status: 'SERVER_ERROR' };

  
export type VerifyEmailByOtpResult =
  | { status: 'SUCCESS' }
  | { status: 'INVALID_OTP' }
  | { status: 'ALREADY_VERIFIED' }
  | { status: 'EXPIRED_OTP'; email: string }
  | { status: 'SERVER_ERROR' };

export type ResendVerificationByOtpResult =
  | { status: 'SUCCESS' }
  | { status: 'EMAIL_NOT_FOUND' }
  | { status: 'ALREADY_VERIFIED' }
  | { status: 'RATE_LIMITED' }
  | { status: 'SERVER_ERROR' };