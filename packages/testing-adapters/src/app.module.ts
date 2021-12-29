import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OtherModule } from './other/other.moduler';
import { TodoModule } from './todos/todos.module';

@Module({
    imports: [TodoModule, OtherModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
