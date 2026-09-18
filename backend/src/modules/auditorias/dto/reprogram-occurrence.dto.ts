import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReprogramOccurrenceDto {
  @ApiProperty({ example: '2026-09-15' })
  @IsDateString()
  nuevaFecha: string;

  @ApiProperty({ example: 'El proveedor reprogramó la visita técnica' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo: string;
}
