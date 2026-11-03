// Modelo de datos de ATS 2.0 en el teléfono. Es el mismo documento de la app de Power Apps (gblA / colDocs),
// con listas en vez de cadenas por posición. El backend lo convierte a las columnas de ATS2 Registros.

export type Tipo = 'ATS' | 'TTR';
export type Estado = 'Borrador' | 'Abierto' | 'Cerrado' | 'Detenido' | 'No aplica';
export type Sync = 'pendiente' | 'enviado' | 'error';
export type SiNo = '' | 'SI' | 'NO';
export type Resp360 = '' | 'S' | 'N' | 'A';

export interface Doc {
  codigo: string;
  tipo: Tipo;
  estado: Estado;
  sync: Sync;
  errores?: string[];
  rev?: number;          // sube cada vez que hay algo nuevo para enviar
  spId: number;
  paso: number;
  creado: string;        // ISO
  cerradoEn: string;     // ISO
  resultado: string;
  fecha: string;         // yyyy-mm-dd (del teléfono)
  turno: string;
  horaIni: string;
  inicioTurno: SiNo;
  pais: string;
  frente: string;
  tarea: string;
  lugar: string;
  cota: string;
  empresa: string;
  contratista: string;
  duenoArea: string;
  procedimiento: string;
  iper: SiNo;
  radio: string;
  supervisor: string;
  firmaSup: string;      // data URI PNG
  horaAut: string;
  v360: Resp360[];       // 12 (la TTR usa las 6 primeras)
  noHist: number[];      // preguntas que alguna vez fueron NO
  rf: SiNo;
  rfSel: number[];       // riesgos fatales marcados (1-11)
  rfOtro: string;
  ccv: string;
  r4: ('' | 'S' | 'N')[];  // 16 riesgos sin potencial fatal
  r4c: number[][];         // controles (1-25) por riesgo
  r4Otro: string;
  r4OtroCtr: string;
  ctrlAdic: string;
  cierre: ('' | 'S' | 'A')[];  // 9
  horaFin: string;
  obsCierre: string;
  supCierre: string;
  firmaCierre: string;
  reconocido: string;
  motivoRec: string;
  tareaCod: string;
  enListado: '' | 'SI';
  atsIni: string;
  atsIniHora: string;
  cambios: ('' | 'N' | 'C')[];  // 8
  areaLimpia: SiNo;
  lat: string;
  lon: string;
}

export interface Firma {
  codigo: string;
  nro: number;
  nombre: string;
  cargo: string;
  empresa: string;
  documento: string;
  credencial: string;
  hora: string;
  firma: string;         // data URI PNG
  origen: string;        // Credencial | DNI | QR ATS 2.0 | Cédula (+ " NFC")
  firmadoEn: string;     // ISO
  sync: Sync;
}

export interface Tarea {
  codigo: string;
  tarea: string;
  procedimiento: string;
  area: string;
  frente: string;
  empresa: string;
  riesgoFatal: string;
  ccv: string;
  habilitados: string[];
}

export interface Persona {
  documento: string;
  nombre: string;
  cargo: string;
  empresa: string;
  credencial: string;
}

export interface AtsInicio {
  codigo: string;
  horaAut: string;
  frente: string;
  supervisor: string;
  radio: string;
  empresa: string;
  origen: 'tel' | 'sp';
}

/** lo que devuelve el backend de un ATS buscado por código */
export interface AtsRemoto {
  codigo: string;
  tipo: string;
  inicioTurno: string;
  estado: string;
  fechaInicio: string;
  dia: string;
  horaAut: string;
  frente: string;
  supervisor: string;
  radio: string;
  empresa: string;
}

export type Pantalla =
  | { id: 'inicio' }
  | { id: 'ats' }
  | { id: 'ttr' }
  | { id: 'persona' }
  | { id: 'firma'; para: 'autorizar' | 'cerrar' }
  | { id: 'qr'; texto: string; info: string; desde?: 'ats' };
