// TTR (ScrTtr, v14+): 4 pasos (Tarea, Equipo, Cambios, Firmas) y Término cuando está autorizada.
// Los datos de la tarea salen del Listado (no se editan acá) y supervisor / radio del ATS de inicio de turno,
// que vale 15 días. Si algo cambió, la TTR no aplica y se pasa a un ATS 2.0 con los datos precargados.
import { useEffect, useState } from 'react';
import { useAts } from '../estado';
import { ICONOS } from '../iconos';
import { CAMBIOS, Q360, VIGENCIA_ATS_INICIO } from '../catalogo';
import { Banda, BotonEscanear, Campo, Chips, Encabezado, Panel, Pasos } from '../componentes';
import type { AtsInicio, Doc, Tarea } from '../tipos';
import { aEnviar, conValor, ddmm, diaDeCodigo, diasEntre, hhmm, sumarDias, yyyymmdd } from '../util';

const NOMBRES = ['Tarea', 'Equipo', 'Cambios', 'Firmas', 'Término'];

/** datos que trae la tarea del Listado (el riesgo fatal y la CCV, si el Listado los tiene) */
function datosTarea(t: Tarea, d: Doc): Partial<Doc> {
  const rf = t.riesgoFatal.trim();
  return {
    tareaCod: t.codigo, tarea: t.tarea, procedimiento: t.procedimiento, frente: t.frente || d.frente, empresa: t.empresa || d.empresa, enListado: 'SI',
    rf: !rf ? d.rf : rf.toUpperCase() === 'NO' ? 'NO' : 'SI', rfOtro: !rf ? d.rfOtro : rf.toUpperCase() === 'NO' ? '' : rf, ccv: t.ccv || d.ccv,
  };
}
/** vincular el ATS de inicio: trae supervisor y radio (y frente / empresa si la tarea no los fijó) */
function datosAts(a: Pick<AtsInicio, 'codigo' | 'horaAut' | 'supervisor' | 'radio' | 'frente' | 'empresa'>, d: Doc): Partial<Doc> {
  const fija = d.enListado === 'SI';
  return {
    atsIni: a.codigo, atsIniHora: a.horaAut, supervisor: a.supervisor || d.supervisor, radio: a.radio || d.radio,
    frente: fija && d.frente.trim() ? d.frente : a.frente || d.frente, empresa: fija && d.empresa.trim() ? d.empresa : a.empresa || d.empresa,
  };
}

export function TtrPantalla() {
  const s = useAts();
  const d = s.actual!;
  const paso = s.paso;
  const c = s.cambiar;
  const [msg, setMsg] = useState('');
  const [pickT, setPickT] = useState(false);
  const [pickA, setPickA] = useState(false);
  const [busca, setBusca] = useState('');
  const ed = d.estado === 'Borrador';
  const ed5 = d.estado === 'Abierto';
  const personal = s.pers.filter((p) => p.codigo === d.codigo).sort((a, b) => a.nro - b.nro);
  const tareaLis = s.tareas.find((t) => t.codigo === d.tareaCod);
  const habN = tareaLis?.habilitados.length ?? 0;
  const rfListado = tareaLis?.riesgoFatal.trim() ?? '';
  const cambio = d.cambios.includes('C');
  const estadoTxt = { Borrador: 'en preparación', Abierto: 'autorizada', Cerrado: 'cerrada', Detenido: 'detenida', 'No aplica': 'no aplica → ATS' }[d.estado];

  // al entrar: ATS de inicio (de este teléfono y SharePoint), vínculo automático y Listado al día
  useEffect(() => {
    void s.refrescarAtsInicio();
    if (navigator.onLine) void s.refrescarCatalogos();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const a = s.atsInicio.find((x) => x.origen === 'tel');
    if (ed && !d.atsIni && a) c((x) => datosAts(a, x));
  }, [d.codigo]);  // eslint-disable-line react-hooks/exhaustive-deps

  const cargarTarea = async (cod: string) => {
    const code = cod.trim().toUpperCase();
    if (!code) return s.avisar('Escaneá el QR o elegí la tarea del Listado.', 'aviso');
    let t = s.tareas.find((x) => x.codigo.toUpperCase() === code);
    if (!t && navigator.onLine) t = (await s.refrescarCatalogos())?.tareas.find((x) => x.codigo.toUpperCase() === code);
    if (!t) return s.avisar(`La tarea ${code} no está en el Listado de Tareas Rutinarias vigente${navigator.onLine ? '' : ' de este teléfono (sin señal no se pudo actualizar)'}. Si no está en el Listado, se hace con ATS 2.0.`, 'error');
    c((x) => datosTarea(t, x));
    s.avisar(`Tarea ${t.codigo} cargada.`);
  };
  const leerQrTarea = (leido: string) => {
    const x = leido.trim().toUpperCase();
    if (!x.startsWith('ATS2-T-')) return s.avisar(`Ese QR no es de una tarea del Listado (ATS2-T-…). Leí: ${x.slice(0, 40)}`, 'error');
    void cargarTarea(x.slice(7));
  };

  const noSirve = (cod: string, estado: string) => s.avisar(`El ATS ${cod}${estado === 'Detenido' ? ' fue detenido' : ' todavía no está autorizado por el supervisor'}: no sirve para la TTR.`, 'error');
  const noEsInicio = (cod: string) => s.avisar(`El ATS ${cod} no está marcado como de inicio de turno (pregunta del paso 1 del ATS 2.0): la TTR se vincula con un ATS 2.0 de inicio de turno.`, 'error');
  const leerQrAts = async (leido: string) => {
    const x = leido.trim().toUpperCase();
    if (!x.startsWith('ATS2-A-')) return s.avisar(`Ese QR no es de un ATS 2.0 (ATS2-A-…). Leí: ${x.slice(0, 40)}`, 'error');
    const cod = x.slice(7); const dia = diaDeCodigo(cod);
    if (!dia) return s.avisar(`Ese QR no tiene un código de ATS 2.0 válido. Leí: ${x.slice(0, 40)}`, 'error');
    if (diasEntre(dia, yyyymmdd()) > VIGENCIA_ATS_INICIO) {
      return s.avisar(`El ATS ${cod} es del ${ddmm(dia)} y venció el ${ddmm(sumarDias(dia, VIGENCIA_ATS_INICIO))}: el ATS de inicio de turno vale ${VIGENCIA_ATS_INICIO} días. Hacé un ATS 2.0 de inicio de turno nuevo.`, 'error');
    }
    const a = s.atsInicio.find((y) => y.codigo === cod);
    if (a) { c((y) => datosAts(a, y)); return s.avisar('ATS de inicio de turno vinculado.'); }
    const loc = s.docs.find((y) => y.codigo === cod);
    if (loc && loc.inicioTurno !== 'SI') return noEsInicio(cod);
    if (loc && loc.estado !== 'Abierto' && loc.estado !== 'Cerrado') return noSirve(cod, loc.estado);
    const r = navigator.onLine ? await s.api.registro(cod).catch(() => null) : null;
    if (r && r.inicioTurno !== 'SI') return noEsInicio(cod);
    if (r && r.estado !== 'Abierto' && r.estado !== 'Cerrado') return noSirve(cod, r.estado);
    if (r) { c((y) => datosAts(r, y)); return s.avisar('ATS de inicio de turno vinculado.'); }
    c({ atsIni: cod, atsIniHora: `${cod.slice(11, 13)}:${cod.slice(13, 15)}` });
    s.avisar(`ATS ${cod} vinculado sin poder verificarlo (${navigator.onLine ? 'todavía no llegó a SharePoint' : 'sin señal'}).`, 'aviso');
  };

  /** cambió algo o la tarea no está en el Listado: TTR "No aplica" (o se descarta) y ATS 2.0 con los datos */
  const aAts = () => {
    if (ed && cambio) {
      const lista = CAMBIOS.filter((_, i) => d.cambios[i] === 'C').map((k) => k.t).join(', ');
      c((x) => ({ estado: 'No aplica', resultado: `TTR no aplica: cambió ${lista}`, cerradoEn: new Date().toISOString(), ...aEnviar(x) }));
    } else s.descartar(d.codigo);
    s.crear('ATS', { tarea: d.tarea, frente: d.frente, procedimiento: d.procedimiento, empresa: d.empresa, supervisor: d.supervisor, radio: d.radio, turno: d.turno, rf: d.rf, rfOtro: d.rfOtro, ccv: d.ccv });
    s.setPaso(1);
    s.ir({ id: 'ats' });
  };

  const validar = (n: number) => {
    switch (n) {
      case 1: return d.enListado !== 'SI' ? 'Escaneá o elegí la tarea del Listado. Si no está, se hace con ATS 2.0.'
        : !d.atsIni.trim() ? 'Vinculá el ATS 2.0 de inicio de turno: sin él no se inicia el trabajo.' : '';
      case 2: return d.v360.slice(0, 6).includes('') ? 'Respondé las 6 preguntas.'
        : d.v360.slice(0, 6).includes('N') ? 'Hay respuestas NO: detengan la tarea y contacten al supervisor antes de iniciar.' : '';
      case 3: return d.cambios.includes('') ? 'Contestá las 8 condiciones, una por una.' : cambio ? 'Cambió algo: la TTR no aplica. Hacé un ATS 2.0.'
        : !d.rf ? 'Indicá si la tarea tiene riesgo fatal.' : d.rf === 'SI' && !d.rfOtro.trim() ? 'Indicá cuál es el riesgo fatal.' : '';
      case 4: return ed ? 'Autorizá la TTR para pasar al término.' : '';
      default: return '';
    }
  };
  const irPaso = (n: number) => { setMsg(''); s.setPaso(n); window.scrollTo?.(0, 0); };
  const siguiente = () => {
    if (paso === 5) {
      if (d.estado !== 'Abierto') return s.alInicio();
      const m = !d.horaFin.trim() ? 'Completá la hora de término.' : !d.areaLimpia ? 'Indicá si el área quedó limpia y sin pendientes.' : '';
      if (m) return setMsg(m);
      c((x) => ({ estado: 'Cerrado', resultado: x.areaLimpia === 'NO' ? 'Cerrada con pendientes en el área (informado al supervisor)' : 'Cerrada', cerradoEn: new Date().toISOString(), ...aEnviar(x) }));
      s.avisar('TTR cerrada. Se envía apenas haya señal.');
      return s.alInicio();
    }
    const m = ed ? validar(paso) : '';
    if (m) return setMsg(m);
    if (ed) c((x) => ({ paso: Math.max(x.paso, paso + 1) }));
    irPaso(paso + 1);
  };
  const detener = () => {
    const nos = d.v360.slice(0, 6).map((v, i) => (v === 'N' ? i + 1 : 0)).filter(Boolean).join(', ');
    c((x) => ({ estado: 'Detenido', resultado: `Detenido en la verificación del equipo: preguntas ${nos}`, cerradoEn: new Date().toISOString(), ...aEnviar(x) }));
    s.alInicio();
  };
  const tareasFiltradas = s.tareas.filter((t) => { const b = busca.trim().toLowerCase(); return !b || [t.tarea, t.codigo, t.frente].some((x) => x.toLowerCase().includes(b)); });

  return (
    <div className="ats2-pant">
      <Encabezado color="blue" titulo="TTR · Tarea Rutinaria" sub={`${d.codigo} · ${estadoTxt}`} onAtras={() => s.alInicio()}
        derecha={ed ? <button type="button" className="ats2-hdr-btn" onClick={() => { s.descartar(d.codigo); s.alInicio(); }}>Descartar</button> : null} />
      <Pasos nombres={ed ? NOMBRES.slice(0, 4) : NOMBRES} actual={paso} hasta={d.paso} todos={!ed} color="blue" onIr={irPaso} />

      <main className="ats2-cuerpo ats2-cuerpo-pasos">
        {paso === 1 && <>
          <div className="ats2-titfila"><h3 className="ats2-h3">Tarea del Listado</h3>
            {ed && d.enListado !== 'SI' && <button type="button" className="ats2-enlace ats2-rojo" onClick={aAts}>¿No está? → ATS 2.0</button>}</div>
          {d.enListado === 'SI' ? (
            <div className="ats2-ok">
              <div className="ats2-ok-fila"><b>✓ {d.tareaCod} · en el Listado</b>{ed && <button type="button" className="ats2-btn-pildora" onClick={() => c({ enListado: '' })}>Cambiar</button>}</div>
              <div className="ats2-semi">{d.tarea}</div>
              <small>Procedimiento: {d.procedimiento || '-'}</small>
            </div>
          ) : <>
            <BotonEscanear texto="Escanear QR de la tarea" disabled={!ed} onLeido={leerQrTarea} />
            <button type="button" className="ats2-btn ats2-btn-borde ats2-btn-alto" disabled={!ed}
              onClick={() => { setBusca(''); setPickT(true); if (navigator.onLine) void s.refrescarCatalogos(); }}>Elegir del Listado o buscar el código</button>
          </>}
          <h3 className="ats2-h3">ATS 2.0 de inicio de turno</h3>
          {d.atsIni ? (
            <div className="ats2-ok ats2-ok-fila">
              <b>✓ {d.atsIni}{d.atsIniHora && <><br /><small>inicio {d.atsIniHora}</small></>}</b>
              {ed && <button type="button" className="ats2-btn-pildora" onClick={() => c({ atsIni: '', atsIniHora: '' })}>Cambiar</button>}
            </div>
          ) : <>
            <BotonEscanear texto="Escanear QR del ATS" disabled={!ed} onLeido={(t) => void leerQrAts(t)} />
            <button type="button" className="ats2-btn ats2-btn-borde ats2-btn-alto" disabled={!ed} onClick={() => { setPickA(true); void s.refrescarAtsInicio(); }}>Elegir de la lista</button>
          </>}
        </>}

        {paso === 2 && <>
          <h3 className="ats2-h3">¿El equipo está en condiciones?</h3>
          <p className="ats2-nota">Las 6 preguntas críticas. Si alguna es NO, se detiene la tarea.</p>
          {Q360.slice(0, 6).map((q, i) => (
            <div key={q.n} className="ats2-tarj">
              <div className="ats2-preg-cab"><img src={ICONOS[`q${q.n}`]} alt="" /><span className="ats2-semi">{q.q}</span></div>
              <Chips chico valor={d.v360[i]} editable={ed}
                onCambio={(v) => c((x) => ({ v360: conValor(x.v360, i, v), noHist: v === 'N' && !x.noHist.includes(i + 1) ? [...x.noHist, i + 1] : x.noHist }))}
                opciones={[{ texto: 'SI', valor: 'S', color: 'green' }, { texto: 'NO', valor: 'N', color: 'alert' }, { texto: 'N/A', valor: 'A', color: 'gray', oculto: !q.na }]} />
            </div>
          ))}
          {d.v360.slice(0, 6).includes('N') && <>
            <Banda>Hay un NO: detengan la tarea y contacten al supervisor antes de iniciar.</Banda>
            {ed && <button type="button" className="ats2-btn ats2-btn-alert" onClick={detener}>Registrar detención y salir</button>}
          </>}
        </>}

        {paso === 3 && <>
          <h3 className="ats2-h3">¿Algo cambió hoy?</h3>
          <p className="ats2-nota">Contestá las 8, una por una. Si cambió algo, la TTR no aplica y se hace un ATS 2.0.</p>
          {CAMBIOS.map((k, i) => (
            <div key={k.t} className="ats2-tarj">
              <div className="ats2-preg-cab"><img src={ICONOS[`t${i + 1}`]} alt="" /><span><b className="ats2-azul-osc">{k.t}</b><br /><small className="ats2-nota">{k.s}</small></span></div>
              <Chips chico valor={d.cambios[i]} editable={ed} onCambio={(v) => c((x) => ({ cambios: conValor(x.cambios, i, v) }))}
                opciones={[{ texto: 'No cambió', valor: 'N', color: 'green' }, { texto: 'Cambió → ATS 2.0', valor: 'C', color: 'alert' }]} />
            </div>
          ))}
          {cambio && <>
            <Banda>Cambió algo: esta tarjeta no aplica. Hagan un ATS 2.0.</Banda>
            {ed && <button type="button" className="ats2-btn ats2-btn-alert" onClick={aAts}>Cambió algo: hacer ATS 2.0</button>}
          </>}
          <h3 className="ats2-h3">Riesgo fatal</h3>
          {rfListado ? (
            <Banda tono={d.rf === 'SI' ? 'malSuave' : 'okSuave'}>
              {d.rf === 'SI' ? `Según el Listado tiene riesgo fatal: ${d.rfOtro}. Hagan la CCV antes de iniciar.` : 'Según el Listado, la tarea no tiene riesgo fatal.'}
            </Banda>
          ) : <>
            <Chips valor={d.rf} editable={ed} onCambio={(v) => c({ rf: v })} opciones={[{ texto: 'Tiene riesgo fatal', valor: 'SI', color: 'alert' }, { texto: 'No tiene', valor: 'NO' }]} />
            {d.rf === 'SI' && <Campo titulo="¿Cuál?" valor={d.rfOtro} editable={ed} onCambio={(v) => c({ rfOtro: v })} />}
          </>}
          {d.rf === 'SI' && <Campo titulo="N° de la CCV realizada" valor={d.ccv} editable={ed} pista="Ej.: CCV-0123" onCambio={(v) => c({ ccv: v })} />}
        </>}

        {paso === 4 && <>
          <h3 className="ats2-h3">Declaración y firmas</h3>
          <p className="ats2-nota">Cada trabajador firma por sí mismo.</p>
          <div className="ats2-decl">Conozco el procedimiento de esta tarea y hoy se hace igual que siempre: mismo lugar, mismos equipos y mismo personal, sin cambios de clima ni interferencias. Si algo cambia, detenemos la tarea y hacemos un ATS 2.0.</div>
          <Banda tono={habN ? 'okSuave' : 'malSuave'}>
            {habN ? `Pueden firmar ${habN} persona(s) habilitada(s) para ${d.tareaCod}.`
              : `La tarea ${d.tareaCod} no tiene personal habilitado: nadie puede firmar. Hagan un ATS 2.0 o pidan a HSS que lo habilite.`}
          </Banda>
          {ed && <button type="button" className="ats2-btn ats2-btn-blue ats2-btn-alto" disabled={!habN} onClick={() => s.ir({ id: 'persona' })}>＋  Agregar trabajador y firmar</button>}
          {personal.map((p) => (
            <div key={p.nro} className="ats2-persona">
              <span className="ats2-persona-n ats2-blue">{p.nro}</span>
              <span className="ats2-persona-d"><b>{p.nombre}</b><small>{p.empresa}<br />{p.documento} · {p.hora}</small></span>
              <img src={p.firma} alt={`Firma de ${p.nombre}`} className="ats2-persona-f" />
              {ed && p.sync !== 'enviado' && <button type="button" className="ats2-x" aria-label="Quitar" onClick={() => s.quitarFirma(d.codigo, p.nro)}>✕</button>}
            </div>
          ))}
          <div className="ats2-sup">
            <div className="ats2-sup-t">Supervisor que autoriza: {d.supervisor}</div>
            <div className={ed ? 'ats2-nota' : 'ats2-verde'}>{ed ? 'Autorizá cuando hayan firmado todos.' : `TTR autorizada a las ${d.horaAut}.`}</div>
            {d.firmaSup && <img src={d.firmaSup} alt="Firma del supervisor" className="ats2-firma-img" />}
            {ed && <button type="button" className="ats2-btn ats2-btn-green" onClick={() => (personal.length ? s.ir({ id: 'firma', para: 'autorizar' }) : setMsg('Agregá al menos un trabajador con su firma.'))}>✍  Firmar y autorizar TTR</button>}
          </div>
        </>}

        {paso === 5 && <>
          <h3 className="ats2-h3">Término de la tarea</h3>
          <p className="ats2-nota">Al terminar la tarea.</p>
          <div className="ats2-fila ats2-fila-abajo">
            <Campo ancho="mitad" titulo="Hora de término" valor={d.horaFin} editable={ed5} pista="hh:mm" onCambio={(v) => c({ horaFin: v })} />
            {ed5 && <button type="button" className="ats2-btn ats2-btn-borde" onClick={() => c({ horaFin: hhmm() })}>Ahora</button>}
          </div>
          <Chips titulo="Área limpia y sin pendientes" valor={d.areaLimpia} editable={ed5} onCambio={(v) => c({ areaLimpia: v })}
            opciones={[{ texto: 'SI', valor: 'SI', color: 'green' }, { texto: 'NO → avisar', valor: 'NO', color: 'alert' }]} />
          <Banda tono="navy">SI CAMBIAN LAS CONDICIONES DURANTE LA TAREA, DETÉNGANSE Y HAGAN UN ATS 2.0</Banda>
        </>}
      </main>

      {msg && <div className="ats2-msg">{msg}</div>}
      <footer className="ats2-pie-fijo">
        {paso > 1 && <button type="button" className="ats2-btn ats2-btn-borde ats2-borde-blue" onClick={() => irPaso(paso - 1)}>‹  Anterior</button>}
        <button type="button" className={`ats2-btn ats2-crece ${paso === 5 && d.estado === 'Abierto' ? 'ats2-btn-green' : 'ats2-btn-blue'}`} disabled={paso === 4 && ed} onClick={siguiente}>
          {paso === 5 ? (d.estado === 'Abierto' ? 'Cerrar TTR' : 'Volver al inicio') : paso === 4 && ed ? 'Autorizá la TTR arriba' : 'Siguiente  ›'}
        </button>
      </footer>

      {pickT && (
        <Panel titulo={`Listado de Tareas Rutinarias (${s.tareas.length})`} onCerrar={() => setPickT(false)}>
          <input className="ats2-input" value={busca} placeholder="Buscar por tarea, código o frente" onChange={(e) => setBusca(e.target.value)} />
          {s.tareas.length === 0 && <p className="ats2-nota">{s.online ? 'No hay tareas activas en el Listado de Tareas Rutinarias.' : 'Sin señal: el Listado de este teléfono está vacío. Con señal se descarga solo.'}</p>}
          {tareasFiltradas.map((t) => (
            <button key={t.codigo} type="button" className="ats2-opcion" onClick={() => { c((x) => datosTarea(t, x)); setPickT(false); }}>
              <small className="ats2-azul">{t.codigo}{t.frente ? ` · ${t.frente}` : ''}</small><b>{t.tarea}</b>
            </button>
          ))}
        </Panel>
      )}
      {pickA && (
        <Panel titulo={`ATS de inicio de turno (${s.atsInicio.length})`} sub={`Autorizados en los últimos ${VIGENCIA_ATS_INICIO} días · ☁ = hecho en otro teléfono`} onCerrar={() => setPickA(false)}>
          {s.atsInicio.length === 0 && <p className="ats2-nota">{s.online ? `No hay ATS de inicio de turno autorizados en los últimos ${VIGENCIA_ATS_INICIO} días.` : 'Sin señal: solo se ven los ATS de este teléfono, y no hay ninguno.'}</p>}
          {s.atsInicio.map((a) => (
            <button key={a.codigo} type="button" className="ats2-opcion" onClick={() => { c((x) => datosAts(a, x)); setPickA(false); s.avisar('ATS de inicio de turno vinculado.'); }}>
              <small className="ats2-azul">{a.codigo} · {a.codigo.slice(8, 10)}/{a.codigo.slice(6, 8)} {a.horaAut}{a.origen === 'sp' ? '  ☁' : ''}</small>
              <b>{a.frente || '-'}{a.supervisor ? ` · ${a.supervisor}` : ''}</b>
            </button>
          ))}
        </Panel>
      )}
    </div>
  );
}
