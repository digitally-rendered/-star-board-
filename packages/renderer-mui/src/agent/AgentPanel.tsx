import { useEffect, useId, useMemo, useState, type ReactElement } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  AgentToolError,
  argsHash,
  useAgent,
  useAgentTools,
  type AuditRow,
  type SimulateResult,
  type WhyResult,
} from '@star-board/runtime';
import { useText } from '../i18n.js';

/** Citation refs come from a tool response: only http(s) URLs become links; anything else is text. */
function isSafeHref(ref: string): boolean {
  try {
    const url = new URL(ref, 'https://invalid.local/');
    return (url.protocol === 'https:' || url.protocol === 'http:') && /^https?:\/\//i.test(ref);
  } catch {
    return false;
  }
}

/** The `screen.custom` target the generated `AgentPanelSlot` resolves. */
export const AGENT_PANEL_TARGET = 'agent-panel' as const;

/** How many audit rows the panel shows. */
export const AGENT_AUDIT_ROWS = 5;

export type AgentPanelState = 'hidden' | 'idle' | 'explained' | 'simulated' | 'applied';

/**
 * `screen.custom` / `agent-panel` (hexagonal-rules shared/13 §4, typescript/12 §2): the "ask the
 * agent" affordance beside a generated form. Renders nothing without an agent port or when the
 * operation has no tool in the capability-filtered list — the same filter that hides the action.
 */
export interface AgentPanelProps {
  operationId: string;
  /** The arguments the operation would be called with: the form's values. */
  args: unknown;
  ifMatch?: string;
  onApplied?: (result: unknown) => void;
  disabled?: boolean;
  /** The generated slot passes the form values as `values`; they stand in for `args`. */
  values?: unknown;
  schema?: string;
}

export function agentTestId(action: string): string {
  return `agent-${action}`;
}

export function AgentPanel(props: AgentPanelProps): ReactElement | null {
  const agent = useAgent();
  const ids = useMemo(() => [props.operationId], [props.operationId]);
  const enabled = useAgentTools(ids);
  const args: unknown = props.args ?? props.values;
  const hash = argsHash(args);

  const [why, setWhy] = useState<WhyResult | undefined>(undefined);
  const [simulation, setSimulation] = useState<SimulateResult | undefined>(undefined);
  const [applied, setApplied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const unavailableText = useText()('agent.unavailable');

  // A simulation describes one set of arguments; new arguments need a new simulation.
  useEffect(() => {
    setSimulation(undefined);
    setApplied(false);
  }, [hash]);

  if (!agent.available || enabled.length === 0) return null;

  const run = async (step: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await step();
    } catch (cause) {
      setError(cause instanceof AgentToolError ? cause.message : unavailableText);
    } finally {
      setBusy(false);
    }
  };

  const state: AgentPanelState = applied
    ? 'applied'
    : simulation !== undefined
      ? 'simulated'
      : why !== undefined
        ? 'explained'
        : 'idle';

  return (
    <AgentPanelView
      operationId={props.operationId}
      state={state}
      why={why}
      simulation={simulation}
      audit={agent.audit}
      busy={busy}
      disabled={props.disabled ?? false}
      error={error}
      onExplain={() =>
        void run(async () => {
          setWhy(await agent.why(props.operationId, args));
        })
      }
      onSimulate={() =>
        void run(async () => {
          setApplied(false);
          setSimulation(await agent.simulate(props.operationId, args));
        })
      }
      onApply={() =>
        void run(async () => {
          const result = await agent.apply(props.operationId, args, props.ifMatch);
          setApplied(true);
          props.onApplied?.(result);
        })
      }
    />
  );
}

/** The presentational half: everything the panel shows, as props, so each state has a story. */
export interface AgentPanelViewProps {
  operationId: string;
  state: Exclude<AgentPanelState, 'hidden'>;
  why?: WhyResult | undefined;
  simulation?: SimulateResult | undefined;
  audit: readonly AuditRow[];
  busy?: boolean | undefined;
  disabled?: boolean | undefined;
  error?: string | undefined;
  defaultExpanded?: boolean | undefined;
  onExplain: () => void;
  onSimulate: () => void;
  onApply: () => void;
}

export function AgentPanelView(props: AgentPanelViewProps): ReactElement {
  const t = useText();
  const titleId = useId();
  const bodyId = useId();
  const [expanded, setExpanded] = useState(props.defaultExpanded ?? true);
  const busy = props.busy ?? false;
  const disabled = props.disabled ?? false;
  const canApply =
    props.state === 'simulated' &&
    props.simulation !== undefined &&
    props.simulation.wouldSucceed &&
    !disabled &&
    !busy;
  const recent = props.audit.slice(-AGENT_AUDIT_ROWS).reverse();

  return (
    <Card
      component="section"
      variant="outlined"
      role="region"
      aria-labelledby={titleId}
      data-testid={agentTestId('panel')}
      data-operation-id={props.operationId}
      data-agent-state={props.state}
    >
      <CardHeader
        disableTypography
        title={
          <Typography id={titleId} variant="h6" component="h2">
            {t('agent.title')}
          </Typography>
        }
        action={
          <IconButton
            type="button"
            aria-label={t('agent.toggle')}
            aria-expanded={expanded}
            aria-controls={bodyId}
            onClick={() => {
              setExpanded((open) => !open);
            }}
            data-testid={agentTestId('toggle')}
            sx={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
          >
            <ExpandMoreIcon />
          </IconButton>
        }
      />
      <Collapse in={expanded} id={bodyId}>
        <CardActions>
          <Button
            type="button"
            variant="outlined"
            disabled={busy}
            onClick={props.onExplain}
            data-testid={agentTestId('explain')}
          >
            {t('agent.explain')}
          </Button>
          <Button
            type="button"
            variant="outlined"
            disabled={busy || disabled}
            onClick={props.onSimulate}
            data-testid={agentTestId('simulate')}
          >
            {t('agent.simulate')}
          </Button>
          <Button
            type="button"
            variant="contained"
            disabled={!canApply}
            onClick={props.onApply}
            data-testid={agentTestId('apply')}
          >
            {t('agent.apply')}
          </Button>
        </CardActions>
        <CardContent>
          {props.error !== undefined && (
            <Alert severity="error" data-testid={agentTestId('error')}>
              {props.error}
            </Alert>
          )}
          {props.why !== undefined && (
            <Box data-testid={agentTestId('rationale')}>
              <Typography variant="subtitle2" component="h3">
                {t('agent.rationale')}
              </Typography>
              <Typography variant="body2">{props.why.rationale}</Typography>
              {props.why.citations !== undefined && props.why.citations.length > 0 && (
                <List dense aria-label={t('agent.citations')}>
                  {props.why.citations.map((citation, index) => (
                    <ListItem key={`${citation.ref}-${index}`} disableGutters>
                      {isSafeHref(citation.ref) ? (
                        <Link
                          href={citation.ref}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid={agentTestId(`citation-${index}`)}
                        >
                          {citation.label}
                        </Link>
                      ) : (
                        <Typography component="span" data-testid={agentTestId(`citation-${index}`)}>
                          {citation.label} ({citation.ref})
                        </Typography>
                      )}
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}
          {props.simulation !== undefined && (
            <Box data-testid={agentTestId('simulation')}>
              <Typography variant="subtitle2" component="h3">
                {t('agent.diff')}
              </Typography>
              <Box
                component="pre"
                role="region"
                tabIndex={0}
                aria-label={t('agent.diff')}
                data-testid={agentTestId('diff')}
                sx={{ m: 0, overflow: 'auto', fontSize: '0.8rem' }}
              >
                {JSON.stringify(props.simulation.diff, null, 2)}
              </Box>
              {props.simulation.warnings.length > 0 && (
                <Alert
                  severity="warning"
                  role="status"
                  data-testid={agentTestId('warnings')}
                  slotProps={{ message: { component: 'div' } }}
                >
                  <Typography variant="subtitle2" component="h3">
                    {t('agent.warnings')}
                  </Typography>
                  <List dense disablePadding>
                    {props.simulation.warnings.map((warning, index) => (
                      <ListItem key={`${index}-${warning}`} disableGutters>
                        <ListItemText primary={warning} />
                      </ListItem>
                    ))}
                  </List>
                </Alert>
              )}
              {!props.simulation.wouldSucceed && (
                <Alert severity="error" data-testid={agentTestId('would-fail')}>
                  {t('agent.wouldFail')}
                </Alert>
              )}
            </Box>
          )}
          {props.state === 'applied' && (
            <Alert severity="success" data-testid={agentTestId('applied')}>
              {t('agent.applied')}
            </Alert>
          )}
          <Typography variant="subtitle2" component="h3">
            {t('agent.audit')}
          </Typography>
          <List dense aria-label={t('agent.audit')} data-testid={agentTestId('audit')}>
            {recent.map((row, index) => (
              <ListItem key={`${row.at}-${row.tool}-${index}`} disableGutters>
                <ListItemText
                  primary={row.tool}
                  secondary={
                    <>
                      <time dateTime={row.at}>{new Date(row.at).toLocaleTimeString()}</time>
                      {` · ${row.kind} · ${row.outcome}`}
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Collapse>
    </Card>
  );
}
