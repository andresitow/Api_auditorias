import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('auditorias')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('auditorias/:auditoriaId/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('kpis')
  kpis(@Param('auditoriaId') auditoriaId: string, @Query('anio') anio?: string, @Query('categoria') categoria?: string) {
    return this.dashboardService.kpis(auditoriaId, anio ? Number(anio) : new Date().getFullYear(), categoria);
  }

  @Get('series')
  series(
    @Param('auditoriaId') auditoriaId: string,
    @Query('anio') anio?: string,
    @Query('groupBy') groupBy?: 'mes' | 'bimestre' | 'trimestre',
    @Query('categoria') categoria?: string,
  ) {
    const normalizedGroupBy = groupBy === 'trimestre' || groupBy === 'bimestre' ? groupBy : 'mes';
    return this.dashboardService.series(auditoriaId, anio ? Number(anio) : new Date().getFullYear(), normalizedGroupBy, categoria);
  }

  @Get('por-categoria')
  porCategoria(@Param('auditoriaId') auditoriaId: string, @Query('anio') anio?: string) {
    return this.dashboardService.porCategoria(auditoriaId, anio ? Number(anio) : new Date().getFullYear());
  }

  @Get('alertas')
  alertas(@Param('auditoriaId') auditoriaId: string) {
    return this.dashboardService.alertas(auditoriaId);
  }
}
