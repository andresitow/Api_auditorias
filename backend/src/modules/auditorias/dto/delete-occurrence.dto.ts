import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DeleteOccurrenceDto {
  @ApiProperty({ example: 'Actividad duplicada, ya se registró en otra fecha' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo: string;
}
