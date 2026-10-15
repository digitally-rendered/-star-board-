import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactElement } from 'react';
import {
  EMPTY_VALUE,
  hasValue,
  retryAction,
  stateProps,
  useResolved,
  type ActionProps,
  type CellProps,
  type StateProps,
} from '../../../generated/domain/contract.js';
import { PET_COLUMNS } from '../../../generated/domain/pet/columns.js';
import type { PetDetailScreenProps } from '../../../generated/domain/pet/PetDetailScreen.js';
import { useT } from '../../../generated/i18n.js';

/** The fields the card body shows, in this order; the generated default shows every field. */
const SHOWN = ['species', 'notes', 'created_at'] as const;

/**
 * Whole-screen override (typescript/12 §3, widest granularity): `screen.detail` for `pet`/`pet_get`.
 * The generated route container keeps feeding it `usePetDetailScreen` props, so data, capability
 * gating and navigation are reused unchanged; only the presentation differs. It keeps the page
 * object vocabulary (`pet-detail-*`) so the same tests drive both screens.
 */
export function PetDetailOverride(props: PetDetailScreenProps): ReactElement {
  const t = useT();
  const Loading = useResolved<StateProps>('state.loading', 'pet', 'pet_get');
  const ErrorState = useResolved<StateProps>('state.error', 'pet', 'pet_get');
  const Empty = useResolved<StateProps>('state.empty', 'pet', 'pet_get');
  const UpdateAction = useResolved<ActionProps>('action.update', 'pet', 'pet_update');
  const DeleteAction = useResolved<ActionProps>('action.delete', 'pet', 'pet_delete');
  // Back is the same resolved `action.custom` the generated screens use (target `back`).
  const BackAction = useResolved<ActionProps>('action.custom', 'pet', 'back');
  const StatusCell = useResolved<CellProps>('list.column.enum', 'pet', 'status');
  const SpeciesCell = useResolved<CellProps>('list.column.enum', 'pet', 'species');
  const NotesCell = useResolved<CellProps>('list.column.string', 'pet', 'notes');
  const CreatedAtCell = useResolved<CellProps>('list.column.date-time', 'pet', 'created_at');
  // A whole-screen override still owns the page heading: every state renders under the h1 the
  // default screen shell would have provided (axe `page-has-heading-one` in the browser E2E).
  const titled = (node: ReactElement): ReactElement => (
    <section aria-labelledby="pet-detail-title">
      <h1 id="pet-detail-title" style={{ margin: 0 }}>
        {t('pet.screen.detail.title')}
      </h1>
      {node}
    </section>
  );
  if (props.status === 'loading') return titled(<Loading {...stateProps(t('common.loading'))} />);
  if (props.status === 'forbidden') return titled(<Empty {...stateProps(t('common.notFound'))} />);
  if (props.status === 'error') {
    return titled(
      <ErrorState
        {...stateProps(t('common.error'), props.error, retryAction(t('common.retry'), props.retry))}
      />,
    );
  }
  const entity = props.entity;
  if (entity === undefined) return titled(<Empty {...stateProps(t('common.notFound'))} />);
  const cells = { species: SpeciesCell, notes: NotesCell, created_at: CreatedAtCell } as const;
  const update = props.actions.find((a) => a.operationId === 'pet_update');
  const remove = props.actions.find((a) => a.operationId === 'pet_delete');
  return (
    <Card
      component="article"
      variant="outlined"
      data-testid="pet-detail-screen"
      data-override="pet"
    >
      <CardHeader
        disableTypography
        title={
          <Typography component="h1" variant="h4">
            {entity.name}
          </Typography>
        }
        subheader={
          <Box sx={{ mt: 1 }}>
            <StatusCell value={entity.status} row={entity} column={PET_COLUMNS.status} />
          </Box>
        }
        action={
          <Stack
            direction="row"
            spacing={1}
            role="toolbar"
            aria-label={t('pet.screen.detail.title')}
            data-testid="pet-detail-actions"
          >
            {update === undefined ? null : <UpdateAction {...update} variant="contained" />}
            {remove === undefined ? null : <DeleteAction {...remove} />}
          </Stack>
        }
        data-testid="pet-detail-header"
      />
      <CardContent>
        {/* The renderer's definition-list spacing: a muted caption above each value, one row gap apart. */}
        <Stack component="dl" spacing={2} sx={{ m: 0 }} data-testid="pet-detail-fields">
          {SHOWN.map((field) => {
            const Cell = cells[field];
            const value = entity[field];
            return (
              <Box key={field} data-testid={`pet-detail-field-${field}`}>
                <Typography component="dt" variant="caption" color="text.secondary">
                  {PET_COLUMNS[field].headerName}
                </Typography>
                <Box component="dd" sx={{ m: 0 }}>
                  {hasValue(value) ? (
                    <Cell value={value} row={entity} column={PET_COLUMNS[field]} />
                  ) : (
                    <Typography component="span" color="text.secondary">
                      {EMPTY_VALUE}
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })}
        </Stack>
        <Box sx={{ mt: 3 }}>
          <BackAction
            operationId="back"
            label={t('common.back')}
            variant="outlined"
            testId="pet-detail-back"
            onClick={props.onBack}
          />
        </Box>
      </CardContent>
    </Card>
  );
}
