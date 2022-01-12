import {
    CallHandler,
    ExecutionContext,
    Inject,
    mixin,
    NestInterceptor,
    Optional,
    Type,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import multer from '@koa/multer';
import { Observable } from 'rxjs';
import { MULTER_MODULE_OPTIONS } from '../files.constants';
import { MulterModuleOptions } from '../interfaces';
import { MulterOptions } from '../interfaces/multer-options.interface';
import { transformException } from '../multer.utils';
import type Koa from 'koa';
import type { Request } from 'koa';

export function FileInterceptor(
    fieldName: string,
    localOptions?: MulterOptions,
): Type<NestInterceptor> {
    class MixinInterceptor implements NestInterceptor {
        protected multer: ReturnType<typeof multer>;

        private koaInstance: Koa;

        constructor(
            private adapterHost: HttpAdapterHost,
            @Optional()
            @Inject(MULTER_MODULE_OPTIONS)
            options: MulterModuleOptions = {},
        ) {
            this.multer = multer({
                ...options,
                ...localOptions,
            });
            this.koaInstance = this.adapterHost.httpAdapter.getInstance<Koa>();
        }

        async intercept(
            context: ExecutionContext,
            next: CallHandler,
        ): Promise<Observable<any>> {
            const ctx = context.switchToHttp();

            await new Promise<void>((resolve, reject) => {
                const call = this.multer
                    .single(fieldName)
                    .bind(this.koaInstance);
                call(ctx.getRequest<Request>().ctx, () => resolve()).catch(
                    (err: Error) => reject(transformException(err)),
                );
            });
            return next.handle();
        }
    }
    const Interceptor = mixin(MixinInterceptor);
    return Interceptor as Type<NestInterceptor>;
}
