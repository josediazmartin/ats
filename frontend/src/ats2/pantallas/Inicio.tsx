// Inicio (ScrInicio): tarjetas ATS 2.0 / TTR, envío y lo que está en curso en este teléfono.
import { useAts } from '../estado';
import { LOGO } from '../iconos';
import type { Doc } from '../tipos';
import { ddmm, ddmmHora, hhmm, sumarDias, textoEstado } from '../util';
import { VIGENCIA_ATS_INICIO } from '../catalogo';

export function infoQrAts(d: Doc) {
  return `ATS 2.0 ${d.inicioTurno === 'SI' ? 'de inicio de turno ' : ''}· ${d.codigo} · ${d.horaAut}\n`
    + (d.inicioTurno === 'SI'
      ? `Escaneá este código desde la TTR. Vale hasta el ${ddmm(sumarDias(d.fecha, VIGENCIA_ATS_INICIO))}.`
      : 'Escaneá este código desde la TTR para vincularla con este ATS.');
}

const ICO_ATS = <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="9" y="8" width="30" height="36" rx="5" fill="none" stroke="white" strokeWidth="3.5" /><rect x="17" y="3" width="14" height="9" rx="3" fill="white" /><polyline points="16,27 22,33 33,21" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const ICO_TTR = <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="9" width="38" height="30" rx="5" fill="none" stroke="white" strokeWidth="3.5" /><line x1="12" y1="18" x2="36" y2="18" stroke="white" strokeWidth="3.5" strokeLinecap="round" /><line x1="12" y1="25" x2="36" y2="25" stroke="white" strokeWidth="3.5" strokeLinecap="round" /><line x1="12" y1="32" x2="26" y2="32" stroke="white" strokeWidth="3.5" strokeLinecap="round" /></svg>;

export function Inicio({ version }: { version: string }) {
  const s = useAts();
  const enCurso = s.docs.filter((d) => d.estado === 'Borrador' || d.estado === 'Abierto')
    .sort((a, b) => (a.estado === 'Abierto' ? 0 : 1) - (b.estado === 'Abierto' ? 0 : 1) || (a.creado < b.creado ? 1 : -1));
  const conError = s.docs.filter((d) => d.sync === 'error' && d.errores?.length);

  const abrir = (d: Doc) => {
    s.setActualCod(d.codigo);
    if (d.tipo === 'ATS') { s.setPaso(d.estado === 'Abierto' ? 6 : Math.max(1, d.paso)); s.ir({ id: 'ats' }); }
    else { s.setPaso(d.estado === 'Abierto' ? 5 : Math.min(4, Math.max(1, d.paso))); s.ir({ id: 'ttr' }); }
  };
  const nuevo = (tipo: Doc['tipo']) => { s.crear(tipo); s.setPaso(1); s.ir({ id: tipo === 'ATS' ? 'ats' : 'ttr' }); };

  return (
    <div className="ats2-pant">
      <header className="ats2-inicio-hdr"><img src={LOGO} alt="ATS 2.0 · HSS" /></header>
      <main className="ats2-cuerpo">
        <button type="button" className="ats2-tarjeta ats2-tarjeta-ats" aria-label="Nuevo ATS 2.0" onClick={() => nuevo('ATS')}>
          <span className="ats2-tarjeta-ico">{ICO_ATS}</span>
          <span className="ats2-tarjeta-txt"><b>ATS 2.0</b><span>Análisis de Trabajo Seguro</span><small>Inicio de turno y toda tarea sin TTR</small></span>
          <span className="ats2-tarjeta-ir">›</span>
        </button>
        <button type="button" className="ats2-tarjeta ats2-tarjeta-ttr" aria-label="Nueva TTR" onClick={() => nuevo('TTR')}>
          <span className="ats2-tarjeta-ico">{ICO_TTR}</span>
          <span className="ats2-tarjeta-txt"><b>TTR</b><span>Tarjeta de Tarea Rutinaria</span><small>Solo tareas del Listado, sin cambios</small></span>
          <span className="ats2-tarjeta-ir">›</span>
        </button>

        <div className="ats2-envio">
          <div>
            <div className={`ats2-envio-t ${s.pendientes ? '' : 'ats2-verde'}`}>{s.pendientes ? `${s.pendientes} sin enviar` : 'Todo enviado ✓'}</div>
            <div className={`ats2-envio-s ${s.online ? '' : 'ats2-naranja'}`}>
              {s.enviando ? 'Enviando…' : !s.online ? 'Sin señal: se envían solos cuando vuelva.'
                : `Se envían solos con señal${s.meta.ultSync ? ` · último ${hhmm(new Date(s.meta.ultSync))}` : '.'}`}
            </div>
          </div>
          <button type="button" className="ats2-btn ats2-btn-navy" disabled={!s.online || s.enviando || !s.pendientes} onClick={() => void s.sincronizar()}>
            {s.enviando ? 'Enviando…' : 'Enviar ahora'}
          </button>
        </div>

        {conError.length > 0 && (
          <div className="ats2-errores-envio">
            <b>No se pudieron enviar:</b>
            {conError.map((d) => <div key={d.codigo}>{d.codigo}: {d.errores!.join(' ')}</div>)}
          </div>
        )}

        <h2 className="ats2-h2">En curso en este teléfono ({enCurso.length})</h2>
        <p className="ats2-nota">En preparación y activas. Al cerrarlas, salen de acá.</p>
        {enCurso.length === 0 && <div className="ats2-vacio">No hay nada en curso. Tocá ATS 2.0 o TTR para empezar.</div>}
        {enCurso.map((d) => {
          const act = d.estado === 'Abierto';
          const firmas = s.pers.filter((p) => p.codigo === d.codigo).length;
          return (
            <div key={d.codigo} className={`ats2-item ${act ? (d.tipo === 'ATS' ? 'ats2-item-ats' : 'ats2-item-ttr') : ''}`}>
              <button type="button" className="ats2-item-abrir" onClick={() => abrir(d)}>
                <span className="ats2-item-fila">
                  <span className={`ats2-etq ${d.tipo === 'ATS' ? 'ats2-naranja-bg' : 'ats2-blue'}`}>{d.tipo}</span>
                  <span className="ats2-item-cod">{d.codigo}</span>
                  <span className={`ats2-estado ats2-estado-${d.estado.replace(' ', '')}`}>{textoEstado(d)}</span>
                </span>
                <span className="ats2-item-tarea">{d.tarea || '(sin tarea todavía)'}</span>
                <span className="ats2-item-meta">
                  {ddmmHora(d.creado)} · {d.frente || '-'} · {firmas} firma(s) · {d.estado === 'Borrador' ? 'sin enviar'
                    : { enviado: '☁ enviado', error: '⚠ error al enviar', pendiente: '⏳ pendiente de enviar' }[d.sync]}
                </span>
              </button>
              {act && d.tipo === 'ATS' && (
                <button type="button" className="ats2-btn ats2-btn-navy ats2-item-qr" onClick={() => s.ir({ id: 'qr', texto: `ATS2-A-${d.codigo}`, info: infoQrAts(d) })}>QR</button>
              )}
            </div>
          );
        })}
        <footer className="ats2-pie">{version}{s.meta.catAt ? ` · listas ${ddmmHora(new Date(s.meta.catAt).toISOString())}` : ''}</footer>
      </main>
    </div>
  );
}
