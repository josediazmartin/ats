// Prueba contra SharePoint ATSHSS real, con las credenciales del .env (ALMACEN=graph).
//   node pruebas/probar-graph.js            → solo lee (tareas activas, padrón, ATS de inicio vigentes)
//   node pruebas/probar-graph.js --escribir → además crea un ATS de prueba con una firma y lo manda a la papelera
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearAlmacenGraph } from '../src/almacen/graph.js';
import { guardarDocumento, atsInicioVigentes } from '../src/documentos.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(resolve(RAIZ, '.env'));
const e = process.env;
const alm = crearAlmacenGraph({
  tenantId: e.GRAPH_TENANT_ID, clientId: e.GRAPH_CLIENT_ID, secreto: e.GRAPH_CLIENT_SECRET,
  certificadoClave: e.GRAPH_CERT_CLAVE ? resolve(RAIZ, e.GRAPH_CERT_CLAVE) : undefined, certificadoHuella: e.GRAPH_CERT_HUELLA_SHA256,
  sitioHost: e.SITIO_HOST || 'vicunacom.sharepoint.com', sitioRuta: e.SITIO_RUTA || '/sites/ATSHSS', siteId: e.SITIO_ID,
  listas: {
    registros: e.LISTA_REGISTROS || '75817493-9d10-4d51-8ad3-a7e621765d94', personal: e.LISTA_PERSONAL || '1ed91276-f8dd-4ddd-9a65-019740b5ebf2',
    tareas: e.LISTA_TAREAS || '10b9009b-7229-427e-ac18-2232cdb16b5b', personas: e.LISTA_PERSONAS || 'b720fe19-4239-4617-b204-a5259ab7902b',
  },
});

const tareas = await alm.tareasActivas();
const padron = await alm.padronActivo();
const ini = await atsInicioVigentes(alm);
console.log(`lectura OK: ${tareas.length} tareas activas, ${padron.length} personas activas, ${ini.length} ATS de inicio vigentes`);

if (process.argv.includes('--escribir')) {
  const d = new Date(); const p = (n) => String(n).padStart(2, '0');
  const codigo = `ATS-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-PRWB`;
  const firma = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const doc = {
    codigo, tipo: 'ATS', estado: 'Abierto', creado: d.toISOString(), inicioTurno: 'NO', turno: 'Día', pais: 'Argentina (San Juan)', frente: 'PRUEBA WEB',
    tarea: 'Prueba del backend web (borrar)', empresa: 'Vicuña', iper: 'SI', supervisor: 'Prueba', firmaSup: firma, horaAut: `${p(d.getHours())}:${p(d.getMinutes())}`,
    v360: Array(12).fill('S'), rf: 'NO', r4: Array(16).fill('N'), r4c: [], cierre: [], cambios: [],
  };
  const r = await guardarDocumento(alm, { email: 'prueba-backend@vicuna.com', nombre: 'Prueba backend web' }, {
    doc, personal: [{ nro: 1, documento: '99999999', nombre: 'Persona de prueba', firma, origen: 'Prueba', firmadoEn: d.toISOString() }],
  }, 'Web v1 · prueba');
  console.log('escritura:', r.status, JSON.stringify(r.body));
  if (r.status === 201) {
    for (const per of await alm.personalDe(codigo)) await alm._borrar('personal', per.id);
    await alm._borrar('registros', r.body.id);
    console.log(`${codigo} y su firma enviados a la papelera de ATSHSS`);
  }
}
