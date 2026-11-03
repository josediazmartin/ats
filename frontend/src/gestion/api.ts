// Llamadas a /api/ats/gestion/*. Igual que el componente ATS 2.0: no hace login, la otra app identifica al usuario
// con getHeaders (JWT) o con su sesión (mismo dominio). 403 = el usuario no es de gestión HSS.
import { ErrorApi } from '../ats2/api';
import type { DetalleRegistro, PersonaG, Registro, Resumen, TareaCuerpo, TareaG, Validos, Yo } from './tipos';

export { ErrorApi };

export interface OpcionesApi {
  apiBase: string;
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
}

export function crearApiGestion({ apiBase, getHeaders }: OpcionesApi) {
  const base = apiBase.replace(/\/$/, '');
  async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
    const extra = getHeaders ? await getHeaders() : {};
    let r: Response;
    try {
      r = await fetch(`${base}${ruta}`, {
        credentials: 'include', ...init,
        headers: { 'Content-Type': 'application/json', ...extra, ...(init?.headers ?? {}) },
      });
    } catch {
      throw new ErrorApi(0, ['Sin conexión con el servidor.']);
    }
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok) throw new ErrorApi(r.status, cuerpo?.errores ?? [`Error ${r.status}`]);
    return cuerpo as T;
  }
  const g = (ruta: string) => `/gestion${ruta}`;
  return {
    yo: () => pedir<Yo>('/yo'),
    resumen: () => pedir<Resumen>(g('/resumen')),
    /** dias: 1 = hoy, 7/30/90 = últimos días, 0 = todos */
    registros: (dias: number, tipo = '') => pedir<Registro[]>(g(`/registros?dias=${dias}${tipo ? `&tipo=${tipo}` : ''}`)),
    registro: (codigo: string) => pedir<DetalleRegistro>(g(`/registros/${encodeURIComponent(codigo)}`)),
    validos: () => pedir<Validos>(g('/validos')),
    tareas: () => pedir<TareaG[]>(g('/tareas')),
    guardarTarea: (codigo: string, cuerpo: TareaCuerpo) => pedir<{ ok: true; codigo: string; creado: boolean; avisos: string[] }>(
      g(`/tareas/${encodeURIComponent(codigo)}`), { method: 'PUT', body: JSON.stringify(cuerpo) }),
    personas: () => pedir<PersonaG[]>(g('/personas')),
    guardarPersona: (documento: string, cuerpo: Partial<Omit<PersonaG, 'documento' | 'tareas'>>) => pedir<{ ok: true; documento: string; creado: boolean }>(
      g(`/personas/${encodeURIComponent(documento)}`), { method: 'PUT', body: JSON.stringify(cuerpo) }),
    /** copia de la base (archivo SQLite) con el nombre que manda el backend; 501 si el almacén no lo soporta, 403 sin permiso */
    respaldo: async (): Promise<{ blob: Blob; nombre: string }> => {
      const extra = getHeaders ? await getHeaders() : {};
      let r: Response;
      try {
        r = await fetch(`${base}${g('/respaldo')}`, { credentials: 'include', headers: { ...extra } });
      } catch {
        throw new ErrorApi(0, ['Sin conexión con el servidor.']);
      }
      if (!r.ok) {
        const cuerpo = await r.json().catch(() => ({}));
        throw new ErrorApi(r.status, cuerpo?.errores ?? [`Error ${r.status}`]);
      }
      const cd = r.headers.get('content-disposition') ?? '';
      const m = /filename\*=UTF-8''([^;]+)/i.exec(cd) ?? /filename="?([^";]+)"?/i.exec(cd);
      let nombre = 'ats2-respaldo.sqlite';
      if (m) { try { nombre = decodeURIComponent(m[1].trim()) || nombre; } catch { nombre = m[1].trim(); } }
      return { blob: await r.blob(), nombre };
    },
  };
}

export type ApiGestion = ReturnType<typeof crearApiGestion>;
