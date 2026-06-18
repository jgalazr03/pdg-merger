// En el navegador, @vercel/blob importa `undici` para hacer fetch, pero las
// APIs ya existen de forma nativa. No se puede bundlear undici real (usa módulos
// de Node y sintaxis de campos privados que rompe el webpack de Next 13.5.1), así
// que en el build de CLIENTE redirigimos `undici` a este shim sobre las globales.
const g = globalThis;

export const fetch = (...args) => g.fetch(...args);
export const Headers = g.Headers;
export const Request = g.Request;
export const Response = g.Response;
export const FormData = g.FormData;
export const File = g.File;
export const Blob = g.Blob;
export const FileReader = g.FileReader;

export default { fetch, Headers, Request, Response, FormData, File, Blob, FileReader };
