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

export type SendResetPasswordOtpResult = {
  status: 'SUCCESS' | 'EMAIL_NOT_FOUND' | 'RATE_LIMITED' | 'SERVER_ERROR';
};

export type VerifyResetPasswordOtpResult = {
  status:
    | 'SUCCESS'
    | 'INVALID_OTP'
    | 'EXPIRED_OTP'
    | 'EMAIL_NOT_FOUND'
    | 'SERVER_ERROR';
  email?: string;
};

export type ResetPasswordWithOtpResult = {
  status: 'SUCCESS' | 'INVALID_OTP' | 'EXPIRED_OTP' | 'SERVER_ERROR';
};
