// Vocabulario de dominio fiscal-contable mexicano para "keyterm prompting" de
// Deepgram Nova-3 (modo servidor). Sesga el reconocimiento hacia los términos
// que un modelo genérico de español suele errar — acrónimos fiscales, conceptos
// contables y anglicismos de negocios que aparecen mezclados (Spanglish) en
// juntas de un despacho. Es contextual (no fuerza), así que es seguro aunque el
// audio no sea contable.
//
// Límite de Deepgram: ~500 tokens por petición (≈100 términos). Priorizamos los
// RAROS/de dominio (donde el ASR falla), no palabras comunes que ya acierta.
// Doc: https://developers.deepgram.com/docs/keyterm

/** Términos de dominio (acrónimos, conceptos y anglicismos) para boosting. */
export const DOMAIN_KEYTERMS: string[] = [
  // Autoridades y organismos
  'SAT',
  'IMSS',
  'INFONAVIT',
  'CONDUSEF',
  'PROFECO',
  'CONSAR',
  'IMCP',
  // Documentos y obligaciones fiscales
  'CFDI',
  'RFC',
  'CURP',
  'DIOT',
  'SUA',
  'IDSE',
  'complemento de pago',
  'contabilidad electrónica',
  'declaración anual',
  'pago provisional',
  'papeles de trabajo',
  'dictamen fiscal',
  'opinión de cumplimiento',
  'timbrado',
  // Impuestos y regímenes
  'ISR',
  'IVA',
  'IEPS',
  'PTU',
  'RESICO',
  'persona moral',
  'persona física',
  'régimen fiscal',
  'retención',
  'acreditamiento',
  'deducible',
  'deducción',
  'devolución de impuestos',
  // Normas y conceptos contables
  'NIF',
  'partida doble',
  'póliza contable',
  'asiento contable',
  'balanza de comprobación',
  'estado de resultados',
  'balance general',
  'flujo de efectivo',
  'conciliación bancaria',
  'cuentas por cobrar',
  'cuentas por pagar',
  'devengado',
  'depreciación',
  'amortización',
  'provisión',
  'cierre contable',
  'ejercicio fiscal',
  'contribuyente',
  'nómina',
  // Anglicismos de negocios (Spanglish frecuente en juntas)
  'cash flow',
  'compliance',
  'forecast',
  'budget',
  'deadline',
  'due diligence',
  'write-off',
  'accrual',
  'deliverable',
  'follow-up',
  'workflow',
  'stakeholder',
  'KPI',
  'ROI',
];
