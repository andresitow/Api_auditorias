import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateChannelDto {
  @ApiProperty({ example: 'ETB' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  name: string;

  @ApiProperty({ example: '8.8.8.8' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(/^[a-zA-Z0-9.-]+$/, { message: 'Host inválido: solo letras, números, puntos y guiones' })
  host: string;
}
