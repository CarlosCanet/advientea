
export class UnauthenticatedError extends Error {
    constructor(message: string = "Debes iniciar sesión") {
        super(message);
        this.name = "UnauthenticatedError"
    }
}

export class ForbiddenError extends Error {
    constructor(message: string = "No tienes los permisos requeridos") {
        super(message);
        this.name = "ForbiddenError";
    }
}