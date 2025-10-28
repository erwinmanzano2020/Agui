declare module "vitest" {
  export const describe: (...args: unknown[]) => void;
  export const it: (...args: unknown[]) => void;
  export function expect(value: unknown): {
    toBe: (...args: unknown[]) => unknown;
    [matcher: string]: (...args: unknown[]) => unknown;
  };
}

declare module "vitest/config" {
  export function defineConfig(config: unknown): unknown;
}
