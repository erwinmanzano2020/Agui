import "server-only";

export class AuthorizationDeniedError extends Error {
  constructor(message = "Not allowed") {
    super(message);
    this.name = "AuthorizationDeniedError";
  }
}

export function isAuthorizationDeniedError(error: unknown): error is AuthorizationDeniedError {
  return error instanceof AuthorizationDeniedError;
}

