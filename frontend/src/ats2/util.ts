import type { Doc, Tipo } from './tipos';

const dos = (n: number) => String(n).padStart(2, '0');

/** hh:mm del teléfono */
export const hhmm = (d: Date = new Date()) => `${dos(d.getHours())}:${dos(d.getMinutes())}`;
/** yyyy-mm-dd del teléfono */
export const yyyymmdd = (d: Date = new Date()) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
/** dd/mm */
export const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
/** dd/mm/aaaa */
export const ddmmaaaa = (d: Date) => `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;
/** dd/mm hh:mm */
export const ddmmHora = (iso: string) => { const d = new Date(iso); return `${dos(d.getDate())}/${dos(d.getMonth() + 1)} ${hhmm(d)}`; };

export function sumarDias(dia: string, n: number) {
  const d = new Date(`${dia}T12:00:00`); d.setDate(d.getDate() + n); return yyyymmdd(d);
}
export function diasEntre(a: string, b: string) {
  return Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);
}

/** día del código ATS-aammdd-hhmm-XXXX ("2026-10-27"), o null si no es un código */
export function diaDeCodigo(codigo: string): string | null {
  const m = /^(?:ATS|TTR)-(\d{2})(\d{2})(\d{2})-(\d{2})(\d{2})-[A-Z0-9]{4}$/.exec(codigo);
  if (!m) return null;
  const dia = `20${m[1]}-${m[2]}-${m[3]}`;
  return Number.isNaN(Date.parse(`${dia}T12:00:00`)) ? null : dia;
}

const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** ATS-aammdd-hhmm-XXXX, igual que la app */
export function nuevoCodigo(tipo: Tipo, d = new Date()) {
  const suf = Array.from({ length: 4 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join('');
  return `${tipo}-${String(d.getFullYear()).slice(2)}${dos(d.getMonth() + 1)}${dos(d.getDate())}-${dos(d.getHours())}${dos(d.getMinutes())}-${suf}`;
}

/** DNI / RUT sin puntos, espacios ni guiones */
export const normDni = (x: string) => x.trim().replace(/[.\s-]/g, '');

/** cambia la posición i de una lista (copia) */
export function conValor<T>(lista: T[], i: number, v: T): T[] { const c = lista.slice(); c[i] = v; return c; }

/** recuerdo de los últimos datos usados (como u_Pais, u_Frente… de la app) */
export type Recuerdo = Partial<Pick<Doc, 'pais' | 'frente' | 'cota' | 'empresa' | 'contratista' | 'duenoArea' | 'radio' | 'supervisor'>>;

export function nuevoDoc(tipo: Tipo, recuerdo: Recuerdo, yoNombre: string): Doc {
  const ahora = new Date();
  const h = ahora.getHours();
  return {
    codigo: nuevoCodigo(tipo, ahora), tipo, estado: 'Borrador', sync: 'pendiente', spId: 0, paso: 1,
    creado: ahora.toISOString(), cerradoEn: '', resultado: '',
    fecha: yyyymmdd(ahora), turno: h >= 7 && h < 19 ? 'Día' : 'Noche', horaIni: hhmm(ahora), inicioTurno: '',
    pais: recuerdo.pais ?? '', frente: recuerdo.frente ?? '', tarea: '', lugar: '', cota: recuerdo.cota ?? '',
    empresa: recuerdo.empresa ?? '', contratista: recuerdo.contratista ?? '', duenoArea: recuerdo.duenoArea ?? '',
    procedimiento: '', iper: '', radio: recuerdo.radio ?? '', supervisor: recuerdo.supervisor || yoNombre,
    firmaSup: '', horaAut: '',
    v360: Array(12).fill(''), noHist: [],
    rf: '', rfSel: [], rfOtro: '', ccv: '',
    r4: Array(16).fill(''), r4c: Array.from({ length: 16 }, () => []), r4Otro: '', r4OtroCtr: '', ctrlAdic: '',
    cierre: Array(9).fill(''), horaFin: '', obsCierre: '', supCierre: '', firmaCierre: '', reconocido: '', motivoRec: '',
    tareaCod: '', enListado: '', atsIni: '', atsIniHora: '', cambios: Array(8).fill(''), areaLimpia: '',
    lat: '', lon: '',
  };
}

export const textoEstado = (d: Pick<Doc, 'estado' | 'tipo'>) => ({
  Borrador: 'En preparación', Abierto: 'Activa · falta cierre', Cerrado: 'Cerrado', Detenido: 'Detenido', 'No aplica': 'No aplica → ATS',
})[d.estado];

/** marca un documento para (re)enviar: el envío solo lo da por enviado si no cambió mientras viajaba */
export const aEnviar = (d: Doc) => ({ sync: 'pendiente' as const, rev: (d.rev ?? 0) + 1 });
