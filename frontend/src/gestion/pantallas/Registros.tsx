// ATS cargados (ScrRegs): indicadores, período, tipo, búsqueda y tabla de ATS2 Registros.
import { useMemo } from 'react';
import { useGestion } from '../estado';
import { Buscador, Chip, Encabezado, EtiquetaEstado, EtiquetaTipo, Indicadores, Tabla, useTitulo, type Columna } from '../componentes';
import type { Registro } from '../tipos';
import { coincide, esInicioAutorizado, fechaHora, textoFin, vigente } from '../util';

const PERIODOS = [{ n: 1, t: 'Hoy' }, { n: 7, t: '7 días' }, { n: 30, t: '30 días' }, { n: 90, t: '90 días' }, { n: 0, t: 'Todos' }];

export function Registros() {
  useTitulo('ATS cargados');
  const s = useGestion();
  const { dias, tipo, q } = s.filtros;
  const todos = s.registros;
  const filas = useMemo(
    () => todos.filter((r) => (!tipo || r.tipo === tipo) && coincide(q, r.codigo, r.tarea, r.frente, r.empresa, r.supervisor, r.tareaRutinaria)),
    [todos, tipo, q],
  );
  const per = dias === 1 ? 'hoy' : dias === 0 ? 'todos' : `últimos ${dias} días`;
  const n = (f: (r: Registro) => boolean) => todos.filter(f).length;

  const columnas: Columna<Registro>[] = [
    { titulo: 'Tipo', ancho: 58, al: 'centro', render: (r) => <EtiquetaTipo tipo={r.tipo} /> },
    { titulo: 'N°', ancho: 162, render: (r) => <b className="ats2g-navy">{r.codigo}</b> },
    { titulo: 'Inicio', ancho: 118, render: (r) => <span className="ats2g-muted">{fechaHora(r.fechaInicio)}</span> },
    { titulo: 'Fin / vale hasta', ancho: 130, render: (r) => (
      <span className={esInicioAutorizado(r) ? `ats2g-semi ${vigente(r) ? 'ats2g-verde' : 'ats2g-gris'}` : 'ats2g-muted'}>{textoFin(r)}</span>) },
    { titulo: 'Tarea', render: (r) => r.tarea || '(sin tarea)', titulo2: (r) => r.tarea },
    { titulo: 'Frente', sec: true, ancho: '8%', render: (r) => <span className="ats2g-muted">{r.frente}</span>, titulo2: (r) => r.frente },
    { titulo: 'Empresa', sec: true, ancho: '8%', render: (r) => <span className="ats2g-muted">{r.empresa}</span>, titulo2: (r) => r.empresa },
    { titulo: 'Supervisor', sec: true, ancho: '8%', render: (r) => <span className="ats2g-muted">{r.supervisor}</span>, titulo2: (r) => r.supervisor },
    { titulo: 'Firmas', ancho: 64, al: 'centro', render: (r) => r.personasN || 0 },
    { titulo: 'Estado', ancho: 116, al: 'centro', render: (r) => <EtiquetaEstado estado={r.estado} /> },
  ];

  return (
    <>
      <Encabezado titulo="ATS y TTR cargados"
        sub={`Enviados desde los teléfonos y la web · ${per}${s.registrosAt ? ` · actualizado ${s.registrosAt}` : ''}`} />
      <Indicadores items={[
        { t: 'Total', v: todos.length, color: 'navy' },
        { t: 'ATS 2.0', v: n((r) => r.tipo === 'ATS'), color: 'orange' },
        { t: 'TTR', v: n((r) => r.tipo === 'TTR'), color: 'blue' },
        { t: 'Cerrados', v: n((r) => r.estado === 'Cerrado'), color: 'green' },
        { t: 'Falta cierre', v: n((r) => r.estado === 'Abierto'), color: 'blue' },
        { t: 'Detenidos', v: n((r) => r.estado === 'Detenido'), color: 'alert' },
        { t: 'Firmas', v: todos.reduce((a, r) => a + (Number(r.personasN) || 0), 0), color: 'navy' },
      ]} />
      <div className="ats2g-barra">
        <Buscador valor={q} onCambio={(v) => s.setFiltros({ q: v })} pista="Buscar N°, tarea, frente, empresa o supervisor" />
        <Chip activo={tipo === ''} onClick={() => s.setFiltros({ tipo: '' })}>Todos</Chip>
        <Chip activo={tipo === 'ATS'} onClick={() => s.setFiltros({ tipo: 'ATS' })}>ATS</Chip>
        <Chip activo={tipo === 'TTR'} onClick={() => s.setFiltros({ tipo: 'TTR' })}>TTR</Chip>
        <span className="ats2g-sep" />
        {PERIODOS.map((p) => (
          <Chip key={p.n} activo={dias === p.n} onClick={() => { s.setFiltros({ dias: p.n }); void s.cargarRegistros(p.n); }}>{p.t}</Chip>
        ))}
      </div>
      <Tabla columnas={columnas} filas={filas} clave={(r) => r.codigo} onFila={(r) => s.ir({ id: 'registro', codigo: r.codigo, desde: 'registros' })}
        vacio={todos.length === 0 ? 'No hay ATS ni TTR enviados en el período elegido. Los teléfonos los envían cuando tienen señal.' : 'Ninguno coincide con la búsqueda.'} />
      <div className="ats2g-pie">
        Mostrando {filas.length} de {todos.length} · Fin: el ATS de inicio de turno vale 15 días desde su fecha; los demás, la fecha de cierre · clic en una fila para ver el detalle, las firmas y el QR
      </div>
    </>
  );
}
