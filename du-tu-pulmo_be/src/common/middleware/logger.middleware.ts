import { Injectable, Logger, NestMiddleware } from '@nestjs/common';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggerMiddleware.name);

  use(req: any, res: any, next: () => void) {
    this.logger.log(`[${req.method}] ${req.originalUrl}`);
    next();
  }
}
