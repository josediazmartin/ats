// ATS 2.0 (ScrAts): 6 pasos del formato ATS 2.0 V1.5. Autoriza el supervisor con su firma (Abierto) y al terminar
// la tarea se cierra con otra firma (Cerrado). Las validaciones y textos son los de la app de Power Apps.
import { useState } from 'react';
import { useAts } from '../estado';
import { ICONOS } from '../iconos';
import { CIERRE, CONTROLES, Q360, RIESGOS_FATALES, RIESGOS_NO_FATALES } from '../catalogo';
import { Banda, Campo, Chips, Encabezado, Panel, Pasos, Seccion } from '../componentes';
import type { Doc } from '../tipos';
import { aEnviar, conValor, hhmm } from '../util';
import { infoQrAts } from './Inicio';

const NOMBRES = ['Datos', '360°', 'Fatales', 'Riesgos', 'Personal', 'Cierre'];
const COLOR_NIVEL = { 1: 'ats2-navy', 2: 'ats2-mid', 3: 'ats2-lightb' } as const;

function validar(d: Doc, paso: number): string {
  switch (paso) {
    case 1:
      if (!d.inicioTurno) return 'Indicá si es el ATS de inicio de turno.';
      if (!d.turno) return 'Indicá el turno.';
      if (!d.pais) return 'Elegí el país.';
      if (!d.frente.trim()) return 'Completá el frente / área de trabajo.';
      if (!d.tarea.trim()) return 'Completá la tarea a ejecutar.';
      if (!d.empresa.trim()) return 'Completá la empresa ejecutora.';
      if (!d.supervisor.trim()) return 'Completá el supervisor responsable.';
      if (!d.iper) return 'Indicá si la tarea está en la matriz IPER.';
      if (d.iper === 'NO') return 'La tarea no está en la matriz IPER: no se puede ejecutar.';
      return '';
    case 2:
      if (d.v360.includes('')) return 'Respondé las 12 preguntas.';
      if (d.v360.includes('N')) return 'Hay respuestas NO: detengan la tarea y contacten al supervisor. Cuando las medidas estén, cambiá la respuesta a SI o registrá la detención.';
      return '';
    case 3:
      if (!d.rf) return 'Indicá si la tarea tiene riesgos fatales.';
      if (d.rf === 'SI' && !d.rfSel.length && !d.rfOtro.trim()) return 'Marcá cuál o cuáles riesgos fatales tiene la tarea.';
      return '';
    case 4:
      if (d.r4.includes('')) return 'Marcá SI o NO en los 16 riesgos.';
      if (d.r4.some((v, i) => v === 'S' && !d.r4c[i].length)) return 'Cada riesgo marcado SI necesita al menos un EPP o control.';
      return '';
    case 5:
      return d.estado === 'Borrador' ? 'Autorizá el ATS para pasar al cierre.' : '';
    default: return '';
  }
}

function validarCierre(d: Doc): string {
  if (d.cierre.includes('')) return 'Marcá SI o N/A en las 9 actividades de cierre.';
  if (!d.horaFin.trim()) return 'Completá la hora de término.';
  if (!(d.supCierre || d.supervisor).trim()) return 'Completá el supervisor que cierra.';
  if (!d.firmaCierre) return 'Falta la firma del supervisor que cierra: tocá Firma del supervisor que cierra.';
  return '';
}

export function AtsPantalla() {
  const s = useAts();
  const d = s.actual!;
  const paso = s.paso;
  const [msg, setMsg] = useState('');
  const [pick, setPick] = useState(0);   // riesgo (1-16) con el selector de controles abierto
  const c = s.cambiar;
  const ed = d.estado === 'Borrador';     // pasos 1-5 editables
  const ed6 = d.estado === 'Abierto';     // cierre editable
  const personal = s.pers.filter((p) => p.codigo === d.codigo).sort((a, b) => a.nro - b.nro);
  const estadoTxt = { Borrador: 'en preparación', Abierto: 'autorizado', Cerrado: 'cerrado', Detenido: 'detenido', 'No aplica': 'no aplica' }[d.estado];

  const detener = (motivo: string) => {
    c((x) => ({ estado: 'Detenido', resultado: motivo, cerradoEn: new Date().toISOString(), ...aEnviar(x) }));
    s.alInicio();
  };
  const irPaso = (n: number) => { setMsg(''); s.setPaso(n); window.scrollTo?.(0, 0); };
  const siguiente = () => {
    if (paso === 6) {
      if (d.estado !== 'Abierto') return s.alInicio();
      const m = validarCierre(d);
      if (m) return setMsg(m);
      c((x) => ({ estado: 'Cerrado', resultado: 'Cerrado', supCierre: x.supCierre || x.supervisor, cerradoEn: new Date().toISOString(), ...aEnviar(x) }));
      s.avisar('ATS cerrado. Se envía apenas haya señal.');
      return s.alInicio();
    }
    const m = ed ? validar(d, paso) : '';
    if (m) return setMsg(m);
    if (ed) c((x) => ({ paso: Math.max(x.paso, paso + 1) }));
    irPaso(paso + 1);
  };
  const qr = () => s.ir({ id: 'qr', texto: `ATS2-A-${d.codigo}`, info: infoQrAts(d), desde: 'ats' });
  const r360 = (i: number, v: Doc['v360'][number]) => c((x) => ({ v360: conValor(x.v360, i, v), noHist: v === 'N' && !x.noHist.includes(i + 1) ? [...x.noHist, i + 1] : x.noHist }));

  return (
    <div className="ats2-pant">
      <Encabezado titulo={`ATS 2.0${d.inicioTurno === 'SI' ? ' · inicio de turno' : ''}`} sub={`${d.codigo} · ${estadoTxt}`}
        onAtras={() => s.alInicio()}
        derecha={ed ? <button type="button" className="ats2-hdr-btn" onClick={() => { s.descartar(d.codigo); s.alInicio(); }}>Descartar</button>
          : (d.estado === 'Abierto' || d.estado === 'Cerrado') ? <button type="button" className="ats2-hdr-btn ats2-hdr-btn-lleno" onClick={qr}>QR</button> : null} />
      <Pasos nombres={NOMBRES} actual={paso} hasta={d.paso} todos={!ed} color="navy" onIr={irPaso} />

      <main className="ats2-cuerpo ats2-cuerpo-pasos">
        {paso === 1 && <>
          <Seccion num="1" titulo="DESCRIPCIÓN GENERAL" nota="COMPLETAR ANTES DE LA TAREA" />
          <Chips titulo="¿Es el ATS 2.0 de inicio de turno?" valor={d.inicioTurno} editable={ed} onCambio={(v) => c({ inicioTurno: v })}
            opciones={[{ texto: 'SI', valor: 'SI' }, { texto: 'NO', valor: 'NO' }]} />
          <div className="ats2-fila">
            <div className="ats2-campo ats2-mitad"><span className="ats2-cap">Fecha</span><div className="ats2-solo">{new Date(d.creado).toLocaleDateString('es-AR')}</div></div>
            <Campo ancho="mitad" titulo="Hora de inicio" valor={d.horaIni} editable={ed} onCambio={(v) => c({ horaIni: v })} />
          </div>
          <Chips titulo="Turno" valor={d.turno} editable={ed} onCambio={(v) => c({ turno: v })} opciones={[{ texto: 'Día', valor: 'Día' }, { texto: 'Noche', valor: 'Noche' }]} />
          <Chips titulo="País" valor={d.pais} editable={ed} onCambio={(v) => c({ pais: v })} opciones={[{ texto: 'Chile', valor: 'Chile' }, { texto: 'Argentina', valor: 'Argentina (San Juan)' }]} />
          <Campo titulo="Frente / Área de trabajo" valor={d.frente} editable={ed} onCambio={(v) => c({ frente: v })} />
          <Campo titulo="Tarea a ejecutar" valor={d.tarea} editable={ed} multilinea onCambio={(v) => c({ tarea: v })} />
          <Campo titulo="Lugar específico" valor={d.lugar} editable={ed} onCambio={(v) => c({ lugar: v })} />
          <div className="ats2-fila">
            <Campo ancho="mitad" titulo="Cota aprox. (m s.n.m.)" valor={d.cota} editable={ed} onCambio={(v) => c({ cota: v })} />
            <Campo ancho="mitad" titulo="Radio / canal" valor={d.radio} editable={ed} onCambio={(v) => c({ radio: v })} />
          </div>
          <Campo titulo="Empresa ejecutora" valor={d.empresa} editable={ed} onCambio={(v) => c({ empresa: v })} />
          <Campo titulo="Contratista principal / EPCM" valor={d.contratista} editable={ed} onCambio={(v) => c({ contratista: v })} />
          <Campo titulo="Dueño de área Vicuña" valor={d.duenoArea} editable={ed} onCambio={(v) => c({ duenoArea: v })} />
          <Campo titulo="Procedimiento / Instructivo N°" valor={d.procedimiento} editable={ed} pista="Si no tiene, dejalo vacío e informá al supervisor y a HSS" onCambio={(v) => c({ procedimiento: v })} />
          <Campo titulo="Supervisor responsable" valor={d.supervisor} editable={ed} onCambio={(v) => c({ supervisor: v })} />
          <Chips titulo="¿Tarea en matriz IPER?" valor={d.iper} editable={ed} onCambio={(v) => c({ iper: v })}
            opciones={[{ texto: 'SI', valor: 'SI' }, { texto: 'NO', valor: 'NO', color: 'alert' }]} />
          {d.iper === 'NO' && <>
            <Banda>Si la tarea no está en la matriz IPER, no se puede ejecutar. Detengan la tarea hasta que se evalúe e incluya.</Banda>
            {ed && <button type="button" className="ats2-btn ats2-btn-alert" onClick={() => detener('Detenido: la tarea no está en la matriz IPER')}>Registrar detención y salir</button>}
          </>}
        </>}

        {paso === 2 && <>
          <Seccion num="2" titulo="VERIFICACIÓN PREVIA 360°" nota="PUNTO PRINCIPAL" oscuro />
          <p className="ats2-intro">Responde todo el equipo, en terreno y antes de empezar.</p>
          {Q360.map((q, i) => (
            <div key={q.n} className="ats2-preg">
              <div className={`ats2-preg-n ${COLOR_NIVEL[q.lv]}`}>{q.n}</div>
              <div className="ats2-preg-cuerpo">
                <div className="ats2-preg-cab"><img src={ICONOS[`q${q.n}`]} alt="" /><span className={q.lv === 1 ? 'ats2-semi' : ''}>{q.q}</span></div>
                <Chips chico valor={d.v360[i]} editable={ed} onCambio={(v) => r360(i, v)}
                  opciones={[{ texto: 'SI', valor: 'S', color: 'green' }, { texto: 'NO', valor: 'N', color: 'alert' }, { texto: 'N/A', valor: 'A', color: 'gray', oculto: !q.na }]} />
              </div>
            </div>
          ))}
          <Banda>Si alguna respuesta es NO, o alguien no se siente seguro para realizar el trabajo, detenga y contacte a su supervisor para implementar las medidas necesarias antes de iniciar.</Banda>
          {ed && d.v360.includes('N') && (
            <button type="button" className="ats2-btn ats2-btn-alert" onClick={() => detener(`Detenido en la verificación 360°: preguntas ${d.v360.map((v, i) => (v === 'N' ? i + 1 : 0)).filter(Boolean).join(', ')}`)}>
              Registrar detención y salir
            </button>
          )}
        </>}

        {paso === 3 && <>
          <Seccion num="3" titulo="RIESGOS FATALES VICUÑA" nota="PUNTO PRINCIPAL" oscuro />
          <Chips titulo="¿Tiene alguno de estos riesgos fatales?" valor={d.rf} editable={ed} onCambio={(v) => c({ rf: v })}
            opciones={[{ texto: 'SI', valor: 'SI', color: 'alert' }, { texto: 'NO', valor: 'NO' }]} />
          {d.rf === 'SI' && <>
            <div className="ats2-cap ats2-cap-grande">Si respondió SI, marque cuál o cuáles:</div>
            {RIESGOS_FATALES.map((f, i) => {
              const on = d.rfSel.includes(i + 1);
              return (
                <button key={f} type="button" disabled={!ed} className={`ats2-marca ${on ? 'ats2-marca-amb' : ''}`}
                  onClick={() => c((x) => ({ rfSel: on ? x.rfSel.filter((n) => n !== i + 1) : [...x.rfSel, i + 1] }))}>
                  <img src={ICONOS[`f${i + 1}`]} alt="" /><span className="ats2-marca-t ats2-mayus">{f}</span><span className={`ats2-check ${on ? 'ats2-check-on' : ''}`}>{on ? '✓' : ''}</span>
                </button>
              );
            })}
            <Campo titulo="Otro riesgo fatal (especifique)" valor={d.rfOtro} editable={ed} onCambio={(v) => c({ rfOtro: v })} />
            <Campo titulo="N° de CCV realizada(s)" valor={d.ccv} editable={ed} pista="Ej.: CCV-0123" onCambio={(v) => c({ ccv: v })} />
          </>}
          <Banda>Si identifica un riesgo de fatalidad en su tarea, debe realizar la CCV correspondiente antes de iniciar. Si un control crítico no está o no es efectivo, la tarea no se inicia.</Banda>
        </>}

        {paso === 4 && <>
          <Seccion num="4" titulo="RIESGOS SIN POTENCIAL FATAL" nota="PUNTO PRINCIPAL" oscuro />
          <p className="ats2-intro">1. Marque SI o NO en cada riesgo. 2. Por cada SI, elija el EPP o control que va a usar.</p>
          {RIESGOS_NO_FATALES.map((r, i) => {
            const ctl = [...d.r4c[i]].sort((a, b) => a - b);
            return (
              <div key={r} className="ats2-riesgo">
                <div className="ats2-preg-cab"><img src={ICONOS[`r${i + 1}`]} alt="" /><span className="ats2-semi">{r}</span></div>
                <div className="ats2-riesgo-fila">
                  <Chips chico valor={d.r4[i]} editable={ed} onCambio={(v) => c((x) => ({ r4: conValor(x.r4, i, v) }))}
                    opciones={[{ texto: 'SI', valor: 'S' }, { texto: 'NO', valor: 'N', color: 'gray' }]} />
                  {d.r4[i] === 'S' && <>
                    <span className={`ats2-ctl ${ctl.length ? 'ats2-verde' : 'ats2-rojo'}`}>{ctl.length ? `Controles N°: ${ctl.join(', ')}` : 'Falta elegir controles'}</span>
                    <button type="button" className="ats2-btn ats2-btn-borde ats2-btn-chico" onClick={() => setPick(i + 1)}>{ed ? 'Elegir' : 'Ver'}</button>
                  </>}
                </div>
              </div>
            );
          })}
          <Campo titulo="Otro riesgo (especifique)" valor={d.r4Otro} editable={ed} onCambio={(v) => c({ r4Otro: v })} />
          <Campo titulo="Controles N° del otro riesgo" valor={d.r4OtroCtr} editable={ed} pista="Ej.: 6, 15" onCambio={(v) => c({ r4OtroCtr: v })} />
          <Campo titulo="25 · Control adicional" valor={d.ctrlAdic} editable={ed} onCambio={(v) => c({ ctrlAdic: v })} />
        </>}

        {paso === 5 && <>
          <Seccion num="5" titulo="PERSONAL INVOLUCRADO" nota="CADA UNO FIRMA" />
          <div className="ats2-decl">Al firmar, declaro que participé en este ATS, conozco los riesgos de la tarea y los controles que debo aplicar.</div>
          {(d.estado === 'Borrador' || d.estado === 'Abierto') && (
            <button type="button" className="ats2-btn ats2-btn-blue ats2-btn-alto" onClick={() => s.ir({ id: 'persona' })}>＋  Agregar trabajador y firmar</button>
          )}
          <p className="ats2-nota">{personal.length} trabajador(es) firmaron{d.estado === 'Abierto' ? ' · quien se suma después del inicio firma antes de empezar' : ''}</p>
          {personal.map((p) => (
            <div key={p.nro} className="ats2-persona">
              <span className="ats2-persona-n ats2-navy">{p.nro}</span>
              <span className="ats2-persona-d"><b>{p.nombre}</b><small>{p.cargo ? `${p.cargo} · ` : ''}{p.empresa}<br />{p.documento} · {p.hora}{p.origen ? ` · ${p.origen}` : ''}</small></span>
              <img src={p.firma} alt={`Firma de ${p.nombre}`} className="ats2-persona-f" />
              {ed && p.sync !== 'enviado' && <button type="button" className="ats2-x" aria-label="Quitar" onClick={() => s.quitarFirma(d.codigo, p.nro)}>✕</button>}
            </div>
          ))}
          <div className="ats2-sup">
            <div className="ats2-sup-t">Supervisor que autoriza: {d.supervisor}</div>
            <div className={ed ? 'ats2-nota' : 'ats2-verde ats2-semi'}>
              {ed ? 'Verificá los controles y la firma de todos los trabajadores antes de autorizar. Al autorizar se habilita el QR para la TTR.'
                : `ATS autorizado a las ${d.horaAut}. Pueden iniciar la tarea.`}
            </div>
            {d.firmaSup ? <img src={d.firmaSup} alt="Firma del supervisor" className="ats2-firma-img" />
              : <div className="ats2-firma-vacia">El supervisor firma al autorizar, cuando ya firmaron todos los trabajadores.</div>}
            {ed && <button type="button" className="ats2-btn ats2-btn-green" onClick={() => (personal.length ? s.ir({ id: 'firma', para: 'autorizar' }) : setMsg('Agregá al menos un trabajador con su firma.'))}>✍  Firmar y autorizar ATS</button>}
            {(d.estado === 'Abierto' || d.estado === 'Cerrado') && <button type="button" className="ats2-btn ats2-btn-navy" onClick={qr}>▣  Mostrar QR para la TTR</button>}
          </div>
        </>}

        {paso === 6 && <>
          <Seccion num="6" titulo="CIERRE DE LA TAREA" nota="COMPLETAR DESPUÉS DE LA TAREA" />
          {ed ? <Banda tono="ambar">Primero autorizá el ATS en el paso 5. El cierre se completa después de la tarea.</Banda> : <>
            <p className="ats2-intro">Verifique que todo riesgo quedó controlado. Marque SI o N/A (no aplica).</p>
            {CIERRE.map((a, i) => (
              <div key={a} className="ats2-cierre">
                <span className="ats2-semi">{a}</span>
                <Chips chico valor={d.cierre[i]} editable={ed6} onCambio={(v) => c((x) => ({ cierre: conValor(x.cierre, i, v) }))}
                  opciones={[{ texto: 'SI', valor: 'S', color: 'green' }, { texto: 'N/A', valor: 'A', color: 'gray' }]} />
              </div>
            ))}
            <div className="ats2-fila ats2-fila-abajo">
              <Campo ancho="mitad" titulo="Hora de término" valor={d.horaFin} editable={ed6} pista="hh:mm" onCambio={(v) => c({ horaFin: v })} />
              {ed6 && <button type="button" className="ats2-btn ats2-btn-borde" onClick={() => c({ horaFin: hhmm() })}>Ahora</button>}
            </div>
            <Campo titulo="Observaciones de cierre" valor={d.obsCierre} editable={ed6} multilinea onCambio={(v) => c({ obsCierre: v })} />
            <Campo titulo="Supervisor que cierra el ATS" valor={d.supCierre || d.supervisor} editable={ed6} onCambio={(v) => c({ supCierre: v })} />
            {d.firmaCierre ? <img src={d.firmaCierre} alt="Firma de cierre" className="ats2-firma-img" />
              : ed6 && <div className="ats2-firma-vacia">Falta la firma del supervisor que cierra.</div>}
            {ed6 && <button type="button" className="ats2-btn ats2-btn-borde ats2-btn-alto" onClick={() => {
              if (!d.supCierre.trim()) c({ supCierre: d.supervisor });
              s.ir({ id: 'firma', para: 'cerrar' });
            }}>{d.firmaCierre ? '✍  Volver a firmar el cierre' : '✍  Firma del supervisor que cierra'}</button>}
            <Campo titulo="Reconocimiento al equipo (nombre)" valor={d.reconocido} editable={ed6} onCambio={(v) => c({ reconocido: v })} />
            <Campo titulo="Motivo del reconocimiento" valor={d.motivoRec} editable={ed6} onCambio={(v) => c({ motivoRec: v })} />
          </>}
          <Banda tono="navy">RECUERDE: SI CAMBIAN LAS CONDICIONES ANTES O DURANTE LA TAREA, DETÉNGASE Y REALICE UN NUEVO ATS</Banda>
        </>}
      </main>

      {msg && <div className="ats2-msg">{msg}</div>}
      <footer className="ats2-pie-fijo">
        {paso > 1 && <button type="button" className="ats2-btn ats2-btn-borde" onClick={() => irPaso(paso - 1)}>‹  Anterior</button>}
        <button type="button" className={`ats2-btn ats2-crece ${paso === 6 && d.estado === 'Abierto' ? 'ats2-btn-green' : 'ats2-btn-navy'}`}
          disabled={paso === 5 && ed} onClick={siguiente}>
          {paso === 6 ? (d.estado === 'Abierto' ? 'Cerrar ATS' : 'Volver al inicio') : paso === 5 && ed ? 'Autorizá el ATS arriba' : 'Siguiente  ›'}
        </button>
      </footer>

      {pick > 0 && (
        <Panel titulo={`EPP y controles para: ${RIESGOS_NO_FATALES[pick - 1]}`} sub="Azul = EPP (lo que me pongo) · Verde = controles" cerrar="Listo" onCerrar={() => setPick(0)}>
          {CONTROLES.map((k) => {
            const on = d.r4c[pick - 1].includes(k.n);
            return (
              <button key={k.n} type="button" disabled={!ed} className={`ats2-marca ats2-marca-ctl ${on ? 'ats2-marca-azul' : ''}`}
                onClick={() => c((x) => ({ r4c: conValor(x.r4c, pick - 1, on ? x.r4c[pick - 1].filter((n) => n !== k.n) : [...x.r4c[pick - 1], k.n]) }))}>
                <span className={`ats2-ctl-n ${k.g === 1 ? 'ats2-blue' : k.g === 2 ? 'ats2-green' : 'ats2-gray'}`}>{k.n}</span>
                {k.n <= 24 ? <img src={ICONOS[`c${k.n}`]} alt="" /> : <span className="ats2-img-hueco" />}
                <span className="ats2-marca-t">{k.c}</span>
                <span className={`ats2-check ${on ? 'ats2-check-on' : ''}`}>{on ? '✓' : ''}</span>
              </button>
            );
          })}
        </Panel>
      )}
    </div>
  );
}
