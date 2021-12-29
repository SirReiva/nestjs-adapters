import { Module } from '@nestjs/common';
import { TodoController } from './todos.controller';
import { TodoRepository } from './todos.repository';
import { TodoService } from './todos.service';

@Module({
    providers: [TodoService, TodoRepository],
    controllers: [TodoController],
})
export class TodoModule {}
