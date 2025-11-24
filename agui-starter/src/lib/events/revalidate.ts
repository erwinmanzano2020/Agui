import { revalidateTag as nextRevalidateTag } from "next/cache.js";

// Wrapper to keep a mockable export for tests without relying on Next's module shape.
let activeRevalidate = nextRevalidateTag;

export function revalidateTag(tag: string): void {
  return activeRevalidate(tag);
}

// Test-only helpers to swap the implementation without relying on module namespace mutability.
export function __setRevalidateTag(fn: typeof nextRevalidateTag): void {
  activeRevalidate = fn;
}

export function __resetRevalidateTag(): void {
  activeRevalidate = nextRevalidateTag;
}
