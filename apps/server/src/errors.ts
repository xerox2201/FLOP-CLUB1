export const ErrorCode = {
  // Auth
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_SESSION: 'INVALID_SESSION',

  // Table
  TABLE_NOT_FOUND: 'TABLE_NOT_FOUND',
  SEAT_UNAVAILABLE: 'SEAT_UNAVAILABLE',
  NOT_SEATED: 'NOT_SEATED',
  NOT_IN_ROOM: 'NOT_IN_ROOM',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  NOT_ACTIVE: 'NOT_ACTIVE',

  // Game
  INVALID_ACTION: 'INVALID_ACTION',
  HAND_NOT_ACTIVE: 'HAND_NOT_ACTIVE',
  CANNOT_CHECK: 'CANNOT_CHECK',
  RAISE_TOO_SMALL: 'RAISE_TOO_SMALL',
  RAISE_BELOW_CURRENT: 'RAISE_BELOW_CURRENT',
  NOT_ENOUGH_STACK: 'NOT_ENOUGH_STACK',
  BAD_ACTION: 'BAD_ACTION',
  BAD_SEAT: 'BAD_SEAT',

  // Money
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  BUY_IN_FAILED: 'BUY_IN_FAILED',

  // Command
  COMMAND_ALREADY_PROCESSED: 'COMMAND_ALREADY_PROCESSED',
  STALE_STATE: 'STALE_STATE',
  RESYNC_REQUIRED: 'RESYNC_REQUIRED',

  // Rate
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface CommandResult<T = any> {
  ok: boolean;
  error?: string;
  code?: ErrorCodeType;
  data?: T;
  duplicate?: boolean;
}

export class AppError extends Error {
  constructor(
    public code: ErrorCodeType,
    message?: string,
  ) {
    super(message || code);
    this.name = 'AppError';
  }
}
