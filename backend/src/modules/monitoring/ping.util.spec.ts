const execFileMock = jest.fn();

jest.mock('child_process', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { promisify } = require('util') as typeof import('util');
  const execFile = (() => undefined) as unknown as Record<symbol, unknown>;
  // ping.util.ts hace promisify(execFile): con el símbolo custom devolvemos { stdout, stderr }
  execFile[promisify.custom] = (...args: unknown[]) => execFileMock(...args);
  return { execFile };
});

import { hacerPing } from './ping.util';

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;
function setPlatform(p: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', { value: p });
}

afterEach(() => {
  Object.defineProperty(process, 'platform', originalPlatform);
  execFileMock.mockReset();
});

describe('hacerPing - argumentos según plataforma', () => {
  it('Windows: -n 1 -w 3000 <host>, timeout 5000', async () => {
    setPlatform('win32');
    execFileMock.mockResolvedValue({ stdout: 'time=10ms', stderr: '' });
    await hacerPing('example.com');
    expect(execFileMock).toHaveBeenCalledWith(
      'ping',
      ['-n', '1', '-w', '3000', 'example.com'],
      { timeout: 5000 },
    );
  });

  it('Linux/Mac: -c 1 -W 3 <host>', async () => {
    setPlatform('linux');
    execFileMock.mockResolvedValue({ stdout: 'time=10ms', stderr: '' });
    await hacerPing('example.com');
    expect(execFileMock.mock.calls[0][1]).toEqual(['-c', '1', '-W', '3', 'example.com']);
  });

  it('el host se pasa como argumento separado (sin shell)', async () => {
    setPlatform('linux');
    execFileMock.mockResolvedValue({ stdout: 'time=1ms', stderr: '' });
    await hacerPing('a.com; rm -rf /');
    expect(execFileMock.mock.calls[0][1]).toContain('a.com; rm -rf /');
    expect(execFileMock.mock.calls[0][0]).toBe('ping');
  });
});

describe('hacerPing - interpretación de la salida', () => {
  it.each([
    ['Linux', 'PING x\n64 bytes from 1.2.3.4: icmp_seq=1 ttl=57 time=12.5 ms\n', 12.5],
    ['Windows EN', 'Reply from 1.2.3.4: bytes=32 time=23ms TTL=57', 23],
    ['Windows ES', 'Respuesta desde 1.2.3.4: bytes=32 tiempo=45ms TTL=57', 45],
    ['Windows menor a 1ms', 'Reply from 1.2.3.4: bytes=32 time<1ms TTL=128', 1],
  ])('%s: extrae la latencia', async (_nombre, stdout, esperado) => {
    execFileMock.mockResolvedValue({ stdout, stderr: '' });
    const res = await hacerPing('h');
    expect(res.lost).toBe(false);
    expect(res.latencyMs).toBe(esperado);
  });

  it('raw prioriza la línea con "time=" / "bytes" / "tiempo"', async () => {
    execFileMock.mockResolvedValue({
      stdout: 'Haciendo ping a x\nRespuesta desde 1.1.1.1: bytes=32 tiempo=7ms TTL=50\n',
      stderr: '',
    });
    const res = await hacerPing('h');
    expect(res.raw).toBe('Respuesta desde 1.1.1.1: bytes=32 tiempo=7ms TTL=50');
  });

  it('sin latencia en la salida => perdido, raw con la línea descriptiva', async () => {
    execFileMock.mockResolvedValue({
      stdout: 'Pinging x\nRequest timed out.\n',
      stderr: '',
    });
    const res = await hacerPing('h');
    expect(res).toEqual({
      latencyMs: null,
      lost: true,
      raw: 'Request timed out.',
    });
  });

  it('sin latencia ni líneas reconocibles => "Sin respuesta"', async () => {
    execFileMock.mockResolvedValue({ stdout: '\n\n', stderr: '' });
    const res = await hacerPing('h');
    expect(res).toEqual({ latencyMs: null, lost: true, raw: 'Sin respuesta' });
  });

  it('también inspecciona stderr', async () => {
    execFileMock.mockResolvedValue({ stdout: '', stderr: 'time=3.2 ms' });
    const res = await hacerPing('h');
    expect(res.latencyMs).toBe(3.2);
  });

  it('si el comando falla (ping devuelve exit != 0 / timeout) => perdido con "Error: <mensaje>"', async () => {
    execFileMock.mockRejectedValue(new Error('Command failed'));
    const res = await hacerPing('h');
    expect(res).toEqual({ latencyMs: null, lost: true, raw: 'Error: Command failed' });
  });

  it('rechazo con valor no-Error también se maneja', async () => {
    execFileMock.mockRejectedValue('kaput');
    const res = await hacerPing('h');
    expect(res).toEqual({ latencyMs: null, lost: true, raw: 'Error: kaput' });
  });
});
