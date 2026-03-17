export class AppError extends Error {
  public statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends AppError {
  constructor() {
    super(403, "Forbidden");
    this.name = "ForbiddenError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
    this.name = "ValidationError";
  }
}
