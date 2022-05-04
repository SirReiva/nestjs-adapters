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
import { Response, Server, Request } from 'hyper-express';
import { parse } from 'content-type';
import type { ServerConstructorOptions } from 'hyper-express/types/components/Server';

export class HyperExpressAdapter extends AbstractHttpAdapter<
    Server,
    Request,
    Response
> {
    constructor(opts?: ServerConstructorOptions) {
        super(new Server(opts));
        this.httpServer = this.instance;
        //@ts-ignore
        this.httpServer.address = function () {};
    }

    private readonly routerMethodFactory = new RouterMethodFactory();

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
            : response.end(String(body));
    }

    public status(response: Response, statusCode: number) {
        return response.status(statusCode);
    }

    public render(response: Response, view: string, options: any) {
        throw Error('Not implemented');
    }

    public redirect(response: Response, statusCode: number, url: string) {
        response.status(statusCode);
        response.redirect(url);
    }

    public setErrorHandler(handler: Function, prefix?: string) {
        this.getInstance<Server>().set_error_handler(
            handler.bind(this.getInstance<Server>()),
        );
    }

    public setNotFoundHandler(handler: Function, prefix?: string) {
        this.getInstance<Server>().set_not_found_handler(
            handler.bind(this.getInstance<Server>()),
        );
    }

    public setHeader(response: Response, name: string, value: string) {
        return response.setHeader(name, value);
    }

    public listen(port: string | number, callback?: () => void);
    public listen(
        port: string | number,
        hostname: string,
        callback?: () => void,
    );
    public listen(port: any, ...args: any[]) {
        //@ts-ignore
        this.httpServer.address = function () {
            return { port: `https://localhost:${port}` };
        };
        return this.httpServer.listen(port, ...args);
    }

    public close() {
        if (!this.httpServer) {
            return undefined;
        }
        return Promise.resolve(this.httpServer.close());
    }

    public set(...args: any[]) {
        throw Error('Not implemented');
    }

    public enable(...args: any[]) {
        throw Error('Not implemented');
    }

    public disable(...args: any[]) {
        throw Error('Not implemented');
    }

    public engine(...args: any[]) {
        throw Error('Not implemented');
    }

    public useStaticAssets(
        path: string,
        // options: Options & { prefix?: string },
    ) {
        // const LiveDirectory = loadPackage(
        //     'LiveDirectory',
        //     'HyperExpressAdapter',
        //     () => require('live-directory'),
        // );
    }

    public setBaseViewsDir(path: string | string[]) {
        throw Error('Not implemented');
    }

    public setViewEngine(engine: string) {
        throw Error('Not implemented');
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

    public async enableCors(options: any) {}

    public createMiddlewareFactory(
        requestMethod: RequestMethod,
    ): (path: string, callback: Function) => any {
        return this.routerMethodFactory
            .get(this.instance, requestMethod)
            .bind(this.instance);
    }

    public initHttpServer(options: NestApplicationOptions) {
        this.httpServer = this.instance = new Server();
    }

    public registerParserMiddleware() {
        this.httpServer.use(async (req, _res, next) => {
            const type = parse(req.header('Content-Type'));
            if (type.type === 'application/json') {
                req.body = await req.json({});
                return next();
            }
            if (type.type === 'text/plain') {
                req.body = await req.text();
                return next();
            }
            if (type.type === 'application/x-www-form-urlencoded') {
                req.body = await req.urlencoded();
                return next();
            }
            if (type.type === 'application/octet-stream') {
                req.body = await req.buffer();
                return next();
            }
        });
    }

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
