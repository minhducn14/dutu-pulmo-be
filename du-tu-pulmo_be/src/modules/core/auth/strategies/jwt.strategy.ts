import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';

export type JwtPayload = {
  sub: string; // accountId (authenticate)
  accountId: string; // explicit alias for clarity
  userId: string; // user entity id (for data associations)
  email?: string;
  roles?: string[];
  fullName?: string;
  patientId?: string;
  doctorId?: string;
  iat?: number;
  exp?: number;
  jti?: string; // Token unique ID for revocation
  aud?: string; // Audience
  iss?: string; // Issuer
};

export type JwtUser = {
  id: string; // DEPRECATED: Use accountId or userId explicitly
  accountId: string; // Account ID (for account-level operations)
  userId: string; // User ID (for data ownership)
  email?: string;
  roles?: string[];
  fullName?: string;
  patientId?: string;
  doctorId?: string;
};

const bearerTokenExtractor = (req: Request): string | null => {
  const header = req.headers?.authorization || null;
  if (typeof header !== 'string') return null;
  const [type, token] = header.trim().split(/\s+/);
  if (type?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({
      jwtFromRequest: bearerTokenExtractor,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
      // Add audience/issuer validation if configured
      audience: process.env.JWT_AUDIENCE,
      issuer: process.env.JWT_ISSUER,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    return await Promise.resolve({
      // For backward compatibility, id = accountId
      id: payload.sub,
      accountId: payload.sub,
      userId: payload.userId || payload.sub, // Fallback for old tokens
      email: payload.email,
      roles: payload.roles,
      fullName: payload.fullName,
      patientId: payload.patientId,
      doctorId: payload.doctorId,
    });
  }
}
