import {
    InternalServerErrorException,
    RequestMethod,
    StreamableFile,
    VersioningType,
} from '@nestjs/common';
import {
    VersioningOptions,
    VersionValue,
    VERSION_NEUTRAL,
} from '@nestjs/common/interfaces';
import { NestApplicationOptions } from '@nestjs/common/interfaces/nest-application-options.interface';
import { isNil, isObject, isString } from '@nestjs/common/utils/shared.utils';
import { AbstractHttpAdapter } from '@nestjs/core/adapters/http-adapter';
import { RouterMethodFactory } from '@nestjs/core/helpers/router-method-factory';
import type { App, Request, Response } from '@tinyhttp/app';
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import sirv, { Options } from 'sirv';
import { importDynamic } from './utils';

export class TinyAdapter extends AbstractHttpAdapter {
    private readonly routerMethodFactory = new RouterMethodFactory();

    constructor(instance: App) {
        super(instance);
    }

    end(response: Response, message?: string) {
        response.end(message);
    }

    isHeadersSent(response: Response): Boolean {
        return response.headersSent;
    }

    public reply(response: Response, body: any, statusCode?: number) {
        if (statusCode) {
            response.status(statusCode);
        }
        if (isNil(body)) {
            return response.end();
        }
        if (body instanceof StreamableFile) {
            const streamHeaders = body.getHeaders();
            if (response.getHeader('Content-Type') === undefined) {
                response.setHeader('Content-Type', streamHeaders.type);
            }
            if (response.getHeader('Content-Disposition') === undefined) {
                response.setHeader(
                    'Content-Disposition',
                    streamHeaders.disposition,
                );
            }
            return body.getStream().pipe(response);
        }
        return isObject(body)
            ? response.json(body)
            : response.send(String(body));
    }

    public status(response: Response, statusCode: number) {
        return response.status(statusCode);
    }

    public render(response: Response, view: string, options: any) {
        return response.render(view, options);
    }

    public redirect(response: Response, statusCode: number, url: string) {
        return response.redirect(url, statusCode);
    }

    public setErrorHandler(handler: Function, prefix?: string) {
        this.getInstance<App>().onError = handler.bind(this.getInstance<App>());
    }

    public setNotFoundHandler(handler: Function, prefix?: string) {
        this.getInstance<App>().noMatchHandler = handler.bind(
            this.getInstance<App>(),
        );
    }

    public setHeader(response: Response, name: string, value: string) {
        return response.set(name, value);
    }

    public listen(port: string | number, callback?: () => void);
    public listen(
        port: string | number,
        hostname: string,
        callback?: () => void,
    );
    public listen(port: any, ...args: any[]) {
        return this.httpServer.listen(port, ...args);
    }

    public close() {
        if (!this.httpServer) {
            return undefined;
        }
        return new Promise((resolve) => this.httpServer.close(resolve));
    }

    public set(...args: any[]) {
        return this.instance.set(...args);
    }

    public enable(...args: any[]) {
        return this.instance.enable(...args);
    }

    public disable(...args: any[]) {
        return this.instance.disable(...args);
    }

    public engine(...args: any[]) {
        return this.instance.engine(...args);
    }

    public useStaticAssets(
        path: string,
        options: Options & { prefix?: string },
    ) {
        if (options && options.prefix) {
            return this.use(options.prefix, sirv(path, options));
        }
        return this.use(sirv(path, options));
    }

    public setBaseViewsDir(path: string | string[]) {
        return this.set('views', path);
    }

    public setViewEngine(engine: string) {
        return this.set('view engine', engine);
    }

    public getRequestHostname(request: Request): string {
        return request.hostname;
    }

    public getRequestMethod(request: Request): string {
        return request.method;
    }

    public getRequestUrl(request: Request): string {
        return request.originalUrl;
    }

    public async enableCors(options: any) {
        const { cors } = (await importDynamic(
            '@tinyhttp/cors',
        )) as typeof import('@tinyhttp/cors');
        return this.use(cors(options));
    }

    public createMiddlewareFactory(
        requestMethod: RequestMethod,
    ): (path: string, callback: Function) => any {
        return this.routerMethodFactory
            .get(this.instance, requestMethod)
            .bind(this.instance);
    }

    public initHttpServer(options: NestApplicationOptions) {
        const isHttpsEnabled = options && options.httpsOptions;
        if (isHttpsEnabled) {
            this.httpServer = createHttpsServer(
                options.httpsOptions,
                this.getInstance<App>().attach.bind(this.getInstance<App>()),
            );
            return;
        }
        this.httpServer = createHttpServer(
            this.getInstance<App>().attach.bind(this.getInstance<App>()),
        );
    }

    public registerParserMiddleware() {}

    public setLocal(key: string, value: any) {
        this.instance.locals[key] = value;
        return this;
    }

    public getType(): string {
        //for compatibillity
        return 'express';
    }

    public applyVersionFilter(
        handler: Function,
        version: VersionValue,
        versioningOptions: VersioningOptions,
    ) {
        return <TRequest extends Record<string, any> = any, TResponse = any>(
            req: TRequest,
            res: TResponse,
            next: () => void,
        ) => {
            if (version === VERSION_NEUTRAL) {
                return handler(req, res, next);
            }
            // URL Versioning is done via the path, so the filter continues forward
            if (versioningOptions.type === VersioningType.URI) {
                return handler(req, res, next);
            }
            // Media Type (Accept Header) Versioning Handler
            if (versioningOptions.type === VersioningType.MEDIA_TYPE) {
                const MEDIA_TYPE_HEADER = 'Accept';
                const acceptHeaderValue: string | undefined =
                    req.headers?.[MEDIA_TYPE_HEADER] ||
                    req.headers?.[MEDIA_TYPE_HEADER.toLowerCase()];

                const acceptHeaderVersionParameter = acceptHeaderValue
                    ? acceptHeaderValue.split(';')[1]
                    : '';

                if (acceptHeaderVersionParameter) {
                    const headerVersion = acceptHeaderVersionParameter.split(
                        versioningOptions.key,
                    )[1];

                    if (Array.isArray(version)) {
                        if (version.includes(headerVersion)) {
                            return handler(req, res, next);
                        }
                    } else if (isString(version)) {
                        if (version === headerVersion) {
                            return handler(req, res, next);
                        }
                    }
                }
            }
            // Header Versioning Handler
            else if (versioningOptions.type === VersioningType.HEADER) {
                const customHeaderVersionParameter: string | undefined =
                    req.headers?.[versioningOptions.header] ||
                    req.headers?.[versioningOptions.header.toLowerCase()];

                if (customHeaderVersionParameter) {
                    if (Array.isArray(version)) {
                        if (version.includes(customHeaderVersionParameter)) {
                            return handler(req, res, next);
                        }
                    } else if (isString(version)) {
                        if (version === customHeaderVersionParameter) {
                            return handler(req, res, next);
                        }
                    }
                }
            }

            if (!next) {
                throw new InternalServerErrorException(
                    'HTTP adapter does not support filtering on version',
                );
            }
            return next();
        };
    }
}
