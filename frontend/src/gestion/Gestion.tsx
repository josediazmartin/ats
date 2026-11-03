// Componente embebible de la gestión HSS del ATS 2.0 (la app "ATS Gestión" de Power Apps, formato notebook).
//   <Gestion apiBase="/api/ats" getHeaders={async () => ({ Authorization: `Bearer ${await tokenAts()}` })} />
// Misma identidad que <Ats2/>: el backend decide quién es el usuario y si es de gestión (403 si no).
import { useMemo, useRef } from 'react';
import { crearApiGestion } from './api';
import { ProveedorGestion, useGestion } from './estado';
import { Avisos, Boton, Menu } from './componentes';
import { Registros } from './pantallas/Registros';
import { Validos } from './pantallas/Validos';
import { Detalle } from './pantallas/Detalle';
import { Tareas } from './pantallas/Tareas';
import { TareaForm } from './pantallas/TareaForm';
import { Personas } from './pantallas/Personas';
import { PersonaForm } from './pantallas/PersonaForm';
import { Imprimir } from './pantallas/Imprimir';
import './gestion.css';

export interface PropsGestion {
  /** dirección del backend de ATS 2.0, por ejemplo "/api/ats" */
  apiBase: string;
  /** encabezados que identifican al usuario ante el backend (p. ej. Authorization con el JWT que firma la otra app) */
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
}

function Pantallas() {
  const s = useGestion();
  if (s.sinPermiso) {
    return (
      <div className="ats2g-centro">
        <h1 className="ats2g-h1">ATS Gestión</h1>
        <p>Tu usuario{s.yo?.email ? ` (${s.yo.email})` : ''} no tiene acceso a la gestión HSS del ATS 2.0. Pedíselo a HSS.</p>
      </div>
    );
  }
  if (!s.cargado) {
    return (
      <div className="ats2g-centro">
        <h1 className="ats2g-h1">ATS Gestión</h1>
        {s.error ? <><p className="ats2g-rojo">{s.error}</p><Boton onClick={() => void s.recargar()} disabled={s.cargando}>Reintentar</Boton></> : <p className="ats2g-muted">Cargando…</p>}
      </div>
    );
  }
  const p = s.pantalla;
  if (p.id === 'imprimir') return <><Imprimir titulo={p.titulo} tarjetas={p.tarjetas} volver={p.volver} /><Avisos /></>;
  return (
    <>
      <Menu />
      <main className="ats2g-main">
        {p.id === 'registros' && <Registros />}
        {p.id === 'validos' && <Validos />}
        {p.id === 'registro' && <Detalle key={p.codigo} codigo={p.codigo} desde={p.desde} />}
        {p.id === 'tareas' && <Tareas />}
        {p.id === 'tarea' && <TareaForm key={p.codigo ?? 'nueva'} codigo={p.codigo} />}
        {p.id === 'personas' && <Personas />}
        {p.id === 'persona' && <PersonaForm key={p.documento ?? 'nueva'} documento={p.documento} />}
      </main>
      <Avisos />
    </>
  );
}

export function Gestion({ apiBase, getHeaders }: PropsGestion) {
  const encabezados = useRef(getHeaders);
  encabezados.current = getHeaders;
  const api = useMemo(() => crearApiGestion({ apiBase, getHeaders: () => (encabezados.current ? encabezados.current() : {}) }), [apiBase]);
  return (
    <div className="ats2g">
      <ProveedorGestion api={api}><Pantallas /></ProveedorGestion>
    </div>
  );
}
