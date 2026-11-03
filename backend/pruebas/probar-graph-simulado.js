// El almacén de Graph contra un Graph simulado en memoria: revisa direcciones, filtros OData, encabezados,
// paginado y cuerpos de cada llamada sin credenciales de Microsoft. npm run probar
import assert from 'node:assert/strict';
import { crearAlmacenGraph } from '../src/almacen/graph.js';
import { guardarDocumento, atsInicioVigentes } from '../src/documentos.js';

const SITE = 'vicunacom.sharepoint.com,f4584bfc-5480-4c70-9f5e-470a3538d791,7ecd59f0-15d4-47c4-bedb-42e4bf1d5c6c';
const L = { registros: 'reg-guid', personal: 'per-guid', tareas: 'tar-guid', personas: 'pad-guid' };
const listas = { 'reg-guid': [], 'per-guid': [], 'tar-guid': [], 'pad-guid': [] };
let ultimoId = 0;
const alta = (lista, fields) => { const it = { id: String(++ultimoId), fields: { ...fields } }; listas[lista].push(it); return it; };
alta('tar-guid', { Title: 'TR-001', Tarea: 'Movimiento de suelo', Activa: 'SI', PersonalCapacitado: ';36031940;20111222;', RiesgoFatal: 'NO' });
alta('tar-guid', { Title: 'TR-002', Tarea: 'Baja', Activa: 'NO' });
for (let i = 0; i < 1003; i++) alta('pad-guid', { Title: String(30000000 + i), Nombre: `Persona ${i}`, Activo: i % 50 ? 'SI' : 'NO' });

/** evalúa los filtros que usa el almacén: fields/X eq 'v' | fields/X ge 'v', unidos con and */
function cumple(f, filtro) {
  if (!filtro) return true;
  return filtro.split(' and ').every((c) => {
    const m = /^fields\/(\w+) (eq|ge) '(.*)'$/.exec(c);
    assert.ok(m, `filtro no esperado: ${c}`);
    const v = m[3].replace(/''/g, "'");
    return m[2] === 'eq' ? f[m[1]] === v : (f[m[1]] ?? '') >= v;
  });
}

const log = [];
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); const metodo = init.method ?? 'GET';
  assert.equal(init.headers.Authorization, 'Bearer TOKEN-PRUEBA');
  assert.equal(init.headers.Prefer, 'HonorNonIndexedQueriesWarningMayFailRandomly');
  log.push(`${metodo} ${decodeURIComponent(u.pathname + u.search)}`);
  const json = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
  let m;
  if ((m = /^\/v1\.0\/sites\/vicunacom\.sharepoint\.com:\/sites\/ATSHSS$/.exec(u.pathname))) return json({ id: SITE });
  if ((m = /^\/v1\.0\/sites\/([^/]+)\/lists\/([^/]+)\/items$/.exec(u.pathname))) {
    assert.equal(decodeURIComponent(m[1]), SITE);
    const lista = listas[m[2]]; assert.ok(lista, `lista ${m[2]}`);
    if (metodo === 'POST') {
      const b = JSON.parse(init.body); assert.ok(b.fields && !Object.values(b.fields).includes(null), 'POST { fields } sin nulls');
      return json(alta(m[2], b.fields), 201);
    }
    assert.equal(u.searchParams.get('$expand'), 'fields');
    const todas = lista.filter((it) => cumple(it.fields, u.searchParams.get('$filter')));
    const desde = Number(u.searchParams.get('skip') ?? 0); const top = 500;   // páginas de 500 para probar nextLink
    const pag = todas.slice(desde, desde + top);
    const r = { value: pag };
    if (desde + top < todas.length) { const n = new URL(url); n.searchParams.set('skip', String(desde + top)); r['@odata.nextLink'] = n.toString(); }
    return json(r);
  }
  if ((m = /^\/v1\.0\/sites\/[^/]+\/lists\/([^/]+)\/items\/(\d+)\/fields$/.exec(u.pathname)) && metodo === 'PATCH') {
    const it = listas[m[1]].find((x) => x.id === m[2]); Object.assign(it.fields, JSON.parse(init.body)); return json(it.fields);
  }
  if ((m = /^\/v1\.0\/sites\/[^/]+\/lists\/([^/]+)\/items\/(\d+)$/.exec(u.pathname)) && metodo === 'DELETE') {
    listas[m[1]] = listas[m[1]].filter((x) => x.id !== m[2]); return new Response(null, { status: 204 });
  }
  return json({ error: { code: 'itemNotFound', message: `simulador: ${metodo} ${u.pathname}` } }, 404);
};

const alm = crearAlmacenGraph({ obtenerToken: async () => 'TOKEN-PRUEBA', sitioHost: 'vicunacom.sharepoint.com', sitioRuta: '/sites/ATSHSS', listas: L });
const FIRMA = 'data:image/png;base64,iVBORw0KGgo=';
let ok = 0; const caso = async (n, fn) => { await fn(); ok++; console.log(`  ✓ ${n}`); };
console.log('ATS 2.0 backend · Graph simulado');

await caso('padrón paginado (982 activos de 1003, 2 páginas) y filtro Activo', async () => {
  const p = await alm.padronActivo(); assert.equal(p.length, 1003 - 21);
  assert.equal(log.filter((l) => l.includes('pad-guid')).length, 2);
});
await caso('tareas activas con filtro en fields/Activa', async () => {
  const t = await alm.tareasActivas(); assert.deepEqual(t.map((x) => x.fields.Title), ['TR-001']);
  assert.ok(log.some((l) => l.includes("$filter=fields/Activa eq 'SI'")));
});
const hoy = new Date(); const p = (n) => String(n).padStart(2, '0');
const cod = (t, s) => `${t}-${String(hoy.getFullYear()).slice(2)}${p(hoy.getMonth() + 1)}${p(hoy.getDate())}-0900-${s}`;
const base = { tipo: 'ATS', estado: 'Abierto', creado: hoy.toISOString(), inicioTurno: 'SI', turno: 'Día', pais: 'Argentina (San Juan)', frente: 'F', tarea: 'T', empresa: 'E', iper: 'SI', supervisor: 'S', firmaSup: FIRMA, v360: Array(12).fill('S'), rf: 'NO', r4: Array(16).fill('N') };
await caso('ATS: POST registro + POST persona + PATCH PersonasN, sin FechaCierre null', async () => {
  const r = await guardarDocumento(alm, { email: 'a@vicuna.com', nombre: 'A' }, { doc: { ...base, codigo: cod('ATS', 'GRA1') }, personal: [{ nro: 1, documento: '36.031.940', nombre: 'Diaz Martin, Jose Maria', firma: FIRMA }] }, 'Web v1');
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const reg = listas['reg-guid'][0].fields;
  assert.equal(reg.Title, cod('ATS', 'GRA1')); assert.equal(reg.PersonasN, 1); assert.ok(!('FechaCierre' in reg));
  assert.equal(listas['per-guid'][0].fields.Documento, '36031940');
  assert.ok(r.body.url.startsWith('https://vicunacom.sharepoint.com/sites/ATSHSS/Lists/ATS2%20Registros/DispForm.aspx?ID='));
});
await caso('TTR: busca tarea y ATS de inicio por Title (con comillas escapadas) y guarda', async () => {
  const r = await guardarDocumento(alm, { email: 'a@vicuna.com', nombre: 'A' }, {
    doc: { ...base, tipo: 'TTR', codigo: cod('TTR', 'GRA2'), inicioTurno: '', tareaCod: 'TR-001', enListado: 'SI', atsIni: cod('ATS', 'GRA1'), cambios: Array(8).fill('N') },
    personal: [{ nro: 1, documento: '20111222', nombre: "O'Higgins, Ana", firma: FIRMA }],
  }, 'Web v1');
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.ok(log.some((l) => l.includes(`$filter=fields/Title eq '${cod('ATS', 'GRA1')}'`)));
  assert.equal((await alm.registroPorCodigo("X'Y")), null);
  assert.ok(log.some((l) => l.includes("fields/Title eq 'X''Y'")));
});
await caso('ATS de inicio vigentes con filtro de fecha', async () => {
  const v = await atsInicioVigentes(alm); assert.deepEqual(v.map((a) => a.codigo), [cod('ATS', 'GRA1')]);
  assert.ok(log.some((l) => /fields\/Tipo eq 'ATS' and fields\/InicioTurno eq 'SI' and fields\/FechaInicio ge '\d{4}-\d\d-\d\dT03:00:00.000Z'/.test(l)));
});
await caso('cerrar: PATCH con FechaCierre y sin duplicar personas', async () => {
  const r = await guardarDocumento(alm, { email: 'a@vicuna.com', nombre: 'A' }, {
    doc: { ...base, codigo: cod('ATS', 'GRA1'), estado: 'Cerrado', cerradoEn: new Date().toISOString(), cierre: Array(9).fill('S'), horaFin: '18:00', supCierre: 'S', firmaCierre: FIRMA },
    personal: [{ nro: 1, documento: '36031940', nombre: 'Diaz Martin, Jose Maria', firma: FIRMA }],
  }, 'Web v1');
  assert.equal(r.status, 200); assert.equal(r.body.personasAgregadas, 0);
  assert.ok(listas['reg-guid'][0].fields.FechaCierre);
});
await caso('borrar (solo pruebas) con DELETE', async () => {
  await alm._borrar('personal', listas['per-guid'][0].id); assert.equal(listas['per-guid'].length, 1);
});
console.log(`${ok} pruebas OK`);
