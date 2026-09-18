import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class EditFechaOccurrenceDto {
  @ApiProperty({ example: '2026-09-15' })
  @IsDateString()
  fechaProgramada: string;
}
