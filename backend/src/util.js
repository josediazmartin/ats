// Fechas en hora de Argentina (UTC-3 fijo, sin horario de verano) y normalización de documentos.

const TZ = 'America/Argentina/San_Juan';

function partes(fecha) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(fecha));
  return Object.fromEntries(p.map((x) => [x.type, x.value]));
}

/** "2026-11-02" en Argentina */
export function diaAr(fecha) { const p = partes(fecha); return `${p.year}-${p.month}-${p.day}`; }
/** "14:05" en Argentina */
export function horaAr(fecha) { const p = partes(fecha); return `${p.hour}:${p.minute}`; }
/** "2026-11-02 14:05" en Argentina (columna CreadoEnApp, como la app) */
export function fechaHoraAr(fecha) { return `${diaAr(fecha)} ${horaAr(fecha)}`; }
/** "02/11/2026" */
export function ddmmyyyy(dia) { const [y, m, d] = dia.split('-'); return `${d}/${m}/${y}`; }

/** días entre dos días "yyyy-mm-dd" (b - a) */
export function diasEntre(a, b) { return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000); }
export function sumarDias(dia, n) { return new Date(Date.parse(`${dia}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10); }

/** DNI / RUT sin puntos, espacios ni guiones (igual que la app) */
export function normDni(x) { return String(x ?? '').trim().replace(/[.\s-]/g, ''); }

/** PersonalCapacitado de la tarea (";dni;dni;", o con comas, espacios o renglones de cargas viejas) -> lista de DNI */
export function habilitados(texto) {
  return String(texto ?? '').split(/[;,\s]+/).map((x) => x.trim()).filter(Boolean);
}

export const texto = (x) => (x === null || x === undefined ? '' : String(x));
