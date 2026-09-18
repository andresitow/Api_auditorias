import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { Frecuencia } from '@prisma/client';

export const CATEGORIAS_AUDITORIA = [
  'Sensibilización y formación SI',
  'Riesgos y activos de la información',
  'Control de Accesos y contraseñas',
  'Seguimientos como puntos de control',
  'Mantenimiento de la infraestructura',
  'Switches',
  'Servidores',
  'Otros',
] as const;

export class CreateActivityDto {
  @ApiProperty({ enum: CATEGORIAS_AUDITORIA })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  categoria: string;

  @ApiProperty({ example: 'Seguimiento de copias de seguridad' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  nombre: string;

  @ApiPropertyOptional({ example: 'Acta o e-mail' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcionEvidencia?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacion?: string;

  @ApiProperty({ example: 'Paula Neira / Paula Donoso' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  responsable: string;

  @ApiProperty({ enum: Frecuencia })
  @IsEnum(Frecuencia)
  frecuencia: Frecuencia;

  @ApiPropertyOptional({ description: 'Requerida cuando frecuencia = UNICA', example: '2026-09-15' })
  @ValidateIf((o: CreateActivityDto) => o.frecuencia === Frecuencia.UNICA)
  @IsDateString()
  @IsNotEmpty()
  fechaEspecifica?: string;

  @ApiPropertyOptional({
    description:
      'Fecha exacta a partir de la cual empiezan a generarse las ocurrencias cuando la programación es por frecuencia (no aplica a UNICA). Sin esto, se generan todos los periodos del año en curso, incluidos los ya pasados.',
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
