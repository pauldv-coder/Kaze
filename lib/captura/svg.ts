/* Saneador del SVG del diagrama (Task 1.7, spec Sec 6.5): defensa en profundidad.
   El SVG que llega aca es el que renderizo bpmn.io en el navegador del analista al enviar a
   revision. El unico lugar donde se muestra despues es `/aprobar/[token]`, y ahi se pinta
   SOLO como `<img src="data:image/svg+xml;base64,...">` -- en ese contexto un navegador no
   ejecuta <script> ni resuelve referencias externas dentro de la imagen. Aun asi este modulo
   quita todo lo peligroso antes de guardarlo: no confiamos en que el unico consumidor futuro
   siga siendo un <img>.
   No toca `window`/`document`, no importa `server-only`: corre en Node (server action) y en
   los tests de Vitest (entorno `node`). */

/** Tope de tamano del SVG guardado: 2 MB. */
export const MAX_SVG = 2 * 1024 * 1024

/* Cada regla se aplica en orden y el bloque completo se repite hasta que una vuelta no cambie
   nada (o hasta 5 vueltas). Eso es necesario porque un ataque puede partir una etiqueta para
   que un regex que "empareja apertura+cierre en un solo match" reconstruya sin querer una
   etiqueta valida con lo que sobra a los lados -- por ejemplo `<scr<script></script>ipt>`:
   un regex `/<script[\s\S]*?<\/script>/` dispara sobre el `<script></script>` interno y dejaria
   "<scr" + "ipt>" = "<script>" suelto, sin cierre, y ese `<script>` ya no lo captura ese mismo
   regex (no hay otro `</script>` para emparejar). Por eso `<script>`/`<foreignObject>` se quitan
   como apertura y cierre POR SEPARADO (nunca un regex que abarque el contenido entre ambos):
   en la vuelta siguiente el `<script>` reconstruido es una apertura suelta y el regex de
   apertura la quita igual. */
const REGLAS: [RegExp, string][] = [
  [/<\?xml[\s\S]*?\?>/gi, ''],
  [/<!DOCTYPE[\s\S]*?(\[[\s\S]*?\])?\s*>/gi, ''],
  [/<!ENTITY[\s\S]*?>/gi, ''],
  // Apertura y cierre de <script> por separado (ver nota arriba). El regex de apertura ya
  // cubre la forma autocerrada (`<script src="x.js"/>`) porque `[^>]*` llega hasta el `>` final.
  [/<script\b[^>]*>/gi, ''],
  [/<\/script\s*>/gi, ''],
  // Mismo razonamiento para <foreignObject>.
  [/<foreignObject\b[^>]*>/gi, ''],
  [/<\/foreignObject\s*>/gi, ''],
  // Atributos onXxx="...", con o sin comillas, mayusculas/minusculas o espacios raros
  // alrededor del "=" (`OnLoad =alert(1)`).
  [/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ''],
  // href / xlink:href que no apunten a un id del propio documento (deben empezar por "#"
  // pegado a la comilla, sin espacio de por medio: ver nota de xlink:href mas abajo).
  [/\s+(xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*'|(?!["'#])[^\s>]+)/gi, ''],
  // url(...) que no sea url(#id) (con o sin comillas alrededor del "#id").
  [/url\(\s*(?!['"]?#)[^)]*\)/gi, 'none'],
  [/@import[^;]*;?/gi, ''],
]

/** Sanea el SVG que renderizo el navegador con bpmn.io (Sec 6.5). Lanza si no es un SVG o
 *  si pasa de 2 MB. Decision documentada: un `href`/`xlink:href` cuyo valor no empieza por
 *  "#" JUSTO despues de la comilla (por ejemplo `xlink:href=" #a"`, con espacio antes del
 *  "#") NO se trata como referencia interna segura -- se quita el atributo entero, igual que
 *  un href externo. Ni la spec de XML ni el comportamiento real de los parsers garantizan que
 *  ese espacio se recorte al resolver la referencia, asi que ante la duda se descarta. */
export function sanearSvg(svg: string): string {
  if (svg.length > MAX_SVG) throw new Error('El diagrama pasa de 2 MB')
  let s = svg
  for (let i = 0; i < 5; i++) {                 // hasta que no cambie (anidamientos maliciosos)
    const antes = s
    for (const [re, por] of REGLAS) s = s.replace(re, por)
    if (s === antes) break
  }
  s = s.trim()
  if (!/^<svg[\s>]/i.test(s) || !/<\/svg>\s*$/i.test(s)) throw new Error('No es un SVG')
  return s
}
