// Backend de ATS 2.0 web. Única fuente de ATS/TTR: base SQLite (ALMACEN=sqlite, por defecto). También puede
// escribir en SharePoint ATSHSS (ALMACEN=graph) o en un archivo de prueba (ALMACEN=local). Configuración: .env.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { crearApp, VERSION } from './app.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(resolve(RAIZ, '.env')); } catch { /* sin .env: variables del sistema */ }
const env = process.env;

const { app, almacen } = crearApp({ env, RAIZ });
const puerto = Number(env.PORT || env.PUERTO || 3001);   // PORT lo inyectan Railway y otros hostings
app.listen(puerto, () => console.log(`ATS 2.0 backend ${VERSION} en http://localhost:${puerto} · almacén ${almacen.nombre}${almacen.archivo ? ` (${almacen.archivo})` : ''} · identidad ${env.IDENTIDAD || 'dev'}`));

for (const senal of ['SIGINT', 'SIGTERM']) process.on(senal, () => { almacen.cerrar?.(); process.exit(0); });
