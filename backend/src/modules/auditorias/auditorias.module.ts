import { Module } from '@nestjs/common';
import { AuditoriasCatalogController } from './auditorias-catalog.controller';
import { AuditoriasCatalogService } from './auditorias-catalog.service';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { ImportExcelService } from './import-excel.service';
import { OccurrencesController } from './occurrences.controller';
import { OccurrencesService } from './occurrences.service';
import { OccurrenceGenerationService } from './occurrence-generation.service';
import { HistoryService } from './history.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ExportController } from './export.controller';
import { ExportBridgeService } from './export-bridge.service';
import { AuditoriaConfigController } from './config.controller';
import { AuditoriaConfigService } from './config.service';
import { NotificationsService } from './notifications.service';
import { PlanSiguienteAnioController } from './plan-siguiente-anio.controller';
import { PlanSiguienteAnioService } from './plan-siguiente-anio.service';

@Module({
  controllers: [
    AuditoriaConfigController,
    AuditoriasCatalogController,
    ActivitiesController,
    OccurrencesController,
    DashboardController,
    ExportController,
    PlanSiguienteAnioController,
  ],
  providers: [
    AuditoriasCatalogService,
    ActivitiesService,
    ImportExcelService,
    OccurrencesService,
    OccurrenceGenerationService,
    HistoryService,
    DashboardService,
    ExportBridgeService,
    AuditoriaConfigService,
    NotificationsService,
    PlanSiguienteAnioService,
  ],
})
export class AuditoriasModule {}
