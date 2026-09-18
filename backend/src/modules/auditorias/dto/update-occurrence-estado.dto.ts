import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { EstadoActividad } from '@prisma/client';

export class UpdateOccurrenceEstadoDto {
  @ApiProperty({ enum: EstadoActividad })
  @IsEnum(EstadoActividad)
  estado: EstadoActividad;

  @ApiPropertyOptional({ description: 'Requerida cuando estado = EJECUTADO' })
  @ValidateIf((o: UpdateOccurrenceEstadoDto) => o.estado === EstadoActividad.EJECUTADO)
  @IsDateString()
  fechaEjecucion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  evidenciaUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  evidenciaDescripcion?: string;

  @ApiPropertyOptional({
    description: 'IDs de archivos de evidencia existentes a eliminar',
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch {
      return [value];
    }
  })
  @IsArray()
  @IsString({ each: true })
  eliminarEvidenciaIds?: string[];
}
