import {useCallback, useEffect, useMemo, useState} from 'react';
import {Navigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {
  Icon,
  VirtualTable,
  type VirtualTableColumn,
  Button,
  Dialog,
  StatusChip,
} from 'sapvt-ltd-web-packages';
import {
  SuccessBanner,
  userLabel,
  type SuccessBannerContent,
} from '../components/SuccessBanner';
import {
  cancelAdminInvitation,
  inviteAdmin,
  regenerateAdminActivation,
  setAdminStatus,
  updateAdminPermissions,
  type ActivationInviteResult,
} from '../services/api/activationApi';
import {
  deactivateUser,
  deleteUser,
  getUsersPage,
  resetUserMfa,
  restoreUser,
  setUserPassword,
  type User,
} from '../services/api/usersApi';
import {useAuthStore} from '../store/authStore';
import {
  ALL_PERMISSION_VALUES,
  PERMISSION_MODULES,
  defaultInvitePermissions,
  isModuleSelected,
  permissionLabel,
  toggleModulePermissions,
} from '../constants/permissions';
import {sortByUpdatedThenCreated} from '../utils/sort';
import '../styles/pages.css';

const MIN_PASSWORD_LENGTH = 8;
const PAGE_SIZE = 50;

function formatCreatedAt(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
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
  const [createPermissions, setCreatePermissions] = useState<string[]>(() =>
    defaultInvitePermissions(),
  );
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editPermsUser, setEditPermsUser] = useState<User | null>(null);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editPermsError, setEditPermsError] = useState<string | null>(null);
  const [savingPerms, setSavingPerms] = useState(false);

  const [inviteResult, setInviteResult] =
    useState<ActivationInviteResult | null>(null);
  const [inviteActionBusy, setInviteActionBusy] = useState(false);
  const [inviteActionError, setInviteActionError] = useState<string | null>(
    null,
  );

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
        includeInactive: true,
      });
      setRows(sortByUpdatedThenCreated(result.items));
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
    setCreatePermissions(defaultInvitePermissions());
    setCreateError(null);
    setCreating(false);
  };

  const openEditPermissions = (user: User) => {
    setEditPermsUser(user);
    setEditPermissions(
      Array.isArray(user.permissions) && user.permissions.length
        ? [...user.permissions]
        : [...ALL_PERMISSION_VALUES],
    );
    setEditPermsError(null);
  };

  const closeEditPermissions = () => {
    setEditPermsUser(null);
    setEditPermissions([]);
    setEditPermsError(null);
    setSavingPerms(false);
  };

  const onSavePermissions = async () => {
    if (!editPermsUser) return;
    setSavingPerms(true);
    setEditPermsError(null);
    try {
      await updateAdminPermissions(editPermsUser._id, editPermissions);
      const {name} = userLabel(editPermsUser);
      closeEditPermissions();
      setSuccessBanner({
        title: t('permissionsUpdatedTitle'),
        detail: t('permissionsUpdatedDetail', {name}),
      });
      await load();
    } catch (err) {
      setEditPermsError(
        err instanceof Error ? err.message : t('errorGeneric'),
      );
    } finally {
      setSavingPerms(false);
    }
  };

  const closeInviteModal = () => {
    setInviteResult(null);
    setInviteActionError(null);
    setInviteActionBusy(false);
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
    setCreating(true);
    try {
      const result = await inviteAdmin({
        name: createName.trim() || undefined,
        email: createEmail.trim(),
        permissions: createPermissions,
      });
      closeCreateModal();
      setInviteResult(result);
      setPage(0);
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setCreating(false);
    }
  };

  const issueInviteForUser = async (user: User) => {
    setBusyId(user._id);
    setInviteActionError(null);
    try {
      const result = await regenerateAdminActivation(user._id);
      setInviteResult(result);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setBusyId(null);
    }
  };

  const onCopyInviteLink = async () => {
    if (!inviteResult) return;
    setInviteActionBusy(true);
    setInviteActionError(null);
    try {
      await copyText(inviteResult.activationLink);
      setSuccessBanner({
        title: t('activationLinkCopiedTitle'),
        detail: t('activationLinkCopiedDetail'),
      });
    } catch {
      setInviteActionError(t('activationCopyFailed'));
    } finally {
      setInviteActionBusy(false);
    }
  };

  const onRegenerateFromInviteModal = async () => {
    if (!inviteResult?.admin?._id) return;
    setInviteActionBusy(true);
    setInviteActionError(null);
    try {
      const result = await regenerateAdminActivation(inviteResult.admin._id);
      setInviteResult(result);
      await load();
    } catch (err) {
      setInviteActionError(
        err instanceof Error ? err.message : t('errorGeneric'),
      );
    } finally {
      setInviteActionBusy(false);
    }
  };

  const onCancelInvitation = async () => {
    if (!inviteResult?.admin?._id) return;
    setInviteActionBusy(true);
    setInviteActionError(null);
    try {
      await cancelAdminInvitation(inviteResult.admin._id);
      closeInviteModal();
      setSuccessBanner({
        title: t('invitationCancelledTitle'),
        detail: t('invitationCancelledDetail'),
      });
      await load();
    } catch (err) {
      setInviteActionError(
        err instanceof Error ? err.message : t('errorGeneric'),
      );
    } finally {
      setInviteActionBusy(false);
    }
  };

  const onSetStatus = async (
    user: User,
    status: 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'PENDING',
    reason?: string,
  ) => {
    setBusyId(user._id);
    try {
      if (status === 'DISABLED') {
        await deactivateUser(user._id, reason || 'Disabled by Super Admin');
      } else if (status === 'ACTIVE' && user.adminStatus === 'DISABLED') {
        await restoreUser(user._id);
      } else {
        await setAdminStatus(user._id, status, reason);
      }
      setSuccessBanner({
        title: t('adminStatusUpdatedTitle'),
        detail: t('adminStatusUpdatedDetail', {
          name: userLabel(user).name,
          status,
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setBusyId(null);
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

  const togglePermission = (moduleId: string, selected: boolean) => {
    setCreatePermissions((prev) =>
      toggleModulePermissions(moduleId, prev, selected),
    );
  };

  const toggleEditModule = (moduleId: string, selected: boolean) => {
    setEditPermissions((prev) =>
      toggleModulePermissions(moduleId, prev, selected),
    );
  };

  const toggleEditPermission = (permission: string) => {
    setEditPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission],
    );
  };

  const columns = useMemo<VirtualTableColumn<User>[]>(
    () => [
      {
        key: 'name',
        header: t('name'),
        filterable: true,
        filterPlaceholder: t('searchName'),
        filterValue: (row) => row.name || row.displayName || '',
        render: (row) => row.name || row.displayName || '—',
      },
      {
        key: 'email',
        header: t('email'),
        filterable: true,
        filterPlaceholder: t('searchEmail'),
        filterValue: (row) => row.email || '',
        render: (row) => row.email || '—',
      },
      {
        key: 'role',
        header: t('role'),
        width: '7rem',
        render: () => <StatusChip status="active" label={t('roleAdmin')} />,
      },
      {
        key: 'status',
        header: t('status'),
        width: '8rem',
        render: (row) => {
          const status = row.adminStatus || 'ACTIVE';
          return (
            <StatusChip
              status={status}
              label={t(`adminStatus_${status}`)}
            />
          );
        },
      },
      {
        key: 'created',
        header: t('createdDate'),
        width: '9rem',
        render: (row) => formatCreatedAt(row.createdAt),
      },
      {
        key: 'mfa',
        header: t('mfaColumn'),
        width: '8rem',
        render: (row) =>
          row.totpEnabled ? (
            <StatusChip status="active" label={t('mfaEnabled')} />
          ) : (
            <StatusChip status="pending" label={t('mfaNotSet')} />
          ),
      },
      {
        key: 'actions',
        header: t('actions'),
        width: '22rem',
        render: (row) => {
          const isSelf =
            currentUser?.id === row._id || currentUser?.email === row.email;
          const status = row.adminStatus || 'ACTIVE';
          const pending = status === 'PENDING';
          return (
            <span className="actions table-actions admin-action-row">
              {pending ? (
                <>
                  <Button variant="ghost" disabled={busyId === row._id} title={t('copyActivationLink')} onClick={() => void issueInviteForUser(row)}>
                    {t('inviteLink')}
                  </Button>
                  <Button variant="ghost" disabled={busyId === row._id} title={t('regenerateLink')} onClick={() => void issueInviteForUser(row)}>
                    {t('regenerateLink')}
                  </Button>
                </>
              ) : null}
              {status === 'ACTIVE' || status === 'LOCKED' ? (
                <Button variant="ghost" disabled={isSelf || busyId === row._id} onClick={() =>
                    void onSetStatus(row, 'DISABLED', 'Disabled by Super Admin')
                  }>
                  {t('deactivate')}
                </Button>
              ) : null}
              {status === 'DISABLED' || status === 'LOCKED' ? (
                <Button variant="ghost" disabled={busyId === row._id} onClick={() => void onSetStatus(row, 'ACTIVE')}>
                  {t('activate')}
                </Button>
              ) : null}
              {status === 'ACTIVE' ? (
                <Button variant="ghost" disabled={isSelf || busyId === row._id} onClick={() => openPasswordModal(row)}>
                  {t('resetPassword')}
                </Button>
              ) : null}
              <Button variant="ghost" disabled={busyId === row._id} onClick={() => openEditPermissions(row)}>
                {t('editPermissions')}
              </Button>
              <Button variant="ghost" className="icon-only" disabled={busyId === row._id || pending} aria-label={t('resetMfa')} title={t('resetMfa')} onClick={() => {
                  setMfaTarget(row);
                  setMfaError(null);
                }}>
                <Icon name="phonelink_lock" size={18} />
              </Button>
              <Button variant="ghost" disabled={isSelf || busyId === row._id} onClick={() => {
                  setDeleteTarget(row);
                  setDeleteError(null);
                  setBusyId(null);
                }}>
                {t('delete')}
              </Button>
            </span>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers close over latest state
    [busyId, currentUser?.email, currentUser?.id, t],
  );

  if (!superAdminElevated) {
    return <Navigate to="/" replace />;
  }

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
        <Button variant="primary" onClick={() => {
            setCreatePermissions(defaultInvitePermissions());
            setCreateOpen(true);
          }}>
          {t('addAdmin')}
        </Button>
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
        <Dialog open
          title={t('addAdminTitle')}
          onClose={closeCreateModal}
          testId="admins-create-modal">
          <p className="muted compact">{t('addAdminLead')}</p>
          <label>
            {t('fullName')}
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
            {t('role')}
            <input value="admin" disabled readOnly />
          </label>
          <fieldset className="permissions-fieldset">
            <legend>{t('permissions')}</legend>
            <p className="muted compact">{t('permissionsInviteHint')}</p>
            <div className="permissions-grid">
              {PERMISSION_MODULES.map((opt) => (
                <label key={opt.id} className="permission-check">
                  <input
                    type="checkbox"
                    checked={isModuleSelected(opt.id, createPermissions)}
                    onChange={(e) =>
                      togglePermission(opt.id, e.target.checked)
                    }
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>
          {createError ? <p className="error-text">{createError}</p> : null}
          <div className="actions">
            <Button variant="primary" disabled={creating} onClick={() => void onCreateAdmin()}>
              {creating ? t('saving') : t('createInvitation')}
            </Button>
            <Button variant="ghost" onClick={closeCreateModal}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}

      {inviteResult ? (
        <Dialog open
          title={t('adminCreatedTitle')}
          onClose={closeInviteModal}
          testId="admins-invite-modal">
          <p className="muted compact">{t('adminCreatedLead')}</p>
          <p className="muted compact">
            {inviteResult.admin.email} · expires{' '}
            {formatCreatedAt(inviteResult.activationExpiresAt)}
          </p>
          <label>
            {t('activationLink')}
            <input
              type="text"
              readOnly
              value={inviteResult.activationLink}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <div className="mfa-qr-wrap invite-qr">
            <img
              src={inviteResult.qrCodeDataUrl}
              alt="Activation link QR"
              width={200}
              height={200}
            />
          </div>
          {inviteActionError ? (
            <p className="error-text">{inviteActionError}</p>
          ) : null}
          <div className="actions wrap-actions">
            <Button variant="primary" disabled={inviteActionBusy} onClick={() => void onCopyInviteLink()}>
              {t('copyActivationLink')}
            </Button>
            <Button variant="ghost" disabled={inviteActionBusy} onClick={() => void onRegenerateFromInviteModal()}>
              {t('regenerateLink')}
            </Button>
            <Button variant="danger" disabled={inviteActionBusy} onClick={() => void onCancelInvitation()}>
              {t('cancelInvitation')}
            </Button>
            <Button variant="ghost" onClick={closeInviteModal}>
              {t('done')}
            </Button>
          </div>
        </Dialog>
      ) : null}

      {editPermsUser ? (
        <Dialog open
          title={t('editPermissionsTitle')}
          onClose={closeEditPermissions}
          testId="admins-edit-permissions-modal">
          <p className="muted compact">
            {t('editPermissionsLead', {name: userLabel(editPermsUser).name})}
          </p>
          <dl className="admin-profile-meta">
            <div>
              <dt>{t('email')}</dt>
              <dd>{editPermsUser.email || '—'}</dd>
            </div>
            <div>
              <dt>{t('role')}</dt>
              <dd>admin</dd>
            </div>
            <div>
              <dt>{t('status')}</dt>
              <dd>{editPermsUser.adminStatus || 'ACTIVE'}</dd>
            </div>
            <div>
              <dt>{t('mfaColumn')}</dt>
              <dd>
                {editPermsUser.totpEnabled
                  ? t('mfaEnabled')
                  : t('mfaNotSet')}
              </dd>
            </div>
          </dl>
          <fieldset className="permissions-fieldset">
            <legend>{t('permissions')}</legend>
            <p className="muted compact">{t('permissionsModulesHint')}</p>
            <div className="permissions-grid">
              {PERMISSION_MODULES.map((opt) => (
                <label key={opt.id} className="permission-check">
                  <input
                    type="checkbox"
                    checked={isModuleSelected(opt.id, editPermissions)}
                    onChange={(e) =>
                      toggleEditModule(opt.id, e.target.checked)
                    }
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <p className="muted compact">{t('permissionsGranularHint')}</p>
            <div className="permissions-list">
              {ALL_PERMISSION_VALUES.map((perm) => (
                <label key={perm} className="permission-check">
                  <input
                    type="checkbox"
                    checked={editPermissions.includes(perm)}
                    onChange={() => toggleEditPermission(perm)}
                  />
                  {permissionLabel(perm)}
                </label>
              ))}
            </div>
          </fieldset>
          {editPermsError ? (
            <p className="error-text">{editPermsError}</p>
          ) : null}
          <div className="actions">
            <Button variant="primary" disabled={savingPerms} onClick={() => void onSavePermissions()}>
              {savingPerms ? t('saving') : t('save')}
            </Button>
            <Button variant="ghost" onClick={closeEditPermissions}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}

      {deleteTarget ? (
        <Dialog open
          title={t('deleteUserTitle')}
          onClose={() => setDeleteTarget(null)}
          testId="admins-delete-modal">
          <p className="muted compact">
            {t('deleteUserLead', {name: userLabel(deleteTarget).name})}
          </p>
          {deleteError ? <p className="error-text">{deleteError}</p> : null}
          <div className="actions">
            <Button variant="primary" disabled={deleting} onClick={() => void onDeleteUser()}>
              {deleting ? t('saving') : t('confirmDelete')}
            </Button>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}

      {mfaTarget ? (
        <Dialog open
          title={t('resetMfaTitle')}
          onClose={() => setMfaTarget(null)}
          testId="admins-reset-mfa-modal">
          <p className="muted compact">
            {t('resetMfaLead', {name: userLabel(mfaTarget).name})}
          </p>
          {mfaError ? <p className="error-text">{mfaError}</p> : null}
          <div className="actions">
            <Button variant="danger" disabled={mfaBusy} onClick={() => void onResetMfa()}>
              {mfaBusy ? t('saving') : t('resetMfa')}
            </Button>
            <Button variant="ghost" onClick={() => setMfaTarget(null)}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}

      {passwordUser ? (
        <Dialog open
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
          <Button variant="ghost" onClick={() => setShowPassword((v) => !v)}>
            {showPassword ? t('hidePassword') : t('showPassword')}
          </Button>
          {passwordError ? <p className="error-text">{passwordError}</p> : null}
          <div className="actions">
            <Button variant="primary" disabled={savingPassword} onClick={() => void onSavePassword()}>
              {savingPassword ? t('saving') : t('save')}
            </Button>
            <Button variant="ghost" onClick={closePasswordModal}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

/** @deprecated Use AdminsPage */
export const UsersPage = AdminsPage;
