// Plantilla de consentimiento + aviso de privacidad para grabar y transcribir
// reuniones/llamadas, alineada a la LFPDPPP (México, vigente 21-mar-2025): datos
// financieros = sensibles → consentimiento EXPRESO; el modo servidor implica
// transferencia internacional. Es una BASE para adaptar con el área legal del
// despacho, NO asesoría jurídica. Se exporta a .docx/.md desde ConsentKit.

export const CONSENT_TEMPLATE = `# Consentimiento y aviso de privacidad — grabación y transcripción

_Plantilla base. Adáptala con tu área legal; no constituye asesoría jurídica._

**Responsable del tratamiento:** [Nombre del despacho], con domicilio en [domicilio].

**Finalidad:** grabar y transcribir la reunión o llamada del [fecha] para elaborar minutas, análisis y documentos de trabajo del expediente del cliente.

**Datos que se tratan:** voz e imagen de los participantes y el contenido de lo conversado, que puede incluir datos financieros y patrimoniales (datos sensibles conforme a la LFPDPPP).

**Conservación:** la grabación y la transcripción se conservan [plazo] y se eliminan conforme a la política de retención del despacho.

**Tratamiento y transferencias:**

- Procesamiento local (en el navegador): el audio no sale del equipo; no hay transferencia a terceros.
- Procesamiento en servidor: el audio se envía a un proveedor de transcripción (Deepgram, EE. UU.) que lo procesa y lo elimina al terminar; esto constituye una transferencia internacional de datos.

**Derechos ARCO:** puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición escribiendo a [correo]. Plazo de respuesta: hasta 20 días.

**Consentimiento expreso:** se me informó lo anterior y otorgo mi consentimiento expreso para la grabación y el tratamiento de mis datos, incluidos los datos financieros sensibles, para las finalidades descritas.

Nombre: __________________________

Firma: __________________________   Fecha: ______________
`;
