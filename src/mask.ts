// Cells under the page's text stay paper, so the ink flows around the words.

export interface DOMRectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** Fade the mask out over this many px beyond the rectangle, instead of a hard edge. */
  feather?: number;
}

/**
 * One byte per cell, row-major from the top-left: 255 under text, 0 where ink shows freely,
 * and in between across a feathered edge. Overlapping rectangles keep the strongest value.
 */
export function cellMask(rects: DOMRectLike[], cols: number, rows: number, cell: { w: number; h: number }): Uint8Array {
  const mask = new Uint8Array(cols * rows);
  for (const b of rects) {
    const f = Math.max(0, b.feather ?? 0);
    const r0 = Math.max(0, Math.floor((b.top - f) / cell.h) - 1), r1 = Math.min(rows - 1, Math.ceil((b.bottom + f) / cell.h));
    const c0 = Math.max(0, Math.floor((b.left - f) / cell.w) - 2), c1 = Math.min(cols - 1, Math.ceil((b.right + f) / cell.w) + 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        let v = 255;
        if (f > 0) {
          // Distance from the cell centre to the rectangle; full mask inside, smooth fade to 0 at `f`.
          const x = (c + 0.5) * cell.w, y = (r + 0.5) * cell.h;
          const dx = Math.max(b.left - x, 0, x - b.right), dy = Math.max(b.top - y, 0, y - b.bottom);
          const t = Math.min(1, Math.hypot(dx, dy) / f);
          v = Math.round(255 * (1 - t * t * (3 - 2 * t)));
        }
        if (v > mask[r * cols + c]) mask[r * cols + c] = v;
      }
    }
  }
  return mask;
}
