// Rutas de gestión (lo que hacía la app "ATS Gestión" de Power Apps): listados de ATS/TTR, ATS válidos,
// Listado de Tareas Rutinarias con su personal habilitado y padrón de personas. Solo para usuarios de gestión
// (req.usuario.gestion, ver identidad.js). Montado en /api/ats/gestion.
import { Router } from 'express';
import { rm } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diaAr, diasEntre, sumarDias, normDni, habilitados, texto } from './util.js';

const VIGENCIA_ATS_INICIO = 15;   // días (procedimiento + app v15)
const corto = (x) => texto(x).trim().slice(0, 255);
const siNo = (x, porDefecto) => (['SI', 'NO'].includes(String(x ?? '').toUpperCase()) ? String(x).toUpperCase() : porDefecto);
const inicioDiaAr = (dia) => `${dia}T03:00:00.000Z`;   // 00:00 de Argentina (UTC-3) en UTC

/** "dd/mm/aaaa" o "aaaa-mm-dd" (o ISO) → "aaaa-mm-dd"; "" si no es una fecha */
export function fechaCorta(x) {
  const s = texto(x).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

/** una fila de ATS2 Registros como la muestra la gestión */
export function filaRegistro(f, hoy = diaAr(new Date())) {
  const dia = f.FechaInicio ? diaAr(f.FechaInicio) : '';
  const esInicio = f.Tipo === 'ATS' && f.InicioTurno === 'SI' && (f.Estado === 'Abierto' || f.Estado === 'Cerrado');
  const valeHasta = esInicio && dia ? sumarDias(dia, VIGENCIA_ATS_INICIO) : '';
  return {
    codigo: texto(f.Title), tipo: texto(f.Tipo), estado: texto(f.Estado), resultado: texto(f.Resultado), inicioTurno: texto(f.InicioTurno),
    fechaInicio: texto(f.FechaInicio), fechaCierre: texto(f.FechaCierre), turno: texto(f.Turno), frente: texto(f.Frente), tarea: texto(f.Tarea),
    empresa: texto(f.Empresa), supervisor: texto(f.Supervisor), radio: texto(f.Radio), personasN: Number(f.PersonasN) || 0,
    tareaRutinaria: texto(f.TareaRutinaria), atsInicio: texto(f.ATSInicio), creadoPorNombre: texto(f.CreadoPorNombre), creadoPorEmail: texto(f.CreadoPorEmail),
    creadoEnApp: texto(f.CreadoEnApp), appVersion: texto(f.AppVersion),
    valeHasta, vigente: !!valeHasta && diasEntre(dia, hoy) >= 0 && diasEntre(dia, hoy) <= VIGENCIA_ATS_INICIO,
  };
}

export function filaTarea(f) {
  return {
    codigo: texto(f.Title), tarea: texto(f.Tarea), procedimiento: texto(f.Procedimiento), anexoIperc: texto(f.AnexoIPERC), area: texto(f.Area),
    frente: texto(f.Frente), empresa: texto(f.Empresa), riesgoFatal: texto(f.RiesgoFatal), ccv: texto(f.CCV), aprobadoPor: texto(f.AprobadoPor),
    fechaAprobacion: fechaCorta(f.FechaAprobacion), ultimaRevision: fechaCorta(f.UltimaRevision), activa: siNo(f.Activa, 'NO'),
    habilitados: habilitados(f.PersonalCapacitado),
  };
}

export function filaPersona(f, tareasDe = new Map()) {
  const documento = texto(f.Title);
  return {
    documento, nombre: texto(f.Nombre), cargo: texto(f.Cargo), empresa: texto(f.Empresa), equipo: texto(f.Equipo),
    activo: siNo(f.Activo, 'NO'), credencial: texto(f.Credencial), tareas: tareasDe.get(normDni(documento)) ?? [],
  };
}

function personalFila(f) {
  return {
    nro: Number(f.Nro) || 0, nombre: texto(f.Nombre), documento: texto(f.Documento), cargo: texto(f.Cargo), empresa: texto(f.Empresa),
    credencial: texto(f.Credencial), hora: texto(f.Hora), firma: texto(f.Firma), origen: texto(f.Origen), firmadoEl: texto(f.FirmadoEl),
  };
}

const coincide = (fila, q) => !q || ['codigo', 'frente', 'tarea', 'empresa', 'supervisor', 'tareaRutinaria', 'atsInicio', 'creadoPorNombre', 'estado']
  .some((k) => String(fila[k]).toLowerCase().includes(q));

export function routerGestion(almacen) {
  const r = Router();
  r.use((req, res, next) => {
    if (!almacen.tareasTodas) return res.status(501).json({ ok: false, errores: [`La gestión necesita el almacén SQL (ALMACEN=sqlite); este backend usa "${almacen.nombre}".`] });
    if (!req.usuario?.gestion) return res.status(403).json({ ok: false, errores: ['Solo el equipo de HSS (gestión) puede entrar acá.'] });
    next();
  });

  r.get('/resumen', async (req, res) => {
    const hoy = diaAr(new Date());
    const [c, semana, vig] = await Promise.all([almacen.conteos(), almacen.registrosDesde(inicioDiaAr(sumarDias(hoy, -6))), atsVigentes(almacen, hoy)]);
    res.json({
      registros: { total: c.registros, hoy: semana.filter((x) => diaAr(x.fields.FechaInicio) === hoy).length, semana: semana.length, ats: c.ats, ttr: c.ttr, faltaCierre: c.faltaCierre },
      validos: vig.length,
      tareas: { total: c.tareas, activas: c.tareasActivas },
      personas: { total: c.personas, activas: c.personasActivas },
    });
  });

  r.get('/registros', async (req, res) => {
    const hoy = diaAr(new Date());
    const dias = Math.max(0, Math.min(3660, Number(req.query.dias ?? 30) || 0));
    const tipo = String(req.query.tipo ?? '').toUpperCase();
    const q = String(req.query.q ?? '').trim().toLowerCase();
    const filas = await almacen.registrosDesde(dias ? inicioDiaAr(sumarDias(hoy, -(dias - 1))) : null);
    res.json(filas.map((x) => filaRegistro(x.fields, hoy)).filter((f) => (!['ATS', 'TTR'].includes(tipo) || f.tipo === tipo) && coincide(f, q)));
  });

  r.get('/registros/:codigo', async (req, res) => {
    const codigo = String(req.params.codigo).trim().toUpperCase();
    const reg = await almacen.registroPorCodigo(codigo);
    if (!reg) return res.status(404).json({ ok: false, errores: [`No existe el registro ${codigo}.`] });
    const hoy = diaAr(new Date());
    const [personal, ttr] = await Promise.all([almacen.personalDe(codigo), reg.fields.Tipo === 'ATS' ? almacen.ttrDe(codigo) : []]);
    res.json({ registro: filaRegistro(reg.fields, hoy), campos: reg.fields, personal: personal.map((p) => personalFila(p.fields)), ttr: ttr.map((x) => filaRegistro(x.fields, hoy)) });
  });

  r.get('/validos', async (req, res) => {
    const hoy = diaAr(new Date());
    const [vig, porAts, recientes] = await Promise.all([atsVigentes(almacen, hoy), almacen.ttrPorAts(), almacen.registrosDesde(inicioDiaAr(sumarDias(hoy, -VIGENCIA_ATS_INICIO)))]);
    res.json({
      ats: vig.map((f) => ({ ...f, quedan: diasEntre(hoy, f.valeHasta), ttrN: porAts[f.codigo] ?? 0 })),
      ttr: recientes.filter((x) => x.fields.Tipo === 'TTR').map((x) => filaRegistro(x.fields, hoy)),
    });
  });

  /** copia consistente de la base (VACUUM INTO) para bajarla desde la gestión: ats2-aaaammdd-hhmm.sqlite */
  r.get('/respaldo', async (req, res, next) => {
    if (!almacen.respaldar) return res.status(501).json({ ok: false, errores: ['Este almacén no tiene respaldo descargable.'] });
    const d = new Date();
    const sello = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    const tmp = join(tmpdir(), `ats2-respaldo-${process.pid}-${Date.now()}.sqlite`);
    try {
      almacen.respaldar(tmp);
      res.download(tmp, `ats2-${sello}.sqlite`, (err) => { rm(tmp, { force: true }, () => {}); if (err && !res.headersSent) next(err); });
    } catch (e) { rm(tmp, { force: true }, () => {}); next(e); }
  });

  r.get('/tareas', async (req, res) => res.json((await almacen.tareasTodas()).map((t) => filaTarea(t.fields))));

  r.put('/tareas/:codigo', async (req, res) => {
    const b = req.body ?? {};
    const codigo = String(req.params.codigo).trim().toUpperCase();
    const errores = [];
    if (!/^[A-Z0-9./-]{2,40}$/.test(codigo)) errores.push('El código de la tarea solo puede tener letras, números, punto, barra y guion (2 a 40 caracteres).');
    const tarea = corto(b.tarea);
    if (tarea.length < 3) errores.push('Escribí el nombre de la tarea.');
    const fechas = {};
    for (const [k, col, nombre] of [['fechaAprobacion', 'FechaAprobacion', 'fecha de aprobación'], ['ultimaRevision', 'UltimaRevision', 'última revisión']]) {
      const v = texto(b[k]).trim();
      fechas[col] = v ? fechaCorta(v) : '';
      if (v && !fechas[col]) errores.push(`La ${nombre} tiene que ser dd/mm/aaaa.`);
    }
    const lista = Array.isArray(b.habilitados) ? b.habilitados : habilitados(b.habilitados);
    const dnis = [...new Set(lista.map(normDni).filter((d) => d.length >= 5 && d.length <= 20))];
    if (errores.length) return res.status(400).json({ ok: false, errores });

    const padron = new Set((await almacen.personasTodas()).map((p) => normDni(p.fields.Title)));
    const fuera = dnis.filter((d) => !padron.has(d));
    const avisos = [];
    if (!dnis.length) avisos.push(`Tarea ${codigo} guardada SIN personal habilitado: nadie podrá firmar su TTR.`);
    if (fuera.length) avisos.push(`${fuera.length} DNI habilitado(s) no está(n) en el padrón: ${fuera.join(', ')}.`);

    const { creado } = await almacen.guardarTarea({
      Title: codigo, Tarea: tarea, Procedimiento: corto(b.procedimiento), AnexoIPERC: corto(b.anexoIperc), Area: corto(b.area), Frente: corto(b.frente),
      Empresa: corto(b.empresa), RiesgoFatal: corto(b.riesgoFatal), CCV: corto(b.ccv), AprobadoPor: corto(b.aprobadoPor), ...fechas,
      Activa: siNo(b.activa, 'SI'), PersonalCapacitado: dnis.length ? `;${dnis.join(';')};` : '',
    });
    res.status(creado ? 201 : 200).json({ ok: true, codigo, creado, avisos });
  });

  r.get('/personas', async (req, res) => {
    const [personas, tareas] = await Promise.all([almacen.personasTodas(), almacen.tareasTodas()]);
    const tareasDe = new Map();
    for (const t of tareas) for (const d of habilitados(t.fields.PersonalCapacitado)) tareasDe.set(normDni(d), [...(tareasDe.get(normDni(d)) ?? []), texto(t.fields.Title)]);
    res.json(personas.map((p) => filaPersona(p.fields, tareasDe)));
  });

  r.put('/personas/:documento', async (req, res) => {
    const b = req.body ?? {};
    const documento = normDni(req.params.documento);
    const errores = [];
    if (documento.length < 5 || documento.length > 20) errores.push('El DNI / RUT tiene que tener entre 5 y 20 caracteres (sin puntos ni guiones).');
    const existente = errores.length ? null : await almacen.personaPorDocumento(documento);
    const nombre = b.nombre === undefined && existente ? texto(existente.fields.Nombre) : corto(b.nombre);
    if (nombre.length < 3) errores.push('Escribí apellido y nombre.');
    if (errores.length) return res.status(400).json({ ok: false, errores });
    const campos = { Title: documento, Nombre: nombre, Activo: siNo(b.activo, existente ? siNo(existente.fields.Activo, 'SI') : 'SI') };
    for (const [k, col] of [['cargo', 'Cargo'], ['empresa', 'Empresa'], ['equipo', 'Equipo'], ['credencial', 'Credencial']]) if (typeof b[k] === 'string') campos[col] = corto(b[k]);
    const { creado } = await almacen.guardarPersona(campos);
    res.status(creado ? 201 : 200).json({ ok: true, documento, creado });
  });

  return r;
}

/** ATS de inicio de turno autorizados y vigentes (15 días), como filas de gestión */
async function atsVigentes(almacen, hoy) {
  const desde = inicioDiaAr(sumarDias(hoy, -VIGENCIA_ATS_INICIO));
  return (await almacen.atsInicioDesde(desde)).map((x) => filaRegistro(x.fields, hoy)).filter((f) => f.vigente);
}
