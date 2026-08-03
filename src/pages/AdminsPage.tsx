import {useCallback, useEffect, useMemo, useState} from 'react';
import {Navigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {Icon, VirtualTable, type VirtualTableColumn} from 'sapvt-ltd-web-packages';
import {Modal} from '../components/Modal';
import {
  SuccessBanner,
  userLabel,
  type SuccessBannerContent,
} from '../components/SuccessBanner';
import {
  createUser,
  deleteUser,
  getUsersPage,
  resetUserMfa,
  setUserPassword,
  type User,
} from '../services/api/usersApi';
import {useAuthStore} from '../store/authStore';
import {formatPhoneDisplay, localTenDigits, phoneSearchValue, toE164} from '../utils/phone';
import '../styles/pages.css';

const MIN_PASSWORD_LENGTH = 8;
const PAGE_SIZE = 50;

function generateAdminPassword(length = 12): string {
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export function AdminsPage() {
  const {t} = useTranslation();
  const currentUser = useAuthStore((s) => s.user);
  const superAdminElevated = useAuthStore((s) => s.superAdminElevated);
  const [rows, setRows] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [mfaTarget, setMfaTarget] = useState<User | null>(null);
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] =
    useState<SuccessBannerContent | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getUsersPage({
        role: 'admin',
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setRows(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [page, t]);

  useEffect(() => {
    if (!superAdminElevated) return;
    void load();
  }, [load, superAdminElevated]);

  useEffect(() => {
    if (!successBanner) return;
    const timer = window.setTimeout(() => setSuccessBanner(null), 10000);
    return () => window.clearTimeout(timer);
  }, [successBanner]);

  if (!superAdminElevated) {
    return <Navigate to="/" replace />;
  }

  const closePasswordModal = () => {
    setPasswordUser(null);
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setPasswordError(null);
    setSavingPassword(false);
  };

  const openPasswordModal = (user: User) => {
    setPasswordUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setPasswordError(null);
  };

  const closeCreateModal = () => {
    setCreateOpen(false);
    setCreateName('');
    setCreateEmail('');
    setCreatePhone('');
    setCreatePassword('');
    setCreateError(null);
    setCreating(false);
  };

  const onSavePassword = async () => {
    if (!passwordUser) return;
    setPasswordError(null);
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(t('passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwordMismatch'));
      return;
    }
    setSavingPassword(true);
    try {
      await setUserPassword(passwordUser._id, newPassword);
      const {name} = userLabel(passwordUser);
      closePasswordModal();
      setSuccessBanner({
        title: t('passwordUpdatedTitle'),
        detail: t('passwordUpdatedDetail', {name}),
      });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setSavingPassword(false);
    }
  };

  const onResetMfa = async () => {
    if (!mfaTarget) return;
    setMfaBusy(true);
    setMfaError(null);
    try {
      await resetUserMfa(mfaTarget._id);
      const {name} = userLabel(mfaTarget);
      setMfaTarget(null);
      setSuccessBanner({
        title: t('mfaResetTitle'),
        detail: t('mfaResetDetail', {name}),
      });
      await load();
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setMfaBusy(false);
    }
  };

  const onCreateAdmin = async () => {
    setCreateError(null);
    if (!createEmail.trim()) {
      setCreateError(t('emailRequired'));
      return;
    }
    const ten = localTenDigits(createPhone);
    if (createPhone.trim() && ten.length !== 10) {
      setCreateError(t('phoneTenDigits'));
      return;
    }
    if (!createPassword || createPassword.length < MIN_PASSWORD_LENGTH) {
      setCreateError(t('passwordTooShort'));
      return;
    }
    setCreating(true);
    try {
      const created = await createUser({
        name: createName.trim() || undefined,
        email: createEmail.trim(),
        phone: ten.length === 10 ? toE164(ten) : undefined,
        role: 'admin',
        password: createPassword,
      });
      const {name} = userLabel(created);
      closeCreateModal();
      setSuccessBanner({
        title: t('userCreatedTitle'),
        detail: t('userCreatedDetail', {name}),
      });
      setPage(0);
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setCreating(false);
    }
  };

  const onDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    setBusyId(deleteTarget._id);
    try {
      const {name} = userLabel(deleteTarget);
      await deleteUser(deleteTarget._id);
      setDeleteTarget(null);
      setSuccessBanner({
        title: t('userDeletedTitle'),
        detail: t('userDeletedDetail', {name}),
      });
      await load();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setDeleting(false);
      setBusyId(null);
    }
  };

  const columns = useMemo<VirtualTableColumn<User>[]>(
    () => [
      {
        key: 'name',
        header: 'Name',
        filterable: true,
        filterPlaceholder: 'Search name',
        filterValue: (row) => row.name || row.displayName || '',
        render: (row) => row.name || row.displayName || '—',
      },
      {
        key: 'email',
        header: 'Email',
        filterable: true,
        filterPlaceholder: 'Filter email',
        filterValue: (row) => row.email || '',
        render: (row) => row.email || '—',
      },
      {
        key: 'phone',
        header: 'Phone',
        filterable: true,
        filterPlaceholder: 'Filter phone',
        filterValue: (row) => phoneSearchValue(row.phone, row.phoneNumber),
        render: (row) => formatPhoneDisplay(row.phone, row.phoneNumber),
      },
      {
        key: 'role',
        header: t('role'),
        width: '7rem',
        render: () => <span className="badge badge-approved">admin</span>,
      },
      {
        key: 'mfa',
        header: t('mfaColumn'),
        width: '10rem',
        render: (row) =>
          row.totpEnabled ? (
            <span className="badge badge-approved">{t('mfaEnabled')}</span>
          ) : (
            <span className="badge badge-pending">{t('mfaNotSet')}</span>
          ),
      },
      {
        key: 'password',
        header: t('password'),
        render: (row) => (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => openPasswordModal(row)}>
            {t('setPassword')}
          </button>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        width: '12rem',
        render: (row) => {
          const isSelf =
            currentUser?.id === row._id || currentUser?.email === row.email;
          return (
            <span className="actions table-actions">
              <button
                type="button"
                className="btn btn-ghost icon-only"
                disabled={busyId === row._id}
                aria-label={t('resetMfa')}
                title={t('resetMfa')}
                onClick={() => {
                  setMfaTarget(row);
                  setMfaError(null);
                }}>
                <Icon name="phonelink_lock" size={18} />
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={isSelf || busyId === row._id}
                onClick={() => {
                  setDeleteTarget(row);
                  setDeleteError(null);
                  setBusyId(null);
                }}>
                {t('delete')}
              </button>
            </span>
          );
        },
      },
    ],
    [busyId, currentUser?.email, currentUser?.id, t],
  );

  return (
    <div className="admin-page scale-baseline-80" data-testid="admins-root">
      <header className="page-header">
        <h1>{t('adminsTitle')}</h1>
        <p>{t('adminsLead')}</p>
      </header>

      {successBanner ? (
        <SuccessBanner
          banner={successBanner}
          onDismiss={() => setSuccessBanner(null)}
          testId="admins-success-banner"
        />
      ) : null}

      <div className="filter-row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setCreateOpen(true)}>
          {t('addAdmin')}
        </button>
      </div>

      <div className="panel">
        {error ? <p className="error-text">{error}</p> : null}
        <VirtualTable
          columns={columns}
          data={rows}
          rowKey={(row) => row._id}
          height={480}
          pageSize={PAGE_SIZE}
          emptyMessage={t('empty')}
          filterDebounceMs={300}
          loading={loading}
          loadingMessage={t('loading')}
          serverPagination={{
            total,
            page,
            onPageChange: setPage,
          }}
        />
      </div>

      {createOpen ? (
        <Modal
          title={t('addAdminTitle')}
          onClose={closeCreateModal}
          testId="admins-create-modal">
          <p className="muted compact">{t('addAdminLead')}</p>
          <label>
            {t('name')}
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              autoComplete="name"
            />
          </label>
          <label>
            {t('email')} *
            <input
              type="email"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            {t('phone')} ({t('optional')})
            <div className="phone-input-row">
              <span className="phone-prefix" aria-hidden>
                +91
              </span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={createPhone}
                placeholder={t('phoneTenDigitsHint')}
                onChange={(e) =>
                  setCreatePhone(localTenDigits(e.target.value).slice(0, 10))
                }
                autoComplete="tel-national"
              />
            </div>
          </label>
          <label>
            {t('password')} *
            <div className="password-generate-row">
              <input
                type="text"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setCreatePassword(generateAdminPassword())}>
                {t('generatePassword')}
              </button>
            </div>
          </label>
          {createError ? <p className="error-text">{createError}</p> : null}
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={creating}
              onClick={() => void onCreateAdmin()}>
              {creating ? t('saving') : t('save')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={closeCreateModal}>
              {t('cancel')}
            </button>
          </div>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal
          title={t('deleteUserTitle')}
          onClose={() => setDeleteTarget(null)}
          testId="admins-delete-modal">
          <p className="muted compact">
            {t('deleteUserLead', {name: userLabel(deleteTarget).name})}
          </p>
          {deleteError ? <p className="error-text">{deleteError}</p> : null}
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={deleting}
              onClick={() => void onDeleteUser()}>
              {deleting ? t('saving') : t('confirmDelete')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setDeleteTarget(null)}>
              {t('cancel')}
            </button>
          </div>
        </Modal>
      ) : null}

      {mfaTarget ? (
        <Modal
          title={t('resetMfaTitle')}
          onClose={() => setMfaTarget(null)}
          testId="admins-reset-mfa-modal">
          <p className="muted compact">
            {t('resetMfaLead', {name: userLabel(mfaTarget).name})}
          </p>
          {mfaError ? <p className="error-text">{mfaError}</p> : null}
          <div className="actions">
            <button
              type="button"
              className="btn btn-danger"
              disabled={mfaBusy}
              onClick={() => void onResetMfa()}>
              {mfaBusy ? t('saving') : t('resetMfa')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setMfaTarget(null)}>
              {t('cancel')}
            </button>
          </div>
        </Modal>
      ) : null}

      {passwordUser ? (
        <Modal
          title={t('setPasswordTitle')}
          onClose={closePasswordModal}
          testId="admins-set-password-modal">
          <p className="muted compact">{t('setPasswordLead')}</p>
          <p className="muted compact">
            {passwordUser.name ||
              passwordUser.displayName ||
              passwordUser.email}
          </p>
          <label>
            {t('newPassword')}
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label>
            {t('confirmPassword')}
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowPassword((v) => !v)}>
            {showPassword ? t('hidePassword') : t('showPassword')}
          </button>
          {passwordError ? <p className="error-text">{passwordError}</p> : null}
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={savingPassword}
              onClick={() => void onSavePassword()}>
              {savingPassword ? t('saving') : t('save')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={closePasswordModal}>
              {t('cancel')}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/** @deprecated Use AdminsPage */
export const UsersPage = AdminsPage;
