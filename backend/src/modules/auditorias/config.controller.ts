import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { AuditoriaConfigService } from './config.service';
import { NotificationsService } from './notifications.service';
import { UpdateAuditoriaConfigDto } from './dto/update-config.dto';

@ApiTags('auditorias')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('auditoria-config')
export class AuditoriaConfigController {
  constructor(
    private readonly configService: AuditoriaConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  get() {
    return this.configService.get();
  }

  @Patch()
  update(@Body() dto: UpdateAuditoriaConfigDto) {
    return this.configService.update(dto);
  }

  @Post('test-notification')
  async testNotification() {
    const cfg = await this.configService.get();
    return this.notificationsService.enviarPrueba(cfg);
  }
}
