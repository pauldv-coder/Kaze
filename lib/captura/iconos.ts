/** Íconos BPMN: la misma geometría (antes `window.Kaze.ICONOS_BPMN`) para que ficha,
 *  diagrama y documento digan lo mismo. Portado de
 *  `reference/captura/sistema-de-diseno/index.jsx` líneas 1029-1066. */

interface IconoPrimitivaCirculo { t: 'circle'; a: { cx: number; cy: number; r: number }; relleno?: boolean; claro?: boolean }
interface IconoPrimitivaPath { t: 'path'; a: { d: string }; relleno?: boolean; claro?: boolean }
interface IconoPrimitivaRect { t: 'rect'; a: { x: number; y: number; width: number; height: number; rx?: number }; relleno?: boolean; claro?: boolean }
export type IconoPrimitiva = IconoPrimitivaCirculo | IconoPrimitivaPath | IconoPrimitivaRect

function trazoEngranaje(): string {
  const pts: string[] = []
  for (let i = 0; i < 8; i++) {
    const b = (i * 45 - 90) * Math.PI / 180
    const p = (r: number, d: number): string => { const a = b + d * Math.PI / 180; return (8 + r * Math.cos(a)).toFixed(2) + ' ' + (8 + r * Math.sin(a)).toFixed(2) }
    pts.push(p(5.1, -16), p(6.9, -8.5), p(6.9, 8.5), p(5.1, 16))
  }
  return 'M' + pts.join('L') + 'Z'
}

export const ICONOS_BPMN: Record<string, IconoPrimitiva[]> = {
  persona: [{ t: 'circle', a: { cx: 8, cy: 4.9, r: 2.7 } }, { t: 'path', a: { d: 'M2.6 14.4c0-3 2.4-5 5.4-5s5.4 2 5.4 5' } }],
  sistema: [{ t: 'path', a: { d: trazoEngranaje() } }, { t: 'circle', a: { cx: 8, cy: 8, r: 2.1 } }],
  automatizacion: [
    { t: 'rect', a: { x: 2.6, y: 5.2, width: 10.8, height: 8.4, rx: 2 } },
    { t: 'path', a: { d: 'M8 5.2V3M1.2 8.4v2.6M14.8 8.4v2.6M6.1 11.3h3.8' } },
    { t: 'circle', a: { cx: 8, cy: 2.2, r: 0.9 }, relleno: true },
    { t: 'circle', a: { cx: 5.9, cy: 8.6, r: 1.1 }, relleno: true },
    { t: 'circle', a: { cx: 10.1, cy: 8.6, r: 1.1 }, relleno: true },
  ],
  hoja: [{ t: 'path', a: { d: 'M3.8 1.6h5.6l3 3v9.8H3.8z' } }, { t: 'path', a: { d: 'M9.4 1.6v3h3M6 8.1h4.4M6 10.6h4.4' } }],
  tiempo: [{ t: 'circle', a: { cx: 8, cy: 8, r: 5.6 } }, { t: 'path', a: { d: 'M8 4.6V8l2.3 1.5' } }],
  mensaje: [{ t: 'rect', a: { x: 2.4, y: 4.2, width: 11.2, height: 7.6, rx: 0.6 } }, { t: 'path', a: { d: 'M2.6 4.5L8 8.6l5.4-4.1' } }],
  aviso: [{ t: 'rect', a: { x: 2.4, y: 4.2, width: 11.2, height: 7.6, rx: 0.6 }, relleno: true }, { t: 'path', a: { d: 'M2.6 4.5L8 8.6l5.4-4.1' }, claro: true }],
  condicion: [{ t: 'rect', a: { x: 4, y: 2.6, width: 8, height: 10.8 } }, { t: 'path', a: { d: 'M5.6 5.2h4.8M5.6 7.4h4.8M5.6 9.6h4.8M5.6 11.6h4.8' } }],
  error: [{ t: 'path', a: { d: 'M3.4 13.2l2.3-8.1 3 3.4 1.9-5.3 2 8.4-3-3.2z' } }],
  decision: [{ t: 'path', a: { d: 'M8 1.8L14.2 8 8 14.2 1.8 8z' } }],
  repite: [{ t: 'path', a: { d: 'M12 5.4A5 5 0 1 0 13 9.2' } }, { t: 'path', a: { d: 'M12.2 2.2v3.4H8.8' } }],
  porCada: [{ t: 'path', a: { d: 'M5 3.5v9M8 3.5v9M11 3.5v9' } }],
  porCadaSecuencial: [{ t: 'path', a: { d: 'M3.5 5h9M3.5 8h9M3.5 11h9' } }],
  hito: [{ t: 'path', a: { d: 'M4.2 14.6V1.8' } }, { t: 'path', a: { d: 'M4.2 2.6h8.4l-2.1 3 2.1 3H4.2' } }],
  // Acciones de la cabecera y de las filas (mismo trazo que el resto del juego).
  deshacer: [{ t: 'path', a: { d: 'M5.4 3.4 2.3 6.5l3.1 3.1' } }, { t: 'path', a: { d: 'M2.7 6.5h6.8a3.9 3.9 0 0 1 0 7.8H6.6' } }],
  historial: [{ t: 'path', a: { d: 'M2.5 8a5.5 5.5 0 1 0 1.6-3.9' } }, { t: 'path', a: { d: 'M2.3 2.3v2.9h2.9' } }, { t: 'path', a: { d: 'M8 5.1v3.1l2.1 1.4' } }],
  abajo: [{ t: 'path', a: { d: 'M4 6.2 8 10.2l4-4' } }],
  copiar: [{ t: 'rect', a: { x: 5.4, y: 5.4, width: 8.2, height: 8.2, rx: 1.4 } }, { t: 'path', a: { d: 'M10.6 3.6V3.4A1 1 0 0 0 9.6 2.4H3.4a1 1 0 0 0-1 1v6.2a1 1 0 0 0 1 1h.2' } }],
  descargar: [{ t: 'path', a: { d: 'M8 2.4v8' } }, { t: 'path', a: { d: 'M4.6 7.2 8 10.6l3.4-3.4' } }, { t: 'path', a: { d: 'M2.6 13.6h10.8' } }],
}
