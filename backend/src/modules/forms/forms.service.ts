import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDiagnosticFormDto } from './dto/create-diagnostic-form.dto';
import {
  CreateFormOptionDto,
  FormOptionCategory,
} from './dto/create-form-option.dto';

@Injectable()
export class FormsService {
  constructor(private readonly prisma: PrismaService) {}

  createDiagnostic(dto: CreateDiagnosticFormDto, createdBy?: string) {
    return this.prisma.diagnosticForm.create({
      data: {
        sesionTipo: dto.sesionTipo,
        motivo: dto.motivo,
        cliente: dto.cliente,
        nit: dto.nit,
        urlProduccion: dto.urlProduccion,
        urlPruebas: dto.urlPruebas,
        urlPortalIt: dto.urlPortalIt,
        fecha: new Date(dto.fecha),
        sistemaOperativo: dto.sistemaOperativo,
        navegadores: dto.navegadores,
        navegadorOtro: dto.navegadorOtro,
        isp: dto.isp,
        megas: dto.megas,
        oficinas: dto.oficinas as unknown as Prisma.InputJsonValue,
        firewallTiene: dto.firewallTiene,
        firewallNombre: dto.firewallNombre,
        antivirusNombre: dto.antivirusNombre,
        createdBy,
      },
    });
  }

  listDiagnostics() {
    return this.prisma.diagnosticForm.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  getDiagnostic(id: string) {
    return this.prisma.diagnosticForm.findUnique({ where: { id } });
  }

  async listOptions(): Promise<Record<FormOptionCategory, string[]>> {
    const rows = await this.prisma.formOption.findMany();
    const grouped: Record<FormOptionCategory, string[]> = {
      isp: [],
      firewall: [],
      antivirus: [],
    };
    for (const row of rows) {
      grouped[row.category as FormOptionCategory]?.push(row.value);
    }
    return grouped;
  }

  addOption(dto: CreateFormOptionDto) {
    return this.prisma.formOption
      .create({ data: { category: dto.category, value: dto.value } })
      .catch(() => undefined);
  }
}
