// Personal habilitado (ScrPersonas): el padrón del ATS 2.0 (lista ATS2 Personas).
import { useMemo } from 'react';
import { useGestion } from '../estado';
import { Boton, Buscador, Chip, Encabezado, EtiquetaActiva, Tabla, useTitulo, type Columna } from '../componentes';
import type { PersonaG } from '../tipos';
import { coincide } from '../util';

export const tarjetaPersona = (p: PersonaG) => ({
  kind: 'Credencial ATS 2.0', code: `ATS2-P-${p.documento}`, l1: p.nombre, l2: `DNI / RUT ${p.documento}`,
  l3: [p.empresa, p.equipo, p.credencial].filter(Boolean).join(' · '),
});

export function Personas() {
  useTitulo('Personal habilitado');
  const s = useGestion();
  const { perF, qPer } = s.filtros;
  const filas = useMemo(
    () => s.personas.filter((p) => (perF === 'Todos' || p.activo === 'SI') && coincide(qPer, p.nombre, p.documento, p.credencial, p.empresa, p.cargo, p.equipo))
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [s.personas, perF, qPer],
  );

  const columnas: Columna<PersonaG>[] = [
    { titulo: 'Apellido y nombre', render: (p) => <b className="ats2g-navy">{p.nombre}</b>, titulo2: (p) => p.nombre },
    { titulo: 'DNI / RUT', ancho: 130, render: (p) => p.documento },
    { titulo: 'Credencial', ancho: 180, render: (p) => <span className="ats2g-muted">{p.credencial}</span> },
    { titulo: 'Empresa', sec: true, ancho: '16%', render: (p) => <span className="ats2g-muted">{p.empresa}</span> },
    { titulo: 'Equipo', sec: true, ancho: '12%', render: (p) => <span className="ats2g-muted">{p.equipo}</span> },
    { titulo: 'Tareas', ancho: 80, al: 'centro', render: (p) => <b>{p.tareas?.length ?? 0}</b> },
    { titulo: 'Estado', ancho: 100, al: 'centro', render: (p) => <EtiquetaActiva activa={p.activo === 'SI'} si="Activo" no="Inactivo" /> },
  ];

  const imprimir = () => s.ir({ id: 'imprimir', titulo: 'Credenciales QR', tarjetas: filas.map(tarjetaPersona), volver: { id: 'personas' } });

  return (
    <>
      <Encabezado titulo="Personal habilitado" sub="Padrón del ATS 2.0: en la app el trabajador se agrega escaneando su credencial o su DNI"
        derecha={<>
          <Boton tipo="borde" disabled={filas.length === 0} onClick={imprimir}>🖨  Imprimir QR ({filas.length})</Boton>
          <Boton tipo="blue" onClick={() => s.ir({ id: 'persona', documento: null })}>＋  Agregar persona</Boton>
        </>} />
      <div className="ats2g-barra">
        <Buscador valor={qPer} onCambio={(v) => s.setFiltros({ qPer: v })} pista="Buscar nombre, DNI o credencial" />
        <Chip activo={perF === 'Activos'} onClick={() => s.setFiltros({ perF: 'Activos' })}>Activos</Chip>
        <Chip activo={perF === 'Todos'} onClick={() => s.setFiltros({ perF: 'Todos' })}>Todos</Chip>
        <span className="ats2g-crece" />
        <span className="ats2g-cnt">{filas.length} persona(s)</span>
      </div>
      <Tabla columnas={columnas} filas={filas} clave={(p) => p.documento} onFila={(p) => s.ir({ id: 'persona', documento: p.documento })}
        vacio={s.personas.length === 0 ? 'Todavía no hay personas cargadas.' : 'Nadie coincide con la búsqueda.'} />
      <div className="ats2g-pie">Tareas = tareas activas en las que la persona está habilitada (se habilita desde cada tarea) · clic en una persona para editarla</div>
    </>
  );
}
