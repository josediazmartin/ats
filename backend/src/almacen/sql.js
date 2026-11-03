// Almacén SQLite (node:sqlite, sin dependencias): la única fuente de ATS 2.0 / TTR.
// Misma interfaz que graph.js y local.js para las reglas (documentos.js), más lo que necesita la gestión
// (tareas, padrón, listados) y la migración desde SharePoint (importar).
// Archivo: SQLITE_ARCHIVO (por defecto datos/ats2.sqlite). En Docker va en un volumen; respaldo = copiar el archivo
// con `sqlite3 ats2.sqlite ".backup ..."` o `npm run respaldo`.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { TABLAS, sqlEsquema } from './esquema.js';

const q = (c) => `"${c}"`;
const ahora = () => new Date().toISOString();

/** valor apto para SQLite: null, número o texto (nunca undefined, booleanos ni objetos) */
function valor(v, numerica) {
  if (v === undefined || v === null) return null;
  if (numerica) { const n = Number(v); return Number.isFinite(n) ? n : null; }
  if (typeof v === 'boolean') return v ? 'SI' : 'NO';
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

export function crearAlmacenSql({ archivo }) {
  if (archivo !== ':memory:') mkdirSync(dirname(archivo), { recursive: true });
  const db = new DatabaseSync(archivo);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec(sqlEsquema());

  const fila = (r) => {
    if (!r) return null;
    const { id, sp_id, creado_el, modificado_el, ...fields } = r;
    for (const k of Object.keys(fields)) if (fields[k] === null) fields[k] = '';   // como SharePoint/Graph: texto vacío
    return { id, spId: sp_id, creadoEl: creado_el, modificadoEl: modificado_el, fields };
  };
  const sel = (tabla, where = '', orden = '', params = []) => db.prepare(`SELECT * FROM ${tabla} ${where} ${orden}`).all(...params).map(fila);

  function insertar(tabla, fields, extra = {}) {
    const t = TABLAS[tabla];
    const cols = t.columnas.filter((c) => fields[c] !== undefined);
    const vals = cols.map((c) => valor(fields[c], t.numericas.includes(c)));
    const ts = ahora();
    const sql = `INSERT INTO ${tabla} (${[...cols.map(q), 'sp_id', 'creado_el', 'modificado_el'].join(', ')}) VALUES (${[...cols, 0, 0, 0].map(() => '?').join(', ')})`;
    const r = db.prepare(sql).run(...vals, extra.spId ?? null, extra.creadoEl ?? ts, extra.modificadoEl ?? ts);
    return Number(r.lastInsertRowid);
  }

  function actualizar(tabla, id, fields, extra = {}) {
    const t = TABLAS[tabla];
    const cols = t.columnas.filter((c) => fields[c] !== undefined);
    const vals = cols.map((c) => valor(fields[c], t.numericas.includes(c)));
    const sets = [...cols.map((c) => `${q(c)} = ?`), 'modificado_el = ?'];
    if (extra.spId !== undefined) { sets.push('sp_id = ?'); vals.push(extra.spId); }
    if (extra.creadoEl !== undefined) { sets.push('creado_el = ?'); vals.push(extra.creadoEl); }
    const r = db.prepare(`UPDATE ${tabla} SET ${sets.join(', ')} WHERE id = ?`).run(...vals.slice(0, cols.length), extra.modificadoEl ?? ahora(), ...vals.slice(cols.length), id);
    if (!r.changes) throw Object.assign(new Error(`No existe ${tabla} ${id}`), { status: 404 });
  }

  /** crea o actualiza por la clave única de la tabla; devuelve { id, creado } */
  function upsert(tabla, fields, extra = {}) {
    const t = TABLAS[tabla];
    const ex = db.prepare(`SELECT id FROM ${tabla} WHERE ${t.unica.map((c) => `${q(c)} = ?`).join(' AND ')}`)
      .get(...t.unica.map((c) => valor(fields[c], false)));
    if (ex) { actualizar(tabla, ex.id, fields, extra); return { id: ex.id, creado: false }; }
    return { id: insertar(tabla, fields, extra), creado: true };
  }

  function transaccion(fn) {
    db.exec('BEGIN');
    try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
  }

  const contar = (tabla, where = '', params = []) => Number(db.prepare(`SELECT COUNT(*) AS n FROM ${tabla} ${where}`).get(...params).n);

  return {
    nombre: 'sqlite',
    archivo,

    // ---- lo que usan las reglas (documentos.js): misma interfaz que graph.js y local.js
    tareasActivas: async () => sel('tareas', `WHERE "Activa" = 'SI'`, 'ORDER BY "Title"'),
    padronActivo: async () => sel('personas', `WHERE "Activo" = 'SI'`, 'ORDER BY "Nombre"'),
    registroPorCodigo: async (codigo) => sel('registros', 'WHERE "Title" = ?', '', [codigo])[0] ?? null,
    atsInicioDesde: async (isoUtc) => sel('registros', `WHERE "Tipo" = 'ATS' AND "InicioTurno" = 'SI' AND "FechaInicio" >= ?`, 'ORDER BY "FechaInicio" DESC', [isoUtc]),
    personalDe: async (codigo) => sel('personal', 'WHERE "Title" = ?', 'ORDER BY "Nro"', [codigo]),
    crearRegistro: async (fields) => insertar('registros', fields),
    actualizarRegistro: async (id, fields) => actualizar('registros', id, fields),
    crearPersona: async (fields) => insertar('personal', fields),
    urlRegistro: (id, codigo) => `/gestion/registros/${encodeURIComponent(codigo ?? id)}`,

    // ---- gestión
    tareasTodas: async () => sel('tareas', '', 'ORDER BY "Title"'),
    tareaPorCodigo: async (codigo) => sel('tareas', 'WHERE "Title" = ?', '', [codigo])[0] ?? null,
    guardarTarea: async (fields) => upsert('tareas', fields),
    personasTodas: async () => sel('personas', '', 'ORDER BY "Nombre"'),
    personaPorDocumento: async (documento) => sel('personas', 'WHERE "Title" = ?', '', [documento])[0] ?? null,
    guardarPersona: async (fields) => upsert('personas', fields),
    /** registros con FechaInicio >= desde (ISO) o todos si desde es null; más nuevo primero */
    registrosDesde: async (desdeIso, limite = 2000) => sel('registros', desdeIso ? 'WHERE "FechaInicio" >= ?' : '', `ORDER BY "FechaInicio" DESC, id DESC LIMIT ${Number(limite) || 2000}`, desdeIso ? [desdeIso] : []),
    ttrDe: async (codigoAts) => sel('registros', `WHERE "Tipo" = 'TTR' AND "ATSInicio" = ?`, 'ORDER BY "FechaInicio" DESC', [codigoAts]),
    /** cantidad de TTR vinculadas por ATS de inicio: { codigo: n } */
    ttrPorAts: async () => Object.fromEntries(db.prepare(`SELECT "ATSInicio" AS c, COUNT(*) AS n FROM registros WHERE "Tipo" = 'TTR' AND "ATSInicio" <> '' GROUP BY "ATSInicio"`).all().map((r) => [r.c, Number(r.n)])),
    conteos: async () => ({
      registros: contar('registros'), ats: contar('registros', `WHERE "Tipo" = 'ATS'`), ttr: contar('registros', `WHERE "Tipo" = 'TTR'`),
      faltaCierre: contar('registros', `WHERE "Estado" = 'Abierto'`),
      tareas: contar('tareas'), tareasActivas: contar('tareas', `WHERE "Activa" = 'SI'`),
      personas: contar('personas'), personasActivas: contar('personas', `WHERE "Activo" = 'SI'`),
    }),

    // ---- migración y mantenimiento
    /** crea o actualiza una fila por su clave única, conservando el ID y la fecha de creación de SharePoint */
    importar: (tabla, fields, extra) => upsert(tabla, fields, extra),
    transaccion,
    sql: (texto, params = []) => db.prepare(texto).all(...params),
    respaldar: (destino) => { db.exec(`VACUUM INTO '${String(destino).replace(/'/g, "''")}'`); },
    cerrar: () => db.close(),
  };
}
