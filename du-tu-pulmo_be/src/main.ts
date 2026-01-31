import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

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

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('DuTu Pulmo API')
    .setDescription(
      'API documentation for DuTu Pulmo - Lung Disease Diagnosis System',
    )
    .setVersion('1.0')
    .addBasicAuth()
    .addBearerAuth()
    .addServer('http://localhost:3000', 'Local Development')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  function filterDocumentByRole(doc: any, role: string) {
    const clonedDoc = JSON.parse(JSON.stringify(doc));
    const newPaths: Record<string, any> = {};

    for (const [path, methods] of Object.entries(clonedDoc.paths)) {
      const newMethods: Record<string, any> = {};
      let hasMethods = false;

      for (const [method, operation] of Object.entries(methods as any)) {
        const op = operation as any;
        const roles = op['x-roles'] as string[];

        // Keep if no roles defined (public) OR matches role
        if (!roles || roles.length === 0 || roles.includes(role)) {
          newMethods[method] = op;
          hasMethods = true;
        }
      }

      if (hasMethods) {
        newPaths[path] = newMethods;
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

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`🚀 Application running on: http://localhost:${port}`);
  console.log(`📚 Swagger API Docs: http://localhost:${port}/docs`);
  console.log(`📚 Swagger Admin API Docs: http://localhost:${port}/docs/admin`);
  console.log(`📚 Swagger Doctor API Docs: http://localhost:${port}/docs/doctor`);
  console.log(`📚 Swagger Patient API Docs: http://localhost:${port}/docs/patient`);
}
bootstrap();
