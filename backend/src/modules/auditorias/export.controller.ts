import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EstadoActividad } from '@prisma/client';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { ExportBridgeService } from './export-bridge.service';

type AuthedRequest = Request & { user: { sub: string; username: string } };

/** Descarga el Excel/PDF del "Plan de Trabajo" (año en curso). La generación la hace
 * analytics-service (FastAPI/Python, ver analytics-service/app/plan_trabajo_report.py);
 * este controlador solo valida la auditoría y hace de proxy autenticado (ver
 * ExportBridgeService), igual que plan-siguiente-anio.controller.ts. */
@ApiTags('auditorias')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('auditorias/:auditoriaId/export')
export class ExportController {
  constructor(private readonly bridge: ExportBridgeService) {}

  @Get('excel')
  async excel(
    @Res() res: Response,
    @Param('auditoriaId') auditoriaId: string,
    @Req() req: AuthedRequest,
    @Query('anio') anio?: string,
    @Query('categoria') categoria?: string,
    @Query('estado') estado?: EstadoActividad,
  ) {
    const targetAnio = anio ? Number(anio) : new Date().getFullYear();
    const { buffer, contentType } = await this.bridge.getExcel(
      auditoriaId,
      { anio: targetAnio, categoria, estado },
      req.headers.authorization!,
    );
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="plan-trabajo-${targetAnio}.xlsx"`,
    });
    res.send(buffer);
  }

  @Get('pdf')
  async pdf(
    @Res() res: Response,
    @Param('auditoriaId') auditoriaId: string,
    @Req() req: AuthedRequest,
    @Query('anio') anio?: string,
    @Query('categoria') categoria?: string,
  ) {
    const targetAnio = anio ? Number(anio) : new Date().getFullYear();
    const { buffer, contentType } = await this.bridge.getPdf(
      auditoriaId,
      { anio: targetAnio, categoria },
      req.headers.authorization!,
    );
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="resumen-auditoria-${targetAnio}.pdf"`,
    });
    res.send(buffer);
  }
}
