import CustomError from "./CustomError";

export function createCustomErrorClass(
  className: string,
  defaultMessage: string,
  defaultStatus: number = 500
): typeof CustomError {
  // Dynamically create a new class that extends CustomError
  class DynamicCustomError extends CustomError {
    /**
     * Creates a new instance of the custom error.
     * @constructor
     * @param {string} message - The error message.
     * @param {number} [status=defaultStatus] - The HTTP status code associated with the error.
     * @param {any} [additionalInfo=undefined] - Additional information about the error.
     */
    constructor(
      message: string = defaultMessage,
      status: number = defaultStatus,
      additionalInfo: any = undefined
    ) {
      super(message, status, additionalInfo);
      this.name = className; // Set the name of the error class
    }
  }

  // Set the name of the class dynamically
  Object.defineProperty(DynamicCustomError, "name", { value: className });

  return DynamicCustomError;
}

export const NotFoundError = createCustomErrorClass(
  "NotFoundError",
  "Resource not found",
  404
);
export const BadRequestError = createCustomErrorClass(
  "BadRequestError",
  "Bad request",
  400
);
export const UnauthorizedError = createCustomErrorClass(
  "UnauthorizedError",
  "Unauthorized access",
  401
);
export const ForbiddenError = createCustomErrorClass(
  "ForbiddenError",
  "Forbidden access",
  403
);
