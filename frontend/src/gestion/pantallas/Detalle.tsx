// Detalle de un ATS / TTR (ScrReg): QR o vínculos de la TTR, datos, TTR vinculadas, firmas del personal y del supervisor.
import { useEffect, useState, type ReactNode } from 'react';
import { ImagenQr } from '../../ats2/componentes';
import { CONTROLES, Q360 } from '../../ats2/catalogo';
import { useGestion } from '../estado';
import { Boton, Dato, EncabezadoDetalle, EtiquetaEstado, EtiquetaTipo, Tabla, Tarjeta, useTitulo, type Columna } from '../componentes';
import type { Desde, DetalleRegistro, FirmaPersonal, Registro } from '../tipos';
import { ddmmaaaaDeDia, esInicioAutorizado, fechaHora, lista360, paresDosPuntos, paresIgual, textoEstadoLargo, texto, valeHastaDe, vigente } from '../util';

export function Detalle({ codigo, desde }: { codigo: string; desde: Desde }) {
  useTitulo(codigo);
  const s = useGestion();
  const [det, setDet] = useState<DetalleRegistro | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let vivo = true;
    setDet(null); setError('');
    s.api.registro(codigo).then((d) => { if (vivo) setDet(d); }).catch((e) => { if (vivo) setError(s.mensaje(e)); });
    return () => { vivo = false; };
  }, [codigo, s.api, s.mensaje]);

  const volverTexto = desde === 'validos' ? 'ATS válidos' : 'ATS cargados';
  const volver = () => s.ir({ id: desde });

  if (error) {
    return (
      <>
        <EncabezadoDetalle volver={volverTexto} onVolver={volver} titulo={codigo} />
        <Tarjeta><p className="ats2g-rojo">{error}</p></Tarjeta>
      </>
    );
  }
  if (!det) return <><EncabezadoDetalle volver={volverTexto} onVolver={volver} titulo={codigo} /><div className="ats2g-cargando">Cargando…</div></>;

  const r = det.registro;
  const c = (k: string) => texto(det.campos[k]);
  const esAts = r.tipo === 'ATS';
  const ok = esInicioAutorizado(r);
  const vh = valeHastaDe(r);
  const vig = vigente(r);

  const imprimir = () => s.ir({
    id: 'imprimir', titulo: 'QR del ATS',
    tarjetas: [{ kind: 'ATS 2.0', code: `ATS2-A-${r.codigo}`, l1: r.codigo, l2: r.tarea, l3: `${r.frente ? `${r.frente} · ` : ''}${fechaHora(r.fechaInicio)}` }],
    volver: { id: 'registro', codigo, desde },
  });

  // ---- textos compuestos (los mismos que la app)
  const cierre = c('HoraTermino') ? `Terminó ${c('HoraTermino')}${c('SupervisorCierre') ? ` · ${c('SupervisorCierre')}` : ''}` : r.estado === 'Cerrado' ? 'Cerrado' : 'Sin cerrar';
  const fin = esAts && ok ? `Hasta ${ddmmaaaaDeDia(vh)} · ${vig ? 'vigente' : 'vencido'}` : r.fechaCierre ? `Cerrado ${fechaHora(r.fechaCierre)}` : '';
  const rf = c('RiesgoFatal') === 'SI'
    ? [c('RiesgosFatales'), c('OtroRiesgoFatal')].filter(Boolean).join('; ')
    : c('RiesgoFatal') === 'NO' ? 'No tiene' : '';
  const v360 = lista360(c('Verif360'));
  const rnf = paresDosPuntos(c('RiesgosNoFatales'));
  const cierreChecks = paresIgual(c('CierreChecks')).filter((x) => x.v && x.v !== '-');   // un ATS abierto guarda "actividad=-"
  const cambios = paresIgual(c('Cambios'));
  const nombreCtl = (n: number) => CONTROLES[n - 1]?.c ?? `control ${n}`;

  const colTtr: Columna<Registro>[] = [
    { titulo: 'N°', ancho: 172, render: (t) => <b className="ats2g-navy">{t.codigo}</b> },
    { titulo: 'Inicio', ancho: 124, render: (t) => <span className="ats2g-muted">{fechaHora(t.fechaInicio)}</span> },
    { titulo: 'Tarea', render: (t) => t.tarea || t.tareaRutinaria || '(sin tarea)' },
    { titulo: 'Empresa', sec: true, ancho: '16%', render: (t) => <span className="ats2g-muted">{t.empresa}</span> },
    { titulo: 'Firmas', ancho: 72, al: 'centro', render: (t) => t.personasN || 0 },
    { titulo: 'Estado', ancho: 124, al: 'centro', render: (t) => <EtiquetaEstado estado={t.estado} /> },
  ];
  const colPer: Columna<FirmaPersonal>[] = [
    { titulo: 'N°', ancho: 48, al: 'centro', render: (p) => <b className="ats2g-navy">{p.nro}</b> },
    { titulo: 'Apellido y nombre', render: (p) => <b>{p.nombre}</b> },
    { titulo: 'DNI / RUT', ancho: 120, render: (p) => p.documento },
    { titulo: 'Cargo', sec: true, ancho: '12%', render: (p) => <span className="ats2g-muted">{p.cargo}</span> },
    { titulo: 'Empresa', sec: true, ancho: '12%', render: (p) => <span className="ats2g-muted">{p.empresa}</span> },
    { titulo: 'Hora', ancho: 70, render: (p) => <span className="ats2g-muted">{p.hora}</span> },
    { titulo: 'Origen', ancho: 120, render: (p) => <span className="ats2g-muted">{p.origen}</span> },
    { titulo: 'Firma', ancho: 184, render: (p) => (p.firma ? <img src={p.firma} alt={`Firma de ${p.nombre}`} className="ats2g-firma-chica" /> : <span className="ats2g-muted">(sin imagen)</span>) },
  ];

  return (
    <>
      <EncabezadoDetalle volver={volverTexto} onVolver={volver} etiqueta={<EtiquetaTipo tipo={r.tipo} />} titulo={r.codigo}
        sub={`${textoEstadoLargo(r.estado)} · inicio ${fechaHora(r.fechaInicio)}${r.tarea ? ` · ${r.tarea}` : ''}`}
        derecha={esAts ? <Boton tipo="borde" onClick={imprimir}>🖨  Imprimir QR</Boton> : undefined} />

      <div className="ats2g-cols">
        {esAts ? (
          <Tarjeta titulo="QR del ATS de inicio de turno" clase="ats2g-col-qr">
            <div className="ats2g-qr-centro">
              <ImagenQr texto={`ATS2-A-${r.codigo}`} lado={220} />
              <b className="ats2g-navy">ATS2-A-{r.codigo}</b>
              <p className={`ats2g-nota ${ok && vig ? 'ats2g-verde' : ''}`}>
                {ok ? `La TTR lo escanea para vincularse. Vale hasta el ${ddmmaaaaDeDia(vh)} (${vig ? 'vigente' : 'vencido'}).`
                  : r.inicioTurno === 'SI' ? 'Todavía no está autorizado: la TTR no se puede vincular.'
                    : 'No es de inicio de turno: la TTR no se vincula a este ATS.'}
              </p>
            </div>
          </Tarjeta>
        ) : (
          <Tarjeta titulo="Vínculos de la TTR" clase="ats2g-col-qr">
            <Dato cap="Tarea del Listado de Tareas Rutinarias" valor={c('EnListado') === 'SI' ? c('TareaRutinaria') : 'No está en el Listado'} />
            <Dato cap="ATS 2.0 de inicio de turno vinculado" valor={c('ATSInicio')
              ? <button type="button" className="ats2g-enlace" onClick={() => s.ir({ id: 'registro', codigo: c('ATSInicio'), desde })}>
                {c('ATSInicio')}{c('ATSInicioHora') ? ` · inicio ${c('ATSInicioHora')}` : ''}
              </button>
              : 'Sin vincular'} />
            <Dato cap="¿Algo cambió hoy?" valor={c('CambioDetectado') === 'SI' ? 'Sí: se hizo un ATS 2.0' : c('CambioDetectado') === 'NO' ? 'No cambió nada' : ''} />
            <Dato cap="Área limpia al terminar" valor={c('AreaLimpia')} />
          </Tarjeta>
        )}

        <Tarjeta titulo="Datos" clase="ats2g-crece">
          <div className="ats2g-grid3">
            <Dato cap="Fecha y hora de inicio" valor={fechaHora(r.fechaInicio)} />
            <Dato cap="Turno" valor={`${r.turno}${r.inicioTurno === 'SI' ? ' · inicio de turno' : ''}`} />
            <Dato cap="Cargado por" valor={<>{r.creadoPorNombre}{r.creadoPorEmail && <small className="ats2g-muted"> · {r.creadoPorEmail}</small>}<br /><small className="ats2g-muted">{[r.appVersion, r.creadoEnApp].filter(Boolean).join(' · ')}</small></>} />
            <Dato cap="Frente / área" valor={r.frente} />
            <Dato cap="Lugar / cota" valor={`${c('Lugar')}${c('Cota') ? ` · cota ${c('Cota')}` : ''}`} />
            <Dato cap="Dueño de área" valor={c('DuenoArea')} />
            <Dato cap="Empresa ejecutora" valor={r.empresa} />
            <Dato cap="Contratista" valor={c('Contratista')} />
            <Dato cap="Supervisor que autoriza" valor={`${r.supervisor}${r.radio ? ` · radio ${r.radio}` : ''}`} />
            <Dato cap="Procedimiento" valor={c('Procedimiento')} />
            <Dato cap="En la matriz IPER" valor={c('MatrizIPER')} />
            <Dato cap="CCV" valor={c('CCV')} />
            <Dato cap="Resultado" valor={r.resultado} />
            <Dato cap="Cierre" valor={cierre} />
            <Dato cap="Fin / vale hasta" valor={fin} />
            <Dato cap="País" valor={c('Pais')} />
            <Dato cap="Ubicación (GPS)" valor={c('Latitud') ? `${c('Latitud')}, ${c('Longitud')}` : ''} />
            <Dato cap="Reconocimiento" valor={c('Reconocido') ? `${c('Reconocido')}${c('MotivoReconocimiento') ? ` · ${c('MotivoReconocimiento')}` : ''}` : ''} />
            <Dato ancho cap="Tarea" valor={r.tarea} />
            <Dato ancho cap="Riesgo fatal" valor={rf} />
            <Dato ancho cap={esAts ? 'Verificación 360° (12 preguntas)' : 'Preguntas del equipo (6)'} valor={v360.length ? (
              <div className="ats2g-360">
                {v360.map((x) => <span key={x.n} title={Q360[Number(x.n) - 1]?.q} className={x.v === 'NO' ? 'ats2g-360-no' : x.v === 'N/A' ? 'ats2g-360-na' : ''}>{x.n} · {x.v}</span>)}
                {c('NoEn360') && <span className="ats2g-360-no" title="Preguntas que en algún momento fueron NO">alguna vez NO: {c('NoEn360')}</span>}
              </div>) : ''} />
            {esAts && (
              <Dato ancho cap="Riesgos sin potencial fatal y controles" valor={rnf.length || c('OtroRiesgo') || c('ControlAdicional') ? (
                <ul className="ats2g-ul">
                  {rnf.map((x) => <li key={x.k}><b>{x.k}</b>: {x.nums.map(nombreCtl).join(', ') || '-'}</li>)}
                  {c('OtroRiesgo') && <li><b>{c('OtroRiesgo')}</b>: {c('OtroRiesgoControles') || '-'}</li>}
                  {c('ControlAdicional') && <li><b>Control adicional</b>: {c('ControlAdicional')}</li>}
                </ul>) : ''} />
            )}
            {esAts && (
              <Dato ancho cap="Actividades de cierre" valor={cierreChecks.length ? (
                <ul className="ats2g-ul">{cierreChecks.map((x) => <li key={x.k}>{x.k}: <b>{x.v}</b></li>)}</ul>) : ''} />
            )}
            {!esAts && (
              <Dato ancho cap="¿Algo cambió hoy?" valor={cambios.length ? (
                <ul className="ats2g-ul">{cambios.map((x) => <li key={x.k} className={x.v === 'Cambió' ? 'ats2g-rojo' : ''}>{x.k}: <b>{x.v}</b></li>)}</ul>) : ''} />
            )}
            <Dato ancho cap="Observaciones del cierre" valor={c('ObsCierre')} />
          </div>
        </Tarjeta>
      </div>

      {esAts && r.inicioTurno === 'SI' && (
        <Tarjeta titulo={`TTR vinculadas a este ATS (${det.ttr.length})`}>
          <Tabla columnas={colTtr} filas={det.ttr} clave={(t) => t.codigo} onFila={(t) => s.ir({ id: 'registro', codigo: t.codigo, desde })} vacio="Todavía no hay TTR vinculadas a este ATS." />
        </Tarjeta>
      )}

      <Tarjeta titulo={`Personal que firmó (${det.personal.length})`}>
        <Tabla columnas={colPer} filas={[...det.personal].sort((a, b) => a.nro - b.nro)} clave={(p) => `${p.nro}-${p.documento}`} vacio="Todavía no firmó nadie." />
      </Tarjeta>

      <div className="ats2g-cols">
        <Firma titulo="Firma del supervisor que autorizó" imagen={c('FirmaSupervisor')} nombre={r.supervisor} nota={r.radio ? `Radio ${r.radio}` : ''} />
        {(c('FirmaCierre') || c('SupervisorCierre')) && (
          <Firma titulo="Firma del supervisor que cerró" imagen={c('FirmaCierre')} nombre={c('SupervisorCierre')} nota={c('HoraTermino') ? `Terminó ${c('HoraTermino')}` : ''} />
        )}
      </div>
    </>
  );
}

function Firma({ titulo, imagen, nombre, nota }: { titulo: string; imagen: string; nombre: string; nota?: ReactNode }) {
  return (
    <Tarjeta titulo={titulo} clase="ats2g-col-firma">
      <div className="ats2g-firma-sup">
        {imagen ? <img src={imagen} alt={titulo} /> : <div className="ats2g-firma-vacia">Sin firma</div>}
        <div><Dato cap="Supervisor" valor={nombre} />{nota && <div className="ats2g-nota">{nota}</div>}</div>
      </div>
    </Tarjeta>
  );
}
