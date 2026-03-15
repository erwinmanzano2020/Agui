// src/types/next-route-compat.d.ts
// Provide a loose context parameter type so API route handlers remain compatible
// across Next.js releases that toggle between resolved params and promised params.
declare global {
  type RouteParams<T> = T | Promise<T>;
}

export {};
