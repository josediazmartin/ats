// Tablas del almacén SQL: la única fuente de ATS 2.0 / TTR.
// Las columnas se llaman igual que en las listas de SharePoint ATSHSS (ATS2 Registros, ATS2 Personal,
// ATS2 Tareas Rutinarias, ATS2 Personas) para que las reglas (documentos.js), la migración desde SharePoint
// y cualquier exportación sean 1 a 1. Cada tabla suma: id, sp_id (ID que tenía en SharePoint, si vino de ahí),
// creado_el y modificado_el (ISO UTC).

export const TABLAS = {
  registros: {
    unica: ['Title'],
    numericas: ['PersonasN'],
    columnas: [
      'Title', 'Tipo', 'Estado', 'Resultado', 'InicioTurno', 'FechaInicio', 'FechaCierre', 'Turno', 'Pais',
      'Frente', 'Tarea', 'Lugar', 'Cota', 'Empresa', 'Contratista', 'DuenoArea', 'Procedimiento', 'MatrizIPER',
      'Radio', 'Supervisor', 'FirmaSupervisor', 'Verif360', 'NoEn360', 'RiesgoFatal', 'RiesgosFatales',
      'OtroRiesgoFatal', 'CCV', 'RiesgosNoFatales', 'OtroRiesgo', 'OtroRiesgoControles', 'ControlAdicional',
      'CierreChecks', 'HoraTermino', 'ObsCierre', 'SupervisorCierre', 'FirmaCierre', 'Reconocido',
      'MotivoReconocimiento', 'TareaRutinaria', 'EnListado', 'ATSInicio', 'ATSInicioHora', 'Cambios',
      'CambioDetectado', 'AreaLimpia', 'Latitud', 'Longitud', 'PersonasN', 'CreadoPorEmail', 'CreadoPorNombre',
      'CreadoEnApp', 'AppVersion',
    ],
    indices: [['Tipo', 'InicioTurno', 'FechaInicio'], ['FechaInicio'], ['ATSInicio'], ['Estado']],
  },
  personal: {
    unica: ['Title', 'Documento'],
    numericas: ['Nro'],
    columnas: ['Title', 'Tipo', 'Nro', 'Nombre', 'Cargo', 'Empresa', 'Documento', 'Credencial', 'Hora', 'Origen', 'Firma', 'FirmadoEl'],
    indices: [['Title'], ['Documento']],
  },
  tareas: {
    unica: ['Title'],
    numericas: [],
    columnas: [
      'Title', 'Tarea', 'Procedimiento', 'AnexoIPERC', 'Area', 'Frente', 'Empresa', 'RiesgoFatal', 'CCV',
      'PersonalCapacitado', 'AprobadoPor', 'FechaAprobacion', 'UltimaRevision', 'Activa',
    ],
    indices: [['Activa']],
  },
  personas: {
    unica: ['Title'],
    numericas: [],
    columnas: ['Title', 'Nombre', 'Cargo', 'Empresa', 'Equipo', 'Activo', 'Credencial'],
    indices: [['Activo'], ['Nombre']],
  },
};

const q = (c) => `"${c}"`;

/** CREATE TABLE / INDEX de todo el esquema (idempotente) */
export function sqlEsquema() {
  const partes = [];
  for (const [nombre, t] of Object.entries(TABLAS)) {
    const cols = t.columnas.map((c) => `${q(c)} ${t.numericas.includes(c) ? 'REAL' : 'TEXT'}`);
    partes.push(`CREATE TABLE IF NOT EXISTS ${nombre} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sp_id INTEGER,
  ${cols.join(',\n  ')},
  creado_el TEXT NOT NULL,
  modificado_el TEXT NOT NULL,
  UNIQUE (${t.unica.map(q).join(', ')})
);`);
    for (const idx of t.indices) partes.push(`CREATE INDEX IF NOT EXISTS ix_${nombre}_${idx.join('_').toLowerCase()} ON ${nombre} (${idx.map(q).join(', ')});`);
  }
  return partes.join('\n');
}
