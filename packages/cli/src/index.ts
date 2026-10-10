/** @star-board/cli — L6. star-board generate | check | init | tokens build | tokens lint | parity. */
export const PACKAGE = '@star-board/cli' as const;
export const LAYER = 'L6' as const;
export { run, buildProgram, CLI_VERSION } from './program.js';
export { EXIT, CliUsageError, reportError, type ExitCode } from './errors.js';
export {
  loadConfig,
  parseConfig,
  CONFIG_FILE,
  type StarBoardConfig,
  type TokensConfig,
} from './config.js';
export { loadSource, loadModel, isHttpUrl } from './source.js';
export type { Io, Context } from './io.js';
export { INIT_FILES, skeleton } from './commands/init.js';
export { TOKEN_OUTPUTS, resolveModes } from './commands/tokens.js';
export { formatReport, parseMcpTools, readGeneratedTree } from './commands/parity.js';
