import { Body, Controller, Get, Param, Patch, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { OccurrencesService } from './occurrences.service';
import { FilterOccurrencesDto } from './dto/filter-occurrences.dto';
import { UpdateOccurrenceEstadoDto } from './dto/update-occurrence-estado.dto';
import { ReprogramOccurrenceDto } from './dto/reprogram-occurrence.dto';
import { EditFechaOccurrenceDto } from './dto/edit-fecha-occurrence.dto';
import { CreateOccurrenceDto } from './dto/create-occurrence.dto';
import { evidenciaImagenMulterOptions, EVIDENCIAS_MAX_COUNT } from './evidencia-upload.config';

type AuthedRequest = { user: { sub: string; username: string } };

@ApiTags('auditorias')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('auditorias/:auditoriaId/occurrences')
export class OccurrencesController {
  constructor(private readonly occurrencesService: OccurrencesService) {}

  @Get()
  list(@Param('auditoriaId') auditoriaId: string, @Query() filters: FilterOccurrencesDto) {
    return this.occurrencesService.list(auditoriaId, filters);
  }

  @Get(':id')
  get(@Param('auditoriaId') auditoriaId: string, @Param('id') id: string) {
    return this.occurrencesService.getDetail(auditoriaId, id);
  }

  @Get(':id/history')
  history(@Param('auditoriaId') auditoriaId: string, @Param('id') id: string) {
    return this.occurrencesService.getHistory(auditoriaId, id);
  }

  @Patch(':id/estado')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('evidencias', EVIDENCIAS_MAX_COUNT, evidenciaImagenMulterOptions))
  changeEstado(
    @Param('auditoriaId') auditoriaId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOccurrenceEstadoDto,
    @Req() req: AuthedRequest,
    @UploadedFiles() evidencias?: Express.Multer.File[],
  ) {
    return this.occurrencesService.changeEstado(auditoriaId, id, dto, { userId: req.user.sub, username: req.user.username }, evidencias);
  }

  @Patch(':id/reprogramar')
  reprogram(
    @Param('auditoriaId') auditoriaId: string,
    @Param('id') id: string,
    @Body() dto: ReprogramOccurrenceDto,
    @Req() req: AuthedRequest,
  ) {
    return this.occurrencesService.reprogram(auditoriaId, id, dto, { userId: req.user.sub, username: req.user.username });
  }

  @Patch(':id/fecha')
  editarFecha(
    @Param('auditoriaId') auditoriaId: string,
    @Param('id') id: string,
    @Body() dto: EditFechaOccurrenceDto,
    @Req() req: AuthedRequest,
  ) {
    return this.occurrencesService.editarFecha(auditoriaId, id, dto, { userId: req.user.sub, username: req.user.username });
  }

  @Post()
  createAdHoc(@Param('auditoriaId') auditoriaId: string, @Body() dto: CreateOccurrenceDto, @Req() req: AuthedRequest) {
    return this.occurrencesService.createAdHoc(auditoriaId, dto, { userId: req.user.sub, username: req.user.username });
  }
}
