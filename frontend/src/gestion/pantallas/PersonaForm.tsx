// Alta / edición de una persona del padrón (ScrPerEd): apellido y nombre, ¿habilitado?, DNI; a la derecha sus tareas.
import { useMemo, useState } from 'react';
import { useGestion } from '../estado';
import { Boton, Campo, EncabezadoDetalle, EtiquetaActiva, SiNoChips, Tarjeta, useTitulo } from '../componentes';
import type { SiNo } from '../tipos';
import { normDoc } from '../util';

export function PersonaForm({ documento }: { documento: string | null }) {
  const s = useGestion();
  const existente = useMemo(() => (documento ? s.personas.find((p) => p.documento === documento) ?? null : null), [documento, s.personas]);
  const [nombre, setNombre] = useState(existente?.nombre ?? '');
  const [act, setAct] = useState<SiNo>(existente?.activo === 'NO' ? 'NO' : 'SI');
  const [doc, setDoc] = useState(existente?.documento ?? '');
  const [guardando, setGuardando] = useState(false);
  useTitulo(existente ? existente.nombre : 'Agregar persona');
  const volver = () => s.ir({ id: 'personas' });

  if (documento && !existente) {
    return <><EncabezadoDetalle volver="Personal habilitado" onVolver={volver} titulo={documento} /><Tarjeta><p className="ats2g-rojo">La persona {documento} no está en el padrón.</p></Tarjeta></>;
  }

  const d = normDoc(doc);
  const tareas = s.tareas.filter((t) => d && t.habilitados.map(normDoc).includes(d)).sort((a, b) => a.codigo.localeCompare(b.codigo));

  async function guardar() {
    const error = (m: string) => s.avisar('error', m);
    if (!nombre.trim()) return error('Falta el apellido y nombre.');
    if (!d) return error('Falta el DNI o RUT.');
    if (!/^[0-9]{6,9}(-?[0-9K])?$/.test(d)) return error('El DNI / RUT va sin puntos: solo números (y el dígito verificador del RUT con guion).');
    if (!existente && s.personas.some((p) => normDoc(p.documento) === d)) return error(`Ya hay otra persona con el documento ${d}.`);
    setGuardando(true);
    try {
      await s.api.guardarPersona(d, { nombre: nombre.trim(), activo: act });
      s.avisar('ok', `${nombre.trim()} guardado.`);
      await Promise.all([s.cargarPersonas(), s.cargarResumen()]);
      volver();
    } catch (e) {
      s.avisar('error', s.mensaje(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <EncabezadoDetalle volver="Personal habilitado" onVolver={volver} titulo={existente ? existente.nombre : 'Agregar persona'}
        sub="Padrón del ATS 2.0 (lista ATS2 Personas)"
        derecha={<>
          <Boton tipo="borde" onClick={volver} disabled={guardando}>Cancelar</Boton>
          <Boton onClick={() => void guardar()} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Boton>
        </>} />
      <div className="ats2g-cols ats2g-cols-form">
        <Tarjeta titulo="Datos de la persona" clase="ats2g-col-izq">
          <div className="ats2g-grid3">
            <div className="ats2g-ancho2"><Campo cap="Apellido y nombre" valor={nombre} onCambio={setNombre} pista="Ej.: Pérez, Juan" /></div>
            <SiNoChips cap="¿Habilitado?" valor={act} onCambio={setAct} />
            <Campo cap="DNI / RUT" valor={doc} onCambio={setDoc} pista="Sin puntos" deshabilitado={!!existente} />
          </div>
          {existente && (existente.credencial || existente.cargo || existente.empresa || existente.equipo) && (
            <p className="ats2g-nota">
              {[existente.credencial && `Credencial ${existente.credencial}`, existente.cargo, existente.empresa, existente.equipo].filter(Boolean).join(' · ')} (se conservan: acá se editan solo el nombre, el DNI y si está habilitado)
            </p>
          )}
          <p className="ats2g-nota">QR de la persona: ATS2-P-{d || '…'} · en la app ATS 2.0 se la reconoce escaneando su credencial de Vicuña o su DNI.</p>
        </Tarjeta>
        <div className="ats2g-col-der">
          <Tarjeta titulo={`Tareas en las que está habilitado (${tareas.length})`}>
            <p className="ats2g-nota">Se habilitan desde cada tarea, en Tareas rutinarias.</p>
            {tareas.length === 0
              ? <p className="ats2g-muted">Todavía no está habilitado en ninguna tarea: no puede firmar ninguna TTR.</p>
              : (
                <div className="ats2g-lista">
                  {tareas.map((t) => (
                    <button key={t.codigo} type="button" className="ats2g-item ats2g-item-btn" onClick={() => s.ir({ id: 'tarea', codigo: t.codigo })}>
                      <span className="ats2g-item-txt"><b><span className="ats2g-navy">{t.codigo}</span> · {t.tarea}</b><small>{[t.area, t.frente].filter(Boolean).join(' · ')}</small></span>
                      <EtiquetaActiva activa={t.activa === 'SI'} />
                    </button>
                  ))}
                </div>
              )}
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
