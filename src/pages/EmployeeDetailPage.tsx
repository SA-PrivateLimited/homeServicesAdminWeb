import {useCallback, useEffect, useMemo, useState} from 'react';
import {Link, useParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {
  Button,
  Dialog,
  Select,
  StatusChip,
} from 'sapvt-ltd-web-packages';
import {EmployeeIdCard} from '../components/EmployeeIdCard/EmployeeIdCard';
import {usePermissions} from '../hooks/usePermissions';
import {PERMISSIONS} from '../constants/permissions';
import {ApiError} from '../services/api/apiClient';
import {
  addEmployeeCompensation,
  deleteEmployeeDocument,
  employeeStatusLabel,
  employmentTypeLabel,
  formatExperienceYears,
  generateEmployeeIdCard,
  getEmployee,
  getEmployeesPage,
  maskPhoneDisplay,
  updateEmployee,
  updateEmployeeStatus,
  uploadEmployeeDocument,
  uploadEmployeePhoto,
  type Employee,
  type EmployeeDocumentType,
  type EmployeeIdCardPayload,
  type EmploymentType,
} from '../services/api/employeesApi';
import {localTenDigits, toE164} from '../utils/phone';
import '../styles/pages.css';
import './EmployeeDetailPage.css';

type TabKey =
  | 'overview'
  | 'employment'
  | 'compensation'
  | 'documents'
  | 'activity';

function statusChipStatus(status: string): string {
  if (status === 'active') return 'active';
  if (status === 'on_leave') return 'pending';
  if (status === 'former') return 'cancelled';
  return 'inactive';
}

function formatDate(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatMoney(amount?: number) {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}

export function EmployeeDetailPage() {
  const {employeeId = ''} = useParams();
  const {t} = useTranslation();
  const {hasPermission} = usePermissions();

  const canUpdate = hasPermission(PERMISSIONS.EMPLOYEES_UPDATE);
  const canSalary = hasPermission(PERMISSIONS.EMPLOYEES_SALARY);
  const canDocs = hasPermission(PERMISSIONS.EMPLOYEES_DOCUMENTS);
  const canIdCard = hasPermission(PERMISSIONS.EMPLOYEES_ID_CARD);
  const canDeactivate = hasPermission(PERMISSIONS.EMPLOYEES_DEACTIVATE);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('overview');

  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    profession: '',
    designation: '',
    department: '',
    employmentType: 'full_time' as EmploymentType,
    joiningDate: '',
    confirmationDate: '',
    professionalExperienceYears: '',
    workLocation: '',
    reportingManagerId: '',
    gender: '',
    dateOfBirth: '',
  });
  const [managerOptions, setManagerOptions] = useState<
    Array<{value: string; label: string}>
  >([{value: '', label: '—'}]);

  const [salaryOpen, setSalaryOpen] = useState(false);
  const [salaryBusy, setSalaryBusy] = useState(false);
  const [salaryError, setSalaryError] = useState<string | null>(null);
  const [salaryForm, setSalaryForm] = useState({
    amount: '',
    effectiveFrom: '',
    reason: '',
  });

  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateBusy, setDeactivateBusy] = useState(false);

  const [idCard, setIdCard] = useState<EmployeeIdCardPayload | null>(null);
  const [idCardOpen, setIdCardOpen] = useState(false);
  const [idCardBusy, setIdCardBusy] = useState(false);
  const [idCardError, setIdCardError] = useState<string | null>(null);

  const [docType, setDocType] = useState<EmployeeDocumentType>('other');
  const [docBusy, setDocBusy] = useState(false);

  const load = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getEmployee(employeeId);
      setEmployee(data);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : t('employeesLoadError'),
      );
      setEmployee(null);
    } finally {
      setLoading(false);
    }
  }, [employeeId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const tabs = useMemo(() => {
    const list: Array<{key: TabKey; label: string; show: boolean}> = [
      {key: 'overview', label: t('employeesTabOverview'), show: true},
      {key: 'employment', label: t('employeesTabEmployment'), show: true},
      {
        key: 'compensation',
        label: t('employeesTabCompensation'),
        show: canSalary,
      },
      {
        key: 'documents',
        label: t('employeesTabDocuments'),
        show: canDocs,
      },
      {key: 'activity', label: t('employeesTabActivity'), show: true},
    ];
    return list.filter((x) => x.show);
  }, [canDocs, canSalary, t]);

  function openEdit() {
    if (!employee) return;
    setEditForm({
      fullName: employee.fullName || '',
      phone: localTenDigits(employee.phone),
      email: employee.email || '',
      profession: employee.profession || '',
      designation: employee.designation || '',
      department: employee.department || '',
      employmentType: employee.employmentType || 'full_time',
      joiningDate: employee.joiningDate
        ? employee.joiningDate.slice(0, 10)
        : '',
      confirmationDate: employee.confirmationDate
        ? employee.confirmationDate.slice(0, 10)
        : '',
      professionalExperienceYears: String(
        employee.professionalExperienceYears ?? '',
      ),
      workLocation: employee.workLocation || '',
      reportingManagerId: employee.reportingManagerId
        ? String(employee.reportingManagerId)
        : '',
      gender: employee.gender || '',
      dateOfBirth: employee.dateOfBirth
        ? employee.dateOfBirth.slice(0, 10)
        : '',
    });
    setEditError(null);
    setEditOpen(true);
    void (async () => {
      try {
        const managers = await getEmployeesPage({
          status: 'active',
          limit: 100,
          offset: 0,
        });
        setManagerOptions([
          {value: '', label: '—'},
          ...managers.items
            .filter((m) => m._id !== employee._id)
            .map((e) => ({
              value: e._id,
              label: `${e.fullName} · ${e.designation || e.profession || '—'} · ${e.employeeCode}`,
            })),
        ]);
      } catch {
        setManagerOptions([{value: '', label: '—'}]);
      }
    })();
  }

  async function saveEdit() {
    if (!employee) return;
    const ten = localTenDigits(editForm.phone);
    if (!editForm.fullName.trim() || ten.length !== 10) {
      setEditError(t('employeesSaveError'));
      return;
    }
    setEditBusy(true);
    setEditError(null);
    try {
      const updated = await updateEmployee(employee._id, {
        fullName: editForm.fullName.trim(),
        phone: toE164(ten),
        email: editForm.email.trim(),
        profession: editForm.profession.trim(),
        designation: editForm.designation.trim(),
        department: editForm.department.trim(),
        employmentType: editForm.employmentType,
        joiningDate: editForm.joiningDate || undefined,
        confirmationDate: editForm.confirmationDate || undefined,
        professionalExperienceYears: editForm.professionalExperienceYears
          ? Number(editForm.professionalExperienceYears)
          : 0,
        workLocation: editForm.workLocation.trim(),
        reportingManagerId: editForm.reportingManagerId || null,
        gender: editForm.gender,
        dateOfBirth: editForm.dateOfBirth || undefined,
      });
      setEmployee(updated);
      setEditOpen(false);
      setToast(t('employeesUpdatedToast'));
    } catch (e) {
      setEditError(
        e instanceof ApiError ? e.message : t('employeesSaveError'),
      );
    } finally {
      setEditBusy(false);
    }
  }

  async function saveSalary() {
    if (!employee) return;
    const amount = Number(salaryForm.amount);
    if (!Number.isFinite(amount) || amount < 0 || !salaryForm.effectiveFrom) {
      setSalaryError(t('employeesSalaryValidation'));
      return;
    }
    setSalaryBusy(true);
    setSalaryError(null);
    try {
      const updated = await addEmployeeCompensation(employee._id, {
        amount,
        effectiveFrom: salaryForm.effectiveFrom,
        reason: salaryForm.reason.trim() || undefined,
      });
      setEmployee(updated);
      setSalaryOpen(false);
      setToast(t('employeesSalaryToast'));
    } catch (e) {
      setSalaryError(
        e instanceof ApiError ? e.message : t('employeesSaveError'),
      );
    } finally {
      setSalaryBusy(false);
    }
  }

  async function confirmDeactivate() {
    if (!employee) return;
    setDeactivateBusy(true);
    try {
      const updated = await updateEmployeeStatus(employee._id, 'former');
      setEmployee(updated);
      setDeactivateOpen(false);
      setToast(t('employeesDeactivatedToast'));
    } catch (e) {
      setToast(
        e instanceof ApiError ? e.message : t('employeesSaveError'),
      );
    } finally {
      setDeactivateBusy(false);
    }
  }

  async function handleGenerateIdCard() {
    if (!employee) return;
    setIdCardBusy(true);
    setIdCardError(null);
    try {
      const payload = await generateEmployeeIdCard(employee._id);
      setIdCard(payload);
      setIdCardOpen(true);
      setToast(t('employeesIdCardToast'));
      void load();
    } catch (e) {
      setIdCardError(
        e instanceof ApiError ? e.message : t('employeesIdCardError'),
      );
    } finally {
      setIdCardBusy(false);
    }
  }

  async function onPhotoSelected(file: File | null) {
    if (!file || !employee || !canUpdate) return;
    if (!file.type.startsWith('image/')) {
      setToast(t('employeesPhotoTypeError'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setToast(t('employeesPhotoSizeError'));
      return;
    }
    try {
      const result = await uploadEmployeePhoto(employee._id, file);
      setEmployee(result.employee);
      setToast(t('employeesPhotoToast'));
    } catch (e) {
      setToast(
        e instanceof ApiError ? e.message : t('employeesSaveError'),
      );
    }
  }

  async function onDocSelected(file: File | null) {
    if (!file || !employee || !canDocs) return;
    setDocBusy(true);
    try {
      const updated = await uploadEmployeeDocument(
        employee._id,
        file,
        docType,
      );
      setEmployee(updated);
      setToast(t('employeesDocToast'));
    } catch (e) {
      setToast(
        e instanceof ApiError ? e.message : t('employeesSaveError'),
      );
    } finally {
      setDocBusy(false);
    }
  }

  async function removeDoc(documentId: string) {
    if (!employee) return;
    try {
      const updated = await deleteEmployeeDocument(employee._id, documentId);
      setEmployee(updated);
      setToast(t('employeesDocDeletedToast'));
    } catch (e) {
      setToast(
        e instanceof ApiError ? e.message : t('employeesSaveError'),
      );
    }
  }

  function printIdCard() {
    window.print();
  }

  function downloadIdCard() {
    if (!idCard) return;
    const w = window.open('', '_blank', 'noopener,noreferrer,width=800,height=900');
    if (!w) {
      setToast(t('employeesIdCardPopupBlocked'));
      return;
    }
    const safeName = `Akanso_Employee_ID_${idCard.employeeCode}.html`;
    w.document.write(`<!doctype html><html><head><title>${safeName}</title>
      <style>
        body{font-family:system-ui,sans-serif;background:#f8fafc;padding:24px}
        img{max-width:100%}
        .wrap{display:flex;flex-wrap:wrap;gap:24px;justify-content:center}
        .card{width:340px;border:1px solid #cbd5e1;border-radius:16px;overflow:hidden;background:#fff}
        .silver{padding:12px 16px;background:linear-gradient(180deg,#f4f5f7,#c8ced3)}
        .body{padding:16px;text-align:center}
        h1{font-size:14px;letter-spacing:.12em;margin:0}
        h2{margin:8px 0 0;font-size:18px}
        .qr{width:72px;height:72px;margin-top:12px}
      </style></head><body>
      <div class="wrap">
        <div class="card"><div class="silver"><h1>AKANSO · EMPLOYEE IDENTITY</h1></div>
        <div class="body">
          ${idCard.photoUrl ? `<img src="${idCard.photoUrl}" width="72" height="72" style="border-radius:50%;object-fit:cover"/>` : ''}
          <h2>${idCard.fullName}</h2>
          <p>${idCard.profession || ''}</p>
          <p><strong>${idCard.employeeCode}</strong></p>
          <p>${formatExperienceYears(idCard.experienceYears)} · ${maskPhoneDisplay(idCard.phone)}</p>
          <p>${idCard.location || ''}</p>
          <img class="qr" src="${idCard.qrDataUrl}" alt="QR"/>
        </div></div>
        <div class="card"><div class="silver"><h1>AKANSO</h1></div>
        <div class="body">
          <p>This card identifies the holder as an authorized Akanso employee.</p>
          <p>If found, please return to Akanso.</p>
          <p><strong>${idCard.employeeCode}</strong></p>
          <img class="qr" src="${idCard.qrDataUrl}" alt="QR"/>
          <p>Authorized Employee</p>
        </div></div>
      </div>
      <script>setTimeout(function(){window.print()},400)</script>
      </body></html>`);
    w.document.close();
  }

  if (loading) {
    return (
      <div className="admin-page scale-baseline-80">
        <p className="muted">{t('loading')}</p>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="admin-page scale-baseline-80">
        <p className="error-text">{error || t('employeesLoadError')}</p>
        <Link to="/hr/employees">{t('employeesBack')}</Link>
      </div>
    );
  }

  const history = [...(employee.compensationHistory || [])].sort((a, b) => {
    return (
      new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()
    );
  });

  return (
    <div className="admin-page scale-baseline-80 emp-detail" data-testid="employee-detail">
      <div className="emp-detail__nav no-print">
        <Link to="/hr/employees" className="emp-back">
          ← {t('employeesBack')}
        </Link>
      </div>

      {toast ? (
        <div className="emp-toast no-print" role="status">
          {toast}
        </div>
      ) : null}

      <header className="emp-detail__hero no-print">
        <div className="emp-detail__identity">
          <label className="emp-detail__photo">
            {employee.photoUrl ? (
              <img src={employee.photoUrl} alt="" />
            ) : (
              <span className="emp-avatar emp-avatar--fallback emp-avatar--lg">
                {(employee.fullName || '?').slice(0, 1).toUpperCase()}
              </span>
            )}
            {canUpdate ? (
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) =>
                  void onPhotoSelected(e.target.files?.[0] || null)
                }
              />
            ) : null}
          </label>
          <div>
            <div className="emp-detail__title-row">
              <h1>{employee.fullName}</h1>
              <StatusChip
                status={statusChipStatus(employee.status)}
                label={employeeStatusLabel(employee.status)}
              />
            </div>
            <p className="emp-detail__role">
              {employee.profession || employee.designation || '—'}
            </p>
            <p className="muted">{employee.employeeCode}</p>
          </div>
        </div>
        <div className="emp-detail__actions">
          {canIdCard ? (
            <Button
              variant="primary"
              disabled={idCardBusy}
              onClick={() => void handleGenerateIdCard()}>
              {idCardBusy
                ? t('employeesIdCardGenerating')
                : t('employeesGenerateIdCard')}
            </Button>
          ) : null}
          {canUpdate ? (
            <Button variant="secondary" onClick={openEdit}>
              {t('employeesEdit')}
            </Button>
          ) : null}
          {canDeactivate && employee.status !== 'former' ? (
            <Button variant="ghost" onClick={() => setDeactivateOpen(true)}>
              {t('employeesDeactivate')}
            </Button>
          ) : null}
        </div>
        {idCardError ? <p className="error-text">{idCardError}</p> : null}
      </header>

      <div className="emp-tabs no-print" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={
              tab === item.key ? 'emp-tab emp-tab--active' : 'emp-tab'
            }
            onClick={() => setTab(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      <section className="panel emp-section no-print">
        {tab === 'overview' ? (
          <div className="emp-grid">
            <div>
              <h2>{t('employeesPersonal')}</h2>
              <dl className="emp-dl">
                <div>
                  <dt>{t('employeesFieldPhone')}</dt>
                  <dd>{maskPhoneDisplay(employee.phone)}</dd>
                </div>
                <div>
                  <dt>{t('employeesFieldEmail')}</dt>
                  <dd>{employee.email || '—'}</dd>
                </div>
                <div>
                  <dt>{t('employeesFieldDob')}</dt>
                  <dd>{formatDate(employee.dateOfBirth)}</dd>
                </div>
                <div>
                  <dt>{t('employeesFieldGender')}</dt>
                  <dd>{employee.gender || '—'}</dd>
                </div>
                <div>
                  <dt>{t('employeesFieldAddress')}</dt>
                  <dd>
                    {[
                      employee.address?.line1,
                      employee.address?.city,
                      employee.address?.district,
                      employee.address?.state,
                      employee.address?.pincode,
                    ]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </dd>
                </div>
              </dl>
            </div>
            <div>
              <h2>{t('employeesProfessional')}</h2>
              <dl className="emp-dl">
                <div>
                  <dt>{t('employeesFieldProfession')}</dt>
                  <dd>{employee.profession || '—'}</dd>
                </div>
                <div>
                  <dt>{t('employeesFieldDesignation')}</dt>
                  <dd>{employee.designation || '—'}</dd>
                </div>
                <div>
                  <dt>{t('employeesFieldDepartment')}</dt>
                  <dd>{employee.department || '—'}</dd>
                </div>
                <div>
                  <dt>{t('employeesFieldExperience')}</dt>
                  <dd>
                    {formatExperienceYears(
                      employee.professionalExperienceYears,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t('employeesFieldLocation')}</dt>
                  <dd>{employee.workLocation || '—'}</dd>
                </div>
              </dl>
            </div>
          </div>
        ) : null}

        {tab === 'employment' ? (
          <dl className="emp-dl emp-dl--wide">
            <div>
              <dt>{t('employeesFieldCode')}</dt>
              <dd>{employee.employeeCode}</dd>
            </div>
            <div>
              <dt>{t('employeesFieldEmploymentType')}</dt>
              <dd>{employmentTypeLabel(employee.employmentType)}</dd>
            </div>
            <div>
              <dt>{t('employeesFieldJoining')}</dt>
              <dd>{formatDate(employee.joiningDate)}</dd>
            </div>
            <div>
              <dt>{t('employeesFieldConfirmation')}</dt>
              <dd>{formatDate(employee.confirmationDate)}</dd>
            </div>
            <div>
              <dt>{t('employeesFieldManager')}</dt>
              <dd>
                {employee.reportingManagerName
                  ? `${employee.reportingManagerName} (${employee.reportingManagerCode || '—'})`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>{t('employeesColStatus')}</dt>
              <dd>{employeeStatusLabel(employee.status)}</dd>
            </div>
            {employee.status === 'former' ? (
              <>
                <div>
                  <dt>{t('employeesFieldLeaving')}</dt>
                  <dd>{formatDate(employee.leavingDate)}</dd>
                </div>
                <div>
                  <dt>{t('employeesFieldLeavingReason')}</dt>
                  <dd>{employee.leavingReason || '—'}</dd>
                </div>
              </>
            ) : null}
          </dl>
        ) : null}

        {tab === 'compensation' && canSalary ? (
          <div>
            <div className="emp-comp-current">
              <div>
                <h2>{t('employeesCurrentSalary')}</h2>
                <p className="emp-salary-amount">
                  {employee.currentSalary
                    ? `${formatMoney(employee.currentSalary.amount)} / month`
                    : t('employeesNoSalary')}
                </p>
                {employee.currentSalary ? (
                  <p className="muted">
                    {t('employeesEffectiveFrom')}:{' '}
                    {formatDate(employee.currentSalary.effectiveFrom)}
                  </p>
                ) : null}
              </div>
              <Button
                variant="primary"
                onClick={() => {
                  setSalaryForm({
                    amount: '',
                    effectiveFrom: new Date().toISOString().slice(0, 10),
                    reason: '',
                  });
                  setSalaryError(null);
                  setSalaryOpen(true);
                }}>
                {t('employeesEditSalary')}
              </Button>
            </div>
            {employee.bank ? (
              <dl className="emp-dl" style={{marginTop: 24}}>
                <div>
                  <dt>{t('employeesBankAccount')}</dt>
                  <dd>
                    {employee.bank.accountNumberMasked ||
                      employee.bank.accountNumber ||
                      '—'}
                  </dd>
                </div>
                <div>
                  <dt>IFSC</dt>
                  <dd>{employee.bank.ifsc || '—'}</dd>
                </div>
                <div>
                  <dt>UAN</dt>
                  <dd>{employee.bank.uan || '—'}</dd>
                </div>
                <div>
                  <dt>ESI</dt>
                  <dd>{employee.bank.esi || '—'}</dd>
                </div>
              </dl>
            ) : null}
            <h3 style={{marginTop: 28}}>{t('employeesSalaryHistory')}</h3>
            {history.length === 0 ? (
              <p className="muted">{t('employeesNoSalary')}</p>
            ) : (
              <ul className="emp-history">
                {history.map((row) => (
                  <li key={row._id || `${row.effectiveFrom}-${row.amount}`}>
                    <strong>{formatDate(row.effectiveFrom)}</strong>
                    <span>
                      {formatMoney(row.amount)} / {row.salaryType || 'month'}
                    </span>
                    {row.reason ? (
                      <span className="muted">{row.reason}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {tab === 'documents' && canDocs ? (
          <div>
            <div className="emp-doc-upload">
              <Select
                options={[
                  {value: 'aadhaar', label: 'Aadhaar'},
                  {value: 'pan', label: 'PAN'},
                  {value: 'address_proof', label: 'Address Proof'},
                  {value: 'joining_letter', label: 'Joining Letter'},
                  {
                    value: 'employment_agreement',
                    label: 'Employment Agreement',
                  },
                  {value: 'other', label: 'Other'},
                ]}
                value={docType}
                onChange={(v) => setDocType(v as EmployeeDocumentType)}
              />
              <label className="emp-file-btn">
                <span>{docBusy ? t('saving') : t('employeesUploadDoc')}</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  disabled={docBusy}
                  className="sr-only"
                  onChange={(e) =>
                    void onDocSelected(e.target.files?.[0] || null)
                  }
                />
              </label>
            </div>
            {(employee.documents || []).length === 0 ? (
              <p className="muted">{t('employeesNoDocs')}</p>
            ) : (
              <ul className="emp-doc-list">
                {(employee.documents || []).map((doc) => (
                  <li key={doc._id}>
                    <div>
                      <strong>{doc.type.replace(/_/g, ' ')}</strong>
                      <span className="muted">
                        {formatDate(doc.uploadedAt)} ·{' '}
                        {doc.uploadedByName || 'HR'}
                      </span>
                    </div>
                    <div className="emp-doc-actions">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer">
                        {t('employeesViewDoc')}
                      </a>
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => void removeDoc(doc._id)}>
                        {t('delete')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {tab === 'activity' ? (
          (employee.activity || []).length === 0 ? (
            <p className="muted">{t('employeesNoActivity')}</p>
          ) : (
            <ul className="emp-history">
              {(employee.activity || []).map((item, idx) => (
                <li key={item._id || `${item.createdAt}-${idx}`}>
                  <strong>{formatDate(item.createdAt)}</strong>
                  <span>{item.summary}</span>
                  {item.detail ? (
                    <span className="muted">{item.detail}</span>
                  ) : null}
                  <span className="muted">
                    {t('employeesBy')} {item.createdByName || 'HR'}
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>

      {editOpen ? (
        <Dialog
          open
          title={t('employeesEdit')}
          onClose={() => {
            if (!editBusy) setEditOpen(false);
          }}>
          <div className="modal-form">
            {editError ? <p className="error-text">{editError}</p> : null}
            <label>
              {t('employeesFieldCode')}
              <input
                className="text-input"
                value={employee.employeeCode}
                disabled
                readOnly
              />
            </label>
            <label>
              {t('employeesFieldName')} *
              <input
                className="text-input"
                value={editForm.fullName}
                onChange={(e) =>
                  setEditForm((f) => ({...f, fullName: e.target.value}))
                }
              />
            </label>
            <label>
              {t('employeesFieldPhone')} *
              <input
                className="text-input"
                inputMode="tel"
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm((f) => ({...f, phone: e.target.value}))
                }
              />
            </label>
            <label>
              {t('employeesFieldEmail')}
              <input
                className="text-input"
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm((f) => ({...f, email: e.target.value}))
                }
              />
            </label>
            <label>
              {t('employeesFieldProfession')}
              <input
                className="text-input"
                value={editForm.profession}
                onChange={(e) =>
                  setEditForm((f) => ({...f, profession: e.target.value}))
                }
              />
            </label>
            <label>
              {t('employeesFieldDesignation')}
              <input
                className="text-input"
                value={editForm.designation}
                onChange={(e) =>
                  setEditForm((f) => ({...f, designation: e.target.value}))
                }
              />
            </label>
            <label>
              {t('employeesFieldDepartment')}
              <input
                className="text-input"
                value={editForm.department}
                onChange={(e) =>
                  setEditForm((f) => ({...f, department: e.target.value}))
                }
              />
            </label>
            <label>
              {t('employeesFieldEmploymentType')}
              <Select
                options={[
                  {value: 'full_time', label: 'Full Time'},
                  {value: 'part_time', label: 'Part Time'},
                  {value: 'contract', label: 'Contract'},
                  {value: 'intern', label: 'Intern'},
                  {value: 'other', label: 'Other'},
                ]}
                value={editForm.employmentType}
                onChange={(v) =>
                  setEditForm((f) => ({
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
                value={editForm.joiningDate}
                onChange={(e) =>
                  setEditForm((f) => ({...f, joiningDate: e.target.value}))
                }
              />
            </label>
            <label>
              {t('employeesFieldConfirmation')}
              <input
                className="text-input"
                type="date"
                value={editForm.confirmationDate}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    confirmationDate: e.target.value,
                  }))
                }
              />
            </label>
            <label>
              {t('employeesFieldExperience')}
              <input
                className="text-input"
                inputMode="numeric"
                value={editForm.professionalExperienceYears}
                onChange={(e) =>
                  setEditForm((f) => ({
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
                value={editForm.workLocation}
                onChange={(e) =>
                  setEditForm((f) => ({...f, workLocation: e.target.value}))
                }
              />
            </label>
            <label>
              {t('employeesFieldManager')}
              <Select
                options={managerOptions}
                value={editForm.reportingManagerId}
                showSearch
                onChange={(v) =>
                  setEditForm((f) => ({...f, reportingManagerId: v}))
                }
              />
            </label>
            <div className="form-actions">
              <Button
                variant="ghost"
                disabled={editBusy}
                onClick={() => setEditOpen(false)}>
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                disabled={editBusy}
                onClick={() => void saveEdit()}>
                {editBusy ? t('saving') : t('save')}
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}

      {salaryOpen ? (
        <Dialog
          open
          title={t('employeesUpdateSalary')}
          onClose={() => {
            if (!salaryBusy) setSalaryOpen(false);
          }}>
          <div className="modal-form">
            {salaryError ? <p className="error-text">{salaryError}</p> : null}
            <p className="muted">
              {t('employeesCurrentSalary')}:{' '}
              {employee.currentSalary
                ? formatMoney(employee.currentSalary.amount)
                : '—'}
            </p>
            <label>
              {t('employeesNewSalary')} *
              <input
                className="text-input"
                inputMode="numeric"
                value={salaryForm.amount}
                onChange={(e) =>
                  setSalaryForm((f) => ({...f, amount: e.target.value}))
                }
              />
            </label>
            <label>
              {t('employeesEffectiveFrom')} *
              <input
                className="text-input"
                type="date"
                value={salaryForm.effectiveFrom}
                onChange={(e) =>
                  setSalaryForm((f) => ({
                    ...f,
                    effectiveFrom: e.target.value,
                  }))
                }
              />
            </label>
            <label>
              {t('employeesSalaryReason')}
              <input
                className="text-input"
                value={salaryForm.reason}
                onChange={(e) =>
                  setSalaryForm((f) => ({...f, reason: e.target.value}))
                }
              />
            </label>
            <div className="form-actions">
              <Button
                variant="ghost"
                disabled={salaryBusy}
                onClick={() => setSalaryOpen(false)}>
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                disabled={salaryBusy}
                onClick={() => void saveSalary()}>
                {salaryBusy ? t('saving') : t('save')}
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}

      {deactivateOpen ? (
        <Dialog
          open
          title={t('employeesDeactivateTitle')}
          onClose={() => {
            if (!deactivateBusy) setDeactivateOpen(false);
          }}>
          <p className="modal-lead">
            {t('employeesDeactivateLead', {name: employee.fullName})}
          </p>
          <div className="form-actions">
            <Button
              variant="ghost"
              disabled={deactivateBusy}
              onClick={() => setDeactivateOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={deactivateBusy}
              onClick={() => void confirmDeactivate()}>
              {deactivateBusy ? t('saving') : t('employeesDeactivate')}
            </Button>
          </div>
        </Dialog>
      ) : null}

      {idCardOpen && idCard ? (
        <Dialog
          open
          title={t('employeesIdCardPreview')}
          onClose={() => setIdCardOpen(false)}>
          <div className="emp-id-preview">
            <EmployeeIdCard card={idCard} />
            <div className="form-actions no-print">
              <Button variant="ghost" onClick={() => setIdCardOpen(false)}>
                {t('cancel')}
              </Button>
              <Button variant="secondary" onClick={downloadIdCard}>
                {t('employeesIdCardDownload')}
              </Button>
              <Button variant="primary" onClick={printIdCard}>
                {t('employeesIdCardPrint')}
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
