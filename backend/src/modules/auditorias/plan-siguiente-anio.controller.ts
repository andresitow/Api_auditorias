import { Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { PlanSiguienteAnioService } from './plan-siguiente-anio.service';

type AuthedRequest = Request & { user: { sub: string; username: string } };

/** Genera (vía analytics-service) la propuesta de plan de acción del año siguiente,
 * basada en el análisis del desempeño histórico de la auditoría. El progreso se
 * sigue en vivo por WebSocket directamente contra analytics-service (ver
 * frontend/src/hooks/usePlanAccionJob.ts); este controlador solo arranca el job
 * y sirve de proxy autenticado para el resumen y la descarga de los archivos. */
@ApiTags('auditorias')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('auditorias/:auditoriaId/plan-siguiente-anio')
export class PlanSiguienteAnioController {
  constructor(private readonly service: PlanSiguienteAnioService) {}

  @Post('generar')
  generar(@Param('auditoriaId') auditoriaId: string, @Query('anio') anio: string, @Req() req: AuthedRequest) {
    const targetAnio = anio ? Number(anio) : new Date().getFullYear() + 1;
    return this.service.crearJob(auditoriaId, targetAnio, req.headers.authorization!);
  }

  @Get(':jobId/resumen')
  resumen(@Param('jobId') jobId: string, @Req() req: AuthedRequest) {
    return this.service.getResumen(jobId, req.headers.authorization!);
  }

  @Get(':jobId/excel')
  async excel(@Param('jobId') jobId: string, @Req() req: AuthedRequest, @Res() res: Response) {
    const { buffer, contentType } = await this.service.getArchivo(jobId, 'excel', req.headers.authorization!);
    res.set({ 'Content-Type': contentType, 'Content-Disposition': `attachment; filename="plan-accion.xlsx"` });
    res.send(buffer);
  }

  @Get(':jobId/pdf')
  async pdf(@Param('jobId') jobId: string, @Req() req: AuthedRequest, @Res() res: Response) {
    const { buffer, contentType } = await this.service.getArchivo(jobId, 'pdf', req.headers.authorization!);
    res.set({ 'Content-Type': contentType, 'Content-Disposition': `attachment; filename="plan-accion.pdf"` });
    res.send(buffer);
  }
}
