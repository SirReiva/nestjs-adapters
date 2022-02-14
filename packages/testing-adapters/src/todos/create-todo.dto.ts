import { IsBoolean, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
    @IsString()
    @MinLength(3)
    @ApiProperty()
    title: string;

    @IsBoolean()
    @ApiProperty()
    done: boolean;
}
