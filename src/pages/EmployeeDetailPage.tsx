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
  employeeAccountLabel,
  employeeStatusLabel,
  employmentTypeLabel,
  formatExperienceYears,
  generateEmployeeIdCard,
  getEmployee,
  getEmployeesPage,
  inviteEmployee,
  maskPhoneDisplay,
  revokeEmployeeInvitation,
  updateEmployee,
  updateEmployeeAccess,
  updateEmployeeStatus,
  uploadEmployeeDocument,
  uploadEmployeePhoto,
  type Employee,
  type EmployeeDocumentType,
  type EmployeeIdCardPayload,
  type EmployeeProfileAccess,
  type EmploymentType,
  type EmployeeInviteResult,
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
  const [photoBusy, setPhotoBusy] = useState(false);

  const [accessOpen, setAccessOpen] = useState(false);
  const [accessBusy, setAccessBusy] = useState(false);
  const [accessProfile, setAccessProfile] =
    useState<EmployeeProfileAccess>('view');
  const [accessRaise, setAccessRaise] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteResult, setInviteResult] =
    useState<EmployeeInviteResult | null>(null);

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

  async function onPhotoSelected(
    file: File | null,
    options?: {refreshIdCard?: boolean},
  ) {
    if (!file || !employee || !canUpdate) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setToast(t('employeesPhotoTypeError'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setToast(t('employeesPhotoSizeError'));
      return;
    }
    setPhotoBusy(true);
    try {
      const result = await uploadEmployeePhoto(employee._id, file);
      setEmployee(result.employee);
      setToast(t('employeesPhotoToast'));
      if (options?.refreshIdCard || idCardOpen) {
        const payload = await generateEmployeeIdCard(employee._id);
        setIdCard(payload);
        setIdCardOpen(true);
      }
    } catch (e) {
      setToast(
        e instanceof ApiError ? e.message : t('employeesSaveError'),
      );
    } finally {
      setPhotoBusy(false);
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
    const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!w) {
      setToast(t('employeesIdCardPopupBlocked'));
      return;
    }
    const safeName = `Akansho_Employee_ID_${idCard.employeeCode}.html`;
    const profession = idCard.profession || idCard.designation || '';
    const photo = idCard.photoUrl
      ? `<img class="photo" src="${idCard.photoUrl}" alt=""/>`
      : `<div class="photo fallback">${(idCard.fullName || '?').slice(0, 1).toUpperCase()}</div>`;
    w.document.write(`<!doctype html><html><head><title>${safeName}</title>
      <style>
        *{box-sizing:border-box}
        body{font-family:system-ui,-apple-system,sans-serif;background:#f1f5f9;margin:0;padding:24px}
        .wrap{display:flex;flex-direction:column;gap:20px;align-items:center}
        .card{width:420px;height:265px;border:1px solid #d0d7de;border-radius:14px;overflow:hidden;background:#fff;display:flex;flex-direction:column}
        .silver{height:52px;padding:0 16px;display:flex;align-items:center;justify-content:space-between;
          background:repeating-linear-gradient(0deg,rgba(255,255,255,.3) 0 1px,rgba(0,0,0,.03) 1px 2px),linear-gradient(180deg,#f6f7f9,#c9ced4);
          border-bottom:1px solid rgba(15,28,46,.1)}
        .logo{font-weight:800;letter-spacing:.14em;font-size:13px;color:#0f1c2e}
        .tag{display:block;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;font-weight:650}
        .chip{width:28px;height:20px;border-radius:4px;background:linear-gradient(135deg,#d4af37,#f5e6a3,#a67c00)}
        .front{flex:1;display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:12px 14px}
        .photo{width:72px;height:72px;border-radius:10px;object-fit:cover;border:2px solid #8bc4a4;display:flex;align-items:center;justify-content:center;background:#e8f5ee;font-weight:800;font-size:26px;color:#0f1c2e}
        .name{margin:0;font-size:15px;font-weight:800;text-transform:uppercase;color:#0f1c2e;letter-spacing:.03em}
        .role{margin:2px 0 8px;font-size:12px;font-weight:650;color:#1b7a4e}
        .fields{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;margin:0}
        .fields dt{font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#64748b;margin:0}
        .fields dd{margin:0;font-size:11px;font-weight:700;color:#0f1c2e}
        .qrcol{display:flex;flex-direction:column;align-items:center;gap:4px}
        .qr{width:58px;height:58px;border:1px solid #e2e8f0;border-radius:6px}
        .brand{font-size:10px;font-weight:750;color:#1b7a4e;letter-spacing:.08em;text-transform:uppercase}
        .back{flex:1;display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;padding:14px 16px}
        .copy{margin:0 0 6px;font-size:12px;line-height:1.4;color:#334155}
        .eid span{font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#64748b}
        .eid strong{display:block;font-size:14px;color:#0f1c2e;margin-top:2px}
        .auth{margin:6px 0 0;font-size:9px;font-weight:750;letter-spacing:.1em;text-transform:uppercase;color:#1b7a4e;text-align:center}
        @media print{body{background:#fff;padding:0}.wrap{gap:12mm}.card{box-shadow:none;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      </style></head><body>
      <div class="wrap">
        <div class="card">
          <div class="silver"><div><span class="logo">AKANSHO</span><span class="tag">Employee Identity</span></div><span class="chip"></span></div>
          <div class="front">
            ${photo}
            <div>
              <h2 class="name">${idCard.fullName}</h2>
              <p class="role">${profession}</p>
              <dl class="fields">
                <div><dt>Employee ID</dt><dd>${idCard.employeeCode}</dd></div>
                <div><dt>Experience</dt><dd>${formatExperienceYears(idCard.experienceYears)}</dd></div>
                <div><dt>Phone</dt><dd>${maskPhoneDisplay(idCard.phone)}</dd></div>
                <div><dt>Location</dt><dd>${idCard.location || '—'}</dd></div>
              </dl>
            </div>
            <div class="qrcol"><img class="qr" src="${idCard.qrDataUrl}" alt="QR"/><span class="brand">Akansho</span></div>
          </div>
        </div>
        <div class="card">
          <div class="silver"><div><span class="logo">AKANSHO</span><span class="tag">Authorized Employee</span></div></div>
          <div class="back">
            <div>
              <p class="copy">This card identifies the holder as an authorized Akansho employee.</p>
              <p class="copy">If found, please return to Akansho.</p>
              <div class="eid"><span>Employee ID</span><strong>${idCard.employeeCode}</strong></div>
            </div>
            <div><img class="qr" style="width:78px;height:78px" src="${idCard.qrDataUrl}" alt="QR"/><p class="auth">Authorized Employee</p></div>
          </div>
        </div>
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
          <div className="emp-detail__photo-block">
            <div className="emp-detail__photo" aria-hidden={!employee.photoUrl}>
              {employee.photoUrl ? (
                <img src={employee.photoUrl} alt="" />
              ) : (
                <span className="emp-avatar emp-avatar--fallback emp-avatar--lg">
                  {(employee.fullName || '?').slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            {canUpdate ? (
              <label className="emp-photo-btn">
                <span>
                  {photoBusy
                    ? t('saving')
                    : employee.photoUrl
                      ? t('employeesChangePhoto')
                      : t('employeesAddPhoto')}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={photoBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    e.target.value = '';
                    void onPhotoSelected(file);
                  }}
                />
              </label>
            ) : null}
          </div>
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

      <section className="panel emp-access-panel no-print">
        <div className="emp-access-panel__head">
          <h2>{t('employeesAccountAccess')}</h2>
          {canUpdate ? (
            <div className="emp-access-panel__actions">
              <Button
                variant="secondary"
                disabled={inviteBusy}
                onClick={() => {
                  setAccessProfile(employee.profileAccess || 'view');
                  setAccessRaise(Boolean(employee.canRaiseRequest));
                  setAccessOpen(true);
                }}>
                {t('employeesManageAccess')}
              </Button>
              <Button
                variant="primary"
                disabled={inviteBusy || !employee.email}
                onClick={() => {
                  void (async () => {
                    setInviteBusy(true);
                    try {
                      const result = await inviteEmployee(employee._id);
                      setEmployee(result.employee);
                      setInviteResult(result);
                      setToast(t('employeesInviteToast'));
                    } catch (e) {
                      setToast(
                        e instanceof ApiError
                          ? e.message
                          : t('employeesSaveError'),
                      );
                    } finally {
                      setInviteBusy(false);
                    }
                  })();
                }}>
                {inviteBusy
                  ? t('saving')
                  : employee.accountStatus === 'none' ||
                      employee.accountStatus === 'revoked'
                    ? t('employeesSendInvite')
                    : t('employeesResendInvite')}
              </Button>
            </div>
          ) : null}
        </div>
        {!employee.email ? (
          <p className="muted">{t('employeesInviteNeedsEmail')}</p>
        ) : null}
        <dl className="emp-dl emp-dl--wide">
          <div>
            <dt>{t('employeesFieldEmail')}</dt>
            <dd>{employee.email || '—'}</dd>
          </div>
          <div>
            <dt>{t('employeesAccountStatus')}</dt>
            <dd>
              {employeeAccountLabel(employee.accountStatus)}
              {employee.totpEnabled ? ` · ${t('employeesTotpOn')}` : ''}
            </dd>
          </div>
          <div>
            <dt>{t('employeesProfileAccess')}</dt>
            <dd>
              {employee.profileAccess === 'edit'
                ? t('employeesAccessEdit')
                : t('employeesAccessView')}
            </dd>
          </div>
          <div>
            <dt>{t('employeesRaiseRequest')}</dt>
            <dd>
              {employee.canRaiseRequest
                ? t('employeesRaiseAllowed')
                : t('employeesRaiseDenied')}
            </dd>
          </div>
          <div>
            <dt>{t('employeesInvitation')}</dt>
            <dd>
              {employee.inviteSentAt
                ? formatDate(employee.inviteSentAt)
                : '—'}
            </dd>
          </div>
        </dl>
      </section>

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
            {canUpdate ? (
              <div className="emp-id-photo-bar no-print">
                <p className="muted emp-id-photo-hint">
                  {idCard.photoUrl
                    ? t('employeesIdCardPhotoReady')
                    : t('employeesIdCardPhotoHint')}
                </p>
                <label className="emp-photo-btn emp-photo-btn--inline">
                  <span>
                    {photoBusy
                      ? t('saving')
                      : idCard.photoUrl
                        ? t('employeesChangePhoto')
                        : t('employeesAddPhoto')}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={photoBusy}
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      e.target.value = '';
                      void onPhotoSelected(file, {refreshIdCard: true});
                    }}
                  />
                </label>
              </div>
            ) : null}
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

      {accessOpen ? (
        <Dialog
          open
          title={t('employeesManageAccess')}
          onClose={() => {
            if (!accessBusy) setAccessOpen(false);
          }}>
          <div className="modal-form">
            <p className="modal-lead">{t('employeesAccessLead')}</p>
            <label>
              {t('employeesProfileAccess')}
              <Select
                options={[
                  {value: 'view', label: t('employeesAccessView')},
                  {value: 'edit', label: t('employeesAccessEdit')},
                ]}
                value={accessProfile}
                onChange={(v) => setAccessProfile(v as EmployeeProfileAccess)}
              />
            </label>
            <label className="emp-check">
              <input
                type="checkbox"
                checked={accessRaise}
                onChange={(e) => setAccessRaise(e.target.checked)}
              />
              <span>{t('employeesRaiseRequest')}</span>
            </label>
            <div className="form-actions">
              <Button
                variant="ghost"
                disabled={accessBusy}
                onClick={() => setAccessOpen(false)}>
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                disabled={accessBusy}
                onClick={() => {
                  void (async () => {
                    if (!employee) return;
                    setAccessBusy(true);
                    try {
                      const updated = await updateEmployeeAccess(employee._id, {
                        profileAccess: accessProfile,
                        canRaiseRequest: accessRaise,
                      });
                      setEmployee(updated);
                      setAccessOpen(false);
                      setToast(t('employeesAccessToast'));
                    } catch (e) {
                      setToast(
                        e instanceof ApiError
                          ? e.message
                          : t('employeesSaveError'),
                      );
                    } finally {
                      setAccessBusy(false);
                    }
                  })();
                }}>
                {accessBusy ? t('saving') : t('save')}
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}

      {inviteResult ? (
        <Dialog
          open
          title={t('employeesInviteReady')}
          onClose={() => setInviteResult(null)}>
          <div className="modal-form">
            <p className="modal-lead">{t('employeesInviteLead')}</p>
            <p className="muted">
              {t('employeesInviteExpires', {
                date: formatDate(inviteResult.expiresAt),
              })}
            </p>
            <label>
              {t('employeesActivationLink')}
              <input
                className="text-input"
                readOnly
                value={inviteResult.activationLink}
                onFocus={(e) => e.target.select()}
              />
            </label>
            <div className="form-actions">
              <Button variant="ghost" onClick={() => setInviteResult(null)}>
                {t('cancel')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    inviteResult.activationLink,
                  );
                  setToast(t('employeesLinkCopied'));
                }}>
                {t('employeesCopyLink')}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  window.open(inviteResult.whatsappUrl, '_blank', 'noopener');
                }}>
                {t('employeesShareWhatsApp')}
              </Button>
              {employee.accountStatus === 'invited' ||
              employee.accountStatus === 'activation_pending' ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    void (async () => {
                      try {
                        const updated = await revokeEmployeeInvitation(
                          employee._id,
                        );
                        setEmployee(updated);
                        setInviteResult(null);
                        setToast(t('employeesInviteRevoked'));
                      } catch (e) {
                        setToast(
                          e instanceof ApiError
                            ? e.message
                            : t('employeesSaveError'),
                        );
                      }
                    })();
                  }}>
                  {t('employeesRevokeInvite')}
                </Button>
              ) : null}
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
