import type { Options } from '@koa/cors';
import {
    InternalServerErrorException,
    NestMiddleware,
    RequestMethod,
    StreamableFile,
    VersioningType,
} from '@nestjs/common';
import {
    RequestHandler,
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
import { isNil, isObject, isString } from '@nestjs/common/utils/shared.utils';
import { AbstractHttpAdapter } from '@nestjs/core/adapters/http-adapter';
import { RouterMethodFactory } from '@nestjs/core/helpers/router-method-factory';
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import Koa, {
    Context,
    Middleware,
    Next,
    ParameterizedContext,
    Request,
    Response,
} from 'koa';
import koaBodyBarser from 'koa-bodyparser';
import KoaRouter from 'koa-router';
import type { Options as ServeStaticOptions } from 'koa-static';
import type koaViews from 'koa-views';

type ViewsOptions = Exclude<Parameters<typeof koaViews>[1], undefined>;
export interface KoaViewsOptions extends Omit<ViewsOptions, 'autoRender'> {
    viewsDir: string;
}

export type NestKoaFunctionalMiddleware = (
    req: Request,
    res: Response,
    next: Next,
) => Promise<any> | any;

export const koaToNestMiddleware =
    (middleware: Middleware<any, any>): NestKoaFunctionalMiddleware =>
    (req: Request, res: Response, next: Next) =>
        middleware(req.ctx, next);

const nestToKoaMiddleware =
    (middleware: NestMiddleware['use']): Middleware<any, any> =>
    (ctx: Context, next: Next) =>
        middleware(ctx.request, ctx.response, next);

type KoaHandler = RequestHandler<Request, Response>;

export class KoaAdapter extends AbstractHttpAdapter {
    private readonly routerMethodFactory = new RouterMethodFactory();
    private router?: KoaRouter;

    private getRouteAndHandler(
        pathOrHandler: string | KoaHandler,
        handler?: KoaHandler,
    ): [string, KoaHandler] {
        let path = pathOrHandler;

        if (typeof pathOrHandler === 'function') {
            handler = pathOrHandler;
            path = '';
        }

        return [path as string, handler as KoaHandler];
    }

    constructor(instance?: Koa) {
        super(instance || new Koa());
    }

    public reply(response: Response, body: any, statusCode?: number) {
        response.ctx.respond = false;
        if (statusCode) {
            response.status = statusCode;
        }
        if (isNil(body)) {
            return response.res.end();
        }
        if (body instanceof StreamableFile) {
            const streamHeaders = body.getHeaders();
            if (response.res.getHeader('Content-Type') === undefined) {
                response.res.setHeader('Content-Type', streamHeaders.type);
            }
            if (response.res.getHeader('Content-Disposition') === undefined) {
                response.res.setHeader(
                    'Content-Disposition',
                    streamHeaders.disposition,
                );
            }
            return body.getStream().pipe(response.res);
        }
        if (isObject(body)) {
            response.res.setHeader('Content-Type', 'application/json');
            response.res.end(JSON.stringify(body));
            return;
        }
        return response.res.end(String(body));
    }

    public status(response: Response, statusCode: number) {
        response.status = statusCode;
    }

    public async render(
        response: Response,
        view: string,
        options: any,
    ): Promise<void> {
        const body = await response.ctx.render(view, options);

        this.reply(response, body);
    }

    public redirect(response: Response, statusCode: number, url: string) {
        response.status = statusCode;
        response.redirect(url);
    }

    public setErrorHandler(
        handler: (err: Error, ctx: Context) => void,
        prefix?: string,
    ) {
        this.getInstance<Koa>().on('error', handler);
    }

    public setNotFoundHandler(handler: NestMiddleware['use'], prefix?: string) {
        this.getInstance<Koa>().use(nestToKoaMiddleware(handler));
    }

    public setHeader(response: any, name: string, value: string) {
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

    public engine(options: KoaViewsOptions) {
        const viewsMiddleware: typeof import('koa-views') = loadPackage(
            'koa-views',
            'KoaAdapter.setViewEngine()',
        );

        const { viewsDir, ...viewsOptions } = options;

        this.getInstance<Koa>().use(
            viewsMiddleware(viewsDir, { autoRender: false, ...viewsOptions }),
        );
    }

    public useStaticAssets(path: string, options: ServeStaticOptions) {
        const serveStaticMiddleware: typeof import('koa-static') = loadPackage(
            'koa-static',
            'KoaAdapter.useStaticAssets()',
        );

        this.getInstance<Koa>().use(serveStaticMiddleware(path, options));
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

    public enableCors(
        options: CorsOptions | CorsOptionsDelegate<any> | Options,
    ) {
        const corsMiddleware: typeof import('@koa/cors') = loadPackage(
            '@koa/cors',
            'KoaAdapter.enableCors()',
        );

        this.getInstance<Koa>().use(corsMiddleware(options as Options));
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
                this.getInstance<Koa>().callback(),
            );
            return;
        }
        this.httpServer = createHttpServer(this.getInstance<Koa>().callback());
    }

    public registerParserMiddleware(prefix?: string): any {
        this.getRouter().use(koaBodyBarser() as any, async (ctx, next) => {
            // This is because nest expects params in request object so we need to extend it
            Object.assign(ctx.request, { params: ctx.params });
            await next();
        });
    }

    public setLocal(key: string, value: any) {
        this.instance.locals[key] = value;
        return this;
    }

    public getType(): string {
        return 'koa';
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

    private createRouteHandler(routeHandler: KoaHandler) {
        return (ctx: ParameterizedContext<any, any, any>, next: Next) => {
            ctx.respond = false;
            routeHandler(ctx.request, ctx.response, next);
        };
    }

    private getRouter(): KoaRouter {
        if (!this.router) {
            this.router = new KoaRouter();
            this.getInstance<Koa>().use(this.router.routes());
        }

        return this.router;
    }

    public delete(
        pathOrHandler: string | KoaHandler,
        handler?: KoaHandler,
    ): any {
        const [routePath, routeHandler] = this.getRouteAndHandler(
            pathOrHandler,
            handler,
        );

        return this.getRouter().delete(
            routePath,
            this.createRouteHandler(routeHandler),
        );
    }

    public get(pathOrHandler: string | KoaHandler, handler?: KoaHandler): any {
        const [routePath, routeHandler] = this.getRouteAndHandler(
            pathOrHandler,
            handler,
        );

        return this.getRouter().get(
            routePath,
            this.createRouteHandler(routeHandler),
        );
    }

    public head(pathOrHandler: string | KoaHandler, handler?: KoaHandler): any {
        const [routePath, routeHandler] = this.getRouteAndHandler(
            pathOrHandler,
            handler,
        );

        return this.getRouter().head(
            routePath,
            this.createRouteHandler(routeHandler),
        );
    }

    public options(
        pathOrHandler: string | KoaHandler,
        handler?: KoaHandler,
    ): any {
        const [routePath, routeHandler] = this.getRouteAndHandler(
            pathOrHandler,
            handler,
        );

        return this.getRouter().options(
            routePath,
            this.createRouteHandler(routeHandler),
        );
    }

    public patch(
        pathOrHandler: string | KoaHandler,
        handler?: KoaHandler,
    ): any {
        const [routePath, routeHandler] = this.getRouteAndHandler(
            pathOrHandler,
            handler,
        );

        return this.getRouter().patch(
            routePath,
            this.createRouteHandler(routeHandler),
        );
    }

    public post(pathOrHandler: string | KoaHandler, handler?: KoaHandler): any {
        const [routePath, routeHandler] = this.getRouteAndHandler(
            pathOrHandler,
            handler,
        );

        return this.getRouter().post(
            routePath,
            this.createRouteHandler(routeHandler),
        );
    }

    public put(pathOrHandler: string | KoaHandler, handler?: KoaHandler): any {
        const [routePath, routeHandler] = this.getRouteAndHandler(
            pathOrHandler,
            handler,
        );

        return this.getRouter().put(
            routePath,
            this.createRouteHandler(routeHandler),
        );
    }
}
