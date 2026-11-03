// Reglas y guardado de un ATS 2.0 / TTR: lo mismo que hace la app de Power Apps al enviar (gen.pl, $syncFx),
// más las validaciones de la API de carga, ahora del lado del servidor.
import { RIESGOS_FATALES, RIESGOS_NO_FATALES, CIERRE, CAMBIOS, N_CONTROLES } from './catalogo.js';
import { diaAr, horaAr, fechaHoraAr, ddmmyyyy, diasEntre, sumarDias, normDni, habilitados, texto } from './util.js';

const ESTADOS = ['Abierto', 'Cerrado', 'Detenido', 'No aplica'];
const FINALES = ['Cerrado', 'Detenido', 'No aplica'];
const VIGENCIA_ATS_INICIO = 15;   // días (procedimiento + app v15)
const MAX_FIRMA = 400_000;        // caracteres del data URI de una firma

const esImagen = (x) => typeof x === 'string' && x.startsWith('data:image/') && x.length <= MAX_FIRMA;
const corto = (x) => texto(x).slice(0, 255);
/** lista de largo fijo con los valores permitidos ("" si falta o no vale) */
function lista(v, n, permitidos) {
  const a = Array.isArray(v) ? v : [];
  return Array.from({ length: n }, (_, i) => (permitidos.includes(a[i]) ? a[i] : ''));
}

/** normaliza lo que manda el navegador (nunca confiar en la forma) */
function leerDoc(d) {
  const r4c = Array.isArray(d.r4c) ? d.r4c : [];
  return {
    codigo: texto(d.codigo).trim().toUpperCase(),
    tipo: texto(d.tipo), estado: texto(d.estado), resultado: corto(d.resultado),
    creado: texto(d.creado), cerradoEn: texto(d.cerradoEn),
    turno: corto(d.turno), inicioTurno: texto(d.inicioTurno), pais: corto(d.pais),
    frente: corto(d.frente), tarea: corto(d.tarea), lugar: corto(d.lugar), cota: corto(d.cota),
    empresa: corto(d.empresa), contratista: corto(d.contratista), duenoArea: corto(d.duenoArea),
    procedimiento: corto(d.procedimiento), iper: texto(d.iper), radio: corto(d.radio), supervisor: corto(d.supervisor),
    firmaSup: texto(d.firmaSup), horaAut: corto(d.horaAut),
    v360: lista(d.v360, 12, ['S', 'N', 'A']),
    noHist: (Array.isArray(d.noHist) ? d.noHist : []).map(Number).filter((n) => n >= 1 && n <= 12),
    rf: texto(d.rf), rfSel: (Array.isArray(d.rfSel) ? d.rfSel : []).map(Number).filter((n) => n >= 1 && n <= RIESGOS_FATALES.length),
    rfOtro: corto(d.rfOtro), ccv: corto(d.ccv),
    r4: lista(d.r4, 16, ['S', 'N']),
    r4c: Array.from({ length: 16 }, (_, i) => (Array.isArray(r4c[i]) ? r4c[i] : []).map(Number).filter((n) => n >= 1 && n <= N_CONTROLES)),
    r4Otro: corto(d.r4Otro), r4OtroCtr: corto(d.r4OtroCtr), ctrlAdic: corto(d.ctrlAdic),
    cierre: lista(d.cierre, 9, ['S', 'A']),
    horaFin: corto(d.horaFin), obsCierre: texto(d.obsCierre).slice(0, 4000), supCierre: corto(d.supCierre), firmaCierre: texto(d.firmaCierre),
    reconocido: corto(d.reconocido), motivoRec: corto(d.motivoRec),
    tareaCod: corto(d.tareaCod).trim().toUpperCase(), enListado: texto(d.enListado),
    atsIni: corto(d.atsIni).trim().toUpperCase(), atsIniHora: corto(d.atsIniHora),
    cambios: lista(d.cambios, 8, ['N', 'C']), areaLimpia: corto(d.areaLimpia),
    lat: corto(d.lat), lon: corto(d.lon),
  };
}

function leerPersonal(lista_) {
  return (Array.isArray(lista_) ? lista_ : []).map((p) => ({
    nro: Number(p?.nro) || 0, nombre: corto(p?.nombre).trim(), documento: normDni(p?.documento),
    cargo: corto(p?.cargo), empresa: corto(p?.empresa), credencial: corto(p?.credencial),
    hora: corto(p?.hora), firma: texto(p?.firma), origen: corto(p?.origen), firmadoEn: texto(p?.firmadoEn),
  }));
}

/** columnas de ATS2 Registros: el mismo armado que la app ($syncFx de gen.pl) */
function camposRegistro(d, { usuario, existente, version }) {
  const ttr = d.tipo === 'TTR';
  const sn = { S: 'SI', N: 'NO', A: 'N/A' };
  return {
    Title: d.codigo, Tipo: d.tipo, Estado: d.estado, Resultado: d.resultado, InicioTurno: d.inicioTurno,
    FechaInicio: new Date(d.creado).toISOString(),
    FechaCierre: d.estado === 'Cerrado' && d.cerradoEn ? new Date(d.cerradoEn).toISOString() : null,
    Turno: d.turno, Pais: d.pais, Frente: d.frente, Tarea: d.tarea, Lugar: d.lugar, Cota: d.cota, Empresa: d.empresa,
    Contratista: d.contratista, DuenoArea: d.duenoArea, Procedimiento: d.procedimiento, MatrizIPER: d.iper,
    Radio: d.radio, Supervisor: d.supervisor, FirmaSupervisor: d.firmaSup,
    Verif360: d.v360.slice(0, ttr ? 6 : 12).map((v, i) => `${i + 1}=${sn[v] ?? '-'}`).join(' '),
    NoEn360: [...new Set(d.noHist)].join(','),
    RiesgoFatal: d.rf,
    RiesgosFatales: [...new Set(d.rfSel)].sort((a, b) => a - b).map((n) => RIESGOS_FATALES[n - 1]).join('; '),
    OtroRiesgoFatal: d.rfOtro, CCV: d.ccv,
    RiesgosNoFatales: d.r4.map((v, i) => (v === 'S' ? `${RIESGOS_NO_FATALES[i]}: ${[...new Set(d.r4c[i])].sort((a, b) => a - b).join(',')}` : null))
      .filter(Boolean).join('; '),
    OtroRiesgo: d.r4Otro, OtroRiesgoControles: d.r4OtroCtr, ControlAdicional: d.ctrlAdic,
    CierreChecks: ttr ? '' : CIERRE.map((a, i) => `${a}=${({ S: 'SI', A: 'N/A' })[d.cierre[i]] ?? '-'}`).join('; '),
    HoraTermino: d.horaFin, ObsCierre: d.obsCierre, SupervisorCierre: d.supCierre, FirmaCierre: d.firmaCierre,
    Reconocido: d.reconocido, MotivoReconocimiento: d.motivoRec,
    TareaRutinaria: d.tareaCod, EnListado: d.enListado, ATSInicio: d.atsIni, ATSInicioHora: d.atsIniHora,
    Cambios: ttr ? CAMBIOS.map((t, i) => `${t}=${({ N: 'No cambió', C: 'Cambió' })[d.cambios[i]] ?? '-'}`).join('; ') : '',
    CambioDetectado: ttr ? (d.cambios.includes('C') ? 'SI' : 'NO') : '',
    AreaLimpia: d.areaLimpia, Latitud: d.lat, Longitud: d.lon,
    // quién lo cargó lo dice el backend (la identidad que pasó la otra app), no el navegador; no se pisa al actualizar
    CreadoPorEmail: existente?.CreadoPorEmail || usuario.email,
    CreadoPorNombre: existente?.CreadoPorNombre || usuario.nombre,
    CreadoEnApp: existente?.CreadoEnApp || fechaHoraAr(d.creado),
    AppVersion: version,
  };
}

/** errores del documento según su estado (los mismos mensajes que la app) */
function validarDoc(d) {
  const e = [];
  if (!/^(ATS|TTR)-\d{6}-\d{4}-[A-Z0-9]{4}$/.test(d.codigo)) e.push(`El código "${d.codigo}" no tiene el formato ATS-aammdd-hhmm-XXXX / TTR-aammdd-hhmm-XXXX.`);
  if (!['ATS', 'TTR'].includes(d.tipo)) e.push('Tipo tiene que ser ATS o TTR.');
  else if (!d.codigo.startsWith(`${d.tipo}-`)) e.push(`El código ${d.codigo} no corresponde a un ${d.tipo}.`);
  if (!ESTADOS.includes(d.estado)) e.push('Solo se envían documentos autorizados (Abierto), cerrados, detenidos o "No aplica".');
  if (Number.isNaN(Date.parse(d.creado))) e.push('Falta la fecha de creación (creado) en ISO 8601.');
  if (d.estado === 'Cerrado' && Number.isNaN(Date.parse(d.cerradoEn))) e.push('Falta la fecha de cierre (cerradoEn).');
  if (e.length) return e;

  const autorizado = d.estado === 'Abierto' || d.estado === 'Cerrado';
  if (!autorizado) {
    if (!d.resultado.trim()) e.push(`Un documento ${d.estado.toLowerCase()} tiene que traer el motivo en "resultado".`);
    return e;
  }
  if (!d.supervisor.trim()) e.push('Falta el supervisor que autoriza.');
  if (!esImagen(d.firmaSup)) e.push('Falta la firma del supervisor que autoriza.');
  if (d.tipo === 'ATS') {
    if (!['SI', 'NO'].includes(d.inicioTurno)) e.push('Indicá si es el ATS de inicio de turno.');
    for (const [v, m] of [[d.frente, 'el frente / área de trabajo'], [d.tarea, 'la tarea a ejecutar'], [d.empresa, 'la empresa ejecutora']]) if (!v.trim()) e.push(`Completá ${m}.`);
    if (d.iper !== 'SI') e.push('La tarea tiene que estar en la matriz IPER.');
    if (d.v360.includes('')) e.push('Respondé las 12 preguntas de la verificación 360°.');
    else if (d.v360.includes('N')) e.push('Hay respuestas NO en la verificación 360°: la tarea no se autoriza.');
    if (!['SI', 'NO'].includes(d.rf)) e.push('Indicá si la tarea tiene riesgos fatales.');
    else if (d.rf === 'SI' && !d.rfSel.length && !d.rfOtro.trim()) e.push('Marcá cuál o cuáles riesgos fatales tiene la tarea.');
    if (d.r4.includes('')) e.push('Marcá SI o NO en los 16 riesgos sin potencial fatal.');
    else if (d.r4.some((v, i) => v === 'S' && !d.r4c[i].length)) e.push('Cada riesgo marcado SI necesita al menos un EPP o control.');
    if (d.estado === 'Cerrado') {
      if (d.cierre.includes('')) e.push('Marcá SI o N/A en las 9 actividades de cierre.');
      if (!d.horaFin.trim()) e.push('Completá la hora de término.');
      if (!d.supCierre.trim()) e.push('Completá el supervisor que cierra.');
      if (!esImagen(d.firmaCierre)) e.push('Falta la firma del supervisor que cierra.');
    }
  } else {
    if (d.enListado !== 'SI' || !d.tareaCod) e.push('La TTR tiene que ser de una tarea del Listado de Tareas Rutinarias.');
    if (!d.atsIni) e.push('Vinculá el ATS 2.0 de inicio de turno: sin él no se inicia el trabajo.');
    if (d.v360.slice(0, 6).includes('')) e.push('Respondé las 6 preguntas del equipo.');
    else if (d.v360.slice(0, 6).includes('N')) e.push('Hay respuestas NO en las preguntas del equipo: la TTR no se autoriza.');
    if (d.cambios.includes('')) e.push('Contestá las 8 condiciones de "¿Algo cambió hoy?".');
    else if (d.cambios.includes('C')) e.push('Cambió algo: la TTR no aplica, se hace un ATS 2.0.');
    if (d.estado === 'Cerrado') {
      if (!d.horaFin.trim()) e.push('Completá la hora de término.');
      if (!['SI', 'NO'].includes(d.areaLimpia)) e.push('Indicá si el área quedó limpia y sin pendientes.');
    }
  }
  return e;
}

const candados = new Map();
/** un guardado por código a la vez (dos envíos simultáneos del mismo código nuevo no duplican) */
async function conCandado(codigo, fn) {
  const previo = candados.get(codigo) ?? Promise.resolve();
  const actual = previo.then(fn, fn);
  const cola = actual.catch(() => {});
  candados.set(codigo, cola);
  try { return await actual; } finally { if (candados.get(codigo) === cola) candados.delete(codigo); }
}

/**
 * Guarda un documento con su personal. Devuelve { status, body }.
 * body = { doc, personal: [...] } tal como lo arma el frontend.
 */
export function guardarDocumento(alm, usuario, body, version) {
  const d = leerDoc(body?.doc ?? {});
  return conCandado(d.codigo || '?', async () => {
    const errores = validarDoc(d);
    const personal = leerPersonal(body?.personal);
    if (errores.length) return { status: 400, body: { ok: false, codigo: d.codigo, errores } };

    const existente = await alm.registroPorCodigo(d.codigo);
    if (existente && !texto(existente.fields.AppVersion).startsWith('Web')) {
      return { status: 409, body: { ok: false, codigo: d.codigo, errores: [`El código ${d.codigo} ya existe y no fue cargado desde ATS 2.0 web (lo cargó ${existente.fields.AppVersion || 'otra app'}): no se modifica.`] } };
    }
    if (existente && FINALES.includes(existente.fields.Estado) && existente.fields.Estado !== d.estado) {
      return { status: 409, body: { ok: false, codigo: d.codigo, errores: [`${d.codigo} ya está ${existente.fields.Estado.toLowerCase()} en SharePoint: no se puede pasar a ${d.estado}.`] } };
    }

    // personal: solo se agregan los que todavía no firmaron este código
    const yaGuardado = await alm.personalDe(d.codigo);
    const dnisGuardados = new Set(yaGuardado.map((p) => normDni(p.fields.Documento)));
    const nuevos = personal.filter((p) => !dnisGuardados.has(p.documento));
    const vistos = new Set();
    for (const p of nuevos) {
      if (p.documento.length < 5 || p.documento.length > 20 || p.nombre.length < 3) errores.push(`Revisar la persona "${p.nombre || '?'}" (DNI "${p.documento}"): cada persona necesita DNI (5 a 20 caracteres) y nombre.`);
      if (vistos.has(p.documento)) errores.push(`El DNI ${p.documento} está repetido en el personal.`);
      vistos.add(p.documento);
      if (!esImagen(p.firma)) errores.push(`Falta la firma de ${p.nombre || p.documento} (imagen data:image/...).`);
    }
    const autorizado = d.estado === 'Abierto' || d.estado === 'Cerrado';
    if (autorizado && yaGuardado.length + nuevos.length === 0) errores.push('Agregá al menos un trabajador con su firma.');

    const avisos = [];
    if (d.tipo === 'TTR' && autorizado) {
      const tareas = await alm.tareasActivas();
      const tarea = tareas.find((t) => texto(t.fields.Title).toUpperCase() === d.tareaCod);
      if (!tarea) errores.push(`La tarea ${d.tareaCod} no está en el Listado de Tareas Rutinarias o no está activa.`);
      else {
        const hab = new Set(habilitados(tarea.fields.PersonalCapacitado));
        for (const p of nuevos) if (!hab.has(p.documento)) errores.push(`El DNI ${p.documento} (${p.nombre}) no está habilitado para la tarea ${d.tareaCod}.`);
      }
      const ats = d.atsIni ? await alm.registroPorCodigo(d.atsIni) : null;
      if (ats) {
        const a = ats.fields;
        if (a.Tipo !== 'ATS' || a.InicioTurno !== 'SI') errores.push(`${d.atsIni} no es un ATS 2.0 de inicio de turno.`);
        else if (a.Estado !== 'Abierto' && a.Estado !== 'Cerrado') errores.push(`El ATS de inicio ${d.atsIni} no está autorizado (estado: ${a.Estado || '-'}).`);
        else {
          const diaAts = diaAr(a.FechaInicio); const diaTtr = diaAr(d.creado);
          const dias = diasEntre(diaAts, diaTtr);
          if (dias < 0 || dias > VIGENCIA_ATS_INICIO) errores.push(`El ATS de inicio ${d.atsIni} es del ${ddmmyyyy(diaAts)} y vale hasta el ${ddmmyyyy(sumarDias(diaAts, VIGENCIA_ATS_INICIO))}; la TTR es del ${ddmmyyyy(diaTtr)}.`);
        }
      } else if (d.atsIni) {
        // como la app: un ATS hecho en otro teléfono sin señal puede no haber llegado todavía
        avisos.push(`El ATS de inicio ${d.atsIni} todavía no está en SharePoint: la TTR se guardó vinculada sin verificarlo.`);
      }
    }
    if (errores.length) return { status: 400, body: { ok: false, codigo: d.codigo, errores: [...new Set(errores)] } };

    // guardar: registro, personal y cantidad de personas
    const campos = camposRegistro(d, { usuario, existente: existente?.fields, version });
    for (const k of Object.keys(campos)) if (campos[k] === null) delete campos[k];   // Graph: no mandar nulls (FechaCierre de un abierto)
    let id;
    if (existente) { id = existente.id; await alm.actualizarRegistro(id, campos); }
    else id = await alm.crearRegistro(campos);

    let nro = Math.max(0, ...yaGuardado.map((p) => Number(p.fields.Nro) || 0));
    const nrosUsados = new Set(yaGuardado.map((p) => Number(p.fields.Nro)));
    for (const p of nuevos.sort((a, b) => a.nro - b.nro)) {
      const n = p.nro > 0 && !nrosUsados.has(p.nro) ? p.nro : nro + 1;
      nrosUsados.add(n); nro = Math.max(nro, n);
      const firmado = Number.isNaN(Date.parse(p.firmadoEn)) ? new Date() : new Date(p.firmadoEn);
      await alm.crearPersona({
        Title: d.codigo, Tipo: d.tipo, Nro: n, Nombre: p.nombre, Cargo: p.cargo, Empresa: p.empresa,
        Documento: p.documento, Credencial: p.credencial, Hora: p.hora || horaAr(firmado), Firma: p.firma,
        Origen: p.origen || 'Web', FirmadoEl: firmado.toISOString(),
      });
    }
    const total = yaGuardado.length + nuevos.length;
    await alm.actualizarRegistro(id, { PersonasN: total });

    return {
      status: existente ? 200 : 201,
      body: { ok: true, accion: existente ? 'actualizado' : 'creado', codigo: d.codigo, id, personasAgregadas: nuevos.length, personasTotal: total, url: alm.urlRegistro(id, d.codigo), avisos },
    };
  });
}

/** ATS de inicio de turno autorizados de los últimos 15 días (para vincular la TTR) */
export async function atsInicioVigentes(alm) {
  const hoy = diaAr(new Date());
  const desde = new Date(Date.parse(`${sumarDias(hoy, -(VIGENCIA_ATS_INICIO + 1))}T03:00:00Z`)).toISOString();
  const filas = await alm.atsInicioDesde(desde);
  return filas.map((r) => r.fields)
    .filter((f) => (f.Estado === 'Abierto' || f.Estado === 'Cerrado') && diasEntre(diaAr(f.FechaInicio), hoy) <= VIGENCIA_ATS_INICIO)
    .map(resumenAts)
    .sort((a, b) => (a.codigo < b.codigo ? 1 : -1));
}

/** lo que el frontend necesita de un ATS para vincularlo (QR o lista) */
export function resumenAts(f) {
  return {
    codigo: f.Title, tipo: f.Tipo, inicioTurno: f.InicioTurno, estado: f.Estado, fechaInicio: f.FechaInicio,
    dia: f.FechaInicio ? diaAr(f.FechaInicio) : '', horaAut: f.FechaInicio ? horaAr(f.FechaInicio) : '',
    frente: texto(f.Frente), supervisor: texto(f.Supervisor), radio: texto(f.Radio), empresa: texto(f.Empresa),
  };
}

export function resumenTarea(f) {
  return {
    codigo: texto(f.Title), tarea: texto(f.Tarea), procedimiento: texto(f.Procedimiento), area: texto(f.Area),
    frente: texto(f.Frente), empresa: texto(f.Empresa), riesgoFatal: texto(f.RiesgoFatal), ccv: texto(f.CCV),
    habilitados: habilitados(f.PersonalCapacitado),
  };
}

export function resumenPersona(f) {
  return { documento: texto(f.Title), nombre: texto(f.Nombre), cargo: texto(f.Cargo), empresa: texto(f.Empresa), credencial: texto(f.Credencial) };
}
