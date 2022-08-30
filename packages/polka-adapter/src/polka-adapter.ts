import {
    InternalServerErrorException,
    NestApplicationOptions,
    RequestMethod,
    StreamableFile,
    VersioningOptions,
    VersioningType,
    VERSION_NEUTRAL,
} from '@nestjs/common';
import { VersionValue } from '@nestjs/common/interfaces';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { loadPackage } from '@nestjs/common/utils/load-package.util';
import { isObject, isString } from '@nestjs/common/utils/shared.utils';
import { AbstractHttpAdapter } from '@nestjs/core/adapters/http-adapter';
import { RouterMethodFactory } from '@nestjs/core/helpers/router-method-factory';
import { json, urlencoded } from 'body-parser';
import { createServer as createHttpServer, ServerResponse } from 'http';
import { createServer as createHttpsServer } from 'https';
import polka, { Next, Polka, Request } from 'polka';
import type { Options as SirvOptions } from 'sirv';

export interface SirvNestOptions extends SirvOptions {
    prefix?: string;
}

interface ExtendedResponse extends ServerResponse {
    code?: number;
}

export class PolkaAdapter extends AbstractHttpAdapter {
    private readonly routerMethodFactory = new RouterMethodFactory();

    private _notFoudHandler: Function | undefined;
    private _errorFoudHandler: Function | undefined;

    constructor() {
        super(
            polka({
                onNoMatch: (req: Request, res: ServerResponse) =>
                    this._notFoudHandler && this._notFoudHandler(req, res),
                onError: (
                    err: Error,
                    req: Request,
                    res: ServerResponse,
                    next: Next,
                ) =>
                    this._notFoudHandler &&
                    this._errorFoudHandler(err, req, res, next),
            }),
        );
    }

    end(response: ExtendedResponse, message?: string) {
        response.end(message);
    }

    isHeadersSent(response: ExtendedResponse): Boolean {
        return response.headersSent;
    }

    reply(response: ExtendedResponse, body: any, statusCode?: number) {
        const status = statusCode || response.code;
        if (body instanceof StreamableFile) {
            response.writeHead(status || 206, body.getHeaders());
            return body.getStream().pipe(response);
        }

        if (isObject(body)) {
            const data = JSON.stringify(body);
            return response
                .writeHead(status || 200, {
                    'content-type': 'application/json;charset=utf-8',
                    'content-length': Buffer.byteLength(data),
                })
                .end(data);
        }
        if (body instanceof Buffer) {
            return response
                .writeHead(status || 200, {
                    'content-type': 'application/json;charset=utf-8',
                    'content-length': Buffer.byteLength(body.toString()),
                })
                .end(body);
        }

        return response
            .writeHead(status || 200, {
                'content-type': 'text/plain',
                'content-length': Buffer.byteLength(body || ''),
            })
            .end(body);
    }

    close(): Promise<void> {
        if (!this.httpServer) {
            return undefined;
        }

        return new Promise((resolve) => this.httpServer.close(resolve));
    }

    initHttpServer(options: NestApplicationOptions) {
        const isHttpsEnabled = options.httpsOptions;
        if (isHttpsEnabled) {
            this.httpServer = createHttpsServer(
                options.httpsOptions,
                this.getInstance<Polka>().handler.bind(
                    this.getInstance<Polka>(),
                ),
            );
            return;
        }
        this.httpServer = createHttpServer(
            this.getInstance<Polka>().handler.bind(this.getInstance<Polka>()),
        );

        this.getInstance<Polka>().server = this.httpServer;
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

    useStaticAssets(path: string, options: SirvNestOptions) {
        const sirv: typeof import('sirv').default = loadPackage(
            'sirv',
            'PolkaAdapter.useStaticAssets',
        );
        const serve = sirv(path, options);
        if (options?.prefix) {
            return this.use(options.prefix, serve);
        }

        return this.use(serve);
    }

    setViewEngine(_engine: string) {
        throw new Error('Method not implemented.');
    }

    getRequestHostname(req: Request) {
        return req.headers.x_forwarded_host ?? req.headers.host;
    }

    getRequestMethod(request: Request) {
        return request.method;
    }

    getRequestUrl(request: Request) {
        return request.url;
    }

    status(response: ExtendedResponse, statusCode: number) {
        response.code = statusCode;
    }

    render(response: ServerResponse, view: string, options: any) {
        throw new Error('Method not implemented.');
    }

    redirect(response: ServerResponse, statusCode: number, url: string) {
        response.statusCode = statusCode;
        response.setHeader('Location', url);
        response.end();
    }

    setErrorHandler(handler: Function, prefix?: string) {
        this._errorFoudHandler = handler;
    }

    setNotFoundHandler(handler: Function, prefix?: string) {
        this._notFoudHandler = handler;
    }

    setHeader(response: ServerResponse, name: string, value: string) {
        response.setHeader(name, value);
    }

    registerParserMiddleware(prefix?: string) {
        if (prefix) {
            this.use(prefix, json());
            this.use(prefix, urlencoded({ extended: true }));
            return;
        }
        this.use(json());
        this.use(urlencoded({ extended: true }));
    }

    enableCors(options: CorsOptions, prefix?: string) {
        const cors: typeof import('cors') = loadPackage(
            'cors',
            'PolkaAdapter.enableCors',
        );
        let mw = cors(options);
        if (prefix) {
            return this.use(prefix, mw);
        }
        return this.use(mw);
    }

    createMiddlewareFactory(
        requestMethod: RequestMethod,
    ): (path: string, callback: Function) => any {
        return this.routerMethodFactory
            .get(this.instance, requestMethod)
            .bind(this.instance);
    }

    getType(): string {
        return 'polka';
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
