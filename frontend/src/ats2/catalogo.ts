// Textos fijos del formato ATS 2.0 V1.5 / TTR V1.0 (los mismos de la app de Power Apps, gen.pl).
// Los que se guardan en SharePoint también están en backend/src/catalogo.js: si cambian, cambiar los dos.

/** verificación 360°: n, pregunta, nivel (color de la franja), admite N/A */
export const Q360: { n: number; q: string; lv: 1 | 2 | 3; na: boolean }[] = [
  { n: 1, q: '¿El equipo está en buenas condiciones de salud física, mental y de descanso para esta tarea?', lv: 1, na: false },
  { n: 2, q: '¿Todo el personal cuenta con aptitud médica vigente para trabajo en gran altura geográfica?', lv: 1, na: true },
  { n: 3, q: 'Si alguien consume medicamentos, ¿lo informó al supervisor y al servicio médico?', lv: 1, na: false },
  { n: 4, q: '¿Se revisó el pronóstico y las alertas climáticas del día (viento, tormenta eléctrica, nieve, frío)?', lv: 1, na: false },
  { n: 5, q: '¿Hay comunicación radial operativa con el canal del área y la central de emergencias?', lv: 1, na: false },
  { n: 6, q: '¿Saben cómo activar el Plan de Respuesta a Emergencias, punto de encuentro y ubicación del policlínico?', lv: 1, na: false },
  { n: 7, q: '¿Conocen la planificación diaria de tareas del frente y las interferencias con otras cuadrillas?', lv: 2, na: false },
  { n: 8, q: '¿Las vías de desplazamiento y superficies de trabajo están despejadas, estables y sin hielo ni nieve?', lv: 2, na: false },
  { n: 9, q: '¿Uso mis EPP de forma adecuada y en buen estado, incluida ropa térmica y EPP específico?', lv: 2, na: false },
  { n: 10, q: '¿Hay puntos de hidratación, refugio, abrigo y descanso disponibles en el frente?', lv: 2, na: false },
  { n: 11, q: '¿Conocen la ubicación de los servicios higiénicos?', lv: 3, na: false },
  { n: 12, q: '¿Conocen los puntos de disposición de residuos por tipo?', lv: 3, na: false },
];

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

/** EPP y controles: g 1 = EPP (azul), 2 = control (verde), 3 = adicional */
export const CONTROLES: { n: number; c: string; g: 1 | 2 | 3 }[] = [
  'Casco de seguridad con barbiquejo', 'Lentes de seguridad', 'Antiparras herméticas', 'Careta facial', 'Protección auditiva',
  'Guantes anticorte / antiimpacto', 'Guantes de cabritilla', 'Guantes térmicos', 'Guantes y traje químico', 'Respirador medio rostro / full face',
  'Calzado de seguridad adecuado', 'Ropa térmica y cortaviento', 'Bloqueador solar y protección UV', 'Hidratación y pausas programadas',
  'Superficie de trabajo despejada', 'Orden de herramientas y materiales', 'Segregación / delimitación 360°', 'Baranda o barrera en bordes abiertos',
  'Usar 3 puntos de apoyo', 'Ayuda mecánica para levantar cargas', 'Conocer el peso de la carga', 'Asegurar anclaje y estabilidad',
  'Pasillos y zonas de tránsito despejados', 'Monitoreo de viento y clima', 'Control adicional (escribilo abajo)',
].map((c, i) => ({ n: i + 1, c, g: i < 14 ? 1 : i < 24 ? 2 : 3 }));

export const CIERRE = [
  'Retirar todos los bloqueos', 'Guardar herramientas y equipos', 'Área limpia y ordenada', 'Residuos dispuestos correctamente',
  'Reinstalar protecciones', 'Verificar sistemas de seguridad operativos', 'Avisar retiro al dueño de área',
  'Informar condiciones pendientes al turno siguiente', 'Reportar incidentes o hallazgos',
];

/** TTR "¿Algo cambió hoy?" */
export const CAMBIOS: { t: string; s: string }[] = [
  { t: 'Lugar de trabajo', s: 'frente, nivel, accesos' },
  { t: 'Método o secuencia de la tarea', s: 'respecto al procedimiento' },
  { t: 'Equipos y herramientas', s: 'otro equipo, modelo o estado' },
  { t: 'Personal', s: 'alguien nuevo, reemplazo o primera vez' },
  { t: 'Clima y estado del terreno', s: 'viento, nieve, hielo, tormenta' },
  { t: 'Interferencias', s: 'otras cuadrillas o equipos en el área' },
  { t: 'Permisos de trabajo', s: 'la tarea no requiere ninguno' },
  { t: 'Incidentes', s: 'ninguno en esta tarea desde la última revisión' },
];

export const VIGENCIA_ATS_INICIO = 15;   // días: el ATS de inicio de turno habilita TTR hasta 15 días después
