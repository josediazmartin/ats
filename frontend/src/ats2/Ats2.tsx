// Componente embebible de ATS 2.0. Uso en la otra app:
//   <Ats2 apiBase="/api/ats" getHeaders={async () => ({ Authorization: `Bearer ${await tokenAts()}` })} />
// No hace login: la identidad la resuelve el backend con lo que mande getHeaders (o la sesión de la otra app).
import { useMemo, useRef } from 'react';
import { crearApi } from './api';
import { ProveedorAts, useAts } from './estado';
import { Inicio } from './pantallas/Inicio';
import { AtsPantalla } from './pantallas/AtsPantalla';
import { TtrPantalla } from './pantallas/TtrPantalla';
import { PersonaPantalla } from './pantallas/PersonaPantalla';
import { FirmaPantalla } from './pantallas/FirmaPantalla';
import { QrPantalla } from './pantallas/QrPantalla';
import './ats2.css';

export const VERSION_ATS2_WEB = 'Web v1 · 2-nov';

export interface PropsAts2 {
  /** dirección del backend de ATS 2.0, por ejemplo "/api/ats" o "https://ats.vicuna.com/api/ats" */
  apiBase: string;
  /** encabezados que identifican al usuario ante el backend (p. ej. Authorization con el JWT que firma la otra app) */
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  /** nombre de la base local del navegador (cambiarlo si hay dos instancias en el mismo dominio) */
  almacenamiento?: string;
  /** alto del componente; por defecto ocupa toda la ventana */
  alto?: string;
}

function Pantallas() {
  const s = useAts();
  if (!s.cargado) return <div className="ats2-cargando">Cargando…</div>;
  const p = s.pantalla;
  const sinDoc = p.id !== 'inicio' && p.id !== 'qr' && !s.actual;
  return (
    <>
      {(p.id === 'inicio' || sinDoc) && <Inicio version={VERSION_ATS2_WEB} />}
      {!sinDoc && p.id === 'ats' && <AtsPantalla />}
      {!sinDoc && p.id === 'ttr' && <TtrPantalla />}
      {!sinDoc && p.id === 'persona' && <PersonaPantalla />}
      {!sinDoc && p.id === 'firma' && <FirmaPantalla para={p.para} />}
      {p.id === 'qr' && <QrPantalla texto={p.texto} info={p.info} desde={p.desde} />}
      <div className="ats2-avisos" aria-live="polite">
        {s.avisos.map((a) => <div key={a.id} className={`ats2-aviso ats2-aviso-${a.tipo}`}>{a.texto}</div>)}
      </div>
    </>
  );
}

export function Ats2({ apiBase, getHeaders, almacenamiento = 'ats2', alto }: PropsAts2) {
  // getHeaders puede cambiar en cada render de la otra app: se lee siempre el último
  const encabezados = useRef(getHeaders);
  encabezados.current = getHeaders;
  const api = useMemo(() => crearApi({ apiBase, getHeaders: () => (encabezados.current ? encabezados.current() : {}) }), [apiBase]);
  return (
    <div className="ats2" style={alto ? { minHeight: alto } : undefined}>
      <ProveedorAts api={api} prefijo={almacenamiento}><Pantallas /></ProveedorAts>
    </div>
  );
}
