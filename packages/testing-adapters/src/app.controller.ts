import { FileInterceptor } from '@nestjs-adapters/koa';
import {
    Controller,
    Get,
    Post,
    UploadedFile,
    UseInterceptors,
    Version,
} from '@nestjs/common';
import { diskStorage } from 'multer';
import { resolve } from 'path';
import { AppService } from './app.service';

export const storage = diskStorage({
    destination: resolve(__dirname, '../uploads'),
    filename: (_req, f, cb) => cb(null, f.originalname),
});

@Controller('resources')
export class AppController {
    constructor(private readonly appService: AppService) {}

    @Get()
    @Version('1')
    getHelloV1(): string {
        return this.appService.getHello() + 'V1';
    }

    @Get()
    @Version('2')
    getHelloV2(): string {
        return this.appService.getHello() + 'V2';
    }

    @Get('object')
    getObject() {
        return this.appService.getObject();
    }

    @Post('/file')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: storage,
            limits: { files: 1, fileSize: 8000000 },
        }),
    )
    file(@UploadedFile('file') file: any) {
        return file;
    }
}
