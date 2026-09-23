import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

/** Puente hacia analytics-service (FastAPI/Python): este módulo no hace análisis de
 * datos ni genera archivos, solo valida que la auditoría exista y reenvía la
 * petición con el mismo Bearer token del usuario — analytics-service confía en ese
 * token porque comparte el mismo JWT_SECRET (ver analytics-service/README.md). */
@Injectable()
export class PlanSiguienteAnioService {
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('analyticsServiceUrl')!;
  }

  private async forward(
    path: string,
    authHeader: string,
    init: RequestInit = {},
  ): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { ...init.headers, Authorization: authHeader },
      });
    } catch {
      throw new InternalServerErrorException(
        'No se pudo contactar el servicio de analítica (analytics-service). Verificar que esté corriendo en ' +
          this.baseUrl,
      );
    }
    if (response.status === 404)
      throw new NotFoundException(
        'El job ya no existe o todavía no termina de generarse',
      );
    return response;
  }

  async crearJob(
    auditoriaId: string,
    anio: number,
    authHeader: string,
  ): Promise<{ jobId: string }> {
    const auditoria = await this.prisma.auditoria.findUnique({
      where: { id: auditoriaId },
    });
    if (!auditoria) throw new NotFoundException('Auditoría no encontrada');

    const response = await this.forward('/jobs', authHeader, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auditoriaId, anio }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new InternalServerErrorException(
        `analytics-service respondió ${response.status}: ${detail}`,
      );
    }
    return response.json() as Promise<{ jobId: string }>;
  }

  async getResumen(jobId: string, authHeader: string): Promise<unknown> {
    const response = await this.forward(`/jobs/${jobId}/resumen`, authHeader);
    return response.json();
  }

  async getArchivo(
    jobId: string,
    tipo: 'excel' | 'pdf',
    authHeader: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const response = await this.forward(`/jobs/${jobId}/${tipo}`, authHeader);
    const contentType =
      response.headers.get('content-type') ?? 'application/octet-stream';
    const buffer = Buffer.from(await response.arrayBuffer());
    return { buffer, contentType };
  }
}
