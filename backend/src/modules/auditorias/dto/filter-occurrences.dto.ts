import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { EstadoActividad, Frecuencia } from '@prisma/client';

export class FilterOccurrencesDto {
  @ApiPropertyOptional({
    description: 'Año a consultar (por defecto el año actual)',
  })
  @IsOptional()
  @Type(() => Number)
  anio?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoria?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  responsable?: string;

  @ApiPropertyOptional({ enum: EstadoActividad })
  @IsOptional()
  @IsEnum(EstadoActividad)
  estado?: EstadoActividad;

  @ApiPropertyOptional({ enum: Frecuencia })
  @IsOptional()
  @IsEnum(Frecuencia)
  frecuencia?: Frecuencia;

  @ApiPropertyOptional({ description: 'Periodo exacto, ej. 2026-03' })
  @IsOptional()
  @IsString()
  periodo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fechaHasta?: string;

  @ApiPropertyOptional({ description: 'Búsqueda por palabra clave' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Solo actividades vencidas (planeadas con fecha pasada)',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional({ description: 'Solo actividades próximas a vencer' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dueSoon?: boolean;
}
