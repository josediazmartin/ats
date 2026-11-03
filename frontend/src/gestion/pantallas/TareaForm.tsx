// Alta / edición de una tarea rutinaria (ScrTarea): datos a la izquierda, QR y personal habilitado a la derecha.
import { useMemo, useState } from 'react';
import { ImagenQr } from '../../ats2/componentes';
import { RIESGOS_FATALES } from '../../ats2/catalogo';
import { useGestion } from '../estado';
import { Boton, Campo, Chip, EncabezadoDetalle, SiNoChips, Tarjeta, useTitulo } from '../componentes';
import type { SiNo, TareaG } from '../tipos';
import { coincide, ddmmaaaaDeDia, diaDeTexto, normDoc } from '../util';
import { tarjetaTarea } from './Tareas';

interface Form {
  cod: string; act: SiNo; ccv: string; tarea: string; proc: string; iperc: string; emp: string; area: string; frente: string;
  apr: string; fApr: string; fRev: string; rf: string; rfOtro: string; pers: string[];
}
const OTRO = '__otro__';

function inicial(t: TareaG | null, cantidad: number): Form {
  if (!t) {
    return { cod: `TR-${String(cantidad + 1).padStart(3, '0')}`, act: 'SI', ccv: '', tarea: '', proc: '', iperc: '', emp: '', area: '', frente: '', apr: '', fApr: '', fRev: '', rf: '', rfOtro: '', pers: [] };
  }
  const rfConocido = t.riesgoFatal === '' || t.riesgoFatal === 'NO' || RIESGOS_FATALES.includes(t.riesgoFatal);
  return {
    cod: t.codigo, act: t.activa === 'NO' ? 'NO' : 'SI', ccv: t.ccv, tarea: t.tarea, proc: t.procedimiento, iperc: t.anexoIperc, emp: t.empresa, area: t.area, frente: t.frente,
    apr: t.aprobadoPor, fApr: ddmmaaaaDeDia(t.fechaAprobacion), fRev: ddmmaaaaDeDia(t.ultimaRevision),
    rf: rfConocido ? t.riesgoFatal : OTRO, rfOtro: rfConocido ? '' : t.riesgoFatal, pers: t.habilitados.map(normDoc).filter(Boolean),
  };
}

export function TareaForm({ codigo }: { codigo: string | null }) {
  const s = useGestion();
  const existente = useMemo(() => (codigo ? s.tareas.find((t) => t.codigo === codigo) ?? null : null), [codigo, s.tareas]);
  const [f, setF] = useState<Form>(() => inicial(existente, s.tareas.length));
  const [pick, setPick] = useState(false);
  const [qPick, setQPick] = useState('');
  const [guardando, setGuardando] = useState(false);
  useTitulo(existente ? `Tarea ${existente.codigo}` : 'Nueva tarea');
  const set = (p: Partial<Form>) => setF((v) => ({ ...v, ...p }));
  const volver = () => s.ir({ id: 'tareas' });

  if (codigo && !existente) {
    return <><EncabezadoDetalle volver="Tareas rutinarias" onVolver={volver} titulo={`Tarea ${codigo}`} /><Tarjeta><p className="ats2g-rojo">La tarea {codigo} no está en el Listado.</p></Tarjeta></>;
  }

  const COD = f.cod.trim().toUpperCase();
  const rfValor = f.rf === OTRO ? f.rfOtro.trim() : f.rf;
  const padron = s.personas;
  const nombreDe = (d: string) => padron.find((p) => normDoc(p.documento) === d)?.nombre ?? '';
  const habilitados = [...f.pers].map((d) => ({ d, n: nombreDe(d) })).sort((a, b) => (a.n || 'zzz').localeCompare(b.n || 'zzz'));
  const candidatos = padron.filter((p) => p.activo === 'SI' && coincide(qPick, p.nombre, p.documento, p.credencial, p.equipo, p.empresa))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  const marcado = (d: string) => f.pers.includes(normDoc(d));
  const alternar = (d: string) => { const x = normDoc(d); set({ pers: marcado(x) ? f.pers.filter((y) => y !== x) : [...f.pers, x] }); };

  async function guardar() {
    const fa = f.fApr.trim(); const fr = f.fRev.trim();
    const error = (m: string) => s.avisar('error', m);
    if (!COD) return error('Falta el código de la tarea.');
    if (!/^[A-Z0-9][A-Z0-9./-]{0,29}$/.test(COD)) return error('El código lleva solo letras sin acentos, números, guiones, puntos o barras (hasta 30). Ej.: TR-001');
    if (!existente && s.tareas.some((t) => t.codigo.toUpperCase() === COD)) return error(`Ya hay otra tarea con el código ${COD}.`);
    if (!f.tarea.trim()) return error('Falta la descripción de la tarea.');
    if (!f.rf) return error('Indicá el riesgo fatal de la tarea (o No tiene).');
    if (f.rf === OTRO && !rfValor) return error('Escribí cuál es el riesgo fatal de la tarea.');
    if (fa && !diaDeTexto(fa)) return error('La fecha de aprobación va como dd/mm/aaaa.');
    if (fr && !diaDeTexto(fr)) return error('La fecha de última revisión va como dd/mm/aaaa.');
    setGuardando(true);
    try {
      const r = await s.api.guardarTarea(COD, {
        tarea: f.tarea.trim(), procedimiento: f.proc.trim(), anexoIperc: f.iperc.trim(), area: f.area.trim(), frente: f.frente.trim(), empresa: f.emp.trim(),
        riesgoFatal: rfValor, ccv: f.ccv.trim(), aprobadoPor: f.apr.trim(), fechaAprobacion: fa ? diaDeTexto(fa)! : '', ultimaRevision: fr ? diaDeTexto(fr)! : '',
        activa: f.act, habilitados: f.pers,
      });
      if (f.pers.length === 0) s.avisar('aviso', `Tarea ${COD} guardada SIN personal habilitado: nadie podrá firmar su TTR.`);
      else s.avisar('ok', `Tarea ${COD} guardada.`);
      for (const a of r.avisos ?? []) s.avisar('aviso', a);
      await Promise.all([s.cargarTareas(), s.cargarPersonas(), s.cargarResumen()]);
      volver();
    } catch (e) {
      s.avisar('error', s.mensaje(e));
    } finally {
      setGuardando(false);
    }
  }

  const imprimirQr = () => s.ir({
    id: 'imprimir', titulo: 'QR de la tarea',
    tarjetas: [tarjetaTarea({ codigo: COD, tarea: f.tarea.trim(), frente: f.frente.trim(), area: f.area.trim() })],
    volver: { id: 'tarea', codigo },
  });

  return (
    <>
      <EncabezadoDetalle volver="Tareas rutinarias" onVolver={volver} titulo={existente ? `Tarea ${existente.codigo}` : 'Nueva tarea rutinaria'}
        sub="Los datos de la tarea se editan solo acá: la TTR de ATS 2.0 los toma del Listado de Tareas Rutinarias"
        derecha={<>
          <Boton tipo="borde" onClick={volver} disabled={guardando}>Cancelar</Boton>
          <Boton onClick={() => void guardar()} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Boton>
        </>} />

      <div className="ats2g-cols ats2g-cols-form">
        <Tarjeta titulo="Datos de la tarea" clase="ats2g-col-izq">
          <div className="ats2g-grid3">
            <Campo cap="Código (va en el QR)" valor={f.cod} onCambio={(v) => set({ cod: v })} pista="Ej.: TR-001" deshabilitado={!!existente}
              nota={`QR: ATS2-T-${COD} · letras sin acentos, números y guiones`} />
            <SiNoChips cap="¿Activa?" valor={f.act} onCambio={(v) => set({ act: v })} />
            <Campo cap="CCV" valor={f.ccv} onCambio={(v) => set({ ccv: v })} pista="Ej.: CCV Izaje" />
            <Campo ancho cap="Tarea" valor={f.tarea} onCambio={(v) => set({ tarea: v })} multilinea pista="Qué se hace, como figura en el procedimiento" />
            <Campo cap="Procedimiento" valor={f.proc} onCambio={(v) => set({ proc: v })} pista="Código y revisión" />
            <Campo cap="Anexo IPERC" valor={f.iperc} onCambio={(v) => set({ iperc: v })} />
            <Campo cap="Empresa" valor={f.emp} onCambio={(v) => set({ emp: v })} />
            <Campo cap="Área" valor={f.area} onCambio={(v) => set({ area: v })} />
            <Campo cap="Frente" valor={f.frente} onCambio={(v) => set({ frente: v })} />
            <Campo cap="Aprobado por" valor={f.apr} onCambio={(v) => set({ apr: v })} />
            <Campo cap="Fecha de aprobación" valor={f.fApr} onCambio={(v) => set({ fApr: v })} pista="dd/mm/aaaa" />
            <Campo cap="Última revisión" valor={f.fRev} onCambio={(v) => set({ fRev: v })} pista="dd/mm/aaaa" />
          </div>
          <div className="ats2g-campo">
            <span>Riesgo fatal de la tarea</span>
            <div className="ats2g-rf">
              <button type="button" className={f.rf === 'NO' ? 'ats2g-rf-no' : ''} onClick={() => set({ rf: 'NO' })}>No tiene</button>
              {RIESGOS_FATALES.map((x) => <button key={x} type="button" className={f.rf === x ? 'ats2g-rf-sel' : ''} onClick={() => set({ rf: x })} title={x}>{x}</button>)}
              <button type="button" className={f.rf === OTRO ? 'ats2g-rf-sel' : ''} onClick={() => set({ rf: OTRO })}>Otro…</button>
            </div>
            {f.rf === OTRO && <input className="ats2g-input" value={f.rfOtro} placeholder="¿Cuál es el riesgo fatal?" onChange={(e) => set({ rfOtro: e.target.value })} />}
          </div>
        </Tarjeta>

        <div className="ats2g-col-der">
          <Tarjeta titulo="QR de la tarea">
            <div className="ats2g-qr-fila">
              {COD ? <ImagenQr texto={`ATS2-T-${COD}`} lado={140} /> : <div className="ats2g-qr-hueco">Escribí el código</div>}
              <div className="ats2g-qr-txt">
                <b className="ats2g-navy">ATS2-T-{COD || '…'}</b>
                <p className="ats2g-nota">Pegalo en el lugar de la tarea o en el procedimiento: la TTR lo escanea y carga la tarea sola.</p>
                <Boton tipo="borde" chico disabled={!COD} onClick={imprimirQr}>🖨  Imprimir QR</Boton>
              </div>
            </div>
          </Tarjeta>

          <Tarjeta titulo={`Personal habilitado para esta tarea (${f.pers.length})`}>
            <p className="ats2g-nota">Solo estas personas pueden firmar la TTR de esta tarea. Se eligen del padrón (Personal habilitado).</p>
            <div className="ats2g-barra">
              <Chip activo={!pick} onClick={() => setPick(false)}>Habilitados ({f.pers.length})</Chip>
              <Chip activo={pick} onClick={() => { setQPick(''); setPick(true); }}>＋  Agregar del padrón</Chip>
            </div>
            {!pick ? (
              f.pers.length === 0
                ? <p className="ats2g-rojo">Todavía no hay personal habilitado: nadie podrá firmar la TTR de esta tarea. Tocá + Agregar del padrón.</p>
                : (
                  <div className="ats2g-lista">
                    {habilitados.map((p) => (
                      <div key={p.d} className="ats2g-item">
                        <div className="ats2g-item-txt"><b className={p.n ? '' : 'ats2g-rojo'}>{p.n || '(no está en el padrón)'}</b><small>DNI {p.d}</small></div>
                        <Boton tipo="rojo" chico title="Quitar de esta tarea" onClick={() => alternar(p.d)}>✕</Boton>
                      </div>
                    ))}
                  </div>
                )
            ) : (
              <>
                <input className="ats2g-input" type="search" value={qPick} placeholder="Buscar nombre, DNI, credencial o equipo" aria-label="Buscar en el padrón" onChange={(e) => setQPick(e.target.value)} />
                <p className="ats2g-nota">Hacé clic en una persona para habilitarla o quitarla.</p>
                <div className="ats2g-lista">
                  {candidatos.length === 0 && <p className="ats2g-vacio">Nadie coincide en el padrón.</p>}
                  {candidatos.map((p) => (
                    <button key={p.documento} type="button" className="ats2g-item ats2g-item-btn" onClick={() => alternar(p.documento)}>
                      <span className={`ats2g-check ${marcado(p.documento) ? 'ats2g-check-on' : ''}`}>{marcado(p.documento) ? '✓' : ''}</span>
                      <span className="ats2g-item-txt"><b>{p.nombre}</b><small>DNI {p.documento}{p.equipo ? ` · ${p.equipo}` : ''}{p.credencial ? ` · ${p.credencial}` : ''}</small></span>
                    </button>
                  ))}
                </div>
                <div className="ats2g-barra">
                  <Boton tipo="verde" chico onClick={() => set({ pers: [...new Set([...f.pers, ...candidatos.map((p) => normDoc(p.documento))])] })}>Marcar los de la lista</Boton>
                  <Boton chico onClick={() => setPick(false)}>Listo</Boton>
                </div>
              </>
            )}
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
