export class UnauthenticatedError extends Error {
  constructor(message: string = "Debes iniciar sesión") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = "No tienes los permisos requeridos") {
    super(message);
    this.name = "ForbiddenError";
  }
}
export class ConflictError extends Error {
  constructor(message: string = "Conflicto detectado con la situación actual") {
    super(message);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends Error {
  constructor(message: string = "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.") {
    super(message);
    this.name = "RateLimitError";
  }
}
