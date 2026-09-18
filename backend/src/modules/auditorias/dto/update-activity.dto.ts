import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { Frecuencia } from '@prisma/client';

export class UpdateActivityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  categoria?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcionEvidencia?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  responsable?: string;

  @ApiPropertyOptional({ enum: Frecuencia })
  @IsOptional()
  @IsEnum(Frecuencia)
  frecuencia?: Frecuencia;

  @ApiPropertyOptional({ description: 'Requerida cuando frecuencia = UNICA', example: '2026-09-15' })
  @ValidateIf((o: UpdateActivityDto) => o.frecuencia === Frecuencia.UNICA)
  @IsDateString()
  @IsNotEmpty()
  fechaEspecifica?: string;

  @ApiPropertyOptional({
    description:
      'Fecha exacta a partir de la cual empiezan a generarse las ocurrencias cuando la programación es por frecuencia (no aplica a UNICA).',
    example: '2026-09-15',
  })
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
