import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { AuditoriasCatalogService } from './auditorias-catalog.service';
import { OccurrenceGenerationService } from './occurrence-generation.service';
import { CreateAuditoriaDto } from './dto/create-auditoria.dto';
import { UpdateAuditoriaDto } from './dto/update-auditoria.dto';

type AuthedRequest = { user: { sub: string; username: string } };

@ApiTags('auditorias')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('auditorias')
export class AuditoriasCatalogController {
  constructor(
    private readonly catalogService: AuditoriasCatalogService,
    private readonly generation: OccurrenceGenerationService,
  ) {}

  @Get()
  list() {
    return this.catalogService.list();
  }

  @Get(':auditoriaId')
  get(@Param('auditoriaId') auditoriaId: string) {
    return this.catalogService.get(auditoriaId);
  }

  @Post()
  create(@Body() dto: CreateAuditoriaDto, @Req() req: AuthedRequest) {
    return this.catalogService.create(dto, { userId: req.user.sub, username: req.user.username });
  }

  @Patch(':auditoriaId')
  update(@Param('auditoriaId') auditoriaId: string, @Body() dto: UpdateAuditoriaDto) {
    return this.catalogService.update(auditoriaId, dto);
  }

  @Post(':auditoriaId/generate-year')
  async generateYear(@Param('auditoriaId') auditoriaId: string, @Query('anio') anio?: string) {
    const targetAnio = anio ? Number(anio) : new Date().getFullYear() + 1;
    if (!Number.isInteger(targetAnio) || targetAnio < 2000 || targetAnio > 2100) {
      throw new BadRequestException('Año inválido');
    }
    await this.catalogService.get(auditoriaId); // 404 si no existe
    return this.generation.generateYearForAuditoria(auditoriaId, targetAnio);
  }
}
