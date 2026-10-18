/**
 * Raised when a value object or aggregate is handed a value it cannot accept.
 * Mirrors the reference domain-events layout (`shared/domain/exception`).
 */
export class InvalidArgumentError extends Error {}
