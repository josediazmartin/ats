// Código QR del ATS (ScrQr): se arma en el teléfono, funciona sin señal.
import { useAts } from '../estado';
import { Encabezado, ImagenQr } from '../componentes';

export function QrPantalla({ texto, info, desde }: { texto: string; info: string; desde?: 'ats' }) {
  const s = useAts();
  const volver = () => (desde === 'ats' ? s.ir({ id: 'ats' }) : s.alInicio());
  const lado = Math.min(360, (typeof window === 'undefined' ? 360 : window.innerWidth) - 80);
  return (
    <div className="ats2-pant">
      <Encabezado titulo="Código QR" onAtras={volver} />
      <main className="ats2-cuerpo ats2-qr-cuerpo">
        <div className="ats2-qr-marco"><ImagenQr texto={texto} lado={lado} /></div>
        <div className="ats2-qr-txt">{texto}</div>
        <div className="ats2-qr-info">{info}</div>
        <p className="ats2-nota ats2-centro">Subí el brillo de la pantalla para que lo lea la otra cámara. Funciona sin señal.</p>
      </main>
    </div>
  );
}
