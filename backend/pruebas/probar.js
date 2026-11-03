// Pruebas de las reglas del backend, corridas dos veces: contra el almacén SQLite (archivo temporal) y contra el
// almacén local (JSON temporal). npm run probar
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearAlmacenLocal } from '../src/almacen/local.js';
import { crearAlmacenSql } from '../src/almacen/sql.js';
import { guardarDocumento, atsInicioVigentes } from '../src/documentos.js';
import { firmarJwt, verificarJwt, tieneRolGestion } from '../src/identidad.js';
import { sembrarDemo } from '../scripts/semilla.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const yo = { email: 'prueba@vicuna.com', nombre: 'Prueba' };
const V = 'Web v2 · prueba';
const FIRMA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
let ok = 0;
async function caso(nombre, fn) { await fn(); ok++; console.log(`  ✓ ${nombre}`); }

const hace = (dias) => { const d = new Date(); d.setDate(d.getDate() - dias); return d; };
const cod = (tipo, d, suf) => `${tipo}-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-1000-${suf}`;
function ats(codigo, creado, extra = {}) {
  return {
    codigo, tipo: 'ATS', estado: 'Abierto', creado: creado.toISOString(), cerradoEn: '', resultado: '', inicioTurno: 'SI', turno: 'Día', pais: 'Argentina (San Juan)',
    frente: 'Plataforma demo', tarea: 'Prueba', empresa: 'Contratista Demo S.A.', iper: 'SI', supervisor: 'Ruiz, Carlos (demo)', firmaSup: FIRMA, horaAut: '10:05',
    v360: Array(12).fill('S'), noHist: [], rf: 'NO', rfSel: [], r4: Array(16).fill('N'), r4c: Array.from({ length: 16 }, () => []), cierre: Array(9).fill(''),
    cambios: Array(8).fill(''), ...extra,
  };
}
function ttr(codigo, creado, atsIni, extra = {}) {
  return ats(codigo, creado, { tipo: 'TTR', inicioTurno: '', tareaCod: 'TR-DEMO-01', enListado: 'SI', atsIni, cambios: Array(8).fill('N'), ...extra });
}
const persona = (documento, nombre, nro = 1) => ({ nro, documento, nombre, empresa: 'Contratista Demo S.A.', firma: FIRMA, origen: 'Credencial', firmadoEn: new Date().toISOString() });

async function reglas(alm) {
  const hoy = new Date();
  const A1 = cod('ATS', hace(2), 'AAAA');

  await caso('ATS nuevo autorizado → 201 con PersonasN', async () => {
    const r = await guardarDocumento(alm, yo, { doc: ats(A1, hace(2)), personal: [persona('20111222', 'Pérez, Juan (demo)')] }, V);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.url, alm.urlRegistro(r.body.id, A1));
    const reg = await alm.registroPorCodigo(A1);
    assert.equal(reg.fields.PersonasN, 1);
    assert.equal(reg.fields.CreadoPorEmail, 'prueba@vicuna.com');
    assert.equal(reg.fields.Verif360, '1=SI 2=SI 3=SI 4=SI 5=SI 6=SI 7=SI 8=SI 9=SI 10=SI 11=SI 12=SI');
    assert.equal(reg.fields.FechaCierre ?? '', '', 'un abierto no tiene fecha de cierre');
  });

  await caso('reenvío con una firma nueva → 200, agrega solo la nueva', async () => {
    const r = await guardarDocumento(alm, { email: 'otro@vicuna.com', nombre: 'Otro' }, { doc: ats(A1, hace(2)), personal: [persona('20111222', 'Pérez, Juan (demo)'), persona('20333444', 'Gómez, Ana (demo)', 2)] }, V);
    assert.equal(r.status, 200); assert.equal(r.body.personasAgregadas, 1); assert.equal(r.body.personasTotal, 2);
    assert.equal((await alm.registroPorCodigo(A1)).fields.CreadoPorEmail, 'prueba@vicuna.com', 'no pisa quién lo creó');
    assert.deepEqual((await alm.personalDe(A1)).map((p) => p.fields.Nro), [1, 2]);
  });

  await caso('cierre sin firma de cierre → 400 con el motivo', async () => {
    const r = await guardarDocumento(alm, yo, { doc: ats(A1, hace(2), { estado: 'Cerrado', cerradoEn: hoy.toISOString(), cierre: Array(9).fill('S'), horaFin: '18:00', supCierre: 'Ruiz' }) }, V);
    assert.equal(r.status, 400); assert.match(r.body.errores.join(' '), /firma del supervisor que cierra/);
  });

  await caso('código cargado desde la app de Power Apps → 409', async () => {
    const c = cod('ATS', hoy, 'APPX');
    await alm.crearRegistro({ Title: c, Tipo: 'ATS', Estado: 'Abierto', AppVersion: 'v17 · 30-oct', InicioTurno: 'SI', FechaInicio: hoy.toISOString() });
    const r = await guardarDocumento(alm, yo, { doc: ats(c, hoy), personal: [persona('20111222', 'Pérez')] }, V);
    assert.equal(r.status, 409);
  });

  await caso('TTR válida (ATS de inicio de hace 2 días) → 201', async () => {
    const r = await guardarDocumento(alm, yo, { doc: ttr(cod('TTR', hoy, 'TTR1'), hoy, A1), personal: [persona('20111222', 'Pérez, Juan (demo)')] }, V);
    assert.equal(r.status, 201, JSON.stringify(r.body)); assert.deepEqual(r.body.avisos, []);
  });

  await caso('TTR con un DNI no habilitado → 400', async () => {
    const r = await guardarDocumento(alm, yo, { doc: ttr(cod('TTR', hoy, 'TTR2'), hoy, A1), personal: [persona('12345678', 'Díaz, Laura (demo)')] }, V);
    assert.equal(r.status, 400); assert.match(r.body.errores[0], /no está habilitado para la tarea TR-DEMO-01/);
  });

  await caso('TTR con ATS de inicio de hace 16 días → 400 vencido', async () => {
    const viejo = cod('ATS', hace(16), 'VIEJ');
    await guardarDocumento(alm, yo, { doc: ats(viejo, hace(16)), personal: [persona('20111222', 'Pérez')] }, V);
    const r = await guardarDocumento(alm, yo, { doc: ttr(cod('TTR', hoy, 'TTR3'), hoy, viejo), personal: [persona('20111222', 'Pérez')] }, V);
    assert.equal(r.status, 400); assert.match(r.body.errores[0], /vale hasta el/);
    assert.ok(!(await atsInicioVigentes(alm)).some((a) => a.codigo === viejo), 'el vencido no se ofrece para vincular');
  });

  await caso('TTR con un ATS que no es de inicio de turno → 400', async () => {
    const noIni = cod('ATS', hoy, 'NOIN');
    await guardarDocumento(alm, yo, { doc: ats(noIni, hoy, { inicioTurno: 'NO' }), personal: [persona('20111222', 'Pérez')] }, V);
    const r = await guardarDocumento(alm, yo, { doc: ttr(cod('TTR', hoy, 'TTR4'), hoy, noIni), personal: [persona('20111222', 'Pérez')] }, V);
    assert.equal(r.status, 400); assert.match(r.body.errores[0], /no es un ATS 2.0 de inicio de turno/);
  });

  await caso('TTR con un ATS de inicio que todavía no llegó → 201 con aviso (como la app)', async () => {
    const r = await guardarDocumento(alm, yo, { doc: ttr(cod('TTR', hoy, 'TTR5'), hoy, cod('ATS', hoy, 'ZZZZ')), personal: [persona('20111222', 'Pérez')] }, V);
    assert.equal(r.status, 201); assert.match(r.body.avisos[0], /todavía no está/);
  });

  await caso('firma que no es imagen y DNI repetido → 400 con todos los motivos', async () => {
    const r = await guardarDocumento(alm, yo, { doc: ats(cod('ATS', hoy, 'MALA'), hoy), personal: [persona('20111222', 'Pérez'), { ...persona('20111222', 'Pérez', 2), firma: 'hola' }] }, V);
    assert.equal(r.status, 400); assert.equal(r.body.errores.length, 2);
  });

  await caso('cerrado no vuelve a abierto → 409', async () => {
    const c = cod('ATS', hoy, 'CERR');
    const cerrado = ats(c, hoy, { estado: 'Cerrado', cerradoEn: hoy.toISOString(), cierre: Array(9).fill('S'), horaFin: '18:00', supCierre: 'Ruiz', firmaCierre: FIRMA });
    assert.equal((await guardarDocumento(alm, yo, { doc: cerrado, personal: [persona('20111222', 'Pérez')] }, V)).status, 201);
    assert.equal((await guardarDocumento(alm, yo, { doc: ats(c, hoy), personal: [] }, V)).status, 409);
  });

  await caso('código mal formado y borrador → 400', async () => {
    const r = await guardarDocumento(alm, yo, { doc: { ...ats('ATS-1', hoy), estado: 'Borrador' } }, V);
    assert.equal(r.status, 400); assert.equal(r.body.errores.length, 2);
  });

  await caso('dos envíos simultáneos del mismo código nuevo → un solo registro', async () => {
    const c = cod('ATS', hoy, 'DOBL');
    const body = { doc: ats(c, hoy), personal: [persona('20111222', 'Pérez')] };
    const [a, b] = await Promise.all([guardarDocumento(alm, yo, body, V), guardarDocumento(alm, yo, body, V)]);
    assert.deepEqual([a.status, b.status].sort(), [200, 201]);
    assert.equal((await alm.personalDe(c)).length, 1);
  });
}

const dir = mkdtempSync(join(tmpdir(), 'ats2-'));

console.log('ATS 2.0 backend · reglas sobre SQLite');
const sql = crearAlmacenSql({ archivo: join(dir, 'ats2.sqlite') });
sembrarDemo(sql, join(RAIZ, 'datos/demo.json'));
await reglas(sql);

await caso('SQLite: gestión de tareas y personas (upsert, conteos, TTR por ATS)', async () => {
  assert.equal((await sql.tareasTodas()).length, 3);
  const { creado } = await sql.guardarTarea({ Title: 'TR-NUEVA', Tarea: 'Nueva', Activa: 'SI', PersonalCapacitado: ';20111222;' });
  assert.equal(creado, true);
  assert.equal((await sql.guardarTarea({ Title: 'TR-NUEVA', Activa: 'NO' })).creado, false);
  const t = await sql.tareaPorCodigo('TR-NUEVA');
  assert.equal(t.fields.Activa, 'NO'); assert.equal(t.fields.Tarea, 'Nueva', 'el upsert parcial conserva lo que no vino');
  assert.equal((await sql.tareasActivas()).length, 2, 'TR-NUEVA quedó inactiva: siguen las 2 activas de la demo');
  await sql.guardarPersona({ Title: '99887766', Nombre: 'Nueva, Persona', Activo: 'SI' });
  assert.equal((await sql.personaPorDocumento('99887766')).fields.Credencial, '', 'columna sin dato = texto vacío, como SharePoint');
  const c = await sql.conteos();
  assert.equal(c.tareas, 4); assert.equal(c.personas, 8); assert.equal(c.ats + c.ttr, c.registros);
  const porAts = await sql.ttrPorAts();
  assert.ok(Object.values(porAts).some((n) => n >= 1));
  assert.ok((await sql.registrosDesde(null)).length >= 8);
});

await caso('SQLite: importar conserva ID y fecha de SharePoint y no duplica', async () => {
  const r1 = sql.importar('personas', { Title: '55555555', Nombre: 'Importada', Activo: 'SI' }, { spId: 77, creadoEl: '2026-10-27T15:00:00Z' });
  const r2 = sql.importar('personas', { Title: '55555555', Nombre: 'Importada otra vez', Activo: 'SI' }, { spId: 77, creadoEl: '2026-10-27T15:00:00Z' });
  assert.equal(r1.creado, true); assert.equal(r2.creado, false); assert.equal(r1.id, r2.id);
  const p = await sql.personaPorDocumento('55555555');
  assert.equal(p.spId, 77); assert.equal(p.creadoEl, '2026-10-27T15:00:00Z'); assert.equal(p.fields.Nombre, 'Importada otra vez');
});

await caso('SQLite: respaldo con VACUUM INTO', async () => {
  const destino = join(dir, 'respaldo.sqlite');
  sql.respaldar(destino);
  const copia = crearAlmacenSql({ archivo: destino });
  assert.equal((await copia.personasTodas()).length, (await sql.personasTodas()).length);
  copia.cerrar();
});
sql.cerrar();

console.log('ATS 2.0 backend · reglas sobre el almacén local (JSON)');
await reglas(crearAlmacenLocal({ archivo: join(dir, 'db.json'), semilla: join(RAIZ, 'datos/demo.json') }));

await caso('JWT: válido, vencido, con otra firma y rol de gestión', async () => {
  const s = 'secreto-de-prueba-de-32-caracteres!!';
  assert.equal(verificarJwt(firmarJwt({ email: 'a@vicuna.com' }, s), s).email, 'a@vicuna.com');
  assert.throws(() => verificarJwt(firmarJwt({ email: 'a@vicuna.com' }, s, -120), s), /vencido/);
  assert.throws(() => verificarJwt(firmarJwt({ email: 'a@vicuna.com' }, 'otro-secreto'), s), /firma/);
  assert.equal(tieneRolGestion(['usuario', 'ATS-Gestion']), true);
  assert.equal(tieneRolGestion('operador, supervisor'), false);
});

rmSync(dir, { recursive: true, force: true });
console.log(`${ok} pruebas OK`);
