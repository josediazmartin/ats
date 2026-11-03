// ATS válidos (ScrVal): ATS 2.0 de inicio de turno autorizados que siguen valiendo hoy (15 días inclusive).
import { useEffect, useMemo } from 'react';
import { useGestion } from '../estado';
import { Buscador, Chip, Encabezado, EtiquetaEstado, Indicadores, Tabla, useTitulo, type Columna } from '../componentes';
import type { RegistroValido } from '../tipos';
import { coincide, ddmmaaaaDeDia, fechaCorta, quedanDias, valeHastaDe } from '../util';

export function Validos() {
  useTitulo('ATS válidos');
  const s = useGestion();
  const { valF, qVal } = s.filtros;
  useEffect(() => { void s.cargarValidos(); }, [s.cargarValidos]);   // eslint-disable-line react-hooks/exhaustive-deps

  const todos = useMemo(() => (s.validos?.ats ?? []).map((r) => ({ ...r, quedan: typeof r.quedan === 'number' ? r.quedan : quedanDias(r) })), [s.validos]);
  const filas = useMemo(
    () => todos.filter((r) => (valF === '' || r.quedan <= 3) && coincide(qVal, r.codigo, r.tarea, r.frente, r.empresa, r.supervisor)),
    [todos, valF, qVal],
  );
  const n = (f: (r: RegistroValido) => boolean) => todos.filter(f).length;
  const textoQuedan = (d: number) => (d <= 0 ? 'vence hoy' : d === 1 ? '1 día' : `${d} días`);

  const columnas: Columna<RegistroValido>[] = [
    { titulo: 'N°', ancho: 162, render: (r) => <b className="ats2g-navy">{r.codigo}</b> },
    { titulo: 'Vale hasta', ancho: 100, render: (r) => <b className="ats2g-verde">{ddmmaaaaDeDia(valeHastaDe(r))}</b> },
    { titulo: 'Quedan', ancho: 96, al: 'centro', render: (r) => <span className={`ats2g-est ${r.quedan <= 3 ? 'ats2g-est-pronto' : 'ats2g-est-cerrado'}`}>{textoQuedan(r.quedan)}</span> },
    { titulo: 'Tarea', render: (r) => r.tarea || '(sin tarea)', titulo2: (r) => r.tarea },
    { titulo: 'Frente', sec: true, ancho: '8%', render: (r) => <span className="ats2g-muted">{r.frente}</span>, titulo2: (r) => r.frente },
    { titulo: 'Empresa', sec: true, ancho: '8%', render: (r) => <span className="ats2g-muted">{r.empresa}</span>, titulo2: (r) => r.empresa },
    { titulo: 'Supervisor', sec: true, ancho: '8%', render: (r) => <span className="ats2g-muted">{r.supervisor}</span>, titulo2: (r) => r.supervisor },
    { titulo: 'Inicio', sec: true, ancho: 88, render: (r) => <span className="ats2g-muted">{fechaCorta(r.fechaInicio)}</span> },
    { titulo: 'TTR', ancho: 56, al: 'centro', render: (r) => <b>{r.ttrN ?? 0}</b> },
    { titulo: 'Estado', ancho: 116, al: 'centro', render: (r) => <EtiquetaEstado estado={r.estado} /> },
  ];

  return (
    <>
      <Encabezado titulo="ATS válidos (inicio de turno)"
        sub={`ATS 2.0 de inicio de turno autorizados que siguen valiendo hoy ${fechaCorta(new Date().toISOString())}: la TTR se puede vincular a cualquiera de estos`} />
      <Indicadores items={[
        { t: 'Válidos ahora', v: todos.length, color: 'green' },
        { t: 'Vencen en 3 días o menos', v: n((r) => r.quedan <= 3), color: 'soon' },
        { t: 'Autorizados, falta cierre', v: n((r) => r.estado === 'Abierto'), color: 'blue' },
        { t: 'Cerrados', v: n((r) => r.estado === 'Cerrado'), color: 'navy' },
        { t: 'TTR vinculadas', v: todos.reduce((a, r) => a + (Number(r.ttrN) || 0), 0), color: 'blue' },
      ]} />
      <div className="ats2g-barra">
        <Buscador valor={qVal} onCambio={(v) => s.setFiltros({ qVal: v })} pista="Buscar N°, tarea, frente, empresa o supervisor" />
        <Chip activo={valF === ''} onClick={() => s.setFiltros({ valF: '' })}>Todos</Chip>
        <Chip activo={valF === 'pronto'} onClick={() => s.setFiltros({ valF: 'pronto' })}>Vencen en ≤ 3 días</Chip>
      </div>
      <Tabla columnas={columnas} filas={filas} clave={(r) => r.codigo} onFila={(r) => s.ir({ id: 'registro', codigo: r.codigo, desde: 'validos' })}
        vacio={!s.validos ? 'Cargando…' : todos.length === 0 ? 'No hay ATS 2.0 de inicio de turno válidos: en los últimos 15 días no hay ninguno autorizado.' : 'Ninguno coincide con la búsqueda.'} />
      <div className="ats2g-pie">
        Mostrando {filas.length} de {todos.length} válidos · un ATS 2.0 de inicio de turno autorizado vale 15 días desde su fecha (inclusive) · TTR = vinculadas a ese ATS{s.validosAt ? ` · actualizado ${s.validosAt}` : ''}
      </div>
    </>
  );
}
