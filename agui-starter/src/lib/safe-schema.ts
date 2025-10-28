// Centralized helpers for dynamically loading schema libraries. Avoids executing them at module scope.

export async function loadZod() {
  return await import("zod");
}
