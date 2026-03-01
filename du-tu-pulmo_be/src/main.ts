import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';

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
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  // Global validation pipe
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
  const isProd = process.env.NODE_ENV === 'production';
  const host = isProd ? '0.0.0.0' : 'localhost';

  const serverUrl = process.env.PUBLIC_URL || `http://${host}:${port}`;

  /**
   * Swagger configuration
   */
  const config = new DocumentBuilder()
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
    )
    .addServer(serverUrl, 'Current Server')
    .build();

  const document = SwaggerModule.createDocument(app, config);

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
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'DuTu Pulmo API Docs',
  });

  await app.listen(port, host);

  console.log(`🚀 Application running on: http://${host}:${port}`);
  console.log(`📚 Swagger API Docs: http://${host}:${port}/docs`);
  console.log(`📚 Swagger Admin API Docs: http://${host}:${port}/docs/admin`);
  console.log(
    `📚 Swagger Doctor API Docs: http://${host}:${port}/docs/doctor`,
  );
  console.log(
    `📚 Swagger Patient API Docs: http://${host}:${port}/docs/patient`,
  );
}
void bootstrap();
