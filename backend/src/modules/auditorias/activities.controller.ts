import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { ActivitiesService } from './activities.service';
import { ImportExcelService } from './import-excel.service';
import { importExcelMulterOptions } from './import-excel-upload.config';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { FilterActivitiesDto } from './dto/filter-activities.dto';

type AuthedRequest = { user: { sub: string; username: string } };

@ApiTags('auditorias')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('auditorias/:auditoriaId/activities')
export class ActivitiesController {
  constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly importExcelService: ImportExcelService,
  ) {}

  @Get()
  list(
    @Param('auditoriaId') auditoriaId: string,
    @Query() filters: FilterActivitiesDto,
  ) {
    return this.activitiesService.list(auditoriaId, filters);
  }

  @Get('categorias')
  categorias(@Param('auditoriaId') auditoriaId: string) {
    return this.activitiesService.distinctCategorias(auditoriaId);
  }

  @Get('import-excel/plantilla')
  async plantilla(@Res() res: Response) {
    const buffer = await this.importExcelService.buildTemplate();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="plantilla-plan-trabajo.xlsx"',
    });
    res.send(buffer);
  }

  @Post('import-excel')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', importExcelMulterOptions))
  importExcel(
    @Param('auditoriaId') auditoriaId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    return this.importExcelService.importFromExcel(auditoriaId, file.buffer, {
      userId: req.user.sub,
      username: req.user.username,
    });
  }

  @Get(':id')
  get(@Param('auditoriaId') auditoriaId: string, @Param('id') id: string) {
    return this.activitiesService.getWithOccurrences(auditoriaId, id);
  }

  @Post()
  create(
    @Param('auditoriaId') auditoriaId: string,
    @Body() dto: CreateActivityDto,
    @Req() req: AuthedRequest,
  ) {
    return this.activitiesService.create(auditoriaId, dto, {
      userId: req.user.sub,
      username: req.user.username,
    });
  }

  @Patch(':id')
  update(
    @Param('auditoriaId') auditoriaId: string,
    @Param('id') id: string,
    @Body() dto: UpdateActivityDto,
    @Req() req: AuthedRequest,
  ) {
    return this.activitiesService.update(auditoriaId, id, dto, {
      userId: req.user.sub,
      username: req.user.username,
    });
  }

  @Delete(':id')
  deactivate(
    @Param('auditoriaId') auditoriaId: string,
    @Param('id') id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.activitiesService.deactivate(auditoriaId, id, {
      userId: req.user.sub,
      username: req.user.username,
    });
  }

  @Post(':id/generate')
  generate(
    @Param('auditoriaId') auditoriaId: string,
    @Param('id') id: string,
    @Query('anio') anio: string,
  ) {
    return this.activitiesService.generateForYear(
      auditoriaId,
      id,
      anio ? Number(anio) : new Date().getFullYear(),
    );
  }
}
