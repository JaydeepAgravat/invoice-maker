/* eslint-disable no-bitwise -- bit-level UUID layout and PRNG math are intentional here */
/**
 * UUID v7: 48-bit millisecond timestamp + random bits. Time-ordered ids keep
 * B-tree inserts local and make backups merge without collisions.
 */

type RandomFill = (bytes: Uint8Array) => void;

const defaultFill: RandomFill = bytes => {
  const c = (
    globalThis as {
      crypto?: { getRandomValues?: (b: Uint8Array) => Uint8Array };
    }
  ).crypto;
  if (c?.getRandomValues) {
    c.getRandomValues(bytes);
    return;
  }
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
};

let lastMs = -1;
let seq = 0;

export function uuidv7(
  now: number = Date.now(),
  fill: RandomFill = defaultFill,
): string {
  const bytes = new Uint8Array(16);
  fill(bytes);

  // Monotonic within the same millisecond: a 12-bit counter in rand_a.
  if (now === lastMs) {
    seq = (seq + 1) & 0xfff;
  } else {
    lastMs = now;
    seq = bytes[6]! & 0x07;
  }

  let ms = now;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ms % 256;
    ms = Math.floor(ms / 256);
  }
  bytes[6] = 0x70 | ((seq >> 8) & 0x0f);
  bytes[7] = seq & 0xff;
  bytes[8] = 0x80 | (bytes[8]! & 0x3f);

  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16,
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
