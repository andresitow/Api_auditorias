import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateOccurrenceDto {
  @ApiProperty({
    description:
      'Id de la actividad (debe ser de frecuencia A_DEMANDA o CUANDO_SE_REQUIERA)',
  })
  @IsString()
  @IsNotEmpty()
  activityId: string;

  @ApiProperty({ example: '2026-08-10' })
  @IsDateString()
  fechaProgramada: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;
}
