/** A flag or config problem the user can fix; always exit 2, never a stack trace. */
export class CliUsageError extends Error {
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'CliUsageError';
    this.details = details;
  }
}
