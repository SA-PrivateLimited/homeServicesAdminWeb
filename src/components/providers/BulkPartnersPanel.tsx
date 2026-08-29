import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Button, Icon, Select} from 'sapvt-ltd-web-packages';
import type {
  GeographyMetaDistrict,
  GeographyMetaState,
} from '../../services/api/geographyApi';
import {localTenDigits} from '../../utils/phone';
import {
  clearBulkDraftStorage,
  downloadBulkTemplate,
  insertBulkPartnerRow,
  loadBulkDraftFromStorage,
  parseBulkPaste,
  partnerPinFromPhone,
  saveBulkDraftToStorage,
  type BulkGeoDefaults,
  type ProviderBulkDraftRow,
  type ServiceOption,
} from '../../utils/providerBulkImport';
import {PinCopyButton} from '../PinCopyButton';
import './BulkPartnersPanel.css';

export interface BulkPartnersPanelProps {
  geoStates: GeographyMetaState[];
  geoDistricts: GeographyMetaDistrict[];
  serviceOptions: ServiceOption[];
  onProviderCreated: () => void | Promise<void>;
}

function statusLabel(
  row: ProviderBulkDraftRow,
  t: (key: string) => string,
): string {
  if (row.status === 'success') return t('bulkPartnersStatusSuccess');
  if (row.status === 'failed') return row.error ? t(row.error) : t('errorGeneric');
  if (row.status === 'inserting') return t('bulkPartnersStatusInserting');
  return t('bulkPartnersStatusPending');
}

export function BulkPartnersPanel({
  geoStates,
  geoDistricts,
  serviceOptions,
  onProviderCreated,
}: BulkPartnersPanelProps) {
  const {t} = useTranslation();
  const stored = loadBulkDraftFromStorage();

  const [expanded, setExpanded] = useState(stored?.expanded ?? false);
  const [pasteText, setPasteText] = useState(stored?.pasteText ?? '');
  const [stateId, setStateId] = useState(stored?.stateId ?? '');
  const [districtId, setDistrictId] = useState(stored?.districtId ?? '');
  const [city, setCity] = useState(stored?.city ?? '');
  const [pincode, setPincode] = useState(stored?.pincode ?? '');
  const [rows, setRows] = useState<ProviderBulkDraftRow[]>(stored?.rows ?? []);
  const [insertAllBusy, setInsertAllBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const stateOptions = useMemo(
    () => geoStates.map((s) => ({value: s._id, label: s.name})),
    [geoStates],
  );

  const districtOptions = useMemo(
    () =>
      geoDistricts
        .filter((d) => !stateId || d.stateId === stateId)
        .map((d) => ({value: d._id, label: d.name})),
    [geoDistricts, stateId],
  );

  const geoDefaults = useMemo((): BulkGeoDefaults => {
    const selectedState = geoStates.find((s) => s._id === stateId);
    const selectedDistrict = geoDistricts.find((d) => d._id === districtId);
    return {
      stateId,
      districtId,
      city,
      pincode,
      stateName: selectedState?.name || '',
      districtName: selectedDistrict?.name || '',
    };
  }, [city, districtId, geoDistricts, geoStates, pincode, stateId]);

  useEffect(() => {
    saveBulkDraftToStorage({
      rows,
      pasteText,
      stateId,
      districtId,
      city,
      pincode,
      expanded,
    });
  }, [rows, pasteText, stateId, districtId, city, pincode, expanded]);

  const updateRow = useCallback(
    (id: string, patch: Partial<ProviderBulkDraftRow>) => {
      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== id) return row;
          const next = {...row, ...patch};
          if (patch.phone !== undefined) {
            next.phone = localTenDigits(patch.phone).slice(0, 10);
          }
          if (
            row.status === 'success' &&
            (patch.phone !== undefined ||
              patch.name !== undefined ||
              patch.service !== undefined)
          ) {
            return row;
          }
          if (row.status !== 'inserting' && row.status !== 'success') {
            next.status = 'pending';
            next.error = undefined;
          }
          return next;
        }),
      );
    },
    [],
  );

  const onLoadRows = () => {
    setLoadError(null);
    const parsed = parseBulkPaste(pasteText);
    if (!parsed.length) {
      setLoadError(t('bulkPartnersPasteEmpty'));
      return;
    }
    setRows((prev) => {
      const keepDone = prev.filter((r) => r.status === 'success');
      return [...keepDone, ...parsed];
    });
  };

  const onClearDraft = () => {
    setPasteText('');
    setRows([]);
    setLoadError(null);
    clearBulkDraftStorage();
  };

  const insertRow = async (rowId: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row || row.status === 'inserting' || row.status === 'success') return;

    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {...r, status: 'inserting', error: undefined}
          : r,
      ),
    );

    try {
      const result = await insertBulkPartnerRow(row, geoDefaults, serviceOptions);
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                status: 'success',
                error: undefined,
                createdUserId: result.userId,
                loginPin: result.loginPin,
              }
            : r,
        ),
      );
      await onProviderCreated();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'errorGeneric';
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {...r, status: 'failed', error: message}
            : r,
        ),
      );
    }
  };

  const onInsertAllPending = async () => {
    const pending = rows.filter((r) => r.status === 'pending' || r.status === 'failed');
    if (!pending.length) return;
    setInsertAllBusy(true);
    for (const row of pending) {
      await insertRow(row.id);
      await new Promise((resolve) => window.setTimeout(resolve, 300));
    }
    setInsertAllBusy(false);
  };

  const pendingCount = rows.filter(
    (r) => r.status === 'pending' || r.status === 'failed',
  ).length;

  return (
    <section
      className={`card bulk-partners-panel${expanded ? ' bulk-partners-panel--expanded' : ''}`}
      data-testid="bulk-partners-panel"
      aria-label={t('bulkPartnersTitle')}>
      <button
        type="button"
        className="bulk-partners-panel__toggle"
        aria-expanded={expanded}
        aria-label={
          expanded ? t('bulkPartnersCollapse') : t('bulkPartnersExpand')
        }
        onClick={() => setExpanded((v) => !v)}>
        <div>
          <h2>{t('bulkPartnersTitle')}</h2>
          <p>{t('bulkPartnersLead')}</p>
        </div>
        <Icon
          name="expand_more"
          size={22}
          className="bulk-partners-panel__chevron"
        />
      </button>

      {expanded ? (
        <div className="bulk-partners-panel__body">
          <div className="bulk-partners-panel__defaults">
            <label>
              {t('geoState')}
              <Select
                options={stateOptions}
                value={stateId}
                placeholder={t('geoState')}
                showSearch
                searchPlaceholder={t('searchState')}
                emptyMessage={t('noStatesFound')}
                onChange={(value) => {
                  setStateId(value);
                  setDistrictId('');
                  setCity('');
                  setPincode('');
                }}
              />
            </label>
            <label>
              {t('geoDistrict')}
              <Select
                options={districtOptions}
                value={districtId}
                placeholder={t('geoDistrict')}
                showSearch
                searchPlaceholder={t('searchDistrict')}
                emptyMessage={t('noDistrictsFound')}
                disabled={!stateId}
                onChange={(value) => {
                  setDistrictId(value);
                  const d = geoDistricts.find((x) => x._id === value);
                  if (d) {
                    if (!city.trim()) setCity(d.name);
                    if (d.pincode) setPincode(d.pincode);
                  }
                }}
              />
            </label>
            <label>
              {t('geoCity')}
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t('geoDistrict')}
              />
            </label>
            <label>
              {t('pincode')}
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={pincode}
                onChange={(e) =>
                  setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="560001"
              />
            </label>
          </div>

          <div className="bulk-partners-panel__paste">
            <label>
              {t('bulkPartnersPasteLabel')}
              <textarea
                value={pasteText}
                placeholder={t('bulkPartnersPastePlaceholder')}
                onChange={(e) => setPasteText(e.target.value)}
              />
            </label>
            <div className="bulk-partners-panel__paste-actions">
              <Button variant="primary" onClick={onLoadRows}>
                {t('bulkPartnersLoadRows')}
              </Button>
              <Button variant="ghost" onClick={() => downloadBulkTemplate()}>
                {t('bulkPartnersDownloadTemplate')}
              </Button>
              <Button variant="ghost" onClick={onClearDraft}>
                {t('bulkPartnersClearDraft')}
              </Button>
            </div>
            {loadError ? <p className="error-text">{loadError}</p> : null}
          </div>

          {rows.length > 0 ? (
            <>
              <div className="bulk-partners-panel__table-wrap">
                <table className="bulk-partners-panel__table">
                  <thead>
                    <tr>
                      <th>{t('phone')}</th>
                      <th>{t('name')}</th>
                      <th>{t('serviceType')}</th>
                      <th>{t('locationAddress')}</th>
                      <th>{t('experienceOptional')}</th>
                      <th>{t('bulkPartnersGender')}</th>
                      <th>{t('bulkPartnersStatus')}</th>
                      <th>{t('loginPin')}</th>
                      <th>{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const pinPreview =
                        row.loginPin ||
                        (localTenDigits(row.phone).length === 10
                          ? partnerPinFromPhone(row.phone)
                          : '—');
                      const statusClass =
                        row.status === 'success'
                          ? 'bulk-partners-panel__status--success'
                          : row.status === 'failed'
                            ? 'bulk-partners-panel__status--failed'
                            : '';
                      const readOnly = row.status === 'success' || row.status === 'inserting';

                      return (
                        <tr key={row.id}>
                          <td>
                            <input
                              type="tel"
                              inputMode="numeric"
                              maxLength={10}
                              value={row.phone}
                              disabled={readOnly}
                              onChange={(e) =>
                                updateRow(row.id, {phone: e.target.value})
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={row.name}
                              disabled={readOnly}
                              onChange={(e) =>
                                updateRow(row.id, {name: e.target.value})
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={row.service}
                              disabled={readOnly}
                              onChange={(e) =>
                                updateRow(row.id, {service: e.target.value})
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={row.address}
                              disabled={readOnly}
                              onChange={(e) =>
                                updateRow(row.id, {address: e.target.value})
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              value={row.experience}
                              disabled={readOnly}
                              onChange={(e) =>
                                updateRow(row.id, {experience: e.target.value})
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={row.gender}
                              disabled={readOnly}
                              onChange={(e) =>
                                updateRow(row.id, {gender: e.target.value})
                              }
                            />
                          </td>
                          <td className={statusClass}>
                            {statusLabel(row, t)}
                          </td>
                          <td>
                            {row.status === 'success' && row.loginPin ? (
                              <span style={{display: 'inline-flex', alignItems: 'center', gap: '0.25rem'}}>
                                {row.loginPin}
                                <PinCopyButton
                                  revealedPin={row.loginPin}
                                  fetchPin={async () => row.loginPin ?? null}
                                />
                              </span>
                            ) : (
                              pinPreview
                            )}
                          </td>
                          <td>
                            <Button
                              variant="primary"
                              disabled={
                                readOnly ||
                                insertAllBusy ||
                                row.status === 'inserting'
                              }
                              onClick={() => void insertRow(row.id)}>
                              {row.status === 'inserting'
                                ? t('saving')
                                : t('bulkPartnersInsert')}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="bulk-partners-panel__gender-note">
                {t('bulkPartnersGenderNote')}
              </p>
              <div className="bulk-partners-panel__footer-actions">
                <Button
                  variant="primary"
                  disabled={insertAllBusy || pendingCount === 0}
                  onClick={() => void onInsertAllPending()}>
                  {insertAllBusy
                    ? t('bulkPartnersInsertAllBusy')
                    : t('bulkPartnersInsertAll', {count: pendingCount})}
                </Button>
              </div>
            </>
          ) : (
            <p style={{opacity: 0.75, fontSize: '0.9rem', margin: 0}}>
              {t('bulkPartnersEmptyTable')}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
