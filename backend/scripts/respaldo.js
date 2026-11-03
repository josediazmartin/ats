// Copia consistente de la base SQLite (VACUUM INTO) en datos/respaldos/ats2-aaaammdd-hhmm.sqlite.
//   npm run respaldo                 (en Docker: docker compose exec ats2 npm run respaldo)
// Conviene programarlo todos los días y copiar la carpeta de respaldos fuera del servidor.
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { crearAlmacenSql } from '../src/almacen/sql.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(resolve(RAIZ, '.env')); } catch { /* sin .env */ }
const archivo = resolve(RAIZ, process.env.SQLITE_ARCHIVO || 'datos/ats2.sqlite');
const carpeta = resolve(RAIZ, process.env.RESPALDOS_CARPETA || 'datos/respaldos');
const conservar = Number(process.env.RESPALDOS_CONSERVAR || 30);   // cuántos quedan

mkdirSync(carpeta, { recursive: true });
const d = new Date();
const sello = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
const destino = join(carpeta, `ats2-${sello}.sqlite`);
const alm = crearAlmacenSql({ archivo });
alm.respaldar(destino);
alm.cerrar();
console.log(`Respaldo: ${destino} (${(statSync(destino).size / 1024).toFixed(0)} KB)`);

const viejos = readdirSync(carpeta).filter((f) => /^ats2-\d{8}-\d{4}\.sqlite$/.test(f)).sort().reverse().slice(conservar);
for (const f of viejos) { unlinkSync(join(carpeta, f)); console.log(`  borrado ${f}`); }
