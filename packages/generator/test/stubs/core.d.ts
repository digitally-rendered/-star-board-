/**
 * Stub of `@star-board/core` for the compile test: only what generated code imports
 * (`ComponentRegistry`, `Registration`, the key types).
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
export interface Registration<C = unknown> extends Required<
  Pick<RegistrationInput<C>, 'key' | 'schema' | 'target' | 'component' | 'source'>
> {
  scope: Scope;
  specificity: 1 | 2 | 3 | 4;
  order: number;
}
export declare class ComponentRegistry {
  register<C>(input: RegistrationInput<C>): Registration<C>;
  resolve<C = unknown>(
    key: ComponentKey,
    schema: string,
    target: string,
    ctx?: Scope,
  ): Registration<C>;
}
