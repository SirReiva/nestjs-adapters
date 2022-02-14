import { INestApplication } from '@nestjs/common';
import { loadPackage } from '@nestjs/common/utils/load-package.util';
import type { SwaggerOptions } from 'koa2-swagger-ui';

export function getGlobalPrefix(app: INestApplication): string {
    const internalConfigRef = (app as any).config;
    return (internalConfigRef && internalConfigRef.getGlobalPrefix()) || '';
}

export const validatePath = (inputPath: string): string =>
    inputPath.charAt(0) !== '/' ? '/' + inputPath : inputPath;

export const setup = (
    path: string,
    app: INestApplication,
    document: any,
    options?: SwaggerOptions,
) => {
    const httpAdapter = app.getHttpAdapter();
    const globalPrefix = getGlobalPrefix(app);
    const finalPath = validatePath(
        options?.useGlobalPrefix &&
            globalPrefix &&
            !globalPrefix.match(/^(\/?)$/)
            ? `${globalPrefix}${validatePath(path)}`
            : path,
    );
    const { koaSwagger }: typeof import('koa2-swagger-ui') = loadPackage(
        'koa2-swagger-ui',
        'SwaggerModule-Koa',
        () => require('koa2-swagger-ui'),
    );

    httpAdapter.getInstance().use(
        koaSwagger({
            routePrefix: finalPath,
            swaggerOptions: {
                spec: document,
                ...options,
            },
        }),
    );
};
