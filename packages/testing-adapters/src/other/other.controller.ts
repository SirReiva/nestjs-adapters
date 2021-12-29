import { Controller, Get, StreamableFile } from '@nestjs/common';
import { createReadStream } from 'fs';
import { join } from 'path';

@Controller('other')
export class OtherController {
    @Get('video')
    video() {
        const file = createReadStream(
            join(__dirname, '../../assets/video.mp4'),
        );
        return new StreamableFile(file);
    }
}
