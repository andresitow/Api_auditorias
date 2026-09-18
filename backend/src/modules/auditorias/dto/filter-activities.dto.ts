import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Frecuencia } from '@prisma/client';

export class FilterActivitiesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoria?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  responsable?: string;

  @ApiPropertyOptional({ enum: Frecuencia })
  @IsOptional()
  @IsEnum(Frecuencia)
  frecuencia?: Frecuencia;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activa?: boolean;

  @ApiPropertyOptional({ description: 'Búsqueda por palabra clave en nombre/descripción' })
  @IsOptional()
  @IsString()
  q?: string;
}
