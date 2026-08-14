import {useCallback, useEffect, useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {
  VirtualTable,
  type VirtualTableColumn,
  Button,
} from 'sapvt-ltd-web-packages';
import {
  deleteServiceCategory,
  getServiceCategories,
  updateServiceCategory,
  type ServiceCategory,
} from '../services/api/serviceCategoriesApi';
import '../styles/pages.css';

export function CategoriesPage() {
  const {t} = useTranslation();
  const [rows, setRows] = useState<ServiceCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getServiceCategories(true));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete category “${name}”?`)) return;
    setBusyId(id);
    try {
      await deleteServiceCategory(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setBusyId(null);
    }
  };

  const onToggleActive = async (row: ServiceCategory) => {
    const next = row.isActive === false;
    setBusyId(row._id);
    setError(null);
    setRows((prev) =>
      prev.map((r) => (r._id === row._id ? {...r, isActive: next} : r)),
    );
    try {
      await updateServiceCategory(row._id, {isActive: next});
    } catch (err) {
      setRows((prev) =>
        prev.map((r) =>
          r._id === row._id ? {...r, isActive: row.isActive} : r,
        ),
      );
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setBusyId(null);
    }
  };

  const sortedRows = useMemo(
    () => rows.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [rows],
  );

  const columns = useMemo<VirtualTableColumn<ServiceCategory>[]>(
    () => [
      {
        key: 'name',
        header: t('name'),
        filterable: true,
        filterPlaceholder: t('searchName'),
        filterValue: (row) => row.name || '',
        render: (row) => (
          <>
            <span
              className="swatch"
              style={{background: row.color || 'var(--color-primary)'}}
            />
            {row.name}
          </>
        ),
      },
      {
        key: 'order',
        header: t('order'),
        filterable: true,
        filterPlaceholder: t('searchOrder'),
        filterValue: (row) => String(row.order ?? ''),
        render: (row) => row.order ?? '—',
      },
      {
        key: 'questions',
        header: t('questions'),
        render: (row) => row.questionnaire?.length ?? 0,
      },
      {
        key: 'active',
        header: t('activeCol'),
        width: '7rem',
        filterable: true,
        filterType: 'multi',
        filterPlaceholder: t('filterActive'),
        filterOptions: [
          {value: 'Yes', label: t('yes')},
          {value: 'No', label: t('no')},
        ],
        filterValue: (row) => (row.isActive === false ? 'No' : 'Yes'),
        render: (row) => {
          const active = row.isActive !== false;
          return (
            <button
              type="button"
              role="switch"
              aria-checked={active}
              aria-label={active ? t('active') : t('inactive')}
              className={`hs-toggle${active ? ' is-on' : ''}`}
              disabled={busyId === row._id}
              onClick={() => void onToggleActive(row)}>
              <span className="hs-toggle-thumb" />
            </button>
          );
        },
      },
      {
        key: 'actions',
        header: t('actions'),
        render: (row) => (
          <div className="actions">
            <Link className="hs-btn hs-btn--ghost hs-btn--md" to={`/categories/${row._id}`}>
              {t('edit')}
            </Link>
            <Button variant="danger" disabled={busyId === row._id} onClick={() => void onDelete(row._id, row.name)}>
              {t('delete')}
            </Button>
          </div>
        ),
      },
    ],
    [busyId, t],
  );

  return (
    <div className="admin-page scale-baseline-80" data-testid="categories-root">
      <header className="page-header row-header">
        <div>
          <h1>{t('categoriesTitle')}</h1>
          <p>{t('categoriesLead')}</p>
        </div>
        <Link className="hs-btn hs-btn--primary hs-btn--md" to="/categories/new">
          {t('addCategory')}
        </Link>
      </header>
      <div className="panel">
        {error ? <p className="error-text">{error}</p> : null}
        <VirtualTable
          columns={columns}
          data={sortedRows}
          rowKey={(row) => row._id}
          height={480}
          pageSize={20}
          emptyMessage={t('empty')}
          filterDebounceMs={300}
          loading={loading}
          loadingMessage={t('loading')}
        />
      </div>
    </div>
  );
}
