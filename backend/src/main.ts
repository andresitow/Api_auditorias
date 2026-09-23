import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  // Los IDs de devtunnel cambian en cada sesión, así que además de la lista
  // fija de CORS_ORIGIN aceptamos cualquier origen *.devtunnels.ms.
  const devtunnelOriginPattern =
    /^https:\/\/[a-z0-9]+-\d+\.[a-z0-9.-]+\.devtunnels\.ms$/i;
  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        devtunnelOriginPattern.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error(`Origen no permitido por CORS: ${origin}`), false);
      }
    },
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Infraestructura API')
    .setDescription('Monitoreo de red, auditorías y formularios')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(
    `API en http://localhost:${port}  ·  Swagger en http://localhost:${port}/docs`,
  );
}
bootstrap().catch((error) => {
  console.error('Error fatal al iniciar la aplicación:', error);
  process.exit(1);
});
