import { KoaAdapter } from '@nestjs-adapters/koa';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, new KoaAdapter());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe());
    await app.listen(3000);
}
bootstrap();
