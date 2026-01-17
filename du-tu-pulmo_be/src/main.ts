import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
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

  // Export swagger.json to docs folder
  // const docsPath = path.join(__dirname, '..', 'docs');
  // if (!fs.existsSync(docsPath)) {
  //   fs.mkdirSync(docsPath, { recursive: true });
  // }
  // fs.writeFileSync(
  //   path.join(docsPath, 'swagger.json'),
  //   JSON.stringify(document, null, 2),
  //   'utf-8',
  // );
  // console.log(`📄 Swagger JSON exported to: ${path.join(docsPath, 'swagger.json')}`);

  SwaggerModule.setup('api', app, document, {
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
  console.log(`📚 Swagger API Docs: http://localhost:${port}/api`);
}
bootstrap();
