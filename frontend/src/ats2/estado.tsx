// Estado de la app: documentos y firmas guardados en el teléfono (IndexedDB), listas descargadas del backend
// y envío automático cuando hay señal. Es la parte "offline first" de la app de Power Apps (colDocs, colPers,
// colTareas, colPadron, colMeta + SaveData / LoadData + $syncFx).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createStore, get, set } from 'idb-keyval';
import { ErrorApi, type Api } from './api';
import type { AtsInicio, Doc, Firma, Pantalla, Persona, Tarea } from './tipos';
import { aEnviar, diasEntre, nuevoDoc, yyyymmdd, type Recuerdo } from './util';
import { VIGENCIA_ATS_INICIO } from './catalogo';

interface Meta { catFecha?: string; catAt?: number; recuerdo?: Recuerdo; yo?: { email: string; nombre: string }; ultSync?: string }
interface Aviso { id: number; texto: string; tipo: 'ok' | 'error' | 'aviso' }

const REFRESCO_MIN = 20;   // minutos entre descargas de listas al volver al inicio (como la app)

function useEstadoAts(api: Api, prefijo: string) {
  const store = useMemo(() => createStore(`${prefijo}-db`, 'datos'), [prefijo]);
  const [cargado, setCargado] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [pers, setPers] = useState<Firma[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [padron, setPadron] = useState<Persona[]>([]);
  const [meta, setMeta] = useState<Meta>({});
  const [atsRemotos, setAtsRemotos] = useState<AtsInicio[]>([]);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [enviando, setEnviando] = useState(false);
  const [pantalla, setPantalla] = useState<Pantalla>({ id: 'inicio' });
  const [actualCod, setActualCod] = useState<string | null>(null);
  const [paso, setPaso] = useState(1);   // paso en pantalla del ATS / TTR (gblPaso / gblPasoT)
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const enviandoRef = useRef(false);
  const docsRef = useRef(docs); docsRef.current = docs;
  const persRef = useRef(pers); persRef.current = pers;

  const avisar = useCallback((texto: string, tipo: Aviso['tipo'] = 'ok') => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a, { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'error' ? 7000 : 4000);
  }, []);

  // ---- cargar lo guardado en el teléfono + limpieza (InPurge)
  useEffect(() => {
    (async () => {
      const [d, p, t, pa, m] = await Promise.all([
        get<Doc[]>('docs', store), get<Firma[]>('pers', store), get<Tarea[]>('tareas', store), get<Persona[]>('padron', store), get<Meta>('meta', store),
      ]);
      const hoy = yyyymmdd();
      const viejo = (x: Doc, dias: number) => diasEntre(x.fecha, hoy) > dias;
      const docs0 = (d ?? []).filter((x) => !(x.sync === 'enviado' && x.estado !== 'Borrador' && x.estado !== 'Abierto'
        && viejo(x, x.tipo === 'ATS' && x.inicioTurno === 'SI' ? 16 : 3)) && !(x.estado === 'Borrador' && viejo(x, 7)));
      const cods = new Set(docs0.map((x) => x.codigo));
      setDocs(docs0);
      setPers((p ?? []).filter((x) => x.sync !== 'enviado' || cods.has(x.codigo)));
      setTareas(t ?? []); setPadron(pa ?? []); setMeta(m ?? {});
      setCargado(true);
    })().catch(() => setCargado(true));
  }, [store]);

  // ---- guardar en el teléfono cada cambio
  useEffect(() => { if (cargado) void set('docs', docs, store); }, [docs, cargado, store]);
  useEffect(() => { if (cargado) void set('pers', pers, store); }, [pers, cargado, store]);
  useEffect(() => { if (cargado) void set('tareas', tareas, store); }, [tareas, cargado, store]);
  useEffect(() => { if (cargado) void set('padron', padron, store); }, [padron, cargado, store]);
  useEffect(() => { if (cargado) void set('meta', meta, store); }, [meta, cargado, store]);

  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // ---- listas (tareas del Listado + padrón): InRefresh
  const refrescarCatalogos = useCallback(async () => {
    try {
      const c = await api.catalogos();
      setTareas(c.tareas); setPadron(c.padron);
      setMeta((m) => ({ ...m, catAt: Date.now(), catFecha: c.fecha }));
      return c;
    } catch { return null; }
  }, [api]);

  const refrescarAtsInicio = useCallback(async () => {
    try {
      const r = await api.atsInicio();
      setAtsRemotos(r.map((a) => ({ codigo: a.codigo, horaAut: a.horaAut, frente: a.frente, supervisor: a.supervisor, radio: a.radio, empresa: a.empresa, origen: 'sp' as const })));
    } catch { /* sin señal: quedan los del teléfono */ }
  }, [api]);

  /** ATS de inicio que una TTR puede vincular: los del teléfono (15 días) + los de SharePoint que no están acá */
  const atsInicio = useMemo<AtsInicio[]>(() => {
    const hoy = yyyymmdd();
    const loc = docs.filter((d) => d.tipo === 'ATS' && d.inicioTurno === 'SI' && (d.estado === 'Abierto' || d.estado === 'Cerrado')
      && diasEntre(d.fecha, hoy) <= VIGENCIA_ATS_INICIO)
      .map((d) => ({ codigo: d.codigo, horaAut: d.horaAut, frente: d.frente, supervisor: d.supervisor, radio: d.radio, empresa: d.empresa, origen: 'tel' as const }));
    const cods = new Set(docs.filter((d) => d.tipo === 'ATS').map((d) => d.codigo));
    return [...loc, ...atsRemotos.filter((a) => !cods.has(a.codigo))].sort((a, b) => (a.codigo < b.codigo ? 1 : -1));
  }, [docs, atsRemotos]);

  // ---- envío ($syncFx): cada documento no borrador que falta enviar, con las firmas que faltan
  const sincronizar = useCallback(async () => {
    if (enviandoRef.current) return;
    const cola = docsRef.current.filter((d) => d.sync !== 'enviado' && d.estado !== 'Borrador');
    if (!cola.length) return;
    enviandoRef.current = true; setEnviando(true);
    let errores = 0;
    for (const d of cola) {
      const firmas = persRef.current.filter((p) => p.codigo === d.codigo && p.sync !== 'enviado');
      try {
        const r = await api.enviar(d, firmas);
        const nros = new Set(firmas.map((f) => f.nro));
        setDocs((ds) => ds.map((x) => (x.codigo === d.codigo ? { ...x, sync: (x.rev ?? 0) === (d.rev ?? 0) ? 'enviado' : x.sync, spId: r.id, errores: undefined } : x)));
        setPers((ps) => ps.map((p) => (p.codigo === d.codigo && nros.has(p.nro) ? { ...p, sync: 'enviado' } : p)));
        for (const a of r.avisos ?? []) avisar(a, 'aviso');
      } catch (e) {
        errores++;
        const lista = e instanceof ErrorApi && e.status >= 400 && e.status < 500 ? e.errores : undefined;
        setDocs((ds) => ds.map((x) => (x.codigo === d.codigo ? { ...x, sync: 'error', errores: lista } : x)));
        if (e instanceof ErrorApi && e.status === 0) break;   // sin señal: no seguir intentando
      }
    }
    setMeta((m) => ({ ...m, ultSync: new Date().toISOString() }));
    enviandoRef.current = false; setEnviando(false);
    if (errores) avisar('Algunos documentos no se pudieron enviar. Se reintenta con la próxima señal.', 'aviso');
  }, [api, avisar]);

  const pendientes = docs.filter((d) => d.sync !== 'enviado' && d.estado !== 'Borrador').length
    + pers.filter((p) => p.sync !== 'enviado' && !docs.some((d) => d.codigo === p.codigo && d.estado === 'Borrador')).length;

  // ---- al abrir: quién soy, listas y envío
  useEffect(() => {
    if (!cargado) return;
    void api.yo().then((yo) => setMeta((m) => ({ ...m, yo }))).catch(() => {});
    if (navigator.onLine) { void refrescarCatalogos(); void sincronizar(); }
  }, [cargado]);  // eslint-disable-line react-hooks/exhaustive-deps

  // apenas algo queda pendiente (autorizar, cerrar, firma nueva), enviarlo; los que dieron error se reintentan
  // con la señal, al volver al inicio o con "Enviar ahora" (no en bucle)
  const hayPendiente = docs.some((d) => d.sync === 'pendiente' && d.estado !== 'Borrador');
  useEffect(() => {
    if (!cargado || !online || !hayPendiente) return;
    const t = setTimeout(() => void sincronizar(), 800);
    return () => clearTimeout(t);
  }, [docs, cargado, online, hayPendiente, sincronizar]);

  // al volver la señal, enviar solo
  useEffect(() => { if (online && cargado) void sincronizar(); }, [online]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ---- documento en edición (gblA): vive en la lista; cada cambio se guarda en el teléfono
  const actual = docs.find((d) => d.codigo === actualCod) ?? null;
  const cambiar = useCallback((patch: Partial<Doc> | ((d: Doc) => Partial<Doc>)) => {
    setDocs((ds) => ds.map((d) => (d.codigo === actualCod ? { ...d, ...(typeof patch === 'function' ? patch(d) : patch) } : d)));
  }, [actualCod]);

  const crear = useCallback((tipo: Doc['tipo'], extra?: Partial<Doc>) => {
    const d = { ...nuevoDoc(tipo, meta.recuerdo ?? {}, meta.yo?.nombre ?? ''), ...extra };
    setDocs((ds) => [...ds, d]);
    setActualCod(d.codigo);
    return d;
  }, [meta.recuerdo, meta.yo]);

  const descartar = useCallback((codigo: string) => {
    setDocs((ds) => ds.filter((d) => d.codigo !== codigo));
    setPers((ps) => ps.filter((p) => p.codigo !== codigo));
  }, []);

  const recordar = useCallback((d: Doc) => {
    setMeta((m) => ({ ...m, recuerdo: { pais: d.pais, frente: d.frente, cota: d.cota, empresa: d.empresa, contratista: d.contratista, duenoArea: d.duenoArea, radio: d.radio, supervisor: d.supervisor } }));
  }, []);

  const agregarFirma = useCallback((f: Omit<Firma, 'nro' | 'sync'>) => {
    setPers((ps) => {
      const nro = Math.max(0, ...ps.filter((p) => p.codigo === f.codigo).map((p) => p.nro)) + 1;
      return [...ps, { ...f, nro, sync: 'pendiente' }];
    });
    // si el documento ya estaba enviado, hay que volver a enviarlo con la firma nueva
    setDocs((ds) => ds.map((d) => (d.codigo === f.codigo && d.estado !== 'Borrador' ? { ...d, ...aEnviar(d) } : d)));
  }, []);
  const quitarFirma = useCallback((codigo: string, nro: number) => setPers((ps) => ps.filter((p) => !(p.codigo === codigo && p.nro === nro))), []);

  const ir = useCallback((p: Pantalla) => { setPantalla(p); window.scrollTo?.(0, 0); }, []);

  /** al volver al inicio: listas si pasaron 20 min y envío si hay pendientes (OnVisible de ScrInicio) */
  const alInicio = useCallback(() => {
    ir({ id: 'inicio' });
    if (!navigator.onLine) return;
    if (!meta.catAt || Date.now() - meta.catAt >= REFRESCO_MIN * 60000) void refrescarCatalogos();
    void sincronizar();
  }, [ir, meta.catAt, refrescarCatalogos, sincronizar]);

  return {
    api, cargado, docs, pers, tareas, padron, meta, online, enviando, pendientes, atsInicio, pantalla, actual, avisos,
    paso, setPaso, setActualCod, cambiar, crear, descartar, recordar, agregarFirma, quitarFirma, ir, alInicio, avisar,
    refrescarCatalogos, refrescarAtsInicio, sincronizar,
    borrarTodo: () => { setDocs([]); setPers([]); },
  };
}

export type EstadoAts = ReturnType<typeof useEstadoAts>;
const Ctx = createContext<EstadoAts | null>(null);

export function ProveedorAts({ api, prefijo, children }: { api: Api; prefijo: string; children: ReactNode }) {
  const v = useEstadoAts(api, prefijo);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useAts() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAts fuera de <Ats2>');
  return v;
}
