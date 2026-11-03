// Tareas rutinarias (ScrTareas): el Listado que usa la TTR, con su QR y su personal habilitado.
import { useMemo } from 'react';
import { useGestion } from '../estado';
import { Boton, Buscador, Chip, Encabezado, EtiquetaActiva, Tabla, useTitulo, type Columna } from '../componentes';
import type { TareaG } from '../tipos';
import { coincide } from '../util';

export const tarjetaTarea = (t: Pick<TareaG, 'codigo' | 'tarea' | 'frente' | 'area'>) =>
  ({ kind: 'Tarea rutinaria', code: `ATS2-T-${t.codigo.toUpperCase()}`, l1: t.codigo, l2: t.tarea, l3: t.frente || t.area });

export function Tareas() {
  useTitulo('Tareas rutinarias');
  const s = useGestion();
  const { tarF, qTar } = s.filtros;
  const filas = useMemo(
    () => s.tareas.filter((t) => (tarF === 'Todas' || t.activa === 'SI') && coincide(qTar, t.codigo, t.tarea, t.frente, t.area, t.empresa))
      .sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [s.tareas, tarF, qTar],
  );
  const sinRf = (t: TareaG) => !t.riesgoFatal || t.riesgoFatal === 'NO';

  const columnas: Columna<TareaG>[] = [
    { titulo: 'Código', ancho: 132, render: (t) => <b className="ats2g-navy">{t.codigo}</b> },
    { titulo: 'Tarea', render: (t) => t.tarea, titulo2: (t) => t.tarea },
    { titulo: 'Área', sec: true, ancho: '10%', render: (t) => <span className="ats2g-muted">{t.area}</span> },
    { titulo: 'Frente', sec: true, ancho: '10%', render: (t) => <span className="ats2g-muted">{t.frente}</span> },
    { titulo: 'Empresa', sec: true, ancho: '10%', render: (t) => <span className="ats2g-muted">{t.empresa}</span> },
    { titulo: 'Riesgo fatal', ancho: '15%', render: (t) => <span className={sinRf(t) ? 'ats2g-muted' : 'ats2g-rojo'}>{sinRf(t) ? 'No tiene' : `⚠ ${t.riesgoFatal}`}</span>, titulo2: (t) => t.riesgoFatal },
    { titulo: 'Procedimiento', sec: true, ancho: '10%', render: (t) => <span className="ats2g-muted">{t.procedimiento}</span> },
    { titulo: 'Habilitados', ancho: 104, al: 'centro', render: (t) => <b className={t.habilitados.length === 0 ? 'ats2g-rojo' : ''}>{t.habilitados.length}</b> },
    { titulo: 'Estado', ancho: 100, al: 'centro', render: (t) => <EtiquetaActiva activa={t.activa === 'SI'} /> },
  ];

  const imprimir = () => s.ir({ id: 'imprimir', titulo: 'QR de tareas rutinarias', tarjetas: filas.map(tarjetaTarea), volver: { id: 'tareas' } });

  return (
    <>
      <Encabezado titulo="Tareas rutinarias" sub="Listado que usa la TTR de ATS 2.0: cada tarea tiene su QR y su personal habilitado"
        derecha={<>
          <Boton tipo="borde" disabled={filas.length === 0} onClick={imprimir}>🖨  Imprimir QR ({filas.length})</Boton>
          <Boton tipo="blue" onClick={() => s.ir({ id: 'tarea', codigo: null })}>＋  Nueva tarea</Boton>
        </>} />
      <div className="ats2g-barra">
        <Buscador valor={qTar} onCambio={(v) => s.setFiltros({ qTar: v })} pista="Buscar código, tarea, área o frente" />
        <Chip activo={tarF === 'Activas'} onClick={() => s.setFiltros({ tarF: 'Activas' })}>Activas</Chip>
        <Chip activo={tarF === 'Todas'} onClick={() => s.setFiltros({ tarF: 'Todas' })}>Todas</Chip>
        <span className="ats2g-crece" />
        <span className="ats2g-cnt">{filas.length} tarea(s)</span>
      </div>
      <Tabla columnas={columnas} filas={filas} clave={(t) => t.codigo} onFila={(t) => s.ir({ id: 'tarea', codigo: t.codigo })}
        vacio={s.tareas.length === 0
          ? 'Todavía no hay tareas en el Listado de Tareas Rutinarias. Tocá + Nueva tarea para cargar la primera: con eso la TTR ya la puede elegir o escanear su QR.'
          : 'Ninguna tarea coincide.'} />
      <div className="ats2g-pie">Clic en una tarea para editarla, habilitar personal o imprimir su QR · una tarea no se borra: se desactiva</div>
    </>
  );
}
