import { Controller, Get, Version } from '@nestjs/common';
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
}
