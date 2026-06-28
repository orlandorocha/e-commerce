import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const apiPrefix = config.get<string>('apiPrefix', 'api');
  app.setGlobalPrefix(apiPrefix);

  // Seguranca
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: [config.get<string>('frontendUrl', 'http://localhost:3000')],
    credentials: true,
  });

  // Validacao global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Filtros e interceptors globais
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('API E-commerce')
    .setDescription(
      'Documentacao completa da API do backend de e-commerce (NestJS + Prisma + PostgreSQL).',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Autenticacao')
    .addTag('Usuarios')
    .addTag('Clientes')
    .addTag('Enderecos')
    .addTag('Categorias')
    .addTag('Marcas')
    .addTag('Fornecedores')
    .addTag('Atributos')
    .addTag('Produtos')
    .addTag('Variacoes')
    .addTag('Estoque')
    .addTag('Carrinho')
    .addTag('Cupons')
    .addTag('Pedidos')
    .addTag('Avaliacoes')
    .addTag('Favoritos')
    .addTag('Dashboard')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  const port = config.get<number>('port', 3001);
  await app.listen(port);
  logger.log(`API rodando em http://localhost:${port}/${apiPrefix}`);
  logger.log(`Swagger em http://localhost:${port}/${apiPrefix}/docs`);

  // Necessario para o Reflector estar disponivel via DI nos guards globais.
  void Reflector;
}

bootstrap();
