// Hoja A4 de tarjetas QR (ScrPrint): 12 por página (3 × 4), todas las páginas de una vez con window.print().
import { ImagenQr } from '../../ats2/componentes';
import { useGestion } from '../estado';
import { useTitulo } from '../componentes';
import type { Pantalla, Tarjeta } from '../tipos';
import { fechaHora, trozos } from '../util';

export function Imprimir({ titulo, tarjetas, volver }: { titulo: string; tarjetas: Tarjeta[]; volver: Pantalla }) {
  useTitulo(titulo);
  const s = useGestion();
  const paginas = trozos(tarjetas, 12);
  const ahora = fechaHora(new Date().toISOString());
  return (
    <div className="ats2g-imprimir">
      <div className="ats2g-print-bar">
        <button type="button" className="ats2g-print-btn" onClick={() => s.ir(volver)}>‹ Volver</button>
        <div className="ats2g-print-info">
          <b>{titulo}</b> · {tarjetas.length} QR · {paginas.length || 1} página(s) A4<br />
          <span>Imprimí desde la PC; en el celular no se puede.</span>
        </div>
        <button type="button" className="ats2g-print-btn ats2g-print-go" onClick={() => window.print()} disabled={tarjetas.length === 0}>🖨  Imprimir</button>
      </div>
      {paginas.length === 0 && <div className="ats2g-vacio">No hay nada para imprimir.</div>}
      {paginas.map((p, i) => (
        <div key={i} className="ats2g-pagina">
          <div className="ats2g-pag-tit">Vicuña · {titulo}</div>
          <div className="ats2g-pag-grid">
            {p.map((t) => (
              <div key={t.code} className="ats2g-tarj">
                <div className="ats2g-tarj-marca">Vicuña</div>
                <div className="ats2g-tarj-kind">{t.kind}</div>
                <div className="ats2g-tarj-ln" />
                <div className="ats2g-tarj-qr"><ImagenQr texto={t.code} lado={148} /></div>
                <div className="ats2g-tarj-l1" title={t.l1}>{t.l1}</div>
                <div className="ats2g-tarj-l2">{t.l2}</div>
                <div className="ats2g-tarj-l3">{t.l3}</div>
                <div className="ats2g-tarj-cod">{t.code}</div>
              </div>
            ))}
          </div>
          <div className="ats2g-pag-pie">Impreso desde ATS Gestión · {ahora} · página {i + 1} de {paginas.length}</div>
        </div>
      ))}
    </div>
  );
}
