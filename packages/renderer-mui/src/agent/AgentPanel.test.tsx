import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import {
  createClient,
  McpAgentPort,
  ServicesProvider,
  type AgentPort,
  type AuthPort,
  type McpTransport,
  type Services,
} from '@star-board/runtime';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoViolations } from '../../test/a11y.js';
import { AgentPanel, AgentPanelView } from './AgentPanel.js';

const auth: AuthPort = {
  getToken: () => Promise.resolve('tok'),
  getPrincipal: () => ({ id: 'u1', roles: ['staff'], capabilities: ['pet:write'] }),
  onUnauthorized: vi.fn(),
};

function services(agent?: AgentPort): Services {
  const base: Services = {
    client: createClient('http://api.test', auth),
    auth,
    notify: { notify: vi.fn() },
  };
  return agent === undefined ? base : { ...base, agent };
}

const text = (value: unknown) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });

/** A stub MCP server for `pet_update` and its helpers. */
function stubAgent(
  results: Record<string, unknown>,
  tools = ['pet_update', 'why_pet_update', 'simulate_pet_update'],
) {
  const request = vi.fn((method: 'tools/list' | 'tools/call', params?: unknown) => {
    if (method === 'tools/list') return Promise.resolve({ tools: tools.map((name) => ({ name })) });
    const { name } = params as { name: string };
    const result = results[name];
    return result === undefined
      ? Promise.reject(new Error(`no tool ${name}`))
      : Promise.resolve(result);
  });
  const transport: McpTransport = { request };
  return { request, port: new McpAgentPort(transport, { principal: () => 'u1' }) };
}

function wrap(svc: Services, children: ReactNode) {
  return render(<ServicesProvider services={svc}>{children}</ServicesProvider>);
}

const okResults = {
  why_pet_update: text({
    rationale: 'The name changed.',
    citations: [{ label: 'Naming', ref: 'https://example.test/naming' }],
  }),
  simulate_pet_update: text({
    diff: { name: ['Max', 'Rex'] },
    warnings: ['Renames the pet'],
    wouldSucceed: true,
  }),
  pet_update: text({ id: 'x1', version: 2 }),
};

describe('AgentPanel (screen.custom / agent-panel)', () => {
  it('renders nothing without an agent port', () => {
    const { container } = wrap(
      services(),
      <AgentPanel operationId="pet_update" args={{ id: 'x1' }} />,
    );
    expect(container.childElementCount).toBe(0);
  });

  it('renders nothing when the operation has no tool', async () => {
    const { port, request } = stubAgent(okResults, ['why_pet_update', 'pet_create']);
    const { container } = wrap(
      services(port),
      <AgentPanel operationId="pet_update" args={{ id: 'x1' }} />,
    );
    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('tools/list');
    });
    expect(container.childElementCount).toBe(0);
  });

  it('explains, simulates, then applies and reports the audit', async () => {
    const { port, request } = stubAgent(okResults);
    const onApplied = vi.fn();
    const { container } = wrap(
      services(port),
      <AgentPanel
        operationId="pet_update"
        args={{ id: 'x1', name: 'Rex' }}
        ifMatch='W/"1"'
        onApplied={onApplied}
      />,
    );
    const panel = await screen.findByTestId('agent-panel');
    expect(panel.getAttribute('role')).toBe('region');
    expect(panel.getAttribute('aria-labelledby')).toBe(
      screen.getByRole('heading', { level: 2 }).id,
    );
    expect(panel.getAttribute('data-agent-state')).toBe('idle');
    expect(screen.getByTestId<HTMLButtonElement>('agent-apply').disabled).toBe(true);

    await userEvent.click(screen.getByTestId('agent-explain'));
    await screen.findByText('The name changed.');
    expect(screen.getByTestId('agent-citation-0').getAttribute('href')).toBe(
      'https://example.test/naming',
    );
    expect(panel.getAttribute('data-agent-state')).toBe('explained');
    expect(screen.getByTestId<HTMLButtonElement>('agent-apply').disabled).toBe(true);

    await userEvent.click(screen.getByTestId('agent-simulate'));
    const diff = await screen.findByTestId('agent-diff');
    expect(diff.tagName).toBe('PRE');
    expect(diff.getAttribute('aria-label')).toBe('Proposed change');
    expect(diff.textContent).toContain('"Rex"');
    expect(screen.getByTestId('agent-warnings').textContent).toContain('Renames the pet');
    expect(panel.getAttribute('data-agent-state')).toBe('simulated');
    expect(screen.getByTestId<HTMLButtonElement>('agent-apply').disabled).toBe(false);

    await userEvent.click(screen.getByTestId('agent-apply'));
    await screen.findByTestId('agent-applied');
    expect(onApplied).toHaveBeenCalledWith({ id: 'x1', version: 2 });
    expect(panel.getAttribute('data-agent-state')).toBe('applied');
    expect(request).toHaveBeenCalledWith('tools/call', {
      name: 'pet_update',
      arguments: { id: 'x1', name: 'Rex' },
      _meta: { ifMatch: 'W/"1"' },
    });

    const audit = screen.getByTestId('agent-audit');
    const rows = audit.querySelectorAll('li');
    expect(rows).toHaveLength(3);
    expect(rows[0]?.textContent).toContain('pet_update');
    expect(rows[0]?.textContent).toContain('apply · ok');
    expect(rows[2]?.textContent).toContain('why_pet_update');
    expect(port.audit().map((r) => r.kind)).toEqual(['why', 'simulate', 'apply']);
    await expectNoViolations(container);
  });

  it('keeps Apply disabled when the simulation would not succeed or the panel is disabled', async () => {
    const { port } = stubAgent({
      ...okResults,
      simulate_pet_update: text({ diff: {}, warnings: ['Owner missing'], wouldSucceed: false }),
    });
    wrap(services(port), <AgentPanel operationId="pet_update" args={{ id: 'x1' }} />);
    await userEvent.click(await screen.findByTestId('agent-simulate'));
    await screen.findByTestId('agent-would-fail');
    expect(screen.getByTestId('agent-warnings').textContent).toContain('Owner missing');
    expect(screen.getByTestId<HTMLButtonElement>('agent-apply').disabled).toBe(true);
  });

  it('shows the tool error and leaves Apply disabled', async () => {
    const { port } = stubAgent({
      ...okResults,
      simulate_pet_update: { isError: true, content: [{ type: 'text', text: 'forbidden' }] },
    });
    wrap(services(port), <AgentPanel operationId="pet_update" args={{ id: 'x1' }} />);
    await userEvent.click(await screen.findByTestId('agent-simulate'));
    expect((await screen.findByTestId('agent-error')).textContent).toContain('forbidden');
    expect(screen.getByTestId<HTMLButtonElement>('agent-apply').disabled).toBe(true);
    expect(port.audit().at(-1)?.outcome).toBe('error');
  });

  it('accepts the generated slot props (schema, values) in place of args', async () => {
    const { port, request } = stubAgent(okResults);
    wrap(
      services(port),
      <AgentPanel operationId="pet_update" args={undefined} schema="pet" values={{ id: 'v1' }} />,
    );
    await userEvent.click(await screen.findByTestId('agent-explain'));
    await screen.findByTestId('agent-rationale');
    expect(request).toHaveBeenCalledWith('tools/call', {
      name: 'why_pet_update',
      arguments: { id: 'v1' },
    });
  });

  it('renders a citation as a link only for http(s) refs', async () => {
    const { port } = stubAgent({
      ...okResults,
      why_pet_update: text({
        rationale: 'r',
        citations: [
          { label: 'Safe', ref: 'https://example.test/doc' },
          { label: 'Script', ref: 'javascript:alert(1)' },
          { label: 'Relative', ref: '/local/path' },
        ],
      }),
    });
    wrap(
      services(port),
      <AgentPanel operationId="pet_update" args={{ id: 'x1' }} ifMatch='W/"1"' />,
    );
    await userEvent.click(await screen.findByTestId('agent-explain'));
    const safe = await screen.findByTestId('agent-citation-0');
    expect(safe.tagName).toBe('A');
    expect(safe.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByTestId('agent-citation-1').tagName).not.toBe('A');
    expect(screen.getByTestId('agent-citation-2').tagName).not.toBe('A');
  });

  it('collapses and expands', async () => {
    const { container } = render(
      <AgentPanelView
        operationId="pet_update"
        state="idle"
        audit={[]}
        onExplain={vi.fn()}
        onSimulate={vi.fn()}
        onApply={vi.fn()}
      />,
    );
    const toggle = screen.getByTestId('agent-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await expectNoViolations(container);
  });
});
