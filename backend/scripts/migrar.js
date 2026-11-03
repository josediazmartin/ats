// Migra las cuatro listas de SharePoint ATSHSS a la base SQLite (única fuente desde nov-2026).
//   npm run migrar -- <carpeta>        carpeta con registros.json, personal.json, tareas.json y personas.json
//   npm run migrar -- <carpeta> --solo-ver   muestra qué haría sin escribir
// Cada JSON puede ser lo que devuelve SharePoint REST (`{ d: { results: [...] } }` o `{ value: [...] }`),
// Microsoft Graph (`{ value: [{ id, fields, createdDateTime }] }`) o una lista simple de ítems.
// Se conserva el ID de SharePoint (sp_id) y la fecha de creación; correrlo dos veces no duplica (clave única).
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { crearAlmacenSql } from '../src/almacen/sql.js';
import { TABLAS } from '../src/almacen/esquema.js';

const ARCHIVOS = { registros: 'registros.json', personal: 'personal.json', tareas: 'tareas.json', personas: 'personas.json' };
const FECHAS_CORTAS = new Set(['FechaAprobacion', 'UltimaRevision']);

/** lista de ítems de cualquiera de los formatos */
export function itemsDe(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.value)) return json.value;
  if (Array.isArray(json?.d?.results)) return json.d.results;
  if (Array.isArray(json?.d)) return json.d;
  throw new Error('No encuentro la lista de ítems en el JSON (esperaba un array, {value:[…]} o {d:{results:[…]}}).');
}

/** { fields, spId, creadoEl, modificadoEl } de un ítem de SharePoint/Graph */
export function normalizar(tabla, item) {
  const origen = item.fields && typeof item.fields === 'object' ? item.fields : item;
  const fields = {};
  for (const c of TABLAS[tabla].columnas) {
    let v = origen[c];
    if (v === undefined && c === 'Title') v = origen.Codigo ?? origen.Documento;   // nombres para mostrar de las listas
    if (v === null || v === undefined) continue;
    if (typeof v === 'object' && !(v instanceof Date)) continue;   // lookups/metadatos de REST
    if (FECHAS_CORTAS.has(c) && typeof v === 'string') { const m = /^(\d{4}-\d{2}-\d{2})/.exec(v); v = m ? m[1] : v; }
    fields[c] = v;
  }
  const spId = Number(item.id ?? item.Id ?? item.ID ?? origen.id ?? origen.Id ?? origen.ID) || null;
  const creadoEl = item.createdDateTime ?? origen.Created ?? origen.createdDateTime ?? undefined;
  const modificadoEl = item.lastModifiedDateTime ?? origen.Modified ?? undefined;
  return { fields, spId, creadoEl, modificadoEl };
}

export function migrarCarpeta(almacen, carpeta, { soloVer = false, log = console.log } = {}) {
  const resumen = {};
  for (const [tabla, nombre] of Object.entries(ARCHIVOS)) {
    const ruta = resolve(carpeta, nombre);
    if (!existsSync(ruta)) { log(`  ${tabla}: sin ${nombre}, se salta`); continue; }
    const items = itemsDe(JSON.parse(readFileSync(ruta, 'utf8')));
    let creados = 0; let actualizados = 0; let sinClave = 0;
    const aplicar = () => {
      for (const it of items) {
        const n = normalizar(tabla, it);
        if (TABLAS[tabla].unica.some((c) => !String(n.fields[c] ?? '').trim())) { sinClave++; continue; }
        if (soloVer) { creados++; continue; }
        const r = almacen.importar(tabla, n.fields, { spId: n.spId, creadoEl: n.creadoEl, modificadoEl: n.modificadoEl });
        if (r.creado) creados++; else actualizados++;
      }
    };
    if (soloVer) aplicar(); else almacen.transaccion(aplicar);
    resumen[tabla] = { leidos: items.length, creados, actualizados, sinClave };
    log(`  ${tabla}: ${items.length} leídos → ${soloVer ? `${creados} se cargarían` : `${creados} nuevos, ${actualizados} actualizados`}${sinClave ? `, ${sinClave} sin clave (saltados)` : ''}`);
  }
  return resumen;
}

const esPrincipal = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) {
  const args = process.argv.slice(2);
  const soloVer = args.includes('--solo-ver');
  const carpeta = args.find((a) => !a.startsWith('--'));
  if (!carpeta) { console.error('Uso: npm run migrar -- <carpeta con registros.json, personal.json, tareas.json, personas.json> [--solo-ver]'); process.exit(2); }
  const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  try { process.loadEnvFile(resolve(RAIZ, '.env')); } catch { /* sin .env */ }
  const archivo = resolve(RAIZ, process.env.SQLITE_ARCHIVO || 'datos/ats2.sqlite');
  console.log(`${soloVer ? 'Simulando' : 'Migrando'} ${resolve(carpeta)} → ${archivo}`);
  const alm = crearAlmacenSql({ archivo });
  migrarCarpeta(alm, resolve(carpeta), { soloVer });
  const c = await alm.conteos();
  console.log(`Base: registros ${c.registros} (ATS ${c.ats}, TTR ${c.ttr}), tareas ${c.tareas}, personas ${c.personas}`);
  alm.cerrar();
}
