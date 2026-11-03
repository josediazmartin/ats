// Almacén de prueba en un archivo JSON, con las mismas columnas que las listas de SharePoint.
// Sirve para correr y probar todo sin credenciales de Microsoft. Arranca con datos/demo.json (personas y tareas
// ficticias). Nunca usarlo en producción.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function crearAlmacenLocal({ archivo, semilla }) {
  if (!existsSync(archivo)) {
    mkdirSync(dirname(archivo), { recursive: true });
    const s = JSON.parse(readFileSync(semilla, 'utf8'));
    const db0 = { ultimoId: 0, registros: [], personal: [], tareas: [], personas: [] };
    for (const t of s.tareas) db0.tareas.push({ id: ++db0.ultimoId, fields: t });
    for (const p of s.personas) db0.personas.push({ id: ++db0.ultimoId, fields: p });
    writeFileSync(archivo, JSON.stringify(db0, null, 1));
  }
  const leer = () => JSON.parse(readFileSync(archivo, 'utf8'));
  const escribir = (db) => writeFileSync(archivo, JSON.stringify(db, null, 1));
  const copia = (filas) => structuredClone(filas);

  return {
    nombre: 'local',
    tareasActivas: async () => copia(leer().tareas.filter((t) => t.fields.Activa === 'SI')),
    padronActivo: async () => copia(leer().personas.filter((p) => p.fields.Activo === 'SI')),
    registroPorCodigo: async (codigo) => copia(leer().registros.find((r) => r.fields.Title === codigo) ?? null),
    atsInicioDesde: async (isoUtc) => copia(leer().registros.filter((r) => r.fields.Tipo === 'ATS'
      && r.fields.InicioTurno === 'SI' && r.fields.FechaInicio >= isoUtc)),
    personalDe: async (codigo) => copia(leer().personal.filter((p) => p.fields.Title === codigo)),
    async crearRegistro(fields) {
      const db = leer(); const id = ++db.ultimoId;
      db.registros.push({ id, fields: { ...fields } }); escribir(db); return id;
    },
    async actualizarRegistro(id, fields) {
      const db = leer(); const r = db.registros.find((x) => x.id === id);
      if (!r) throw Object.assign(new Error(`No existe el registro ${id}`), { status: 404 });
      Object.assign(r.fields, fields); escribir(db);
    },
    async crearPersona(fields) {
      const db = leer(); const id = ++db.ultimoId;
      db.personal.push({ id, fields: { ...fields } }); escribir(db); return id;
    },
    urlRegistro: (id) => `local://ATS2 Registros/${id}`,
  };
}
