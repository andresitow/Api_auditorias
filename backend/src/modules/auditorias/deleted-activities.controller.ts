import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { DeletedActivitiesService } from './deleted-activities.service';

@ApiTags('auditorias')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('auditorias/:auditoriaId/deleted-activities')
export class DeletedActivitiesController {
  constructor(
    private readonly deletedActivitiesService: DeletedActivitiesService,
  ) {}

  @Get()
  list(@Param('auditoriaId') auditoriaId: string) {
    return this.deletedActivitiesService.list(auditoriaId);
  }
}
