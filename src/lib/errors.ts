export class AppError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "AppError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Du har ikke tilgang til dette.") {
    super(message, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, "NOT_FOUND");
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION");
  }
}

export class NotAllowlistedError extends AppError {
  constructor() {
    super(
      "Denne e-postadressen har ikke tilgang til denne private plattformen.",
      "NOT_ALLOWLISTED"
    );
  }
}

export class IdempotencyConflictError extends AppError {
  constructor() {
    super("Denne idempotensnøkkelen er allerede brukt for en annen ordre.", "IDEMPOTENCY_CONFLICT");
  }
}
