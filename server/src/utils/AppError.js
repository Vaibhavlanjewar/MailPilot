export class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode=400]
   * @param {boolean} [isOperational=true]
   */
  constructor(message, statusCode = 400, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace?.(this, this.constructor);
  }
}
