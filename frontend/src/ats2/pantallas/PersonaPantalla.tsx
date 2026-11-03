// Agregar trabajador (ScrPersona, v14c + v18): solo escaneando la credencial (QR), el DNI argentino (PDF417),
// la cédula chilena (RUN=) o leyendo el chip NFC de la credencial. La persona sale del padrón (ATS2 Personas);
// en la TTR además tiene que estar habilitada para la tarea. Después firma con el dedo.
import { useRef, useState } from 'react';
import { useAts } from '../estado';
import { Banda, BotonEscanear, Encabezado, LienzoFirma, type ManejoFirma } from '../componentes';
import { hhmm, normDni } from '../util';

interface Leida { documento: string; nombre: string; cargo: string; empresa: string; credencial: string; origen: string }
const proper = (x: string) => x.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());

export function PersonaPantalla() {
  const s = useAts();
  const d = s.actual!;
  const [per, setPer] = useState<Leida | null>(null);
  const [msg, setMsg] = useState('');
  const [nfc, setNfc] = useState(false);
  const lienzo = useRef<ManejoFirma | null>(null);
  const hab = s.tareas.find((t) => t.codigo === d.tareaCod)?.habilitados ?? [];
  const firmaron = s.pers.filter((p) => p.codigo === d.codigo).length;
  const volver = () => { setMsg(''); s.ir({ id: d.tipo === 'ATS' ? 'ats' : 'ttr' }); };

  /** PerParse: qué persona es lo leído */
  const reconocer = (leido: string, via: 'QR' | 'NFC') => {
    const x = leido.trim(); const xu = x.toUpperCase(); const xd = normDni(x).replace(/-/g, '');
    const conPadron = (q: { documento: string; nombre: string; cargo: string; empresa: string; credencial: string }, origen: string): Leida =>
      ({ documento: q.documento, nombre: q.nombre, cargo: q.cargo, empresa: q.empresa || d.empresa, credencial: q.credencial, origen });
    let r: Leida | null = null;
    const p = s.padron.find((q) => (q.credencial && q.credencial.toUpperCase() === xu) || q.documento === x || q.documento === xd
      || (xu.startsWith('ATS2-P-') && q.documento === x.slice(7)));
    const pc = s.padron.find((q) => q.credencial && xu.includes(q.credencial.toUpperCase()));
    if (!x) { s.avisar('No se leyó nada: volvé a escanear la credencial.', 'aviso'); return; }
    if (p) r = conPadron(p, xu.startsWith('ATS2-P-') ? 'QR ATS 2.0' : 'Credencial');
    else if (pc) r = conPadron(pc, 'Credencial');
    else if (x.includes('@') && x.split('@').length >= 6) {
      // DNI argentino (PDF417): nuevo "trámite@APELLIDO@NOMBRE@sexo@DNI@…", viejo "@DNI@…@APELLIDO@NOMBRE@…"
      const sp = x.split('@'); const viejo = x.startsWith('@');
      const dc = normDni(viejo ? sp[1] : sp[4]);
      const nm = proper((viejo ? `${sp[5]} ${sp[4]}` : `${sp[2]} ${sp[1]}`).trim());
      const q = s.padron.find((y) => y.documento === dc);
      r = q ? conPadron(q, 'DNI') : { documento: dc, nombre: nm, cargo: '', empresa: d.empresa, credencial: '', origen: 'DNI' };
    } else if (xu.includes('RUN=')) {
      const rr = x.slice(xu.indexOf('RUN=') + 4); const run = rr.split('&')[0];
      const limpio = run.replace(/[.-]/g, '');
      const q = s.padron.find((y) => y.documento === run || y.documento === limpio || y.documento === limpio.slice(0, -1));
      if (!q) { setPer(null); s.avisar(`La cédula ${run} no está en el padrón. Pedí a HSS que cargue a la persona en la app ATS.`, 'error'); return; }
      r = conPadron(q, 'Cédula');
    }
    if (!r) { setPer(null); s.avisar(`Esa credencial no está en el padrón (${x.slice(0, 30)}). Pedí a HSS que cargue a la persona en la app ATS.`, 'error'); return; }
    if (via === 'NFC') r.origen += ' NFC';
    setPer(r); setMsg('');
    s.avisar(`✓ ${r.nombre}${r.origen === 'DNI' ? ' (DNI)' : ''}`);
  };

  /** chip NFC de la credencial (Web NFC: Chrome de Android) */
  const leerNfc = async () => {
    const Lector = (window as unknown as { NDEFReader?: new () => { scan: (o: { signal: AbortSignal }) => Promise<void>; onreading: ((ev: { message: { records: { recordType: string; encoding?: string; data: DataView }[] } }) => void) | null } }).NDEFReader;
    if (!Lector) { s.avisar('Leer NFC funciona en Chrome de Android con el NFC prendido. En este navegador escaneá el QR de la credencial.', 'error'); return; }
    const corte = new AbortController();
    setNfc(true);
    const fin = setTimeout(() => { corte.abort(); setNfc(false); s.avisar('No se leyó ningún chip. Apoyá la credencial atrás del teléfono y volvé a tocar Leer NFC.', 'aviso'); }, 20000);
    try {
      const lector = new Lector();
      lector.onreading = (ev) => {
        clearTimeout(fin); corte.abort(); setNfc(false);
        const rec = ev.message.records.find((r) => r.recordType === 'text') ?? ev.message.records.find((r) => r.recordType === 'url');
        if (!rec) { s.avisar('El chip de esa credencial está vacío (no tiene el código grabado). Escaneá el QR.', 'error'); return; }
        reconocer(new TextDecoder(rec.encoding || 'utf-8').decode(rec.data), 'NFC');
      };
      await lector.scan({ signal: corte.signal });
    } catch {
      clearTimeout(fin); setNfc(false);
      s.avisar('No se pudo leer el NFC. Prendé el NFC del teléfono y dale permiso a esta página, o escaneá el QR.', 'error');
    }
  };

  const guardar = (quedarse: boolean) => {
    if (!per?.nombre.trim() || !per.documento) return setMsg('Escaneá la credencial del trabajador.');
    const firma = lienzo.current?.imagen();
    if (!firma) return setMsg('Falta la firma del trabajador: firmá en el recuadro.');
    const dc = normDni(per.documento);
    if (s.pers.some((p) => p.codigo === d.codigo && p.documento === dc)) return setMsg('Esa persona ya firmó este documento.');
    if (d.tipo === 'TTR' && !hab.includes(dc)) return setMsg(`DNI ${dc} no está habilitado para la tarea ${d.tareaCod}: en la TTR solo firma el personal habilitado.`);
    s.agregarFirma({ codigo: d.codigo, nombre: per.nombre.trim(), cargo: per.cargo, empresa: per.empresa, documento: dc, credencial: per.credencial, hora: hhmm(), firma, origen: per.origen, firmadoEn: new Date().toISOString() });
    s.avisar(`${per.nombre.trim()} firmó.`);
    setPer(null); setMsg(''); lienzo.current?.limpiar();
    if (!quedarse) volver();
  };

  const habilitado = per ? hab.includes(normDni(per.documento)) : false;
  return (
    <div className="ats2-pant">
      <Encabezado color={d.tipo === 'ATS' ? 'navy' : 'blue'} titulo="Agregar trabajador" sub={`${d.tipo} · ${d.codigo} · ${firmaron} firmaron`} onAtras={volver} />
      <main className="ats2-cuerpo">
        <div className="ats2-fila">
          <BotonEscanear texto="Escanear QR" clase="ats2-crece" onLeido={(t) => reconocer(t, 'QR')} />
          <button type="button" className="ats2-btn ats2-btn-blue ats2-btn-alto" disabled={nfc} onClick={() => void leerNfc()}>{nfc ? 'Apoyá la credencial…' : 'Leer NFC'}</button>
        </div>
        <div className={`ats2-leida ${per ? 'ats2-leida-ok' : ''}`}>
          {per ? <>
            <b className="ats2-leida-nom">{per.nombre}</b>
            <small>DNI / RUT {per.documento}{per.credencial ? ` · credencial ${per.credencial}` : ''}</small>
            <small>{per.empresa}{per.cargo ? ` · ${per.cargo}` : ''}</small>
            {d.tipo === 'TTR' && <b className={habilitado ? 'ats2-verde' : 'ats2-rojo'}>{habilitado ? `✓ Habilitado para ${d.tareaCod}` : `✕ No está habilitado para ${d.tareaCod}: no puede firmar`}</b>}
          </> : <span className="ats2-nota">{d.tipo === 'TTR'
            ? `Escaneá el QR de la credencial o leé su chip NFC. Solo firma el personal del padrón habilitado para la tarea ${d.tareaCod}.`
            : 'Escaneá el QR de la credencial o leé su chip NFC. Solo se puede agregar a quien está en el padrón.'}</span>}
        </div>
        <div className="ats2-decl ats2-decl-chica">{d.tipo === 'ATS'
          ? 'Al firmar, declaro que participé en este ATS, conozco los riesgos de la tarea y los controles que debo aplicar.'
          : 'Al firmar, declaro que conozco el procedimiento y que hoy la tarea se ejecuta sin cambios.'}</div>
        <div className="ats2-firma-caja">
          <LienzoFirma manejo={lienzo} />
          <button type="button" className="ats2-btn-pildora ats2-firma-borrar" onClick={() => lienzo.current?.limpiar()}>Borrar</button>
          <span className="ats2-firma-pista">Firmá acá con el dedo</span>
        </div>
        {msg && <Banda tono="malSuave">{msg}</Banda>}
        <button type="button" className="ats2-btn ats2-btn-green ats2-btn-alto" onClick={() => guardar(false)}>Guardar y volver</button>
        <button type="button" className="ats2-btn ats2-btn-borde ats2-borde-green" onClick={() => guardar(true)}>Guardar y agregar otro</button>
      </main>
    </div>
  );
}
