import {
    CallHandler,
    createParamDecorator,
    ExecutionContext,
    mixin,
    NestInterceptor,
    Type,
} from '@nestjs/common';
import Busboy, { BusboyConfig } from 'busboy';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { Observable } from 'rxjs';

export type BusBoyFile = {
    filename: string;
    encoding: string;
    mimeType: string;
};

export const UploadedFile = createParamDecorator(
    (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        return request.files[data];
    },
);

export const UploadedFiles = createParamDecorator(
    (_data: void, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        return request.files;
    },
);

export function FileInterceptor(
    dest: string,
    ops: Omit<BusboyConfig, 'headers'> = {},
): Type<NestInterceptor> {
    class MixinInterceptor implements NestInterceptor {
        async intercept(
            context: ExecutionContext,
            next: CallHandler,
        ): Promise<Observable<any>> {
            const ctx = context.switchToHttp();
            const req = ctx.getRequest();
            await new Promise<void>((resolve, reject) => {
                const busboy = Busboy({
                    headers: req.headers,
                    ...ops,
                });

                busboy.on('file', (fieldname, file, filename: BusBoyFile) => {
                    const saveTo = join(dest, filename.filename);
                    file.pipe(createWriteStream(saveTo));
                    if (!req.files) req.files = {};
                    req.files[fieldname] = filename;
                });

                busboy.once('error', reject);

                busboy.on('finish', resolve);

                /* For Koa wrapper */
                if (req.pipe) req.pipe(busboy);
                else req.req.pipe(busboy);
            });
            return next.handle();
        }
    }
    const Interceptor = mixin(MixinInterceptor);
    return Interceptor;
}
