import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EstadoActividad } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface ExportFilters {
  anio: number;
  categoria?: string;
  estado?: EstadoActividad;
}

/** Puente hacia analytics-service (FastAPI/Python): este módulo YA NO genera el
 * Excel/PDF del "Plan de Trabajo" (año en curso) — eso lo hace analytics-service
 * (ver analytics-service/app/plan_trabajo_report.py) — solo valida que la auditoría
 * exista y reenvía la petición con el mismo Bearer token del usuario, que
 * analytics-service confía porque comparte el mismo JWT_SECRET (ver
 * analytics-service/README.md). Mismo patrón que PlanSiguienteAnioService. */
@Injectable()
export class ExportBridgeService {
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('analyticsServiceUrl')!;
  }

  private async forward(path: string, authHeader: string): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, { headers: { Authorization: authHeader } });
    } catch {
      throw new InternalServerErrorException(
        'No se pudo contactar el servicio de analítica (analytics-service). Verificar que esté corriendo en ' + this.baseUrl,
      );
    }
    if (response.status === 404) throw new NotFoundException('La auditoría no existe');
    if (!response.ok) {
      const detail = await response.text();
      throw new InternalServerErrorException(`analytics-service respondió ${response.status}: ${detail}`);
    }
    return response;
  }

  private async fetchArchivo(
    auditoriaId: string,
    tipo: 'excel' | 'pdf',
    filters: ExportFilters,
    authHeader: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const auditoria = await this.prisma.auditoria.findUnique({ where: { id: auditoriaId } });
    if (!auditoria) throw new NotFoundException('Auditoría no encontrada');

    const params = new URLSearchParams({ anio: String(filters.anio) });
    if (filters.categoria) params.set('categoria', filters.categoria);
    if (filters.estado) params.set('estado', filters.estado);

    const response = await this.forward(`/auditorias/${auditoriaId}/export/${tipo}?${params.toString()}`, authHeader);
    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
    const buffer = Buffer.from(await response.arrayBuffer());
    return { buffer, contentType };
  }

  getExcel(auditoriaId: string, filters: ExportFilters, authHeader: string) {
    return this.fetchArchivo(auditoriaId, 'excel', filters, authHeader);
  }

  getPdf(auditoriaId: string, filters: Pick<ExportFilters, 'anio' | 'categoria'>, authHeader: string) {
    return this.fetchArchivo(auditoriaId, 'pdf', filters, authHeader);
  }
}
