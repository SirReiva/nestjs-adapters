import { KoaAdapter, setup } from '@nestjs-adapters/koa';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

export const importDynamic = new Function(
    'modulePath',
    'return import(modulePath)',
);

async function bootstrap() {
    // const { App } = await importDynamic('@tinyhttp/app');
    // const tApp = new App();

    const app = await NestFactory.create(AppModule, new KoaAdapter());
    app.setGlobalPrefix('api');
    app.enableVersioning({
        type: VersioningType.HEADER,
        header: 'version',
    });

    const config = new DocumentBuilder()
        .setTitle('Cats example')
        .setDescription('The cats API description')
        .setVersion('1.0')
        .addTag('cats')
        .build();
    const document = SwaggerModule.createDocument(app, config);
    setup('docs', app, document);

    app.useGlobalPipes(new ValidationPipe());
    await app.listen(3000);
}
bootstrap();
