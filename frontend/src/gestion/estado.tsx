// Estado de la gestión: usuario, datos cargados (registros, válidos, tareas, padrón), filtros, pantalla y avisos.
// Equivale a las variables gbl* y colecciones col* de la app de Power Apps.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ErrorApi, type ApiGestion } from './api';
import type { Pantalla, PersonaG, Registro, Resumen, TareaG, Validos, Yo } from './tipos';
import { marcaAhora } from './util';

export interface Filtros {
  dias: number;                    // ATS cargados: 1 = hoy, 7 / 30 / 90, 0 = todos
  tipo: '' | 'ATS' | 'TTR';
  q: string;
  valF: '' | 'pronto';             // ATS válidos
  qVal: string;
  tarF: 'Activas' | 'Todas';       // tareas
  qTar: string;
  perF: 'Activos' | 'Todos';       // personas
  qPer: string;
}

interface Aviso { id: number; tipo: 'ok' | 'error' | 'aviso'; texto: string }

interface Estado {
  api: ApiGestion;
  version: string;
  yo: Yo | null;
  sinPermiso: boolean;
  cargado: boolean;
  cargando: boolean;
  error: string;
  resumen: Resumen | null;
  registros: Registro[]; registrosAt: string;
  validos: Validos | null; validosAt: string;
  tareas: TareaG[];
  personas: PersonaG[];
  filtros: Filtros; setFiltros: (f: Partial<Filtros>) => void;
  pantalla: Pantalla; ir: (p: Pantalla) => void;
  recargar: () => Promise<void>;
  cargarRegistros: (dias: number) => Promise<void>;
  cargarValidos: () => Promise<void>;
  cargarTareas: () => Promise<void>;
  cargarPersonas: () => Promise<void>;
  cargarResumen: () => Promise<void>;
  avisos: Aviso[]; avisar: (tipo: Aviso['tipo'], texto: string) => void;
  /** texto de un error de la API para mostrar */
  mensaje: (e: unknown) => string;
}

const Ctx = createContext<Estado | null>(null);

export function useGestion() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useGestion fuera de <ProveedorGestion>');
  return s;
}

export const VERSION_GESTION = 'Gestión web v1 · 3-nov';

export function ProveedorGestion({ api, children }: { api: ApiGestion; children: ReactNode }) {
  const [yo, setYo] = useState<Yo | null>(null);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [registrosAt, setRegistrosAt] = useState('');
  const [validos, setValidos] = useState<Validos | null>(null);
  const [validosAt, setValidosAt] = useState('');
  const [tareas, setTareas] = useState<TareaG[]>([]);
  const [personas, setPersonas] = useState<PersonaG[]>([]);
  const [filtros, setFiltrosRaw] = useState<Filtros>({ dias: 7, tipo: '', q: '', valF: '', qVal: '', tarF: 'Activas', qTar: '', perF: 'Activos', qPer: '' });
  const [pantalla, setPantalla] = useState<Pantalla>({ id: 'registros' });
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const nAviso = useRef(0);
  const diasRef = useRef(7);

  const mensaje = useCallback((e: unknown) => (e instanceof ErrorApi ? e.errores.join(' ') : e instanceof Error ? e.message : 'Error desconocido.'), []);
  const avisar = useCallback((tipo: Aviso['tipo'], texto: string) => {
    const id = ++nAviso.current;
    setAvisos((a) => [...a, { id, tipo, texto }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'error' ? 7000 : 4000);
  }, []);
  const setFiltros = useCallback((f: Partial<Filtros>) => setFiltrosRaw((v) => ({ ...v, ...f })), []);

  const permiso = useCallback((e: unknown) => { if (e instanceof ErrorApi && e.status === 403) setSinPermiso(true); }, []);

  const cargarRegistros = useCallback(async (dias: number) => {
    diasRef.current = dias;
    try { setRegistros(await api.registros(dias)); setRegistrosAt(marcaAhora()); } catch (e) { permiso(e); avisar('error', mensaje(e)); }
  }, [api, avisar, mensaje, permiso]);
  const cargarValidos = useCallback(async () => {
    try { setValidos(await api.validos()); setValidosAt(marcaAhora()); } catch (e) { permiso(e); avisar('error', mensaje(e)); }
  }, [api, avisar, mensaje, permiso]);
  const cargarTareas = useCallback(async () => {
    try { setTareas(await api.tareas()); } catch (e) { permiso(e); avisar('error', mensaje(e)); }
  }, [api, avisar, mensaje, permiso]);
  const cargarPersonas = useCallback(async () => {
    try { setPersonas(await api.personas()); } catch (e) { permiso(e); avisar('error', mensaje(e)); }
  }, [api, avisar, mensaje, permiso]);
  const cargarResumen = useCallback(async () => {
    try { setResumen(await api.resumen()); } catch (e) { permiso(e); }
  }, [api, permiso]);

  /** todo de nuevo (botón "Actualizar datos" y arranque) */
  const recargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const u = await api.yo();
      setYo(u);
      if (u.gestion === false) { setSinPermiso(true); return; }
      const [res, regs, val, tar, per] = await Promise.all([api.resumen(), api.registros(diasRef.current), api.validos(), api.tareas(), api.personas()]);
      setResumen(res); setRegistros(regs); setRegistrosAt(marcaAhora()); setValidos(val); setValidosAt(marcaAhora()); setTareas(tar); setPersonas(per);
      setCargado(true);
    } catch (e) {
      permiso(e);
      setError(mensaje(e));
    } finally {
      setCargando(false);
    }
  }, [api, mensaje, permiso]);

  useEffect(() => { void recargar(); }, [recargar]);

  const ir = useCallback((p: Pantalla) => { setPantalla(p); window.scrollTo(0, 0); }, []);

  const valor = useMemo<Estado>(() => ({
    api, version: VERSION_GESTION, yo, sinPermiso, cargado, cargando, error, resumen, registros, registrosAt, validos, validosAt, tareas, personas,
    filtros, setFiltros, pantalla, ir, recargar, cargarRegistros, cargarValidos, cargarTareas, cargarPersonas, cargarResumen, avisos, avisar, mensaje,
  }), [api, yo, sinPermiso, cargado, cargando, error, resumen, registros, registrosAt, validos, validosAt, tareas, personas, filtros, setFiltros, pantalla, ir,
    recargar, cargarRegistros, cargarValidos, cargarTareas, cargarPersonas, cargarResumen, avisos, avisar, mensaje]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
