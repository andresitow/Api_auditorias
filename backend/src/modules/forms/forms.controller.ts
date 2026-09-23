import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { FormsService } from './forms.service';
import { CreateDiagnosticFormDto } from './dto/create-diagnostic-form.dto';
import { CreateFormOptionDto } from './dto/create-form-option.dto';

@ApiTags('formularios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Post('diagnosticos')
  create(
    @Body() dto: CreateDiagnosticFormDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.formsService.createDiagnostic(dto, req.user.sub);
  }

  @Get('diagnosticos')
  list() {
    return this.formsService.listDiagnostics();
  }

  @Get('diagnosticos/:id')
  get(@Param('id') id: string) {
    return this.formsService.getDiagnostic(id);
  }

  @Get('opciones')
  options() {
    return this.formsService.listOptions();
  }

  @Post('opciones')
  addOption(@Body() dto: CreateFormOptionDto) {
    return this.formsService.addOption(dto);
  }
}
