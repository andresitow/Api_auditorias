import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface PingResult {
  latencyMs: number | null;
  lost: boolean;
  raw: string;
}

function buildArgs(host: string): string[] {
  return process.platform === 'win32'
    ? ['-n', '1', '-w', '3000', host]
    : ['-c', '1', '-W', '3', host];
}

export async function hacerPing(host: string): Promise<PingResult> {
  try {
    const { stdout, stderr } = await execFileAsync('ping', buildArgs(host), { timeout: 5000 });
    const salida = `${stdout}${stderr}`;
    const lineas = salida
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const match = salida.match(/[=<](\d+(?:\.\d+)?)\s*ms/i);
    if (!match) {
      const raw = lineas.find((l) => /tiempo|time|host|request/i.test(l)) ?? 'Sin respuesta';
      return { latencyMs: null, lost: true, raw };
    }
    const raw = lineas.find((l) => /tiempo|time=|bytes/i.test(l)) ?? salida.trim();
    return { latencyMs: parseFloat(match[1]), lost: false, raw };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { latencyMs: null, lost: true, raw: `Error: ${message}` };
  }
}
