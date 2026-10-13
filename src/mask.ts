// Cells under the page's text stay paper, so the ink flows around the words.

export interface DOMRectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** One byte per cell, row-major from the top-left: 255 under text, 0 elsewhere. */
export function cellMask(rects: DOMRectLike[], cols: number, rows: number, cell: { w: number; h: number }): Uint8Array {
  const mask = new Uint8Array(cols * rows);
  for (const b of rects) {
    const r0 = Math.max(0, Math.floor(b.top / cell.h) - 1), r1 = Math.min(rows - 1, Math.ceil(b.bottom / cell.h));
    const c0 = Math.max(0, Math.floor(b.left / cell.w) - 2), c1 = Math.min(cols - 1, Math.ceil(b.right / cell.w) + 1);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) mask[r * cols + c] = 255;
  }
  return mask;
}
