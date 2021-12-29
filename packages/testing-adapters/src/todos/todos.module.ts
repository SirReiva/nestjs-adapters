import { Module } from '@nestjs/common';
import { TodoController } from './todos.controller';
import { TodoService } from './todos.service';

@Module({
    providers: [TodoService],
    controllers: [TodoController],
})
export class TodoModule {}
