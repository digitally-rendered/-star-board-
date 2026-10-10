/** The reference token file is imported as data; `parseTokens` validates it at runtime. */
declare module '*.tokens.json' {
  const tokens: unknown;
  export default tokens;
}
