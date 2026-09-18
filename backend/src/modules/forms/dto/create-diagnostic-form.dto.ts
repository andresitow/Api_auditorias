import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class ProviderTestDto {
  @ApiPropertyOptional({ example: 92 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  descarga?: number;

  @ApiPropertyOptional({ example: 45 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  carga?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ping?: number;
}

export class OficinaDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  principal: boolean;

  @ApiProperty({ example: 'Bogotá - Sede Principal' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @ApiProperty({ type: ProviderTestDto })
  @ValidateNested()
  @Type(() => ProviderTestDto)
  une: ProviderTestDto;

  @ApiProperty({ type: ProviderTestDto })
  @ValidateNested()
  @Type(() => ProviderTestDto)
  claro: ProviderTestDto;
}

export class CreateDiagnosticFormDto {
  @ApiProperty({ enum: ['Presencial', 'Remoto'] })
  @IsIn(['Presencial', 'Remoto'])
  sesionTipo: string;

  @ApiProperty({ example: 'Diagnóstico y Configuración' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  motivo: string;

  @ApiProperty({ example: 'PROMOTORA BELONG S.A.S' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  cliente: string;

  @ApiProperty({ example: '901652178-8' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  nit: string;

  @ApiProperty({ example: 'https://cliente.sincoerp.com' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  urlProduccion: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  urlPruebas?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  urlPortalIt?: string;

  @ApiProperty({ example: '2026-07-15' })
  @IsDateString()
  fecha: string;

  @ApiProperty({ enum: ['mixto', 'w11'] })
  @IsIn(['mixto', 'w11'])
  sistemaOperativo: string;

  @ApiProperty({ type: [String], example: ['Chrome', 'Edge'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  navegadores: string[];

  @ApiPropertyOptional()
  @ValidateIf((o: CreateDiagnosticFormDto) => o.navegadores?.includes('Otro'))
  @IsString()
  @IsNotEmpty()
  navegadorOtro?: string;

  @ApiProperty({ example: 'Claro' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  isp: string;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  megas: number;

  @ApiProperty({ type: [OficinaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => OficinaDto)
  oficinas: OficinaDto[];

  @ApiProperty({ example: true })
  @IsBoolean()
  firewallTiene: boolean;

  @ApiPropertyOptional()
  @ValidateIf((o: CreateDiagnosticFormDto) => o.firewallTiene === true)
  @IsString()
  @IsNotEmpty()
  firewallNombre?: string;

  @ApiProperty({ example: 'Kaspersky' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  antivirusNombre: string;
}
