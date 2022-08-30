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
import {
    CorsOptions,
    CorsOptionsDelegate,
} from '@nestjs/common/interfaces/external/cors-options.interface';
import { NestApplicationOptions } from '@nestjs/common/interfaces/nest-application-options.interface';
import { loadPackage } from '@nestjs/common/utils/load-package.util';
import { isString } from '@nestjs/common/utils/shared.utils';
import { AbstractHttpAdapter } from '@nestjs/core/adapters/http-adapter';
import { RouterMethodFactory } from '@nestjs/core/helpers/router-method-factory';
import { json, urlencoded } from 'body-parser';
// import { createServer as createHttpServer } from 'http';
// import { createServer as createHttpsServer } from 'https';
import restana, {
    ErrorHandler,
    Protocol,
    Request,
    RequestHandler,
    Response,
    Service,
} from 'restana';
import type { ServeStaticOptions } from 'serve-static';
//@ts-ignore
import Server from 'low-http-server';

export class RestanaAdapter<T extends Protocol> extends AbstractHttpAdapter {
    private readonly routerMethodFactory = new RouterMethodFactory();

    private _notFoudHandler: RequestHandler<T> | undefined;
    private _errorFoudHandler: ErrorHandler<T> | undefined;

    constructor() {
        super();
    }

    end(response: Response<T>, message?: string) {
        response.end(message);
    }

    isHeadersSent(response: Response<T>): Boolean {
        return response.headersSent;
    }

    public reply(response: Response<T>, body: any, statusCode?: number) {
        if (body instanceof StreamableFile) {
            const headers = body.getHeaders();
            for (const header in headers) {
                response.setHeader(header, headers[header]);
            }
            return body.getStream().pipe(response);
        }
        return response.send(body, statusCode);
    }

    public status(response: Response<T>, statusCode: number) {
        return (response.statusCode = statusCode);
    }

    public render(_response: Response<T>, view: string, options: any) {
        throw new Error('Not implemented');
    }

    public redirect(response: Response<T>, statusCode: number, url: string) {
        return response
            .writeHead(statusCode, {
                Location: url,
            })
            .end();
    }

    public setErrorHandler(handler: ErrorHandler<T>, prefix?: string) {
        this._errorFoudHandler = handler;
    }

    public setNotFoundHandler(handler: RequestHandler<T>, prefix?: string) {
        this._notFoudHandler = handler;
    }

    public setHeader(response: Response<T>, name: string, value: string) {
        return response.setHeader(name, value);
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
        options: ServeStaticOptions & { prefix?: string },
    ) {
        const files: typeof import('serve-static') = loadPackage(
            'serve-static',
            'RestanaAdapter.useStaticAssets',
        );
        if (options && options.prefix) {
            return this.use(options.prefix, files(path, options));
        }
        return this.use(files(path, options));
    }

    public setBaseViewsDir(path: string | string[]) {
        return this.set('views', path);
    }

    public setViewEngine(engine: string) {
        return this.set('view engine', engine);
    }

    public getRequestHostname(request: Request<T>): string {
        return request.headers.host;
    }

    public getRequestMethod(request: Request<T>): string {
        return request.method;
    }

    public getRequestUrl(request: Request<T>): string {
        return request.originalUrl;
    }

    public async enableCors(options: CorsOptions | CorsOptionsDelegate<any>) {
        const cors: typeof import('cors') = loadPackage(
            'cors',
            'RestanaAdapter.enableCors',
        );
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
        // const isHttpsEnabled = options && options.httpsOptions;
        // if (isHttpsEnabled) {
        //     this.httpServer = createHttpsServer(options.httpsOptions);
        //     return;
        // }
        // this.httpServer = createHttpServer();
        this.httpServer = Server({});
        this.httpServer.address = function () {
            return true;
        };
        this.instance = restana<T>({
            errorHandler: (...args) =>
                this._errorFoudHandler && this._errorFoudHandler(...args),
            defaultRoute: (...args) =>
                this._notFoudHandler && this._notFoudHandler(...args),
            server: this.httpServer,
            prioRequestsProcessing: false,
        });
    }

    public registerParserMiddleware() {
        const instance = this.getInstance<Service<T>>();
        instance.use(json() as any);
        instance.use(urlencoded({ extended: false }) as any);
    }

    public setLocal(key: string, value: any) {
        throw new Error('Not implemented');
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
