import { createHash } from "node:crypto";

export type PseudoQrMatrix = string[];

const FINDER_SIZE = 7;

function createMatrix(size: number): boolean[][] {
  return Array.from({ length: size }, () => Array<boolean>(size).fill(false));
}

function placeFinder(matrix: boolean[][], reserved: boolean[][], startX: number, startY: number) {
  for (let y = 0; y < FINDER_SIZE; y += 1) {
    for (let x = 0; x < FINDER_SIZE; x += 1) {
      const globalX = startX + x;
      const globalY = startY + y;
      if (matrix[globalY] && typeof matrix[globalY][globalX] !== "undefined") {
        const border = x === 0 || y === 0 || x === FINDER_SIZE - 1 || y === FINDER_SIZE - 1;
        const inner = x >= 2 && x <= FINDER_SIZE - 3 && y >= 2 && y <= FINDER_SIZE - 3;
        matrix[globalY][globalX] = border || inner;
        reserved[globalY][globalX] = true;
      }
    }
  }
}

function createBitStream(token: string): Generator<number> {
  function* generator() {
    let counter = 0;
    while (true) {
      const hash = createHash("sha256");
      hash.update(token);
      hash.update(counter.toString());
      const bytes = hash.digest();
      for (const byte of bytes) {
        for (let bit = 7; bit >= 0; bit -= 1) {
          yield (byte >> bit) & 1;
        }
      }
      counter += 1;
    }
  }
  return generator();
}

export function generatePseudoQrMatrix(token: string, size = 29): PseudoQrMatrix {
  const matrix = createMatrix(size);
  const reserved = createMatrix(size);

  placeFinder(matrix, reserved, 0, 0);
  placeFinder(matrix, reserved, size - FINDER_SIZE, 0);
  placeFinder(matrix, reserved, 0, size - FINDER_SIZE);

  const bits = createBitStream(token);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (reserved[y][x]) {
        continue;
      }
      const next = bits.next();
      if (next.done) {
        matrix[y][x] = false;
      } else {
        matrix[y][x] = next.value === 1;
      }
    }
  }

  return matrix.map((row) => row.map((cell) => (cell ? "1" : "0")).join(""));
}
