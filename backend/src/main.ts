import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { SerializeInterceptor } from './common/serialize.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Prefijo global de API
  app.setGlobalPrefix('api');

  // CORS dinámico para permitir apps móviles y admin web
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Validaciones globales de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Serialización de Decimal -> Number para el frontend
  app.useGlobalInterceptors(new SerializeInterceptor());

  // Documentación Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('API Transporte - Uber / InDrive Clone')
    .setDescription(
      'API Backend con soporte para tarifas automáticas, subasta de ofertas en tiempo real y tracking geográfico con WebSockets.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 Servidor ejecutándose en http://localhost:${port}/api`);
  logger.log(`📚 Documentación Swagger en http://localhost:${port}/docs`);
}

await bootstrap();
