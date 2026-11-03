// Firma del supervisor (ScrFirma): autorizar el ATS / TTR (pasa a Abierto) o firmar el cierre del ATS.
import { useRef, useState } from 'react';
import { useAts } from '../estado';
import { Banda, Encabezado, LienzoFirma, type ManejoFirma } from '../componentes';
import { aEnviar, hhmm } from '../util';

/** posición del teléfono al autorizar (como la app); sin permiso o sin GPS queda vacía */
function posicion(): Promise<{ lat: string; lon: string }> {
  return new Promise((ok) => {
    if (!navigator.geolocation) return ok({ lat: '', lon: '' });
    navigator.geolocation.getCurrentPosition((p) => ok({ lat: String(p.coords.latitude), lon: String(p.coords.longitude) }),
      () => ok({ lat: '', lon: '' }), { timeout: 4000, maximumAge: 600000 });
  });
}

export function FirmaPantalla({ para }: { para: 'autorizar' | 'cerrar' }) {
  const s = useAts();
  const d = s.actual!;
  const [msg, setMsg] = useState('');
  const lienzo = useRef<ManejoFirma | null>(null);
  const nombre = para === 'autorizar' ? d.supervisor : d.supCierre || d.supervisor;
  const texto = para === 'cerrar' ? 'Cierro este ATS 2.0: la tarea terminó y todo riesgo quedó controlado.'
    : d.tipo === 'ATS' ? 'Autorizo este ATS 2.0: verifiqué los controles y que todos los trabajadores firmaron.'
      : 'Autorizo esta TTR: todos firmaron y hoy no cambió ninguna condición.';
  const volver = () => s.ir({ id: d.tipo === 'ATS' ? 'ats' : 'ttr' });

  const confirmar = async () => {
    const firma = lienzo.current?.imagen();
    if (!firma) return setMsg('Falta la firma: firmá en el recuadro.');
    if (para === 'autorizar') {
      const pos = await posicion();
      s.cambiar((x) => ({ firmaSup: firma, horaAut: hhmm(), estado: 'Abierto', paso: 6, lat: pos.lat, lon: pos.lon, ...aEnviar(x) }));
      s.recordar(d);
      s.avisar(d.tipo === 'ATS' ? 'ATS autorizado. Pueden iniciar la tarea. Al terminar, completá el cierre (paso 6).'
        : 'TTR autorizada. Pueden iniciar la tarea. Al terminar, completá el término (paso 5).');
    } else {
      s.cambiar({ firmaCierre: firma, supCierre: nombre });
    }
    volver();
  };

  return (
    <div className="ats2-pant">
      <Encabezado color={d.tipo === 'ATS' ? 'navy' : 'blue'} titulo={para === 'autorizar' ? 'Firma del supervisor que autoriza' : 'Firma del supervisor que cierra'}
        sub={`${d.tipo} · ${d.codigo}`} onAtras={volver} />
      <main className="ats2-cuerpo">
        <div className="ats2-decl">{texto}</div>
        <div className="ats2-sup-t">Firma: {nombre}</div>
        <div className="ats2-firma-caja">
          <LienzoFirma manejo={lienzo} alto={300} />
          <button type="button" className="ats2-btn-pildora ats2-firma-borrar" onClick={() => lienzo.current?.limpiar()}>Borrar</button>
          <span className="ats2-firma-pista">Firmá acá con el dedo</span>
        </div>
        {msg && <Banda tono="malSuave">{msg}</Banda>}
      </main>
      <footer className="ats2-pie-fijo">
        <button type="button" className="ats2-btn ats2-btn-borde" onClick={volver}>Cancelar</button>
        <button type="button" className="ats2-btn ats2-btn-green ats2-crece" onClick={() => void confirmar()}>{para === 'autorizar' ? 'Firmar y autorizar' : 'Confirmar firma'}</button>
      </footer>
    </div>
  );
}
