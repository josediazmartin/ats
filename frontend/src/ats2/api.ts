// Llamadas al backend de ATS 2.0. El componente no hace login: la otra app agrega lo que identifica a su usuario
// con getHeaders (por ejemplo "Authorization: Bearer <jwt>") o con su sesión (cookies, mismo dominio).
import type { AtsRemoto, Doc, Firma, Persona, Tarea } from './tipos';

export interface OpcionesApi {
  apiBase: string;
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
}

export class ErrorApi extends Error {
  constructor(public status: number, public errores: string[]) { super(errores.join(' ')); }
}

export function crearApi({ apiBase, getHeaders }: OpcionesApi) {
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
  return {
    yo: () => pedir<{ email: string; nombre: string }>('/yo'),
    catalogos: () => pedir<{ tareas: Tarea[]; padron: Persona[]; fecha: string }>('/catalogos'),
    atsInicio: () => pedir<AtsRemoto[]>('/ats-inicio'),
    /** null si no existe en SharePoint */
    registro: (codigo: string) => pedir<AtsRemoto>(`/registros/${encodeURIComponent(codigo)}`)
      .catch((e) => { if (e instanceof ErrorApi && e.status === 404) return null; throw e; }),
    enviar: (doc: Doc, personal: Firma[]) => pedir<{ ok: true; id: number; accion: string; avisos: string[] }>('/documentos', {
      method: 'POST', body: JSON.stringify({ doc, personal }),
    }),
  };
}

export type Api = ReturnType<typeof crearApi>;
