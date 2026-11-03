// Carga las tareas y personas FICTICIAS de datos/demo.json en la base SQLite (para probar en la PC).
//   npm run semilla:demo            (usa SQLITE_ARCHIVO del .env, o datos/ats2.sqlite)
// Nunca correrlo contra la base de producción.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { crearAlmacenSql } from '../src/almacen/sql.js';

/** siembra tareas y personas de un JSON { tareas: [...], personas: [...] } (mismas columnas que SharePoint) */
export function sembrarDemo(almacen, archivoJson) {
  const s = JSON.parse(readFileSync(archivoJson, 'utf8'));
  return almacen.transaccion(() => {
    let n = 0;
    for (const t of s.tareas ?? []) { almacen.importar('tareas', t); n++; }
    for (const p of s.personas ?? []) { almacen.importar('personas', p); n++; }
    return n;
  });
}

const esPrincipal = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) {
  const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  try { process.loadEnvFile(resolve(RAIZ, '.env')); } catch { /* sin .env */ }
  const archivo = resolve(RAIZ, process.env.SQLITE_ARCHIVO || 'datos/ats2.sqlite');
  const alm = crearAlmacenSql({ archivo });
  const n = sembrarDemo(alm, resolve(RAIZ, 'datos/demo.json'));
  const c = await alm.conteos();
  console.log(`${n} filas demo cargadas en ${archivo} → tareas ${c.tareas} (${c.tareasActivas} activas), personas ${c.personas} (${c.personasActivas} activas)`);
  alm.cerrar();
}
