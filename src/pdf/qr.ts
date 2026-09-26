import qrcode from 'qrcode-generator';

/**
 * QR code as a compact vector SVG: one path, horizontal runs merged, with
 * the standard 4-module quiet zone. Byte mode in UTF-8 (EPC names can have
 * accents); error correction M balances density and robustness on paper.
 */
export function qrSvg(payload: string, opts: { size?: string } = {}): string {
  const previous = qrcode.stringToBytes;
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']!;
  try {
    const qr = qrcode(0, 'M');
    qr.addData(payload, 'Byte');
    qr.make();
    const n = qr.getModuleCount();
    const quiet = 4;
    let d = '';
    for (let r = 0; r < n; r++) {
      let c = 0;
      while (c < n) {
        if (!qr.isDark(r, c)) {
          c++;
          continue;
        }
        const start = c;
        while (c < n && qr.isDark(r, c)) {
          c++;
        }
        d += `M${start + quiet} ${r + quiet}h${c - start}v1h-${c - start}z`;
      }
    }
    const total = n + quiet * 2;
    const size = opts.size ?? '100%';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#fff"/><path fill="#000" d="${d}"/></svg>`;
  } finally {
    qrcode.stringToBytes = previous;
  }
}
