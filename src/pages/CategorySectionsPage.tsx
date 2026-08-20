import {type FormEvent, useCallback, useEffect, useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {
  Button,
  VirtualTable,
  type VirtualTableColumn,
} from 'sapvt-ltd-web-packages';
import {
  createServiceCategorySection,
  deleteServiceCategorySection,
  getServiceCategorySections,
  updateServiceCategorySection,
  type ServiceCategorySection,
} from '../services/api/serviceCategoriesApi';
import '../styles/pages.css';

export function CategorySectionsPage() {
  const {t} = useTranslation();
  const [rows, setRows] = useState<ServiceCategorySection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [newKey, setNewKey] = useState('');
  const [newLabelEn, setNewLabelEn] = useState('');
  const [newLabelHi, setNewLabelHi] = useState('');
  const [newOrder, setNewOrder] = useState(50);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getServiceCategorySections(true));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!newLabelEn.trim() || !newLabelHi.trim()) {
      setError(t('sectionLabelsRequired'));
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createServiceCategorySection({
        key: newKey.trim() || undefined,
        labelEn: newLabelEn.trim(),
        labelHi: newLabelHi.trim(),
        order: newOrder,
        isActive: true,
      });
      setNewKey('');
      setNewLabelEn('');
      setNewLabelHi('');
      setNewOrder(50);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setCreating(false);
    }
  };

  const onPatch = async (
    row: ServiceCategorySection,
    updates: Partial<ServiceCategorySection>,
  ) => {
    setBusyKey(row.key);
    setError(null);
    const previous = row;
    setRows((prev) =>
      prev.map((r) => (r.key === row.key ? {...r, ...updates} : r)),
    );
    try {
      await updateServiceCategorySection(row.key, updates);
    } catch (err) {
      setRows((prev) =>
        prev.map((r) => (r.key === row.key ? previous : r)),
      );
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setBusyKey(null);
    }
  };

  const onDelete = async (row: ServiceCategorySection) => {
    if (row.key === 'other') {
      setError(t('sectionOtherProtected'));
      return;
    }
    if (!window.confirm(t('sectionDeleteConfirm', {name: row.labelEn}))) {
      return;
    }
    setBusyKey(row.key);
    setError(null);
    try {
      await deleteServiceCategorySection(row.key);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setBusyKey(null);
    }
  };

  const columns = useMemo<VirtualTableColumn<ServiceCategorySection>[]>(
    () => [
      {
        key: 'key',
        header: t('sectionKeyCol'),
        filterable: true,
        filterPlaceholder: t('searchKey'),
        filterValue: (row) => row.key,
        render: (row) => <code style={{fontSize: 12}}>{row.key}</code>,
      },
      {
        key: 'labelEn',
        header: `${t('name')} (EN)`,
        width: '14rem',
        render: (row) => (
          <input
            key={`${row.key}-en-${row.labelEn}`}
            className="category-inline-input"
            defaultValue={row.labelEn}
            disabled={busyKey === row.key}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next && next !== row.labelEn) {
                void onPatch(row, {labelEn: next});
              }
            }}
          />
        ),
      },
      {
        key: 'labelHi',
        header: `${t('name')} (HI)`,
        width: '14rem',
        render: (row) => (
          <input
            key={`${row.key}-hi-${row.labelHi}`}
            className="category-inline-input"
            lang="hi"
            defaultValue={row.labelHi}
            disabled={busyKey === row.key}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next && next !== row.labelHi) {
                void onPatch(row, {labelHi: next});
              }
            }}
          />
        ),
      },
      {
        key: 'order',
        header: t('order'),
        width: '6rem',
        render: (row) => (
          <input
            key={`${row.key}-order-${row.order ?? 0}`}
            className="category-inline-input"
            type="number"
            defaultValue={row.order ?? 0}
            disabled={busyKey === row.key}
            onBlur={(e) => {
              const next = Number(e.target.value);
              if (!Number.isNaN(next) && next !== row.order) {
                void onPatch(row, {order: next});
              }
            }}
          />
        ),
      },
      {
        key: 'active',
        header: t('activeCol'),
        width: '7rem',
        render: (row) => {
          const active = row.isActive !== false;
          return (
            <button
              type="button"
              role="switch"
              aria-checked={active}
              className={`hs-toggle${active ? ' is-on' : ''}`}
              disabled={busyKey === row.key}
              onClick={() => void onPatch(row, {isActive: !active})}>
              <span className="hs-toggle-thumb" />
            </button>
          );
        },
      },
      {
        key: 'actions',
        header: t('actions'),
        render: (row) => (
          <Button
            variant="danger"
            disabled={busyKey === row.key || row.key === 'other'}
            onClick={() => void onDelete(row)}>
            {t('delete')}
          </Button>
        ),
      },
    ],
    [busyKey, t],
  );

  return (
    <div className="admin-page scale-baseline-80" data-testid="category-sections-root">
      <header className="page-header row-header">
        <div>
          <p className="breadcrumb">
            <Link to="/categories">{t('navCategories')}</Link> /{' '}
            {t('navCategorySections')}
          </p>
          <h1>{t('categorySectionsTitle')}</h1>
          <p>{t('categorySectionsLead')}</p>
        </div>
        <Link className="hs-btn hs-btn--ghost hs-btn--md" to="/categories">
          {t('back')}
        </Link>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      <form className="panel form-panel" onSubmit={onCreate}>
        <h3 style={{marginTop: 0}}>{t('addSection')}</h3>
        <div className="form-row">
          <label>
            {t('sectionKeyCol')}
            <input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="e.g. home_repair"
            />
          </label>
          <label>
            {t('order')}
            <input
              type="number"
              value={newOrder}
              onChange={(e) => setNewOrder(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            {t('name')} (EN) *
            <input
              value={newLabelEn}
              onChange={(e) => setNewLabelEn(e.target.value)}
              required
              placeholder="Home Repair & Services"
            />
          </label>
          <label>
            {t('name')} (HI) *
            <input
              value={newLabelHi}
              onChange={(e) => setNewLabelHi(e.target.value)}
              required
              lang="hi"
              placeholder="घर की मरम्मत और सेवाएँ"
            />
          </label>
        </div>
        <div className="actions form-actions">
          <Button type="submit" variant="primary" disabled={creating}>
            {creating ? t('saving') : t('addSection')}
          </Button>
        </div>
      </form>

      <div className="panel panel--dropdown-safe" style={{marginTop: 16}}>
        <VirtualTable
          columns={columns}
          data={rows}
          rowKey={(row) => row.key}
          height={420}
          pageSize={20}
          emptyMessage={t('empty')}
          loading={loading}
          loadingMessage={t('loading')}
        />
      </div>
    </div>
  );
}
