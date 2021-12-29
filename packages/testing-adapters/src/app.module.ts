import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TodoModule } from './todos/todos.module';

@Module({
    imports: [TodoModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
