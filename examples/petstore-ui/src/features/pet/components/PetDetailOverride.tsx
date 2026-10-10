import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Stack from '@mui/material/Stack';
import type { ReactElement } from 'react';
import {
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
  const StatusCell = useResolved<CellProps>('list.column.enum', 'pet', 'status');
  const SpeciesCell = useResolved<CellProps>('list.column.enum', 'pet', 'species');
  const NotesCell = useResolved<CellProps>('list.column.string', 'pet', 'notes');
  const CreatedAtCell = useResolved<CellProps>('list.column.date-time', 'pet', 'created_at');
  if (props.status === 'loading') return <Loading {...stateProps(t('common.loading'))} />;
  if (props.status === 'forbidden') return <Empty {...stateProps(t('common.notFound'))} />;
  if (props.status === 'error') {
    return (
      <ErrorState
        {...stateProps(t('common.error'), props.error, retryAction(t('common.retry'), props.retry))}
      />
    );
  }
  const entity = props.entity;
  if (entity === undefined) return <Empty {...stateProps(t('common.notFound'))} />;
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
        title={<h1 style={{ margin: 0 }}>{entity.name}</h1>}
        subheader={<StatusCell value={entity.status} row={entity} column={PET_COLUMNS.status} />}
        action={
          <Stack
            direction="row"
            spacing={1}
            role="toolbar"
            aria-label={t('pet.screen.detail.title')}
            data-testid="pet-detail-actions"
          >
            {update === undefined ? null : <UpdateAction {...update} />}
            {remove === undefined ? null : <DeleteAction {...remove} />}
          </Stack>
        }
        data-testid="pet-detail-header"
      />
      <CardContent>
        <dl data-testid="pet-detail-fields">
          {SHOWN.map((field) => {
            const Cell = cells[field];
            return (
              <div key={field} data-testid={`pet-detail-field-${field}`}>
                <dt>{PET_COLUMNS[field].headerName}</dt>
                <dd>
                  <Cell value={entity[field]} row={entity} column={PET_COLUMNS[field]} />
                </dd>
              </div>
            );
          })}
        </dl>
        <button type="button" data-testid="pet-detail-back" onClick={props.onBack}>
          {t('common.back')}
        </button>
      </CardContent>
    </Card>
  );
}
