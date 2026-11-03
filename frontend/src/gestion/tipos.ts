// Modelo de la gestión HSS del ATS 2.0: lo que devuelve el backend en /api/ats/gestion/*.
// Las columnas crudas de un registro (campos) son las mismas de la lista ATS2 Registros (Title, Tipo, Verif360…).

export type SiNo = 'SI' | 'NO';

export interface Registro {
  codigo: string;
  tipo: string;            // ATS | TTR
  estado: string;          // Abierto | Cerrado | Detenido | No aplica | Borrador
  resultado: string;
  inicioTurno: string;     // SI | NO | ''
  fechaInicio: string;     // ISO
  fechaCierre: string;     // ISO | ''
  turno: string;
  frente: string;
  tarea: string;
  empresa: string;
  supervisor: string;
  radio: string;
  personasN: number;
  tareaRutinaria: string;
  atsInicio: string;
  creadoPorNombre: string;
  creadoPorEmail: string;
  creadoEnApp: string;
  appVersion: string;
  valeHasta: string;       // yyyy-mm-dd | '' (solo ATS de inicio autorizado)
  vigente: boolean;
}

export interface RegistroValido extends Registro {
  quedan: number;          // días hasta el vencimiento (0 = vence hoy)
  ttrN: number;            // TTR vinculadas
}

export interface FirmaPersonal {
  nro: number; nombre: string; documento: string; cargo: string; empresa: string; credencial: string;
  hora: string; firma: string; origen: string; firmadoEl: string;
}

export type Campos = Record<string, string | number | null | undefined>;

export interface DetalleRegistro {
  registro: Registro;
  campos: Campos;
  personal: FirmaPersonal[];
  ttr: Registro[];         // TTR vinculadas (si es un ATS de inicio)
}

export interface Validos { ats: RegistroValido[]; ttr: Registro[] }

export interface TareaG {
  codigo: string; tarea: string; procedimiento: string; anexoIperc: string; area: string; frente: string; empresa: string;
  riesgoFatal: string; ccv: string; aprobadoPor: string; fechaAprobacion: string; ultimaRevision: string;
  activa: SiNo; habilitados: string[];
}
export type TareaCuerpo = Omit<TareaG, 'codigo'>;

export interface PersonaG {
  documento: string; nombre: string; cargo: string; empresa: string; equipo: string; activo: SiNo; credencial: string;
  tareas: string[];        // códigos de tareas activas en las que está habilitado
}

export interface Resumen {
  registros: { total: number; hoy: number; semana: number; ats: number; ttr: number; faltaCierre: number };
  validos: number;
  tareas: { total: number; activas: number };
  personas: { total: number; activas: number };
}

export interface Yo { email: string; nombre: string; gestion?: boolean }

/** tarjeta QR para la hoja de impresión */
export interface Tarjeta { kind: string; code: string; l1: string; l2: string; l3: string }

export type Desde = 'registros' | 'validos';

export type Pantalla =
  | { id: 'registros' }
  | { id: 'validos' }
  | { id: 'registro'; codigo: string; desde: Desde }
  | { id: 'tareas' }
  | { id: 'tarea'; codigo: string | null }          // null = nueva
  | { id: 'personas' }
  | { id: 'persona'; documento: string | null }     // null = nueva
  | { id: 'imprimir'; titulo: string; tarjetas: Tarjeta[]; volver: Pantalla };
