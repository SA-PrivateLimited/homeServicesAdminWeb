import {useCallback, useEffect, useMemo, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {
  Button,
  Dialog,
  Select,
  StatusChip,
  VirtualTable,
  type VirtualTableColumn,
} from 'sapvt-ltd-web-packages';
import {CreatableLookupSelect} from '../components/CreatableLookupSelect';
import {usePermissions} from '../hooks/usePermissions';
import {PERMISSIONS} from '../constants/permissions';
import {
  createEmployee,
  createEmployeeLookup,
  deleteEmployeeLookup,
  employeeStatusLabel,
  formatExperienceYears,
  getEmployeeMeta,
  getEmployeeStats,
  getEmployeesPage,
  listEmployeeLookups,
  maskPhoneDisplay,
  type CreateEmployeeInput,
  type Employee,
  type EmployeeLookup,
  type EmployeeMeta,
  type EmployeeStats,
  type EmployeeStatus,
  type EmploymentType,
} from '../services/api/employeesApi';
import {localTenDigits, toE164} from '../utils/phone';
import {ApiError} from '../services/api/apiClient';
import '../styles/pages.css';
import './EmployeesPage.css';

const PAGE_SIZE = 20;
const ALL = '__all__';

type PageTab = 'employees' | 'department' | 'designation' | 'profession';
type LookupKind = 'department' | 'designation' | 'profession';

function isLookupTab(tab: PageTab): tab is LookupKind {
  return tab === 'department' || tab === 'designation' || tab === 'profession';
}

function statusChipStatus(status: EmployeeStatus): string {
  if (status === 'active') return 'active';
  if (status === 'on_leave') return 'pending';
  if (status === 'former') return 'cancelled';
  return 'inactive';
}

export function EmployeesPage() {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const {hasPermission} = usePermissions();
  const canCreate = hasPermission(PERMISSIONS.EMPLOYEES_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.EMPLOYEES_UPDATE);

  const [pageTab, setPageTab] = useState<PageTab>('employees');
  const [rows, setRows] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [meta, setMeta] = useState<EmployeeMeta | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [departmentFilter, setDepartmentFilter] = useState(ALL);
  const [professionFilter, setProfessionFilter] = useState(ALL);

  const [lookups, setLookups] = useState<EmployeeLookup[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [newLookupLabel, setNewLookupLabel] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    profession: '',
    designation: '',
    department: '',
    employmentType: 'full_time' as EmploymentType,
    joiningDate: '',
    professionalExperienceYears: '',
    workLocation: '',
    reportingManagerId: '',
  });
  const [managerOptions, setManagerOptions] = useState<
    Array<{value: string; label: string}>
  >([{value: '', label: '—'}]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getEmployeesPage({
        search,
        status: statusFilter === ALL ? undefined : statusFilter,
        department: departmentFilter === ALL ? undefined : departmentFilter,
        profession: professionFilter === ALL ? undefined : professionFilter,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setRows(result.items);
      setTotal(result.total);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : t('employeesLoadError'),
      );
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    search,
    statusFilter,
    departmentFilter,
    professionFilter,
    page,
    t,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const [s, m] = await Promise.all([
          getEmployeeStats(),
          getEmployeeMeta(),
        ]);
        setStats(s);
        setMeta(m);
      } catch {
        /* stats optional */
      }
    })();
  }, []);

  const refreshMeta = useCallback(async () => {
    try {
      setMeta(await getEmployeeMeta());
    } catch {
      /* keep previous meta */
    }
  }, []);

  const loadLookups = useCallback(
    async (kind: LookupKind) => {
      setLookupLoading(true);
      setLookupError(null);
      try {
        setLookups(await listEmployeeLookups(kind));
      } catch (e) {
        setLookupError(
          e instanceof ApiError
            ? e.message
            : t('employeesLookupLoadError'),
        );
        setLookups([]);
      } finally {
        setLookupLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!isLookupTab(pageTab)) return;
    setNewLookupLabel('');
    void loadLookups(pageTab);
  }, [pageTab, loadLookups]);

  useEffect(() => {
    if (!createOpen) return;
    void (async () => {
      try {
        const managers = await getEmployeesPage({
          status: 'active',
          limit: 100,
          offset: 0,
        });
        setManagerOptions([
          {value: '', label: '—'},
          ...managers.items.map((e) => ({
            value: e._id,
            label: `${e.fullName} · ${e.designation || e.profession || '—'} · ${e.employeeCode}`,
          })),
        ]);
      } catch {
        setManagerOptions([{value: '', label: '—'}]);
      }
    })();
  }, [createOpen]);

  const statusOptions = useMemo(
    () => [
      {value: ALL, label: t('employeesFilterAll')},
      {value: 'active', label: employeeStatusLabel('active')},
      {value: 'on_leave', label: employeeStatusLabel('on_leave')},
      {value: 'inactive', label: employeeStatusLabel('inactive')},
      {value: 'former', label: employeeStatusLabel('former')},
    ],
    [t],
  );

  const departmentOptions = useMemo(
    () => [
      {value: ALL, label: t('employeesFilterDepartment')},
      ...(meta?.departments || []).map((d) => ({value: d, label: d})),
    ],
    [meta, t],
  );

  const professionOptions = useMemo(
    () => [
      {value: ALL, label: t('employeesFilterProfession')},
      ...(meta?.professions || []).map((d) => ({value: d, label: d})),
    ],
    [meta, t],
  );

  const employmentTypeOptions = useMemo(
    () => [
      {value: 'full_time', label: 'Full Time'},
      {value: 'part_time', label: 'Part Time'},
      {value: 'contract', label: 'Contract'},
      {value: 'intern', label: 'Intern'},
      {value: 'other', label: 'Other'},
    ],
    [],
  );

  const columns = useMemo<VirtualTableColumn<Employee>[]>(
    () => [
      {
        key: 'employee',
        header: t('employeesColEmployee'),
        width: 280,
        render: (row) => (
          <div className="emp-cell-person">
            {row.photoUrl ? (
              <img
                className="emp-avatar"
                src={row.photoUrl}
                alt=""
                width={40}
                height={40}
              />
            ) : (
              <span className="emp-avatar emp-avatar--fallback" aria-hidden>
                {(row.fullName || '?').slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="emp-cell-person__text">
              <Link
                className="emp-name-link"
                to={`/hr/employees/${row._id}`}>
                {row.fullName}
              </Link>
              <span className="muted">{row.employeeCode}</span>
            </div>
          </div>
        ),
      },
      {
        key: 'profession',
        header: t('employeesColProfession'),
        width: 160,
        render: (row) => (
          <span>
            {row.profession || row.designation || '—'}
            {row.department ? (
              <span className="muted block-muted">{row.department}</span>
            ) : null}
          </span>
        ),
      },
      {
        key: 'phone',
        header: t('employeesColPhone'),
        width: 120,
        render: (row) => maskPhoneDisplay(row.phone),
      },
      {
        key: 'location',
        header: t('employeesColLocation'),
        width: 140,
        render: (row) => row.workLocation || row.address?.city || '—',
      },
      {
        key: 'experience',
        header: t('employeesColExperience'),
        width: 100,
        render: (row) =>
          formatExperienceYears(row.professionalExperienceYears),
      },
      {
        key: 'status',
        header: t('employeesColStatus'),
        width: 130,
        render: (row) => (
          <StatusChip
            status={statusChipStatus(row.status)}
            label={employeeStatusLabel(row.status)}
          />
        ),
      },
      {
        key: 'actions',
        header: t('actions'),
        width: 120,
        render: (row) => (
          <Button
            variant="ghost"
            onClick={() => navigate(`/hr/employees/${row._id}`)}>
            {t('employeesView')}
          </Button>
        ),
      },
    ],
    [navigate, t],
  );

  function resetForm() {
    setForm({
      fullName: '',
      phone: '',
      email: '',
      profession: '',
      designation: '',
      department: '',
      employmentType: 'full_time',
      joiningDate: '',
      professionalExperienceYears: '',
      workLocation: '',
      reportingManagerId: '',
    });
    setFieldErrors({});
    setCreateError(null);
  }

  async function handleCreate() {
    const errors: Record<string, string> = {};
    if (!form.fullName.trim()) {
      errors.fullName = t('employeesErrName');
    }
    const ten = localTenDigits(form.phone);
    if (ten.length !== 10) {
      errors.phone = t('employeesErrPhone');
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setCreateBusy(true);
    setCreateError(null);
    try {
      const payload: CreateEmployeeInput = {
        fullName: form.fullName.trim(),
        phone: toE164(ten),
        email: form.email.trim() || undefined,
        profession: form.profession.trim() || undefined,
        designation: form.designation.trim() || undefined,
        department: form.department.trim() || undefined,
        employmentType: form.employmentType,
        joiningDate: form.joiningDate || undefined,
        professionalExperienceYears: form.professionalExperienceYears
          ? Number(form.professionalExperienceYears)
          : undefined,
        workLocation: form.workLocation.trim() || undefined,
        reportingManagerId: form.reportingManagerId || null,
      };
      const created = await createEmployee(payload);
      setCreateOpen(false);
      resetForm();
      void refreshMeta();
      navigate(`/hr/employees/${created._id}`);
    } catch (e) {
      setCreateError(
        e instanceof ApiError
          ? e.message
          : t('employeesSaveError'),
      );
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleAddLookup() {
    if (!isLookupTab(pageTab)) return;
    const label = newLookupLabel.trim();
    if (!label) return;
    setLookupBusy(true);
    setLookupError(null);
    try {
      await createEmployeeLookup(pageTab, label);
      setNewLookupLabel('');
      await loadLookups(pageTab);
      await refreshMeta();
    } catch (e) {
      setLookupError(
        e instanceof ApiError
          ? e.message
          : t('employeesLookupSaveError'),
      );
    } finally {
      setLookupBusy(false);
    }
  }

  async function handleDeleteLookup(id: string) {
    if (!isLookupTab(pageTab)) return;
    setLookupBusy(true);
    setLookupError(null);
    try {
      await deleteEmployeeLookup(id);
      await loadLookups(pageTab);
      await refreshMeta();
    } catch (e) {
      setLookupError(
        e instanceof ApiError
          ? e.message
          : t('employeesLookupDeleteError'),
      );
    } finally {
      setLookupBusy(false);
    }
  }

  const emptyMessage =
    search || statusFilter !== ALL || departmentFilter !== ALL
      ? t('employeesEmptySearch')
      : t('employeesEmpty');

  const lookupTabTitle =
    pageTab === 'department'
      ? t('employeesTabDepartments')
      : pageTab === 'designation'
        ? t('employeesTabDesignations')
        : t('employeesTabProfessions');

  return (
    <div className="admin-page scale-baseline-80" data-testid="employees-root">
      <header className="page-header row-header">
        <div>
          <h1>{t('employeesTitle')}</h1>
          <p>{t('employeesLead')}</p>
        </div>
        <div className="row-header-actions">
          {canCreate && pageTab === 'employees' ? (
            <Button
              variant="primary"
              onClick={() => {
                resetForm();
                setCreateOpen(true);
              }}>
              {t('employeesAdd')}
            </Button>
          ) : null}
        </div>
      </header>

      <div
        className="emp-page-tabs"
        role="tablist"
        aria-label={t('employeesTitle')}>
        {(
          [
            ['employees', t('employeesTabEmployees')],
            ['department', t('employeesTabDepartments')],
            ['designation', t('employeesTabDesignations')],
            ['profession', t('employeesTabProfessions')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={pageTab === id}
            className={
              pageTab === id ? 'emp-page-tab is-selected' : 'emp-page-tab'
            }
            onClick={() => setPageTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {pageTab === 'employees' ? (
        <>
      {stats ? (
        <div className="emp-stats" aria-label={t('employeesStatsLabel')}>
          <div className="emp-stat">
            <span className="emp-stat__label">{t('employeesStatTotal')}</span>
            <span className="emp-stat__value">{stats.total}</span>
          </div>
          <div className="emp-stat">
            <span className="emp-stat__label">{t('employeesStatActive')}</span>
            <span className="emp-stat__value">{stats.active}</span>
          </div>
          <div className="emp-stat">
            <span className="emp-stat__label">{t('employeesStatLeave')}</span>
            <span className="emp-stat__value">{stats.onLeave}</span>
          </div>
          <div className="emp-stat">
            <span className="emp-stat__label">{t('employeesStatFormer')}</span>
            <span className="emp-stat__value">{stats.former}</span>
          </div>
        </div>
      ) : null}

      <div className="filter-row emp-filters">
        <label className="emp-search">
          <span className="sr-only">{t('employeesSearch')}</span>
          <input
            type="search"
            className="text-input"
            placeholder={t('employeesSearch')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </label>
        <div className="filter-inline" style={{minWidth: '10rem'}}>
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(0);
            }}
          />
        </div>
        <div className="filter-inline" style={{minWidth: '10rem'}}>
          <Select
            options={professionOptions}
            value={professionFilter}
            showSearch
            onChange={(v) => {
              setProfessionFilter(v);
              setPage(0);
            }}
          />
        </div>
        <div className="filter-inline" style={{minWidth: '10rem'}}>
          <Select
            options={departmentOptions}
            value={departmentFilter}
            showSearch
            onChange={(v) => {
              setDepartmentFilter(v);
              setPage(0);
            }}
          />
        </div>
      </div>

      <div className="panel emp-list-panel">
        {error ? <p className="error-text">{error}</p> : null}
        <div className="emp-desktop-table">
          <VirtualTable
            columns={columns}
            data={rows}
            rowKey={(row) => row._id}
            height={480}
            pageSize={PAGE_SIZE}
            emptyMessage={emptyMessage}
            loading={loading}
            loadingMessage={t('loading')}
            serverPagination={{
              total,
              page,
              onPageChange: setPage,
            }}
          />
        </div>

        <div className="emp-mobile-list" aria-live="polite">
          {loading ? (
            <p className="muted">{t('loading')}</p>
          ) : rows.length === 0 ? (
            <div className="emp-empty">
              <p>{emptyMessage}</p>
              {canCreate && !search ? (
                <Button
                  variant="primary"
                  onClick={() => {
                    resetForm();
                    setCreateOpen(true);
                  }}>
                  {t('employeesAdd')}
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className="emp-card-list">
              {rows.map((row) => (
                <li key={row._id}>
                  <button
                    type="button"
                    className="emp-card"
                    onClick={() => navigate(`/hr/employees/${row._id}`)}>
                    <div className="emp-card__top">
                      {row.photoUrl ? (
                        <img src={row.photoUrl} alt="" className="emp-avatar" />
                      ) : (
                        <span className="emp-avatar emp-avatar--fallback">
                          {(row.fullName || '?').slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <div className="emp-card__meta">
                        <strong>{row.fullName}</strong>
                        <span>
                          {row.profession || row.designation || '—'}
                        </span>
                        <span className="muted">{row.employeeCode}</span>
                      </div>
                      <StatusChip
                        status={statusChipStatus(row.status)}
                        label={employeeStatusLabel(row.status)}
                      />
                    </div>
                    <div className="emp-card__bottom">
                      <span>
                        {row.workLocation || row.address?.city || '—'}
                      </span>
                      <span>
                        {formatExperienceYears(
                          row.professionalExperienceYears,
                        )}
                      </span>
                    </div>
                    <span className="emp-card__cta">
                      {t('employeesView')} →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
        </>
      ) : (
        <section className="panel emp-lookup-panel" aria-label={lookupTabTitle}>
          <div className="emp-lookup-panel__header">
            <div>
              <h2 className="emp-lookup-panel__title">{lookupTabTitle}</h2>
              <p className="muted emp-lookup-panel__lead">
                {t('employeesLookupLead')}
              </p>
            </div>
          </div>
          {lookupError ? <p className="error-text">{lookupError}</p> : null}
          {canUpdate ? (
            <div className="emp-lookup-add">
              <input
                className="text-input"
                value={newLookupLabel}
                placeholder={t('employeesLookupPlaceholder')}
                autoComplete="off"
                onChange={(e) => setNewLookupLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleAddLookup();
                  }
                }}
              />
              <Button
                variant="primary"
                disabled={lookupBusy || !newLookupLabel.trim()}
                onClick={() => void handleAddLookup()}>
                {lookupBusy ? t('saving') : t('employeesLookupAdd')}
              </Button>
            </div>
          ) : null}
          {lookupLoading ? (
            <p className="muted">{t('loading')}</p>
          ) : lookups.length === 0 ? (
            <p className="muted">{t('employeesLookupEmpty')}</p>
          ) : (
            <ul className="emp-lookup-list">
              {lookups.map((row) => (
                <li key={row._id} className="emp-lookup-list__item">
                  <span className="emp-lookup-list__label">{row.label}</span>
                  {canUpdate ? (
                    <Button
                      variant="ghost"
                      disabled={lookupBusy}
                      onClick={() => void handleDeleteLookup(row._id)}>
                      {t('employeesLookupRemove')}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {createOpen ? (
        <Dialog
          open
          title={t('employeesAddTitle')}
          onClose={() => {
            if (!createBusy) setCreateOpen(false);
          }}>
          <p className="modal-lead">{t('employeesAddLead')}</p>
          <div className="modal-form">
            {createError ? <p className="error-text">{createError}</p> : null}
            <label>
              {t('employeesFieldName')} *
              <input
                className="text-input"
                value={form.fullName}
                autoComplete="name"
                onChange={(e) =>
                  setForm((f) => ({...f, fullName: e.target.value}))
                }
              />
              {fieldErrors.fullName ? (
                <span className="field-error">{fieldErrors.fullName}</span>
              ) : null}
            </label>
            <label>
              {t('employeesFieldPhone')} *
              <input
                className="text-input"
                inputMode="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({...f, phone: e.target.value}))
                }
              />
              {fieldErrors.phone ? (
                <span className="field-error">{fieldErrors.phone}</span>
              ) : null}
            </label>
            <label>
              {t('employeesFieldEmail')}
              <input
                className="text-input"
                type="email"
                inputMode="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({...f, email: e.target.value}))
                }
              />
            </label>
            <label>
              {t('employeesFieldProfession')}
              <CreatableLookupSelect
                options={meta?.professions || []}
                value={form.profession}
                addNewLabel={t('employeesLookupAddNew')}
                newValuePlaceholder={t('employeesLookupPlaceholder')}
                onChange={(profession) =>
                  setForm((f) => ({...f, profession}))
                }
              />
            </label>
            <label>
              {t('employeesFieldDesignation')}
              <CreatableLookupSelect
                options={meta?.designations || []}
                value={form.designation}
                addNewLabel={t('employeesLookupAddNew')}
                newValuePlaceholder={t('employeesLookupPlaceholder')}
                onChange={(designation) =>
                  setForm((f) => ({...f, designation}))
                }
              />
            </label>
            <label>
              {t('employeesFieldDepartment')}
              <CreatableLookupSelect
                options={meta?.departments || []}
                value={form.department}
                addNewLabel={t('employeesLookupAddNew')}
                newValuePlaceholder={t('employeesLookupPlaceholder')}
                onChange={(department) =>
                  setForm((f) => ({...f, department}))
                }
              />
            </label>
            <label>
              {t('employeesFieldEmploymentType')}
              <Select
                options={employmentTypeOptions}
                value={form.employmentType}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    employmentType: v as EmploymentType,
                  }))
                }
              />
            </label>
            <label>
              {t('employeesFieldJoining')}
              <input
                className="text-input"
                type="date"
                value={form.joiningDate}
                onChange={(e) =>
                  setForm((f) => ({...f, joiningDate: e.target.value}))
                }
              />
            </label>
            <label>
              {t('employeesFieldExperience')}
              <input
                className="text-input"
                inputMode="numeric"
                value={form.professionalExperienceYears}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    professionalExperienceYears: e.target.value,
                  }))
                }
              />
            </label>
            <label>
              {t('employeesFieldLocation')}
              <input
                className="text-input"
                value={form.workLocation}
                onChange={(e) =>
                  setForm((f) => ({...f, workLocation: e.target.value}))
                }
              />
            </label>
            <label>
              {t('employeesFieldManager')}
              <Select
                options={managerOptions}
                value={form.reportingManagerId}
                showSearch
                onChange={(v) =>
                  setForm((f) => ({...f, reportingManagerId: v}))
                }
              />
            </label>
            <p className="muted emp-id-hint">{t('employeesIdAutoHint')}</p>
            <div className="form-actions">
              <Button
                variant="ghost"
                disabled={createBusy}
                onClick={() => setCreateOpen(false)}>
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                disabled={createBusy}
                onClick={() => void handleCreate()}>
                {createBusy ? t('saving') : t('employeesSave')}
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
