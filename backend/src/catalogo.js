// Textos fijos del formato ATS 2.0 / TTR que se guardan en SharePoint.
// Son los mismos que usa la app de Power Apps (gen.pl) y frontend/src/ats2/catalogo.ts: si cambian, cambiar los tres.

export const RIESGOS_FATALES = [
  'Conducción de vehículos', 'Contacto con energía eléctrica', 'Estabilidad de talud', 'Interacción persona – equipos móviles',
  'Izaje', 'Trabajo en altura', 'Liberación descontrolada de energía', 'Pérdida de control del equipo fuera de ruta',
  'Caída de objetos desde altura', 'Manejo de explosivos', 'Clima adverso',
];

export const RIESGOS_NO_FATALES = [
  'Caída al mismo nivel (tropiezo, resbalón)', 'Pisada sobre objetos (clavos, despuntes, fierros)', 'Manejo manual de cargas / sobreesfuerzo',
  'Posturas forzadas / trabajo repetitivo', 'Golpeado por / contra herramientas o estructuras', 'Atrapamiento de manos y dedos (herramientas manuales)',
  'Corte con herramientas u objetos cortopunzantes', 'Proyección de partículas (esmerilado, corte, picado)', 'Contacto con superficies calientes',
  'Radiación no ionizante (arco de soldadura)', 'Exposición a ruido', 'Exposición a vibraciones (mano-brazo / cuerpo)', 'Exposición a polvo / sílice',
  'Contacto dérmico con químicos (aditivos, desmoldantes, pinturas)', 'Exposición a radiación UV', 'Exposición a frío / viento',
];

export const CIERRE = [
  'Retirar todos los bloqueos', 'Guardar herramientas y equipos', 'Área limpia y ordenada', 'Residuos dispuestos correctamente',
  'Reinstalar protecciones', 'Verificar sistemas de seguridad operativos', 'Avisar retiro al dueño de área',
  'Informar condiciones pendientes al turno siguiente', 'Reportar incidentes o hallazgos',
];

export const CAMBIOS = [
  'Lugar de trabajo', 'Método o secuencia de la tarea', 'Equipos y herramientas', 'Personal',
  'Clima y estado del terreno', 'Interferencias', 'Permisos de trabajo', 'Incidentes',
];

export const N_CONTROLES = 25;
