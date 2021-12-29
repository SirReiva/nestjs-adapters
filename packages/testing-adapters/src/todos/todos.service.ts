import { Injectable } from '@nestjs/common';
import { Todo } from './todo.model';

@Injectable()
export class TodoService {
    private todos: Todo[] = [
        new Todo('0', 'HTML I', true),
        new Todo('1', 'CSS', true),
        new Todo('2', 'Responsive design', true),
        new Todo('3', 'Git', true),
        new Todo('4', 'JavaScript I', true),
        new Todo('5', 'JavaScript II', false),
    ];

    findById(id: string) {
        return this.todos.find((todo) => todo.id === id);
    }

    getAll() {
        return this.todos;
    }

    deleteById(id: string) {
        const todoToDelete = this.todos.find((todo) => todo.id === id);
        if (!todoToDelete) return null;
        this.todos = this.todos.filter((todo) => todo === todoToDelete);
        return todoToDelete;
    }

    update(info: Partial<Omit<Todo, 'id'>>, id: string) {
        const todoToUpdate = this.todos.find((todo) => todo.id === id);
        if (!todoToUpdate) return null;

        if (info.title) todoToUpdate.title = info.title;
        if (info.done) todoToUpdate.done = info.done;

        return todoToUpdate;
    }

    create(id: string, title: string, done: boolean) {
        const todo = new Todo(id, title, done);
        this.todos.push(todo);
        return todo;
    }
}
