import type { AuditRow } from './types.js';

/** In-memory, bounded, newest last. The UI shows it; nothing persists it. */
export class AgentAuditLog {
  private readonly entries: AuditRow[] = [];
  private readonly listeners = new Set<() => void>();

  constructor(private readonly limit = 200) {}

  append(row: AuditRow): void {
    this.entries.push(row);
    if (this.entries.length > this.limit) this.entries.splice(0, this.entries.length - this.limit);
    for (const listener of this.listeners) listener();
  }

  rows(): readonly AuditRow[] {
    return this.entries;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
