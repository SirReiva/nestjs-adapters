import {
    BusBoyFile,
    FileInterceptor,
    UploadedFile,
} from '@nestjs-adapters/common';
import {
    Controller,
    Get,
    Post,
    UseInterceptors,
    Version,
} from '@nestjs/common';
import { resolve } from 'path';
import { AppService } from './app.service';

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
    @UseInterceptors(FileInterceptor(resolve(__dirname, '../uploads')))
    file(
        @UploadedFile('file') file: BusBoyFile,
        @UploadedFile('file2') file2: BusBoyFile,
    ) {
        console.log(file);
        console.log(file2);
        return 'ok';
    }
}
