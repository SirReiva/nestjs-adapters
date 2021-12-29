import { IsBoolean, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
    @IsString()
    @MinLength(3)
    title: string;

    @IsBoolean()
    done: boolean;
}
