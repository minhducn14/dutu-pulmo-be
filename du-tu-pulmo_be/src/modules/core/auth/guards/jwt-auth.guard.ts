import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // Check if error is due to token expiration
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (info?.name === 'TokenExpiredError') {
      throw new UnauthorizedException(ERROR_MESSAGES.TOKEN_EXPIRED);
    }

    // Check if error is due to invalid token
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (info?.name === 'JsonWebTokenError') {
      throw new UnauthorizedException(ERROR_MESSAGES.INVALID_TOKEN);
    }

    // If there's an error or no user, throw unauthorized
    if (err || !user) {
      throw err || new UnauthorizedException(ERROR_MESSAGES.UNAUTHORIZED);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return user;
  }
}
