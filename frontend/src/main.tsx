// Página de prueba: hace de "la otra app". En una app real, solo se monta <Ats2 /> (o <Gestion /> para HSS) donde corresponda.
//   /          → ATS 2.0 (ATS + TTR, formato celular)
//   /gestion   → ATS Gestión (formato notebook)
// Clave de acceso (solo para una prueba publicada con IDENTIDAD=dev y CLAVE_ACCESO en el backend): abrir una vez
// https://…/?clave=LA_CLAVE en cada dispositivo; queda guardada en el navegador y se manda en x-ats-acceso.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Ats2 } from './ats2';
import { Gestion } from './gestion';

const esGestion = /^\/gestion(\/|$)/.test(location.pathname);

const CLAVE = 'ats2_clave';
try {
  const url = new URL(location.href);
  const clave = url.searchParams.get('clave');
  if (clave !== null) {
    if (clave) localStorage.setItem(CLAVE, clave); else localStorage.removeItem(CLAVE);
    url.searchParams.delete('clave');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
} catch { /* sin localStorage: se sigue sin clave */ }

function encabezados(): Record<string, string> {
  try { const c = localStorage.getItem(CLAVE); return c ? { 'x-ats-acceso': c } : {}; } catch { return {}; }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {esGestion ? <Gestion apiBase="/api/ats" getHeaders={encabezados} /> : <Ats2 apiBase="/api/ats" getHeaders={encabezados} />}
  </StrictMode>,
);
