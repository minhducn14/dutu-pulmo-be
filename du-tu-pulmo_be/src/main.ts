import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import * as express from 'express';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getRolesFromOperation(operation: unknown): string[] | undefined {
  if (!isRecord(operation)) return undefined;

  const roles = operation['x-roles'];
  if (!Array.isArray(roles)) return undefined;

  return roles.filter((role): role is string => typeof role === 'string');
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Body limit
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ limit: '20mb', extended: true }));

  // CORS
  app.enableCors();

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));

  const port = process.env.PORT ?? 3000;
  const host = '0.0.0.0';

  /**
   * 🔥 ENV DETECTION
   */
  const ENV = process.env.ENV || process.env.NODE_ENV || 'development';

  const PUBLIC_URL = process.env.BACKEND_URL;

  let serverUrl: string;

  if (ENV === 'production' || ENV === 'staging') {
    if (!PUBLIC_URL) {
      throw new Error('❌ PUBLIC_URL is required in production/staging');
    }
    serverUrl = PUBLIC_URL;
  } else {
    serverUrl = `http://localhost:${port}`;
  }

  logger.log(`🌍 ENV: ${ENV}`);
  logger.log(`🌐 PUBLIC_URL: ${PUBLIC_URL}`);
  logger.log(`🚀 Using server URL: ${serverUrl}`);

  /**
   * 🔥 SWAGGER CONFIG
   */
  const builder = new DocumentBuilder()
    .setTitle('DuTu Pulmo API')
    .setDescription(
      'API documentation for DuTu Pulmo - Lung Disease Diagnosis System',
    )
    .setVersion('1.0')
    .addBasicAuth()
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    );

  // 👉 Chỉ add localhost khi dev
  if (ENV === 'development') {
    builder.addServer(`http://localhost:${port}`, 'Local Server');
  }

  // 👉 Server chính
  builder.addServer(serverUrl, 'Public Server');

  const config = builder.build();

  const document = SwaggerModule.createDocument(app, config);

  /**
   * 🔥 FILTER DOC BY ROLE
   */
  function filterDocumentByRole(
    doc: OpenAPIObject,
    role: string,
  ): OpenAPIObject {
    const clonedDoc = structuredClone(doc);
    const sourcePaths = clonedDoc.paths ?? {};
    const newPaths: NonNullable<OpenAPIObject['paths']> = {};

    for (const [path, methods] of Object.entries(sourcePaths)) {
      if (!isRecord(methods)) continue;

      const newMethods: Record<string, unknown> = {};

      for (const [method, operation] of Object.entries(methods)) {
        const roles = getRolesFromOperation(operation);
        if (!roles || roles.length === 0 || roles.includes(role)) {
          newMethods[method] = operation;
        }
      }

      if (Object.keys(newMethods).length > 0) {
        newPaths[path] = newMethods as NonNullable<
          OpenAPIObject['paths']
        >[string];
      }
    }

    clonedDoc.paths = newPaths;
    return clonedDoc;
  }

  const ADMIN_ROLE = 'ADMIN';
  const DOCTOR_ROLE = 'DOCTOR';
  const PATIENT_ROLE = 'PATIENT';

  const adminDocument = filterDocumentByRole(document, ADMIN_ROLE);
  const doctorDocument = filterDocumentByRole(document, DOCTOR_ROLE);
  const patientDocument = filterDocumentByRole(document, PATIENT_ROLE);

  const swaggerOptions = {
    persistAuthorization: true,
    tagsSorter: 'alpha',
    operationsSorter: 'alpha',
  };

  SwaggerModule.setup('docs/admin', app, adminDocument, {
    swaggerOptions,
    customSiteTitle: 'Admin API Docs',
  });

  SwaggerModule.setup('docs/doctor', app, doctorDocument, {
    swaggerOptions,
    customSiteTitle: 'Doctor API Docs',
  });

  SwaggerModule.setup('docs/patient', app, patientDocument, {
    swaggerOptions,
    customSiteTitle: 'Patient API Docs',
  });

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions,
    customSiteTitle: 'DuTu Pulmo API Docs',
  });

  /**
   * EXPORT OPENAPI (optional)
   */
  const exportPath = process.env.EXPORT_OPENAPI_PATH;
  const exportPatientPath = process.env.EXPORT_PATIENT_OPENAPI_PATH;

  if (exportPath || exportPatientPath) {
    if (exportPath) {
      mkdirSync(dirname(exportPath), { recursive: true });
      writeFileSync(exportPath, JSON.stringify(document, null, 2), 'utf8');
      logger.log(`Exported OpenAPI: ${exportPath}`);
    }
    if (exportPatientPath) {
      mkdirSync(dirname(exportPatientPath), { recursive: true });
      writeFileSync(
        exportPatientPath,
        JSON.stringify(patientDocument, null, 2),
        'utf8',
      );
      logger.log(`Exported patient OpenAPI: ${exportPatientPath}`);
    }
    await app.close();
    return;
  }

  /**
   * START SERVER
   */
  await app.listen(port, host);

  logger.log(`🚀 Running at: ${serverUrl}`);
  logger.log(`📚 Docs: ${serverUrl}/docs`);
}

void bootstrap();
