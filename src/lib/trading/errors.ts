export class TradingError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "TradingError";
  }
}

export class ForbiddenError extends TradingError {
  constructor(message = "Du har ikke tilgang til denne kontoen.") {
    super(message, "FORBIDDEN");
  }
}

export class NotFoundError extends TradingError {
  constructor(message: string) {
    super(message, "NOT_FOUND");
  }
}

export class ValidationError extends TradingError {
  constructor(message: string) {
    super(message, "VALIDATION");
  }
}

export class IdempotencyConflictError extends TradingError {
  constructor() {
    super(
      "Denne idempotensnøkkelen er allerede brukt for en annen ordre.",
      "IDEMPOTENCY_CONFLICT"
    );
  }
}

export class SeasonNotActiveError extends TradingError {
  constructor(message = "Sesongen er ikke aktiv — handel er ikke mulig nå.") {
    super(message, "SEASON_NOT_ACTIVE");
  }
}
