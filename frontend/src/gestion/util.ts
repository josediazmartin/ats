// Fechas, textos de estado y lectura de las columnas de texto de ATS2 Registros.
import { diasEntre, sumarDias, yyyymmdd } from '../ats2/util';
import { VIGENCIA_ATS_INICIO } from '../ats2/catalogo';
import type { Registro } from './tipos';

const dos = (n: number) => String(n).padStart(2, '0');

export const texto = (x: unknown) => (x === null || x === undefined ? '' : String(x));

/** "dd/mm/aaaa hh:mm" en la hora de la PC */
export function fechaHora(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}
/** "dd/mm/aaaa" */
export function fechaCorta(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;
}
/** "yyyy-mm-dd" del ISO en la hora de la PC */
export const diaLocal = (iso: string) => (iso ? yyyymmdd(new Date(iso)) : '');
export const hoyDia = () => yyyymmdd(new Date());
/** "yyyy-mm-dd" → "dd/mm/aaaa" */
export const ddmmaaaaDeDia = (dia: string) => (dia ? `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}` : '');
/** "dd/mm/aaaa" → "yyyy-mm-dd", o null si no es una fecha */
export function diaDeTexto(t: string): string | null {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(t);
  if (!m) return null;
  const dia = `${m[3]}-${dos(Number(m[2]))}-${dos(Number(m[1]))}`;
  const d = new Date(`${dia}T12:00:00`);
  return Number.isNaN(d.getTime()) || yyyymmdd(d) !== dia ? null : dia;
}
/** "dd/mm hh:mm" de ahora (marca de "actualizado") */
export const marcaAhora = () => { const d = new Date(); return `${dos(d.getDate())}/${dos(d.getMonth() + 1)} ${dos(d.getHours())}:${dos(d.getMinutes())}`; };

/** ATS de inicio de turno autorizado (el que habilita la TTR) */
export const esInicioAutorizado = (r: Pick<Registro, 'tipo' | 'inicioTurno' | 'estado'>) =>
  r.tipo === 'ATS' && r.inicioTurno === 'SI' && (r.estado === 'Abierto' || r.estado === 'Cerrado');
/** hasta cuándo vale (yyyy-mm-dd): lo dice el backend; si no, fecha de inicio + 15 días */
export function valeHastaDe(r: Registro) {
  if (r.valeHasta) return r.valeHasta;
  if (!esInicioAutorizado(r) || !r.fechaInicio) return '';
  return sumarDias(diaLocal(r.fechaInicio), VIGENCIA_ATS_INICIO);
}
export function vigente(r: Registro) {
  const v = valeHastaDe(r);
  if (!v) return false;
  return r.valeHasta && typeof r.vigente === 'boolean' ? r.vigente : v >= hoyDia();
}
export const quedanDias = (r: Registro) => { const v = valeHastaDe(r); return v ? diasEntre(hoyDia(), v) : -1; };
/** columna "Fin / vale hasta" de la tabla */
export function textoFin(r: Registro) {
  if (esInicioAutorizado(r)) return `hasta ${ddmmaaaaDeDia(valeHastaDe(r))}`;
  return r.fechaCierre ? fechaHora(r.fechaCierre) : '-';
}

const TEXTO_ESTADO: Record<string, string> = { Abierto: 'Falta cierre', Cerrado: 'Cerrado', Detenido: 'Detenido', 'No aplica': 'No aplica → ATS', Borrador: 'En preparación' };
export const textoEstado = (e: string) => TEXTO_ESTADO[e] ?? e;
const TEXTO_ESTADO_LARGO: Record<string, string> = { Abierto: 'Autorizado, falta el cierre', Cerrado: 'Cerrado', Detenido: 'Detenido', 'No aplica': 'No aplica → se hizo un ATS 2.0', Borrador: 'En preparación' };
export const textoEstadoLargo = (e: string) => TEXTO_ESTADO_LARGO[e] ?? e;
const CLASE_ESTADO: Record<string, string> = { Abierto: 'abierto', Cerrado: 'cerrado', Detenido: 'detenido', Borrador: 'borrador' };
export const claseEstado = (e: string) => CLASE_ESTADO[e] ?? 'otro';

/** DNI / RUT como lo guarda la app: sin puntos ni espacios, en mayúsculas (la K del RUT) */
export const normDoc = (x: string) => x.trim().toUpperCase().replace(/[.\s]/g, '');

/** búsqueda sin mayúsculas sobre varios campos */
export function coincide(q: string, ...campos: (string | undefined | null)[]) {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return campos.some((c) => (c ?? '').toLowerCase().includes(t));
}

/** "a=b; c=d" → [{k, v}] (CierreChecks, Cambios) */
export function paresIgual(txt: string) {
  return texto(txt).split(';').map((x) => x.trim()).filter(Boolean).map((x) => {
    const i = x.lastIndexOf('=');
    return i < 0 ? { k: x, v: '' } : { k: x.slice(0, i).trim(), v: x.slice(i + 1).trim() };
  });
}
/** "riesgo: 1,11; otro: 3" → [{k, nums}] (RiesgosNoFatales) */
export function paresDosPuntos(txt: string) {
  return texto(txt).split(';').map((x) => x.trim()).filter(Boolean).map((x) => {
    const i = x.lastIndexOf(':');
    const nums = i < 0 ? [] : x.slice(i + 1).split(',').map((n) => Number(n.trim())).filter((n) => n > 0);
    return { k: i < 0 ? x : x.slice(0, i).trim(), nums };
  });
}
/** "1=SI 2=N/A …" → [{n, v}] (Verif360) */
export function lista360(txt: string) {
  return texto(txt).split(/\s+/).filter(Boolean).map((x) => { const [n, v] = x.split('='); return { n, v: v ?? '' }; });
}

export function trozos<T>(lista: T[], n: number): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < lista.length; i += n) r.push(lista.slice(i, i + n));
  return r;
}
