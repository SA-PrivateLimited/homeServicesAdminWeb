import {useCallback, useEffect, useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {
  VirtualTable,
  type VirtualTableColumn,
  Button,
  Select,
} from 'sapvt-ltd-web-packages';
import {
  deleteServiceCategory,
  getServiceCategories,
  getServiceCategorySections,
  updateServiceCategory,
  type ServiceCategory,
  type ServiceCategorySection,
} from '../services/api/serviceCategoriesApi';
import {CATEGORY_SECTION_FALLBACK} from '../constants/categorySections';
import '../styles/pages.css';

function SearchTermsCell({
  value,
  disabled,
  placeholder,
  onCommit,
}: {
  value: string;
  disabled?: boolean;
  placeholder?: string;
  onCommit: (raw: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  // Keep draft in sync when the row reloads / VirtualTable remounts.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <textarea
      className="category-search-terms-cell"
      value={draft}
      disabled={disabled}
      rows={2}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        // Skip no-op commits (VirtualTable unmount blur used to wipe terms).
        if (draft === value) return;
        onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
    />
  );
}

export function CategoriesPage() {
  const {t, i18n} = useTranslation();
  const isHindi = i18n.language?.startsWith('hi');
  const [rows, setRows] = useState<ServiceCategory[]>([]);
  const [sections, setSections] = useState<ServiceCategorySection[]>(
    CATEGORY_SECTION_FALLBACK,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sectionOptions = useMemo(
    () =>
      sections.map((opt) => ({
        value: opt.key,
        label: isHindi ? opt.labelHi : opt.labelEn,
        searchText: `${opt.labelEn} ${opt.labelHi} ${opt.key}`,
      })),
    [isHindi, sections],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, sectionRows] = await Promise.all([
        getServiceCategories(true),
        getServiceCategorySections().catch(() => CATEGORY_SECTION_FALLBACK),
      ]);
      setRows(cats);
      setSections(sectionRows.length ? sectionRows : CATEGORY_SECTION_FALLBACK);
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

  const onTogglePopular = async (row: ServiceCategory) => {
    const next = !Boolean(row.isPopular);
    const previous = row.isPopular;
    setBusyId(row._id);
    setError(null);
    setRows((prev) =>
      prev.map((r) => (r._id === row._id ? {...r, isPopular: next} : r)),
    );
    try {
      await updateServiceCategory(row._id, {isPopular: next});
    } catch (err) {
      setRows((prev) =>
        prev.map((r) =>
          r._id === row._id ? {...r, isPopular: previous} : r,
        ),
      );
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setBusyId(null);
    }
  };

  const onSectionChange = async (row: ServiceCategory, nextSection: string) => {
    const sectionKey = nextSection.trim() || 'other';
    if ((row.sectionKey || 'other') === sectionKey) return;
    const previous = row.sectionKey;
    setBusyId(row._id);
    setError(null);
    setRows((prev) =>
      prev.map((r) => (r._id === row._id ? {...r, sectionKey} : r)),
    );
    try {
      await updateServiceCategory(row._id, {sectionKey});
    } catch (err) {
      setRows((prev) =>
        prev.map((r) =>
          r._id === row._id ? {...r, sectionKey: previous} : r,
        ),
      );
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setBusyId(null);
    }
  };

  const parseSearchTerms = (raw: string): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const part of raw.split(/[\n,]+/)) {
      // Strip wrapping quotes from pasted "'plumber', 'pipe'" style values.
      const term = part.trim().replace(/^['"]+|['"]+$/g, '').trim();
      if (!term) continue;
      const key = term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(term);
    }
    return out;
  };

  const onSearchTermsChange = async (
    row: ServiceCategory,
    raw: string,
  ) => {
    const searchTerms = parseSearchTerms(raw);
    const prevJoined = (row.searchTerms || []).join(', ');
    const nextJoined = searchTerms.join(', ');
    if (prevJoined === nextJoined) return;
    const previous = row.searchTerms;
    setBusyId(row._id);
    setError(null);
    setRows((prev) =>
      prev.map((r) => (r._id === row._id ? {...r, searchTerms} : r)),
    );
    try {
      await updateServiceCategory(row._id, {searchTerms});
    } catch (err) {
      setRows((prev) =>
        prev.map((r) =>
          r._id === row._id ? {...r, searchTerms: previous} : r,
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
        header: `${t('name')} (EN)`,
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
        key: 'nameHi',
        header: `${t('nameHi', 'Name')} (HI)`,
        render: (row) => (
          <span lang="hi" style={{fontSize: 13}}>
            {row.nameHi || (
              <span
                style={{
                  color: 'var(--color-danger, #ef4444)',
                  fontSize: 11,
                }}>
                missing
              </span>
            )}
          </span>
        ),
      },
      {
        key: 'section',
        header: t('categorySectionCol'),
        width: '16rem',
        filterable: true,
        filterType: 'multi',
        filterPlaceholder: t('categorySectionFilter'),
        filterOptions: sections.map((opt) => ({
          value: opt.key,
          label: isHindi ? opt.labelHi : opt.labelEn,
        })),
        filterValue: (row) => row.sectionKey || 'other',
        render: (row) => (
          <div className="category-section-cell">
            <Select
              options={sectionOptions}
              value={row.sectionKey || 'other'}
              onChange={(value) => void onSectionChange(row, value)}
              allowClear={false}
              showSearch
              searchPlaceholder={t('categorySectionSearch')}
              emptyMessage={t('empty')}
              disabled={busyId === row._id}
            />
          </div>
        ),
      },
      {
        key: 'popular',
        header: t('popularCol'),
        width: '7rem',
        filterable: true,
        filterType: 'multi',
        filterPlaceholder: t('filterPopular'),
        filterOptions: [
          {value: 'Yes', label: t('yes')},
          {value: 'No', label: t('no')},
        ],
        filterValue: (row) => (row.isPopular ? 'Yes' : 'No'),
        render: (row) => {
          const popular = Boolean(row.isPopular);
          return (
            <button
              type="button"
              role="switch"
              aria-checked={popular}
              aria-label={popular ? t('isPopular') : t('notPopular')}
              className={`hs-toggle${popular ? ' is-on' : ''}`}
              disabled={busyId === row._id}
              onClick={() => void onTogglePopular(row)}>
              <span className="hs-toggle-thumb" />
            </button>
          );
        },
      },
      {
        key: 'searchTerms',
        header: t('categorySearchTermsCol'),
        width: '18rem',
        filterable: true,
        filterPlaceholder: t('categorySearchTermsFilter'),
        filterValue: (row) => (row.searchTerms || []).join(' '),
        render: (row) => (
          <SearchTermsCell
            key={`${row._id}:${(row.searchTerms || []).join(',')}`}
            value={(row.searchTerms || []).join(', ')}
            disabled={busyId === row._id}
            placeholder={t('categorySearchTermsPlaceholder')}
            onCommit={(raw) => void onSearchTermsChange(row, raw)}
          />
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
            <Link
              className="hs-btn hs-btn--ghost hs-btn--md"
              to={`/categories/${row._id}`}>
              {t('edit')}
            </Link>
            <Button
              variant="danger"
              disabled={busyId === row._id}
              onClick={() => void onDelete(row._id, row.name)}>
              {t('delete')}
            </Button>
          </div>
        ),
      },
    ],
    [busyId, isHindi, sectionOptions, sections, t],
  );

  return (
    <div className="admin-page scale-baseline-80" data-testid="categories-root">
      <header className="page-header row-header">
        <div>
          <h1>{t('categoriesTitle')}</h1>
          <p>{t('categoriesLead')}</p>
        </div>
        <div className="row-header-actions actions">
          <Link className="hs-btn hs-btn--ghost hs-btn--md" to="/category-sections">
            {t('navCategorySections')}
          </Link>
          <Link className="hs-btn hs-btn--primary hs-btn--md" to="/categories/new">
            {t('addCategory')}
          </Link>
        </div>
      </header>
      <div className="panel panel--dropdown-safe">
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
