import { PolkaAdapter } from '@nestjs-adapters/polka';
import { TinyAdapter } from '@nestjs-adapters/tiny-http';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

export const importDynamic = new Function(
    'modulePath',
    'return import(modulePath)',
);

async function bootstrap() {
    const { App } = await importDynamic('@tinyhttp/app');

    const tApp = new App();

    const app = await NestFactory.create(AppModule, new TinyAdapter(tApp));
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe());
    await app.listen(3000);
}
bootstrap();
