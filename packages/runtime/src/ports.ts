/**
 * Ports the runtime consumes (hexagonal-rules typescript/05 §1, typescript/01 §4). Interfaces only,
 * written as function properties so an implementation can be a plain object or a stub. A consuming
 * app provides the adapters once through `ServicesProvider`; hooks obtain them with `useServices()`.
 */

/** The authenticated principal; roles and capabilities carry backend spellings (typescript/05 §5). */
export interface Principal {
  id: string;
  roles: string[];
  capabilities: string[];
}

export interface AuthPort {
  /** The bearer token for the next request, or null when anonymous. Never read by components. */
  getToken: () => Promise<string | null>;
  getPrincipal: () => Principal | null;
  /** Called exactly once per 401 response by the client; clears the session and redirects. */
  onUnauthorized: () => void;
}

export type NotifyLevel = 'info' | 'success' | 'warning' | 'error';
export interface NotifyPort {
  notify: (level: NotifyLevel, message: string) => void;
}

/** The application MCP seen from the UI (shared/13 §3–§4): the filtered tool list and a call. */
export interface AgentPort {
  listTools: () => Promise<{ name: string }[]>;
  call: (name: string, args: unknown) => Promise<unknown>;
}
