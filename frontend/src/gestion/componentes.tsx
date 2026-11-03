// Piezas de las pantallas de gestión (formato notebook): menú lateral, encabezados, indicadores, chips, tabla,
// tarjetas, datos de solo lectura, campos de formulario y avisos. Todo con clases .ats2g-*.
import { useEffect, useState, type ReactNode } from 'react';
import { useGestion } from './estado';
import type { Pantalla } from './tipos';
import { claseEstado, textoEstado } from './util';

// ---------------------------------------------------------------- menú lateral
const SECCIONES: { id: Pantalla['id']; texto: string }[] = [
  { id: 'registros', texto: 'ATS cargados' },
  { id: 'validos', texto: 'ATS válidos' },
  { id: 'tareas', texto: 'Tareas rutinarias' },
  { id: 'personas', texto: 'Personal habilitado' },
];

/** sección del menú que corresponde a la pantalla (el detalle resalta la lista desde la que se abrió) */
function seccionDe(p: Pantalla): Pantalla['id'] {
  if (p.id === 'registro') return p.desde;
  if (p.id === 'tarea') return 'tareas';
  if (p.id === 'persona') return 'personas';
  if (p.id === 'imprimir') return seccionDe(p.volver);
  return p.id;
}

export function Menu() {
  const s = useGestion();
  const act = seccionDe(s.pantalla);
  const [bajando, setBajando] = useState(false);
  /** baja una copia de la base (GET /gestion/respaldo) con un <a download> temporal */
  async function respaldo() {
    setBajando(true);
    try {
      const { blob, nombre } = await s.api.respaldo();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nombre; a.style.display = 'none';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      s.avisar('ok', `Respaldo bajado: ${nombre}`);
    } catch (e) {
      s.avisar('error', s.mensaje(e));
    } finally {
      setBajando(false);
    }
  }
  const conteo: Record<string, number> = {
    registros: s.registros.length,
    validos: s.validos ? s.validos.ats.length : (s.resumen?.validos ?? 0),
    tareas: s.tareas.filter((t) => t.activa === 'SI').length,
    personas: s.personas.filter((p) => p.activo === 'SI').length,
  };
  return (
    <aside className="ats2g-side">
      <div className="ats2g-side-tit">ATS Gestión</div>
      <div className="ats2g-side-sub">Gestión HSS del ATS 2.0 y la TTR</div>
      {SECCIONES.map((x) => (
        <button key={x.id} type="button" className={`ats2g-nav ${act === x.id ? 'ats2g-nav-act' : ''}`} onClick={() => s.ir({ id: x.id } as Pantalla)}>
          <span>{x.texto}</span><b>{conteo[x.id]}</b>
        </button>
      ))}
      <div className="ats2g-side-pie">
        <button type="button" className="ats2g-side-ref" disabled={s.cargando}
          onClick={() => { void s.recargar().then(() => s.avisar('ok', 'Datos actualizados.')); }}>
          {s.cargando ? 'Actualizando…' : '↻  Actualizar datos'}
        </button>
        <button type="button" className="ats2g-side-ref ats2g-side-sec" disabled={bajando} title="Baja una copia de la base de datos del ATS 2.0"
          onClick={() => void respaldo()}>
          {bajando ? 'Bajando…' : '⤓  Descargar respaldo'}
        </button>
        <div className="ats2g-side-yo" title={s.yo?.email}>{s.yo?.email}</div>
        <div className="ats2g-side-ver">Versión {s.version}</div>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------- encabezados
export function Encabezado({ titulo, sub, derecha }: { titulo: ReactNode; sub?: ReactNode; derecha?: ReactNode }) {
  return (
    <div className="ats2g-cab">
      <div className="ats2g-cab-txt"><h1 className="ats2g-h1">{titulo}</h1>{sub && <p className="ats2g-sub">{sub}</p>}</div>
      {derecha && <div className="ats2g-cab-der">{derecha}</div>}
    </div>
  );
}

export function EncabezadoDetalle({ volver, onVolver, titulo, sub, etiqueta, derecha }: {
  volver: string; onVolver: () => void; titulo: ReactNode; sub?: ReactNode; etiqueta?: ReactNode; derecha?: ReactNode;
}) {
  return (
    <div className="ats2g-cab">
      <div className="ats2g-cab-txt">
        <button type="button" className="ats2g-volver" onClick={onVolver}>‹  {volver}</button>
        <h1 className="ats2g-h1">{etiqueta}{etiqueta && ' '}{titulo}</h1>
        {sub && <p className="ats2g-sub">{sub}</p>}
      </div>
      {derecha && <div className="ats2g-cab-der">{derecha}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- indicadores, chips, buscador
export type ColorInd = 'navy' | 'orange' | 'blue' | 'green' | 'alert' | 'soon';
export function Indicadores({ items }: { items: { t: string; v: ReactNode; color: ColorInd }[] }) {
  return (
    <div className="ats2g-tiles">
      {items.map((x) => <div key={x.t} className={`ats2g-tile ats2g-tile-${x.color}`}><b>{x.v}</b><span>{x.t}</span></div>)}
    </div>
  );
}

export function Chip({ activo, onClick, children, ancho }: { activo: boolean; onClick: () => void; children: ReactNode; ancho?: number }) {
  return <button type="button" className={`ats2g-chip ${activo ? 'ats2g-chip-act' : ''}`} style={ancho ? { minWidth: ancho } : undefined} onClick={onClick}>{children}</button>;
}

export function Buscador({ valor, onCambio, pista }: { valor: string; onCambio: (v: string) => void; pista: string }) {
  return <input className="ats2g-busca" type="search" value={valor} placeholder={pista} aria-label={pista} onChange={(e) => onCambio(e.target.value)} />;
}

// ---------------------------------------------------------------- tabla
export interface Columna<T> {
  titulo: string;
  ancho?: number | string;        // px o "%"; sin ancho = reparte lo que queda
  al?: 'centro' | 'derecha';
  sec?: boolean;                  // columna secundaria: se esconde en pantallas angostas
  render: (fila: T) => ReactNode;
  titulo2?: (fila: T) => string;  // tooltip
}

export function Tabla<T>({ columnas, filas, clave, onFila, vacio }: {
  columnas: Columna<T>[]; filas: T[]; clave: (f: T) => string; onFila?: (f: T) => void; vacio: string;
}) {
  const cl = (c: Columna<T>) => `${c.al === 'centro' ? 'ats2g-al-c' : c.al === 'derecha' ? 'ats2g-al-r' : ''} ${c.sec ? 'ats2g-col-sec' : ''}`;
  return (
    <div className="ats2g-tabla">
      {filas.length === 0 ? <div className="ats2g-vacio">{vacio}</div> : (
        <table>
          <thead><tr>{columnas.map((c) => <th key={c.titulo} className={cl(c)} style={c.ancho ? { width: c.ancho } : undefined}>{c.titulo}</th>)}</tr></thead>
          <tbody>
            {filas.map((f) => (
              <tr key={clave(f)} className={onFila ? 'ats2g-fila' : ''} tabIndex={onFila ? 0 : undefined}
                onClick={onFila ? () => onFila(f) : undefined} onKeyDown={onFila ? (e) => { if (e.key === 'Enter') onFila(f); } : undefined}>
                {columnas.map((c) => <td key={c.titulo} className={cl(c)} title={c.titulo2?.(f)}>{c.render(f)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- etiquetas
export function EtiquetaEstado({ estado }: { estado: string }) {
  return <span className={`ats2g-est ats2g-est-${claseEstado(estado)}`}>{textoEstado(estado)}</span>;
}
export function EtiquetaTipo({ tipo }: { tipo: string }) {
  return <span className={`ats2g-etq-tipo ats2g-tipo-${tipo === 'ATS' ? 'ATS' : 'TTR'}`}>{tipo}</span>;
}
export function EtiquetaActiva({ activa, si = 'Activa', no = 'Inactiva' }: { activa: boolean; si?: string; no?: string }) {
  return <span className={`ats2g-est ${activa ? 'ats2g-est-cerrado' : 'ats2g-est-otro'}`}>{activa ? si : no}</span>;
}

// ---------------------------------------------------------------- tarjetas, datos, campos
export function Tarjeta({ titulo, derecha, children, clase = '', estilo }: { titulo?: ReactNode; derecha?: ReactNode; children: ReactNode; clase?: string; estilo?: React.CSSProperties }) {
  return (
    <section className={`ats2g-card ${clase}`} style={estilo}>
      {titulo && <div className="ats2g-card-t"><span>{titulo}</span>{derecha}</div>}
      {children}
    </section>
  );
}

/** dato de solo lectura: título chico + valor ("-" si está vacío) */
export function Dato({ cap, valor, ancho }: { cap: string; valor: ReactNode; ancho?: boolean }) {
  const vacio = valor === '' || valor === null || valor === undefined;
  return <div className={`ats2g-dato ${ancho ? 'ats2g-ancho' : ''}`}><small>{cap}</small><div>{vacio ? '-' : valor}</div></div>;
}

export function Campo({ cap, valor, onCambio, pista, multilinea, deshabilitado, nota, ancho }: {
  cap: string; valor: string; onCambio: (v: string) => void; pista?: string; multilinea?: boolean; deshabilitado?: boolean; nota?: string; ancho?: boolean;
}) {
  return (
    <label className={`ats2g-campo ${ancho ? 'ats2g-ancho' : ''}`}>
      <span>{cap}</span>
      {multilinea
        ? <textarea className="ats2g-input" value={valor} placeholder={pista} disabled={deshabilitado} onChange={(e) => onCambio(e.target.value)} />
        : <input className="ats2g-input" value={valor} placeholder={pista} disabled={deshabilitado} onChange={(e) => onCambio(e.target.value)} />}
      {nota && <em className="ats2g-nota">{nota}</em>}
    </label>
  );
}

export function SiNoChips({ cap, valor, onCambio }: { cap: string; valor: 'SI' | 'NO'; onCambio: (v: 'SI' | 'NO') => void }) {
  return (
    <div className="ats2g-campo">
      <span>{cap}</span>
      <div className="ats2g-barra">
        <Chip activo={valor === 'SI'} onClick={() => onCambio('SI')} ancho={72}>Sí</Chip>
        <Chip activo={valor === 'NO'} onClick={() => onCambio('NO')} ancho={72}>No</Chip>
      </div>
    </div>
  );
}

export function Boton({ tipo = 'navy', chico, children, ...rest }: {
  tipo?: 'navy' | 'blue' | 'borde' | 'verde' | 'rojo'; chico?: boolean; children: ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'children'>) {
  return <button type="button" className={`ats2g-btn ats2g-btn-${tipo} ${chico ? 'ats2g-btn-chico' : ''}`} {...rest}>{children}</button>;
}

// ---------------------------------------------------------------- avisos (Notify)
export function Avisos() {
  const s = useGestion();
  return (
    <div className="ats2g-avisos" aria-live="polite">
      {s.avisos.map((a) => <div key={a.id} className={`ats2g-aviso ats2g-aviso-${a.tipo}`}>{a.texto}</div>)}
    </div>
  );
}

/** título de la pestaña del navegador mientras la pantalla está abierta */
export function useTitulo(t: string) {
  useEffect(() => { const antes = document.title; document.title = `${t} · ATS Gestión`; return () => { document.title = antes; }; }, [t]);
}
