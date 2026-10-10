/** One error family for the whole track; codes are the one authority (CLAUDE.md). */
export const ERROR_CODES = [
  'SPEC_INVALID',
  'SPEC_MISSING_EXTENSION',
  'SPEC_OPERATION_ID',
  'REGISTRY_DUPLICATE_SPECIFICITY',
  'REGISTRY_UNRESOLVED',
  'REGISTRY_UNKNOWN_KEY',
  'GENERATOR_OUT_OF_SURFACE',
  'GENERATOR_DRIFT',
  'TOKENS_INVALID',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export class StarBoardError extends Error {
  readonly code: ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(
    code: ErrorCode,
    message: string,
    details: Record<string, unknown> = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}
export class SpecError extends StarBoardError {}
export class RegistryError extends StarBoardError {}
export class GeneratorError extends StarBoardError {}
export class TokensError extends StarBoardError {}
