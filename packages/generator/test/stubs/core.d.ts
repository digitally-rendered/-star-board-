/**
 * Stub of `@star-board/core` for the compile test: only what generated code imports
 * (`ComponentRegistry`, the key types).
 */
export type ComponentKey =
  | `field.${string}`
  | `list.column.${string}`
  | `action.${string}`
  | `state.${string}`
  | `screen.${string}`
  | 'help.inline';
export type ListColumnKey = `list.column.${string}`;
export interface Scope {
  version?: string;
  role?: string;
}
export interface RegistrationInput<C = unknown> {
  key: ComponentKey;
  schema: string;
  target: string;
  scope?: Scope;
  component: C;
  source: 'generated' | 'override';
}
export declare class ComponentRegistry {
  register<C>(input: RegistrationInput<C>): RegistrationInput<C>;
}
