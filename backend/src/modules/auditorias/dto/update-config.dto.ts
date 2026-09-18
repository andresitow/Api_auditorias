import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateAuditoriaConfigDto {
  @ApiPropertyOptional({ type: [Number], example: [1, 3, 7] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @Type(() => Number)
  @IsInt({ each: true })
  diasAntes?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sonidoActivo?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  semaforoVerdePct?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  semaforoAmarilloPct?: number;

  @ApiPropertyOptional({ description: 'Activa/desactiva el envío de notificaciones por Teams/correo' })
  @IsOptional()
  @IsBoolean()
  notificacionesActivas?: boolean;

  @ApiPropertyOptional({ description: 'URL del Incoming Webhook del canal de Teams. Vacío para desactivar ese canal.' })
  @IsOptional()
  @IsString()
  teamsWebhookUrl?: string;

  @ApiPropertyOptional({ description: 'Destinatarios de correo separados por coma. Vacío para desactivar ese canal.' })
  @IsOptional()
  @IsString()
  notifEmails?: string;
}
