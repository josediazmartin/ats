// Piezas comunes de las pantallas (encabezado, pasos, chips, campos, bandas, paneles, firma, escáner, QR).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

export function Encabezado({ titulo, sub, color = 'navy', onAtras, derecha }: {
  titulo: string; sub?: string; color?: 'navy' | 'blue'; onAtras?: () => void; derecha?: ReactNode;
}) {
  return (
    <header className={`ats2-hdr ats2-hdr-${color}`}>
      {onAtras && <button type="button" className="ats2-hdr-atras" onClick={onAtras} aria-label="Volver">‹</button>}
      <div className="ats2-hdr-txt">
        <div className="ats2-hdr-tit">{titulo}</div>
        {sub && <div className="ats2-hdr-sub">{sub}</div>}
      </div>
      {derecha}
    </header>
  );
}

export function Pasos({ nombres, actual, hasta, todos, color, onIr }: {
  nombres: string[]; actual: number; hasta: number; todos: boolean; color: 'navy' | 'blue'; onIr: (n: number) => void;
}) {
  return (
    <nav className="ats2-pasos">
      {nombres.map((nom, i) => {
        const n = i + 1; const habil = todos || n <= hasta;
        return (
          <button key={n} type="button" className={`ats2-paso ${n === actual ? `ats2-paso-act ats2-${color}` : habil ? 'ats2-paso-hecho' : ''}`}
            disabled={!habil} onClick={() => onIr(n)}>
            <span className="ats2-paso-n">{n}</span>
            <span className="ats2-paso-l">{nom}</span>
          </button>
        );
      })}
    </nav>
  );
}

export interface OpcionChip<T extends string> { texto: string; valor: T; color?: 'navy' | 'green' | 'alert' | 'gray' | 'blue'; oculto?: boolean }
export function Chips<T extends string>({ titulo, valor, opciones, onCambio, editable = true, chico = false }: {
  titulo?: string; valor: T | ''; opciones: OpcionChip<T>[]; onCambio: (v: T) => void; editable?: boolean; chico?: boolean;
}) {
  return (
    <div className="ats2-campo">
      {titulo && <div className="ats2-cap">{titulo}</div>}
      <div className={`ats2-chips ${chico ? 'ats2-chips-chico' : ''}`}>
        {opciones.map((o) => (
          <button key={o.valor} type="button" disabled={!editable} style={o.oculto ? { visibility: 'hidden' } : undefined}
            className={`ats2-chip ${valor === o.valor ? `ats2-chip-sel ats2-${o.color ?? 'navy'}` : ''}`} onClick={() => onCambio(o.valor)}>
            {o.texto}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Campo({ titulo, valor, onCambio, editable = true, multilinea = false, pista, ancho }: {
  titulo: string; valor: string; onCambio: (v: string) => void; editable?: boolean; multilinea?: boolean; pista?: string; ancho?: 'mitad';
}) {
  return (
    <label className={`ats2-campo ${ancho === 'mitad' ? 'ats2-mitad' : ''}`}>
      <span className="ats2-cap">{titulo}</span>
      {multilinea
        ? <textarea className="ats2-input" rows={3} value={valor} disabled={!editable} placeholder={pista} onChange={(e) => onCambio(e.target.value)} />
        : <input className="ats2-input" value={valor} disabled={!editable} placeholder={pista} onChange={(e) => onCambio(e.target.value)} />}
    </label>
  );
}

/** encabezado de sección del formato (oscuro = punto principal) */
export function Seccion({ num, titulo, nota, oscuro }: { num: string; titulo: string; nota?: string; oscuro?: boolean }) {
  return (
    <div className={`ats2-sec ${oscuro ? 'ats2-sec-osc' : ''}`}>
      <div className="ats2-sec-num">{num}</div>
      <div><div className="ats2-sec-tit">{titulo}</div>{nota && <div className="ats2-sec-nota">{nota}</div>}</div>
    </div>
  );
}

export function Banda({ children, tono = 'alert' }: { children: ReactNode; tono?: 'alert' | 'navy' | 'okSuave' | 'malSuave' | 'ambar' }) {
  return <div className={`ats2-banda ats2-banda-${tono}`}>{children}</div>;
}

export function Panel({ titulo, sub, onCerrar, cerrar = 'Cerrar', children }: { titulo: string; sub?: string; onCerrar: () => void; cerrar?: string; children: ReactNode }) {
  return (
    <div className="ats2-velo" role="dialog" aria-modal="true">
      <div className="ats2-panel">
        <div className="ats2-panel-tit">{titulo}</div>
        {sub && <div className="ats2-panel-sub">{sub}</div>}
        <div className="ats2-panel-cuerpo">{children}</div>
        <button type="button" className="ats2-btn ats2-btn-borde" onClick={onCerrar}>{cerrar}</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- firma con el dedo
export interface ManejoFirma { limpiar: () => void; imagen: () => string | null }

/** lienzo de firma; imagen() devuelve un PNG o null si no hay trazo suficiente */
export function LienzoFirma({ alto = 190, manejo }: { alto?: number; manejo: React.MutableRefObject<ManejoFirma | null> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const largo = useRef(0);
  useEffect(() => {
    const c = ref.current!; const ctx = c.getContext('2d')!;
    const ajustar = () => {
      const r = c.getBoundingClientRect(); const k = window.devicePixelRatio || 1;
      c.width = Math.round(r.width * k); c.height = Math.round(r.height * k);
      ctx.setTransform(k, 0, 0, k, 0, 0); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, r.width, r.height);
      ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b1f5c';
      largo.current = 0;
    };
    ajustar();
    let ult: { x: number; y: number } | null = null;
    const pos = (e: PointerEvent) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const abajo = (e: PointerEvent) => { try { c.setPointerCapture(e.pointerId); } catch { /* puntero sintético */ } ult = pos(e); };
    const mover = (e: PointerEvent) => {
      if (!ult) return; const p = pos(e);
      ctx.beginPath(); ctx.moveTo(ult.x, ult.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      largo.current += Math.hypot(p.x - ult.x, p.y - ult.y); ult = p;
    };
    const arriba = () => { ult = null; };
    c.addEventListener('pointerdown', abajo); c.addEventListener('pointermove', mover);
    c.addEventListener('pointerup', arriba); c.addEventListener('pointercancel', arriba);
    manejo.current = {
      limpiar: ajustar,
      // como la app: una firma de verdad tiene algo de trazo (no un toque)
      imagen: () => (largo.current < 60 ? null : c.toDataURL('image/png')),
    };
    return () => {
      c.removeEventListener('pointerdown', abajo); c.removeEventListener('pointermove', mover);
      c.removeEventListener('pointerup', arriba); c.removeEventListener('pointercancel', arriba);
    };
  }, [manejo]);
  return <canvas ref={ref} className="ats2-lienzo" style={{ height: alto }} />;
}

// ---------------------------------------------------------------- escáner (cámara): QR y PDF417 del DNI argentino
const HINTS = new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE, BarcodeFormat.PDF_417]],
  [DecodeHintType.TRY_HARDER, true],
]);
export const lectorCodigos = () => new BrowserMultiFormatReader(HINTS);

export function Escaner({ titulo, onLeido, onCerrar }: { titulo: string; onLeido: (texto: string) => void; onCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let controles: IScannerControls | undefined; let vivo = true;
    lectorCodigos().decodeFromConstraints({ video: { facingMode: 'environment' } }, video.current!, (res) => {
      if (res && vivo) { vivo = false; controles?.stop(); onLeido(res.getText()); }
    }).then((c) => { controles = c; if (!vivo) c.stop(); })
      .catch(() => setError('No se pudo abrir la cámara. Dale permiso de cámara a esta página (y usá https).'));
    return () => { vivo = false; controles?.stop(); };
  }, [onLeido]);
  return (
    <div className="ats2-velo" role="dialog" aria-modal="true">
      <div className="ats2-panel ats2-escaner">
        <div className="ats2-panel-tit">{titulo}</div>
        {error ? <Banda tono="malSuave">{error}</Banda> : <video ref={video} className="ats2-video" muted playsInline />}
        <div className="ats2-panel-sub">Apuntá al código. Para el DNI, el código ancho de atrás.</div>
        <button type="button" className="ats2-btn ats2-btn-borde" onClick={onCerrar}>Cancelar</button>
      </div>
    </div>
  );
}

/** botón que abre el escáner */
/** con ?dbg=1 en la dirección, cada escáner tiene un campo para escribir lo que "leyó" (pruebas en la PC) */
const DBG = typeof location !== 'undefined' && new URLSearchParams(location.search).get('dbg') === '1';

/** botón que abre el escáner */
export function BotonEscanear({ texto, onLeido, disabled, clase = '' }: { texto: string; onLeido: (t: string) => void; disabled?: boolean; clase?: string }) {
  const [abierto, setAbierto] = useState(false);
  const [sim, setSim] = useState('');
  return (
    <>
      <button type="button" className={`ats2-btn ats2-btn-blue ats2-btn-alto ${clase}`} disabled={disabled} onClick={() => setAbierto(true)}>{texto}</button>
      {abierto && <Escaner titulo={texto} onCerrar={() => setAbierto(false)} onLeido={(t) => { setAbierto(false); onLeido(t); }} />}
      {DBG && !disabled && (
        <span className="ats2-fila ats2-dbg">
          <input className="ats2-input" aria-label={`Simular: ${texto}`} value={sim} placeholder="Simular lectura" onChange={(e) => setSim(e.target.value)} />
          <button type="button" className="ats2-btn ats2-btn-borde" onClick={() => { onLeido(sim); setSim(''); }}>Leer</button>
        </span>
      )}
    </>
  );
}

// ---------------------------------------------------------------- QR (sin señal: se genera en el teléfono)
export function ImagenQr({ texto, lado = 300 }: { texto: string; lado?: number }) {
  const [src, setSrc] = useState('');
  useEffect(() => { void QRCode.toDataURL(texto, { errorCorrectionLevel: 'L', margin: 2, width: lado * 2 }).then(setSrc); }, [texto, lado]);
  return src ? <img src={src} alt={texto} className="ats2-qr" style={{ width: lado, height: lado }} /> : null;
}
