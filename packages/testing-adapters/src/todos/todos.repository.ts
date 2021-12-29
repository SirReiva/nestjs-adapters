import { Injectable } from '@nestjs/common';
import { Todo } from './todo.model';

@Injectable()
export class TodoRepository {
    private todos: Todo[];
}
