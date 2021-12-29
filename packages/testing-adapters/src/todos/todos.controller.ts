import {
    Body,
    ConflictException,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    Post,
} from '@nestjs/common';
import { CreateUserDto } from './create-todo.dto';
import { TodoService } from './todos.service';

@Controller('/todos')
export class TodoController {
    constructor(private readonly todoService: TodoService) {}

    @Get()
    getAll() {
        return this.todoService.getAll();
    }

    @Get(':id')
    getById(@Param('id') id: string) {
        const todo = this.todoService.findById(id);

        if (!todo) throw new NotFoundException();

        return todo;
    }

    @Post()
    create(@Body() body: CreateUserDto) {
        const id = this.getAll().length.toString();
        return this.todoService.create(id, body.title, body.done);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    deleteById(@Param('id') id: string) {
        const todo = this.todoService.deleteById(id);
        if (!todo) throw new NotFoundException();
    }
}
