import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody = {
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()) as string,
      message:
        exception instanceof HttpException
          ? exception.getResponse()
          : 'Internal server error',
    };

    // Log the exception
    if (httpStatus >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - Status: ${httpStatus} - Error: ${
          exception instanceof Error ? exception.message : 'Unknown Error'
        }`,
        exception instanceof Error ? exception.stack : '',
      );
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} - Status: ${httpStatus} - Message: ${
          typeof responseBody.message === 'object'
            ? JSON.stringify(responseBody.message)
            : responseBody.message
        }`,
      );
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
