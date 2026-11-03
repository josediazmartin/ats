// Pruebas HTTP de las rutas de gestión (/api/ats/gestion) sobre una base SQLite temporal. npm run probar
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearApp } from '../src/app.js';
import { crearAlmacenSql } from '../src/almacen/sql.js';
import { firmarJwt } from '../src/identidad.js';
import { sembrarDemo } from '../scripts/semilla.js';
import { migrarCarpeta } from '../scripts/migrar.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = mkdtempSync(join(tmpdir(), 'ats2g-'));
const FIRMA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
let ok = 0;
async function caso(nombre, fn) { await fn(); ok++; console.log(`  ✓ ${nombre}`); }

async function levantar(env) {
  const almacen = crearAlmacenSql({ archivo: join(dir, `${Math.random().toString(36).slice(2)}.sqlite`) });
  sembrarDemo(almacen, join(RAIZ, 'datos/demo.json'));
  const { app } = crearApp({ env, RAIZ, almacen });
  const servidor = await new Promise((res) => { const s = app.listen(0, '127.0.0.1', () => res(s)); });
  const base = `http://127.0.0.1:${servidor.address().port}/api/ats`;
  const pedir = async (ruta, init = {}, headers = {}) => {
    const r = await fetch(base + ruta, { ...init, headers: { 'Content-Type': 'application/json', ...headers } });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  return { almacen, servidor, pedir, cerrar: () => { servidor.close(); almacen.cerrar(); } };
}

const hoy = new Date();
const cod = (tipo, suf) => `${tipo}-${String(hoy.getFullYear()).slice(2)}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}-1000-${suf}`;
const ats = (codigo, extra = {}) => ({
  codigo, tipo: 'ATS', estado: 'Abierto', creado: hoy.toISOString(), cerradoEn: '', resultado: '', inicioTurno: 'SI', turno: 'Día', pais: 'Argentina (San Juan)',
  frente: 'Plataforma demo', tarea: 'Prueba gestión', empresa: 'Contratista Demo S.A.', iper: 'SI', supervisor: 'Ruiz, Carlos (demo)', firmaSup: FIRMA, horaAut: '10:05',
  v360: Array(12).fill('S'), noHist: [], rf: 'NO', rfSel: [], r4: Array(16).fill('N'), r4c: Array.from({ length: 16 }, () => []), cierre: Array(9).fill(''), cambios: Array(8).fill(''), ...extra,
});
const persona = (documento, nombre) => ({ nro: 1, documento, nombre, empresa: 'Contratista Demo S.A.', firma: FIRMA, origen: 'Credencial', firmadoEn: hoy.toISOString() });

console.log('ATS 2.0 backend · gestión (HTTP, modo dev)');
const s = await levantar({ IDENTIDAD: 'dev', DEV_USUARIO_EMAIL: 'hss@vicuna.com', DEV_USUARIO_NOMBRE: 'HSS', DEV_USUARIO_GESTION: 'SI' });

await caso('/yo dice gestion: true y /resumen arranca con los datos demo', async () => {
  const yo = await s.pedir('/yo');
  assert.equal(yo.body.gestion, true);
  const r = await s.pedir('/gestion/resumen');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.tareas, { total: 3, activas: 2 });
  assert.deepEqual(r.body.personas, { total: 7, activas: 6 });
  assert.equal(r.body.registros.total, 0);
});

await caso('PUT tarea: crea (201), actualiza (200), valida código y avisa sin habilitados', async () => {
  const c = await s.pedir('/gestion/tareas/tr-g-01', { method: 'PUT', body: JSON.stringify({ tarea: 'Tarea de gestión', area: 'Mina', riesgoFatal: 'Izaje', fechaAprobacion: '28/10/2026', habilitados: ['20.111.222', '20111222', '20333444', '70000001'] }) });
  assert.equal(c.status, 201, JSON.stringify(c.body)); assert.equal(c.body.codigo, 'TR-G-01');
  assert.match(c.body.avisos[0], /1 DNI habilitado\(s\) no está\(n\) en el padrón: 70000001/);
  const lista = await s.pedir('/gestion/tareas');
  const t = lista.body.find((x) => x.codigo === 'TR-G-01');
  assert.deepEqual(t.habilitados, ['20111222', '20333444', '70000001']); assert.equal(t.fechaAprobacion, '2026-10-28'); assert.equal(t.activa, 'SI');
  const u = await s.pedir('/gestion/tareas/TR-G-01', { method: 'PUT', body: JSON.stringify({ tarea: 'Tarea de gestión', activa: 'NO', habilitados: [] }) });
  assert.equal(u.status, 200); assert.equal(u.body.creado, false); assert.match(u.body.avisos[0], /SIN personal habilitado/);
  assert.equal((await s.pedir('/gestion/tareas')).body.find((x) => x.codigo === 'TR-G-01').activa, 'NO');
  const mal = await s.pedir('/gestion/tareas/TR%20MAL', { method: 'PUT', body: JSON.stringify({ tarea: '' }) });
  assert.equal(mal.status, 400); assert.equal(mal.body.errores.length, 2);
  const fecha = await s.pedir('/gestion/tareas/TR-G-02', { method: 'PUT', body: JSON.stringify({ tarea: 'Otra', ultimaRevision: 'ayer' }) });
  assert.equal(fecha.status, 400); assert.match(fecha.body.errores[0], /dd\/mm\/aaaa/);
});

await caso('PUT persona: crea, actualiza solo lo que viene y lista sus tareas', async () => {
  const c = await s.pedir('/gestion/personas/70.000.001', { method: 'PUT', body: JSON.stringify({ nombre: 'Nueva, Persona', activo: 'SI' }) });
  assert.equal(c.status, 201); assert.equal(c.body.documento, '70000001');
  const u = await s.pedir('/gestion/personas/70000001', { method: 'PUT', body: JSON.stringify({ activo: 'NO' }) });
  assert.equal(u.status, 200);
  const p = (await s.pedir('/gestion/personas')).body.find((x) => x.documento === '70000001');
  assert.equal(p.nombre, 'Nueva, Persona'); assert.equal(p.activo, 'NO'); assert.deepEqual(p.tareas, ['TR-G-01'].filter(() => false), 'TR-G-01 quedó sin habilitados');
  const juan = (await s.pedir('/gestion/personas')).body.find((x) => x.documento === '20111222');
  assert.deepEqual(juan.tareas, ['TR-DEMO-01']);
  const mal = await s.pedir('/gestion/personas/12', { method: 'PUT', body: JSON.stringify({ nombre: 'X' }) });
  assert.equal(mal.status, 400); assert.equal(mal.body.errores.length, 2);
});

const A = cod('ATS', 'GEST');
await caso('un ATS enviado aparece en /registros, /registros/:codigo (con firmas) y /validos', async () => {
  const env = await s.pedir('/documentos', { method: 'POST', body: JSON.stringify({ doc: ats(A), personal: [persona('20111222', 'Pérez, Juan (demo)')] }) });
  assert.equal(env.status, 201, JSON.stringify(env.body));
  assert.equal(env.body.url, `/gestion/registros/${A}`);
  const lista = await s.pedir('/gestion/registros?dias=7&tipo=ATS&q=gesti');
  assert.equal(lista.body.length, 1); assert.equal(lista.body[0].codigo, A); assert.equal(lista.body[0].vigente, true); assert.equal(lista.body[0].personasN, 1);
  assert.equal((await s.pedir('/gestion/registros?dias=7&tipo=TTR')).body.length, 0);
  const det = await s.pedir(`/gestion/registros/${A}`);
  assert.equal(det.status, 200); assert.equal(det.body.campos.Title, A); assert.equal(det.body.personal[0].firma, FIRMA); assert.deepEqual(det.body.ttr, []);
  assert.equal((await s.pedir('/gestion/registros/ATS-000000-0000-XXXX')).status, 404);
  const val = await s.pedir('/gestion/validos');
  assert.equal(val.body.ats.length, 1); assert.equal(val.body.ats[0].quedan, 15); assert.equal(val.body.ats[0].ttrN, 0);
  const r = await s.pedir('/gestion/resumen');
  assert.equal(r.body.registros.hoy, 1); assert.equal(r.body.validos, 1); assert.equal(r.body.registros.faltaCierre, 1);
});

await caso('una TTR vinculada suma en ttrN y en el detalle del ATS', async () => {
  const t = await s.pedir('/documentos', { method: 'POST', body: JSON.stringify({ doc: ats(cod('TTR', 'GTTR'), { tipo: 'TTR', inicioTurno: '', tareaCod: 'TR-DEMO-01', enListado: 'SI', atsIni: A, cambios: Array(8).fill('N') }), personal: [persona('20111222', 'Pérez, Juan (demo)')] }) });
  assert.equal(t.status, 201, JSON.stringify(t.body));
  assert.equal((await s.pedir('/gestion/validos')).body.ats[0].ttrN, 1);
  assert.equal((await s.pedir(`/gestion/registros/${A}`)).body.ttr.length, 1);
  assert.equal((await s.pedir('/gestion/registros?dias=0')).body.length, 2);
});

await caso('migrar una carpeta con JSON de SharePoint (REST y Graph) sin duplicar', async () => {
  const carpeta = join(dir, 'sp'); mkdirSync(carpeta);
  writeFileSync(join(carpeta, 'tareas.json'), JSON.stringify({ d: { results: [{ Id: 5, Title: 'TR-SP-1', Tarea: 'De SharePoint', Activa: 'SI', PersonalCapacitado: ';20111222;', FechaAprobacion: '2026-10-28T00:00:00Z', Created: '2026-10-28T12:00:00Z', AuthorId: 7, __metadata: { type: 'x' } }] } }));
  writeFileSync(join(carpeta, 'personas.json'), JSON.stringify({ value: [{ id: '9', createdDateTime: '2026-10-27T10:00:00Z', fields: { Title: '36031940', Nombre: 'Diaz Martin, Jose Maria', Activo: 'SI', Credencial: '2-73-P0000012041' } }] }));
  writeFileSync(join(carpeta, 'registros.json'), JSON.stringify([{ ID: 1, Codigo: 'ATS-261027-1524-G5NY', Tipo: 'ATS', Estado: 'Cerrado', InicioTurno: 'SI', FechaInicio: '2026-10-27T18:24:00Z', AppVersion: 'v6 · 27-oct', PersonasN: 1 }]));
  const r1 = migrarCarpeta(s.almacen, carpeta, { log: () => {} });
  const r2 = migrarCarpeta(s.almacen, carpeta, { log: () => {} });
  assert.equal(r1.tareas.creados, 1); assert.equal(r2.tareas.creados, 0); assert.equal(r2.tareas.actualizados, 1);
  assert.equal(r1.personas.creados, 1); assert.equal(r1.registros.creados, 1); assert.equal(r1.personal, undefined);
  const t = (await s.pedir('/gestion/tareas')).body.find((x) => x.codigo === 'TR-SP-1');
  assert.equal(t.fechaAprobacion, '2026-10-28'); assert.deepEqual(t.habilitados, ['20111222']);
  const g = await s.pedir('/gestion/registros/ATS-261027-1524-G5NY');
  assert.equal(g.body.registro.appVersion, 'v6 · 27-oct'); assert.equal(g.body.registro.personasN, 1);
  const p = await s.almacen.personaPorDocumento('36031940');
  assert.equal(p.spId, 9); assert.equal(p.creadoEl, '2026-10-27T10:00:00Z');
});
await caso('GET /respaldo baja una copia SQLite válida', async () => {
  const r = await fetch(`http://127.0.0.1:${s.servidor.address().port}/api/ats/gestion/respaldo`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-disposition') ?? '', /ats2-\d{8}-\d{4}\.sqlite/);
  const bytes = Buffer.from(await r.arrayBuffer());
  assert.equal(bytes.subarray(0, 15).toString('latin1'), 'SQLite format 3', 'el archivo empieza con la firma de SQLite');
  const copia = join(dir, 'bajada.sqlite'); writeFileSync(copia, bytes);
  const alm2 = crearAlmacenSql({ archivo: copia });
  assert.equal((await alm2.conteos()).registros, 3); alm2.cerrar();
});
s.cerrar();

console.log('ATS 2.0 backend · gestión (prueba publicada con CLAVE_ACCESO)');
const k = await levantar({ IDENTIDAD: 'dev', CLAVE_ACCESO: 'clave-de-prueba' });
await caso('con CLAVE_ACCESO: sin x-ats-acceso → 401; con la clave → 200', async () => {
  const sin = await k.pedir('/yo');
  assert.equal(sin.status, 401); assert.match(sin.body.errores[0], /clave de acceso/);
  assert.equal((await k.pedir('/yo', {}, { 'x-ats-acceso': 'otra' })).status, 401);
  assert.equal((await k.pedir('/yo', {}, { 'x-ats-acceso': 'clave-de-prueba' })).status, 200);
  assert.equal((await k.pedir('/salud')).status, 200, '/salud no pide clave');
});
k.cerrar();

console.log('ATS 2.0 backend · gestión (identidad JWT y proxy)');
const SEC = 'secreto-de-prueba-de-32-caracteres!!';
const j = await levantar({ IDENTIDAD: 'jwt', JWT_SECRETO: SEC, JWT_AUDIENCIA: 'ats2', GESTION_EMAILS: 'hss@vicuna.com, otra@vicuna.com' });
await caso('JWT sin rol y fuera de GESTION_EMAILS → 403; con rol o con el correo → 200; sin token → 401', async () => {
  const sin = await j.pedir('/gestion/resumen', {}, { Authorization: `Bearer ${firmarJwt({ email: 'op@vicuna.com', aud: 'ats2' }, SEC)}` });
  assert.equal(sin.status, 403);
  assert.equal((await j.pedir('/catalogos', {}, { Authorization: `Bearer ${firmarJwt({ email: 'op@vicuna.com', aud: 'ats2' }, SEC)}` })).status, 200, 'el operador sí usa el resto de la API');
  const rol = await j.pedir('/gestion/resumen', {}, { Authorization: `Bearer ${firmarJwt({ email: 'op@vicuna.com', aud: 'ats2', roles: ['ats-gestion'] }, SEC)}` });
  assert.equal(rol.status, 200);
  const correo = await j.pedir('/yo', {}, { Authorization: `Bearer ${firmarJwt({ email: 'HSS@vicuna.com', aud: 'ats2' }, SEC)}` });
  assert.equal(correo.body.gestion, true);
  assert.equal((await j.pedir('/gestion/resumen')).status, 401);
});
j.cerrar();

const p = await levantar({ IDENTIDAD: 'proxy', PROXY_CLAVE: 'clave-proxy' });
await caso('proxy: x-ats-usuario-rol decide la gestión', async () => {
  const h = { 'x-ats-clave': 'clave-proxy', 'x-ats-usuario-email': 'op%40vicuna.com', 'x-ats-usuario-nombre': 'Operador' };
  assert.equal((await p.pedir('/gestion/resumen', {}, h)).status, 403);
  assert.equal((await p.pedir('/gestion/resumen', {}, { ...h, 'x-ats-usuario-rol': 'supervisor,gestion' })).status, 200);
});
p.cerrar();

rmSync(dir, { recursive: true, force: true });
console.log(`${ok} pruebas OK`);
