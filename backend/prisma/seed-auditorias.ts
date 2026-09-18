import { PrismaClient, Frecuencia } from '@prisma/client';

const prisma = new PrismaClient();
const ANIO = 2026;

type Override = { idx: number; estado: 'E' | 'R' | 'N' };

interface ActivitySeed {
  categoria: string;
  nombre: string;
  descripcionEvidencia?: string;
  responsable: string;
  frecuencia: Frecuencia;
  overrides?: Override[];
}

// --- Cálculo de periodos (réplica ligera de src/modules/auditorias/periods.util.ts,
// duplicada aquí a propósito para que este script de siembra no dependa de la
// compilación de src/ y pueda ejecutarse de forma aislada con ts-node). ---
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function lastDayOfMonth(anio: number, monthIndex0: number): Date {
  return new Date(Date.UTC(anio, monthIndex0 + 1, 0));
}
function lastDayOfQuarter(anio: number, q: number): Date {
  return new Date(Date.UTC(anio, q * 3, 0));
}
function lastDayOfSemester(anio: number, s: number): Date {
  return new Date(Date.UTC(anio, s === 1 ? 6 : 12, 0));
}
function weeksOfYear(anio: number): { week: number; fecha: Date }[] {
  const start = new Date(Date.UTC(anio, 0, 1));
  const end = new Date(Date.UTC(anio, 11, 31));
  const weeks: { week: number; fecha: Date }[] = [];
  const cursor = new Date(start);
  let week = 1;
  while (cursor <= end) {
    const weekEnd = new Date(cursor);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 4);
    weeks.push({ week, fecha: weekEnd > end ? end : weekEnd });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
    week += 1;
  }
  return weeks;
}
function periodsForYear(frecuencia: Frecuencia, anio: number): { periodo: string; fechaProgramada: Date }[] {
  switch (frecuencia) {
    case 'DIARIO':
      return weeksOfYear(anio).map(({ week, fecha }) => ({ periodo: `${anio}-W${pad2(week)}`, fechaProgramada: fecha }));
    case 'MENSUAL':
      return Array.from({ length: 12 }, (_, i) => ({ periodo: `${anio}-${pad2(i + 1)}`, fechaProgramada: lastDayOfMonth(anio, i) }));
    case 'TRIMESTRAL':
      return [1, 2, 3, 4].map((q) => ({ periodo: `${anio}-Q${q}`, fechaProgramada: lastDayOfQuarter(anio, q) }));
    case 'SEMESTRAL':
      return [1, 2].map((s) => ({ periodo: `${anio}-S${s}`, fechaProgramada: lastDayOfSemester(anio, s) }));
    case 'ANUAL':
      return [{ periodo: `${anio}`, fechaProgramada: new Date(Date.UTC(anio, 11, 31)) }];
    default:
      return [];
  }
}

const M = Frecuencia.MENSUAL;
const T = Frecuencia.TRIMESTRAL;
const S = Frecuencia.SEMESTRAL;
const A = Frecuencia.ANUAL;
const D = Frecuencia.DIARIO;
const AD = Frecuencia.A_DEMANDA;
const CR = Frecuencia.CUANDO_SE_REQUIERA;

const CAT_SENSIBILIZACION = 'Sensibilización y formación SI';
const CAT_RIESGOS = 'Riesgos y activos de la información';
const CAT_ACCESOS = 'Control de Accesos y contraseñas';
const CAT_PUNTOS_CONTROL = 'Seguimientos como puntos de control';
const CAT_MANTENIMIENTO = 'Mantenimiento de la infraestructura';
const CAT_SWITCHES = 'Switches';
const CAT_SERVIDORES = 'Servidores';

const PAULA_N = 'Paula Neira';
const PAULA_D = 'Paula Donoso';
const PAULA_ND = 'Paula Neira / Paula Donoso';
const TECNICO_INFRA = 'Técnico de infraestructura y redes internas';
const INGENIERO_INFRA = 'Ingeniero de infraestructura y redes internas';
const ANALISTA_SR = 'Analista senior de infraestructura y ciberseguridad';

// Estados transcritos con mejor esfuerzo desde la planilla original (2026-07-22 = fecha
// de referencia: los meses/periodos ya transcurridos están marcados como E/R/N; el resto
// queda en PLANEADO por defecto, que es el valor con el que se generan todas las
// ocurrencias). Cada ocurrencia sembrada queda con transcripcionRevisada=false para que
// el equipo la valide en la aplicación.
const ACTIVITIES: ActivitySeed[] = [
  // Sensibilización y formación SI
  {
    categoria: CAT_SENSIBILIZACION,
    nombre: 'Semana de la seguridad de la información, Ciberseguridad y Protección de Datos Personales',
    descripcionEvidencia: 'Semana de la seguridad',
    responsable: 'En conjunto Sistema de Gestión y Protección de Datos',
    frecuencia: A,
  },
  {
    categoria: CAT_SENSIBILIZACION,
    nombre: 'Actualizar Inducción y ReInducción con las nuevas Políticas de Ciberseguridad (NIST)',
    descripcionEvidencia: 'Inducción y ReInducción',
    responsable: `${PAULA_D} / Seguridad de la información`,
    frecuencia: A,
    overrides: [{ idx: 0, estado: 'R' }],
  },

  // Riesgos y activos de la información
  {
    categoria: CAT_RIESGOS,
    nombre: 'Seguimientos Riesgos de Infraestructura, Ciberseguridad y Bases de Datos',
    descripcionEvidencia: 'Matriz de riesgos',
    responsable: PAULA_N,
    frecuencia: A,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_RIESGOS,
    nombre: 'Seguimiento Activos de información Infraestructura, Ciberseguridad y Bases de Datos',
    descripcionEvidencia: 'Inventario de activos',
    responsable: PAULA_N,
    frecuencia: A,
  },
  {
    categoria: CAT_RIESGOS,
    nombre: 'Participación Comité de Riesgos Sincosoft',
    descripcionEvidencia: 'Reuniones/Comités',
    responsable: PAULA_N,
    frecuencia: T,
    overrides: [{ idx: 0, estado: 'E' }, { idx: 1, estado: 'E' }],
  },

  // Control de Accesos y contraseñas
  {
    categoria: CAT_ACCESOS,
    nombre: 'Seguimiento de matriz control de accesos de usuarios de Infraestructura y Ciberseguridad',
    descripcionEvidencia: 'Matriz de accesos Infraestructura',
    responsable: PAULA_ND,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_ACCESOS,
    nombre: 'Revisión Administración y Accesos ERP',
    descripcionEvidencia: 'Informe',
    responsable: PAULA_ND,
    frecuencia: A,
  },
  {
    categoria: CAT_ACCESOS,
    nombre: 'Seguimiento Accesos usuarios de alto privilegio del Directorio Activo',
    descripcionEvidencia: 'Informe',
    responsable: PAULA_D,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_ACCESOS,
    nombre: 'Validar política de contraseña de acuerdo al procedimiento de Gestión de Usuarios y Contraseñas (Microsoft 365) y directorio activo',
    descripcionEvidencia: 'Informe',
    responsable: PAULA_D,
    frecuencia: A,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_ACCESOS,
    nombre: 'Verificar la autorización del equipo de bases de datos para el acceso a las bases de datos de los clientes en la torre de control',
    descripcionEvidencia: 'Informe',
    responsable: PAULA_N,
    frecuencia: A,
  },

  // Seguimientos como puntos de control
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Control de Accesos Biométricos (Backups)',
    descripcionEvidencia: 'Informe',
    responsable: PAULA_D,
    frecuencia: M,
    overrides: [0, 1, 2, 3, 4, 5].map((idx) => ({ idx, estado: 'E' as const })),
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Punto de Control Licencias de usuarios',
    descripcionEvidencia: 'Informe y Correo',
    responsable: PAULA_ND,
    frecuencia: M,
    overrides: [0, 1, 2, 3, 4, 5, 6].map((idx) => ({ idx, estado: 'E' as const })),
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Punto de Control Traslados de Equipos y Proveedores',
    descripcionEvidencia: 'Informe y Correo',
    responsable: PAULA_ND,
    frecuencia: T,
    overrides: [{ idx: 0, estado: 'E' }, { idx: 1, estado: 'R' }, { idx: 2, estado: 'R' }],
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Punto de Control Físicos y Consumibles',
    descripcionEvidencia: 'Informe y Correo',
    responsable: PAULA_ND,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Punto de control de activos físicos',
    descripcionEvidencia: 'Informe',
    responsable: PAULA_ND,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Seguimiento usuarios activos e inactivos (retiros, ingresos, licencias) en el DA y Microsoft 365',
    descripcionEvidencia: 'Informe',
    responsable: PAULA_ND,
    frecuencia: A,
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Seguimiento Análisis de hallazgos (ERP)',
    descripcionEvidencia: 'Análisis de hallazgos',
    responsable: PAULA_ND,
    frecuencia: AD,
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Revisión MFA activo para todos los usuarios (ERP y Microsoft 365)',
    descripcionEvidencia: 'Acta o Correo',
    responsable: PAULA_N,
    frecuencia: S,
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Validar accesos del personal en vacaciones y/o licencias',
    descripcionEvidencia: 'Correo - Informe',
    responsable: PAULA_D,
    frecuencia: M,
    overrides: [0, 1, 2, 3, 4, 5, 6].map((idx) => ({ idx, estado: 'E' as const })),
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Seguimiento incidentes de seguridad de la información',
    descripcionEvidencia: 'Informe Microsoft 365 Defender y Darktrace',
    responsable: PAULA_D,
    frecuencia: M,
    overrides: [0, 1, 2, 3, 4, 5].map((idx) => ({ idx, estado: 'E' as const })),
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Seguimiento cronograma de mantenimiento',
    descripcionEvidencia: 'Cronograma',
    responsable: PAULA_N,
    frecuencia: M,
    overrides: [0, 1, 2, 3, 4, 5].map((idx) => ({ idx, estado: 'E' as const })),
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Seguimiento al DRP (cronograma y evidencias de pruebas)',
    descripcionEvidencia: 'Cronograma',
    responsable: PAULA_N,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Seguimiento procedimiento de clasificación y etiquetado de la información (SharePoint)',
    descripcionEvidencia: 'Correo',
    responsable: PAULA_N,
    frecuencia: A,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Implementación NIST',
    descripcionEvidencia: 'Plan de Trabajo',
    responsable: PAULA_ND,
    frecuencia: M,
    overrides: [0, 1, 2, 3, 4, 5, 6].map((idx) => ({ idx, estado: 'E' as const })),
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Seguimiento Cronograma NIST',
    descripcionEvidencia: 'Correo',
    responsable: PAULA_N,
    frecuencia: M,
    overrides: [0, 1, 2, 3, 4, 5, 6].map((idx) => ({ idx, estado: 'E' as const })),
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Actualización de Documentación de Infraestructura',
    descripcionEvidencia: 'Documento',
    responsable: PAULA_D,
    frecuencia: CR,
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Diligenciar los indicadores de gestión del SI',
    descripcionEvidencia: 'Indicadores de gestión',
    responsable: PAULA_D,
    frecuencia: M,
    overrides: [0, 1, 2, 3, 4, 5].map((idx) => ({ idx, estado: 'E' as const })),
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Seguimiento de copias de seguridad',
    descripcionEvidencia: 'Acta o e-mail',
    responsable: PAULA_N,
    frecuencia: M,
    overrides: [0, 1, 2, 3, 4, 5].map((idx) => ({ idx, estado: 'E' as const })),
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Seguimiento y Control Restauración de Backups (Discos)',
    descripcionEvidencia: 'Correo',
    responsable: PAULA_D,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Envío de Discos a Backups',
    descripcionEvidencia: 'Correo',
    responsable: PAULA_D,
    frecuencia: A,
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Seguimiento JOBS base de datos',
    descripcionEvidencia: 'Informe',
    responsable: PAULA_N,
    frecuencia: A,
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Seguimiento y control Proyecto Huella de Carbono',
    descripcionEvidencia: 'Correo',
    responsable: PAULA_ND,
    frecuencia: A,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Pruebas de Vulnerabilidad Interna',
    descripcionEvidencia: 'Informe',
    responsable: PAULA_ND,
    frecuencia: A,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Seguimiento Plan de Acción Prueba de Vulnerabilidad Interna',
    descripcionEvidencia: 'Plan de Acción',
    responsable: PAULA_ND,
    frecuencia: A,
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Pruebas de Vulnerabilidad Externa',
    descripcionEvidencia: 'Informe',
    responsable: PAULA_ND,
    frecuencia: A,
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Seguimiento Plan de Acción Prueba de Vulnerabilidad Externa',
    descripcionEvidencia: 'Plan de Acción',
    responsable: PAULA_ND,
    frecuencia: A,
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Seguimiento y Control Eliminación de Clientes en Bases de Datos que finalizan contrato',
    descripcionEvidencia: 'Plan de Acción',
    responsable: PAULA_ND,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'E' }, { idx: 1, estado: 'E' }],
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Proyecto Activación MFA Clientes',
    descripcionEvidencia: 'Seguimiento',
    responsable: PAULA_D,
    frecuencia: M,
    overrides: [0, 1, 2, 3, 4, 5].map((idx) => ({ idx, estado: 'E' as const })),
  },
  {
    categoria: CAT_PUNTOS_CONTROL,
    nombre: 'Seguimiento a los dispositivos finales del usuario (Bitlocker, bloqueo USB, pantalla limpia, antivirus, VPN, respaldo SharePoint, agente Defender, etc.)',
    descripcionEvidencia: 'Informe',
    responsable: PAULA_ND,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'E' }],
  },

  // Mantenimiento de la infraestructura
  {
    categoria: CAT_MANTENIMIENTO,
    nombre: 'Aire Acondicionado',
    descripcionEvidencia: 'Mantenimiento general',
    responsable: TECNICO_INFRA,
    frecuencia: T,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_MANTENIMIENTO,
    nombre: 'Equipos Portátiles (físico y lógico)',
    descripcionEvidencia: 'Limpieza interna, revisión de conexiones, actualización de sistemas operativos (6 meses)',
    responsable: TECNICO_INFRA,
    frecuencia: A,
  },
  {
    categoria: CAT_MANTENIMIENTO,
    nombre: 'Tableros de Distribución eléctrico y tomas eléctricas',
    descripcionEvidencia: 'Verificar ruido o calentamiento en el tablero',
    responsable: ANALISTA_SR,
    frecuencia: A,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_MANTENIMIENTO,
    nombre: 'Access Point Cisco Meraki',
    descripcionEvidencia: 'Update firmware, revisar conexiones, quitar polvo',
    responsable: ANALISTA_SR,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_MANTENIMIENTO,
    nombre: 'UPS',
    descripcionEvidencia: 'El proveedor realiza el mantenimiento físico, se valida correcto arranque y modo UPS',
    responsable: ANALISTA_SR,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_MANTENIMIENTO,
    nombre: 'Data Center',
    descripcionEvidencia: 'Revisión de conexiones eléctricas, revisiones diarias visuales, limpieza y orden',
    responsable: 'Analista de gestión de Infraestructura y Responsable de SST',
    frecuencia: D,
    overrides: Array.from({ length: 29 }, (_, idx) => ({ idx, estado: 'E' as const })),
  },
  {
    categoria: CAT_MANTENIMIENTO,
    nombre: 'Planta Eléctrica Edificio 8111',
    descripcionEvidencia: 'El administrador del edificio programa y ejecuta el mantenimiento',
    responsable: INGENIERO_INFRA,
    frecuencia: A,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_MANTENIMIENTO,
    nombre: 'Planta Eléctrica Artik',
    descripcionEvidencia: 'El administrador del edificio programa y ejecuta el mantenimiento',
    responsable: INGENIERO_INFRA,
    frecuencia: A,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_MANTENIMIENTO,
    nombre: 'Biométricos e imanes de acceso a oficinas, centro de datos y bodegas (lector facial)',
    descripcionEvidencia: 'Validar funcionamiento de biométricos e imanes de acceso',
    responsable: ANALISTA_SR,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_MANTENIMIENTO,
    nombre: 'Tablets (domóticas x4)',
    descripcionEvidencia: 'Validar funcionamiento, daños o desgastes, actualización de sistema',
    responsable: TECNICO_INFRA,
    frecuencia: CR,
  },
  {
    categoria: CAT_MANTENIMIENTO,
    nombre: 'NVR 81-11 / Cámaras de seguridad',
    descripcionEvidencia: 'Actualización de firmware más reciente, limpieza, validación de componentes',
    responsable: ANALISTA_SR,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_MANTENIMIENTO,
    nombre: 'Firewall',
    descripcionEvidencia: 'Actualización de sistema operativo',
    responsable: 'Johan Castillo',
    frecuencia: AD,
  },
  {
    categoria: CAT_MANTENIMIENTO,
    nombre: 'Test de IOS clientes con servicio externo',
    descripcionEvidencia: 'Validar rendimiento del sistema de almacenamiento y capacidad del servidor (lectura/escritura)',
    responsable: ANALISTA_SR,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_MANTENIMIENTO,
    nombre: 'Comunicados para que los clientes revisen su infraestructura',
    descripcionEvidencia: 'Enviar recomendaciones mínimas para el correcto funcionamiento del ERP en su infraestructura',
    responsable: 'Analista de gestión de infraestructura',
    frecuencia: A,
  },

  // Switches
  {
    categoria: CAT_SWITCHES,
    nombre: 'Switches Cisco Red',
    descripcionEvidencia: 'Mantenimiento físico, verificar firmeza de conexiones fibra/RJ45 y deterioro',
    responsable: INGENIERO_INFRA,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'R' }],
  },
  {
    categoria: CAT_SWITCHES,
    nombre: 'Switch Tp-Link',
    descripcionEvidencia: 'Físico, verificar firmeza de conexiones y deterioro',
    responsable: INGENIERO_INFRA,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'N' }],
  },
  {
    categoria: CAT_SWITCHES,
    nombre: 'Switches internos servidores (4 en 81-11 y 6 en Artik)',
    descripcionEvidencia: 'Verificar firmeza de conexiones y deterioro',
    responsable: INGENIERO_INFRA,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'N' }],
  },
  {
    categoria: CAT_SWITCHES,
    nombre: 'Switch Mesas Usuarios',
    descripcionEvidencia: 'Validación de ventiladores, quitar tierra y polvo',
    responsable: ANALISTA_SR,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'E' }],
  },

  // Servidores
  {
    categoria: CAT_SERVIDORES,
    nombre: 'Servidores clientes (host) — físico y update firmware',
    descripcionEvidencia: 'Desmonte de servidores, limpieza de componentes, ajuste en rieles, update firmware BIOS/Xclarity/controladora',
    responsable: INGENIERO_INFRA,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_SERVIDORES,
    nombre: 'Servidores cliente (host) — lógico',
    descripcionEvidencia: 'Update Windows en host',
    responsable: INGENIERO_INFRA,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_SERVIDORES,
    nombre: 'Actualización Servidores clientes (máquinas virtuales)',
    descripcionEvidencia: 'Update Windows en máquinas virtuales',
    responsable: INGENIERO_INFRA,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'E' }],
  },
  {
    categoria: CAT_SERVIDORES,
    nombre: 'Servidores internos — lógico, update firmware y Windows',
    descripcionEvidencia: 'Desmonte de servidores, limpieza de componentes, update firmware y Windows',
    responsable: INGENIERO_INFRA,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'R' }, { idx: 1, estado: 'E' }],
  },
  {
    categoria: CAT_SERVIDORES,
    nombre: 'Servidores internos — físico',
    descripcionEvidencia: 'Desmonte de servidores, limpieza de componentes, ajuste en rieles del rack',
    responsable: INGENIERO_INFRA,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'R' }, { idx: 1, estado: 'R' }],
  },
  {
    categoria: CAT_SERVIDORES,
    nombre: 'Actualización Servidores internos (máquinas virtuales)',
    descripcionEvidencia: 'Update Windows en máquinas virtuales',
    responsable: INGENIERO_INFRA,
    frecuencia: S,
    overrides: [{ idx: 0, estado: 'R' }, { idx: 1, estado: 'E' }],
  },
  {
    categoria: CAT_SERVIDORES,
    nombre: 'Certificados TLS (SincoERP / SincoAcademic)',
    descripcionEvidencia: 'Validar que el certificado esté vigente',
    responsable: 'Analista de base de datos y seguridad',
    frecuencia: A,
    overrides: [{ idx: 0, estado: 'E' }],
  },
];

const AUDITORIA_NOMBRE = 'Plan de Trabajo Infraestructura y Ciberseguridad';

async function main() {
  const auditoria =
    (await prisma.auditoria.findFirst({ where: { nombre: AUDITORIA_NOMBRE } })) ??
    (await prisma.auditoria.create({
      data: {
        nombre: AUDITORIA_NOMBRE,
        descripcion:
          'Cronograma de actividades del Sistema de Gestión de Seguridad de la Información (SGSI) y Ciberseguridad, con seguimiento mensual de cumplimiento.',
      },
    }));
  console.log(`Auditoría lista: ${auditoria.nombre} (${auditoria.id})`);

  let creadas = 0;
  let omitidas = 0;

  for (const seed of ACTIVITIES) {
    const existing = await prisma.activity.findFirst({ where: { auditoriaId: auditoria.id, categoria: seed.categoria, nombre: seed.nombre } });
    if (existing) {
      omitidas += 1;
      continue;
    }

    const activity = await prisma.activity.create({
      data: {
        auditoriaId: auditoria.id,
        categoria: seed.categoria,
        nombre: seed.nombre,
        descripcionEvidencia: seed.descripcionEvidencia,
        responsable: seed.responsable,
        frecuencia: seed.frecuencia,
      },
    });

    const periodos = periodsForYear(seed.frecuencia, ANIO);
    for (let idx = 0; idx < periodos.length; idx++) {
      const { periodo, fechaProgramada } = periodos[idx];
      const override = seed.overrides?.find((o) => o.idx === idx);
      await prisma.activityOccurrence.create({
        data: {
          activityId: activity.id,
          periodo,
          fechaProgramada,
          estado: override ? (override.estado === 'E' ? 'EJECUTADO' : override.estado === 'R' ? 'REPROGRAMADO' : 'NO_REALIZADO') : 'PLANEADO',
          fechaEjecucion: override?.estado === 'E' ? fechaProgramada : null,
          reprogramaciones: override?.estado === 'R' ? 1 : 0,
          observaciones: override ? 'Transcripción automática desde el documento origen (2026-Plan de Trabajo Anual) — verificar.' : null,
          transcripcionRevisada: false,
        },
      });
    }
    creadas += 1;
  }

  await prisma.auditoriaConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  console.log(`Actividades creadas: ${creadas}. Ya existentes (omitidas): ${omitidas}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
