import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Button, Icon, Select} from 'sapvt-ltd-web-packages';
import type {
  GeographyMetaBlock,
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
  matchServiceValue,
  matchStateValue,
  matchDistrictValue,
  matchBlockValue,
  districtExcelLabel,
  blockExcelLabel,
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
  geoBlocks: GeographyMetaBlock[];
  serviceOptions: ServiceOption[];
  onProviderCreated: () => void | Promise<void>;
  /** Full-page route: always expanded, no collapse toggle */
  standalone?: boolean;
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
  geoBlocks,
  serviceOptions,
  onProviderCreated,
  standalone = false,
}: BulkPartnersPanelProps) {
  const {t} = useTranslation();
  const stored = loadBulkDraftFromStorage();

  const [expanded, setExpanded] = useState(
    standalone ? true : (stored?.expanded ?? false),
  );
  const [pasteText, setPasteText] = useState(stored?.pasteText ?? '');
  const [stateId, setStateId] = useState(stored?.stateId ?? '');
  const [districtId, setDistrictId] = useState(stored?.districtId ?? '');
  const [blockId, setBlockId] = useState(stored?.blockId ?? '');
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

  const blockOptions = useMemo(
    () =>
      geoBlocks
        .filter((b) => !districtId || b.districtId === districtId)
        .map((b) => ({value: b._id, label: b.name})),
    [geoBlocks, districtId],
  );

  const geoDefaults = useMemo((): BulkGeoDefaults => {
    const selectedState = geoStates.find((s) => s._id === stateId);
    const selectedDistrict = geoDistricts.find((d) => d._id === districtId);
    const selectedBlock = geoBlocks.find((b) => b._id === blockId);
    return {
      stateId,
      districtId,
      blockId,
      city,
      pincode,
      stateName: selectedState?.name || '',
      districtName: selectedDistrict?.name || '',
      blockName: selectedBlock?.name || '',
    };
  }, [
    blockId,
    city,
    districtId,
    geoBlocks,
    geoDistricts,
    geoStates,
    pincode,
    stateId,
  ]);

  useEffect(() => {
    saveBulkDraftToStorage({
      rows,
      pasteText,
      stateId,
      districtId,
      blockId,
      city,
      pincode,
      expanded: standalone ? true : expanded,
    });
  }, [
    rows,
    pasteText,
    stateId,
    districtId,
    blockId,
    city,
    pincode,
    expanded,
    standalone,
  ]);

  const isExpanded = standalone || expanded;

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
      const result = await insertBulkPartnerRow(
        row,
        geoDefaults,
        serviceOptions,
        geoStates,
        geoDistricts,
        geoBlocks,
      );
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

  const successCount = rows.filter((r) => r.status === 'success').length;
  const failedCount = rows.filter((r) => r.status === 'failed').length;

  return (
    <section
      className={`bulk-partners-panel${isExpanded ? ' bulk-partners-panel--expanded' : ''}${standalone ? ' bulk-partners-panel--standalone' : ' card'}`}
      data-testid="bulk-partners-panel"
      aria-label={t('bulkPartnersTitle')}>
      {standalone ? null : (
        <button
          type="button"
          className="bulk-partners-panel__toggle"
          aria-expanded={isExpanded}
          aria-label={
            isExpanded ? t('bulkPartnersCollapse') : t('bulkPartnersExpand')
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
      )}

      {isExpanded ? (
        <div className={`bulk-partners-panel__body${standalone ? ' bulk-partners-panel__body--standalone' : ''}`}>
          <section className="bulk-partners-section" aria-labelledby="bulk-partners-step-location">
            <div className="bulk-partners-section__head">
              <h3 id="bulk-partners-step-location">{t('bulkPartnersStepLocation')}</h3>
              <p>{t('bulkPartnersStepLocationLead')}</p>
            </div>
            <div className="bulk-partners-field-grid">
              <div className="bulk-partners-field">
                <span className="bulk-partners-field__label">{t('geoState')}</span>
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
                    setBlockId('');
                    setCity('');
                    setPincode('');
                  }}
                />
              </div>
              <div className="bulk-partners-field">
                <span className="bulk-partners-field__label">{t('geoDistrict')}</span>
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
                    setBlockId('');
                    const d = geoDistricts.find((x) => x._id === value);
                    if (d) {
                      if (!city.trim()) setCity(d.name);
                      if (d.pincode) setPincode(d.pincode);
                    }
                  }}
                />
              </div>
              <div className="bulk-partners-field">
                <span className="bulk-partners-field__label">{t('geoBlock')}</span>
                <Select
                  options={blockOptions}
                  value={blockId}
                  placeholder={t('geoBlock')}
                  showSearch
                  searchPlaceholder={t('searchBlock')}
                  emptyMessage={t('noBlocksFound')}
                  disabled={!districtId}
                  onChange={(value) => setBlockId(value)}
                />
              </div>
              <div className="bulk-partners-field">
                <span className="bulk-partners-field__label">{t('geoCity')}</span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={t('geoCity')}
                />
              </div>
              <div className="bulk-partners-field">
                <span className="bulk-partners-field__label">{t('pincode')}</span>
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
              </div>
            </div>
          </section>

          <section className="bulk-partners-section" aria-labelledby="bulk-partners-step-paste">
            <div className="bulk-partners-section__head">
              <h3 id="bulk-partners-step-paste">{t('bulkPartnersStepPaste')}</h3>
              <p>{t('bulkPartnersStepPasteLead')}</p>
            </div>
            <div className="bulk-partners-field bulk-partners-paste">
              <span className="bulk-partners-field__label">{t('bulkPartnersPasteLabel')}</span>
              <textarea
                value={pasteText}
                placeholder={t('bulkPartnersPastePlaceholder')}
                onChange={(e) => setPasteText(e.target.value)}
              />
            </div>
            <div className="bulk-partners-paste-actions">
              <Button variant="primary" onClick={onLoadRows}>
                {t('bulkPartnersLoadRows')}
              </Button>
              <Button variant="ghost" onClick={() => downloadBulkTemplate(serviceOptions, geoStates, geoDistricts, geoBlocks)}>
                {t('bulkPartnersDownloadTemplate')}
              </Button>
              <Button variant="ghost" onClick={onClearDraft}>
                {t('bulkPartnersClearDraft')}
              </Button>
            </div>
            {loadError ? <p className="error-text">{loadError}</p> : null}
          </section>

          <section className="bulk-partners-section" aria-labelledby="bulk-partners-step-review">
            <div className="bulk-partners-section__head">
              <h3 id="bulk-partners-step-review">{t('bulkPartnersStepReview')}</h3>
              <p>{t('bulkPartnersStepReviewLead')}</p>
            </div>

            {rows.length > 0 ? (
              <>
                <p className="bulk-partners-summary">
                  {t('bulkPartnersRowSummary', {
                    pending: pendingCount,
                    success: successCount,
                    failed: failedCount,
                  })}
                </p>
                <div className="bulk-partners-table-wrap">
                  <table className="bulk-partners-table">
                  <thead>
                    <tr>
                      <th>{t('phone')}</th>
                      <th>{t('name')}</th>
                      <th>{t('serviceType')}</th>
                      <th>{t('geoState')}</th>
                      <th>{t('geoDistrict')}</th>
                      <th>{t('geoBlock')}</th>
                      <th>{t('geoCity')}</th>
                      <th>{t('pincode')}</th>
                      <th>{t('locationAddress')}</th>
                      <th>{t('experienceOptional')}</th>
                      <th>{t('ratingOptional')}</th>
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
                          ? 'bulk-partners-status--success'
                          : row.status === 'failed'
                            ? 'bulk-partners-status--failed'
                            : '';
                      const readOnly = row.status === 'success' || row.status === 'inserting';
                      const matchedService = matchServiceValue(
                        row.service,
                        serviceOptions,
                      );
                      const unmatchedService =
                        !matchedService && (row.service || '').trim()
                          ? (row.service || '').trim()
                          : '';
                      const genderNormalized = ['Male', 'Female', 'Other'].find(
                        (g) =>
                          g.toLowerCase() ===
                          (row.gender || '').trim().toLowerCase(),
                      );

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
                          <td className="bulk-partners-table__service">
                            <select
                              aria-label={t('serviceType')}
                              value={matchedService || ''}
                              disabled={readOnly}
                              onChange={(e) =>
                                updateRow(row.id, {service: e.target.value})
                              }>
                              {unmatchedService ? (
                                <option value="" disabled>
                                  {t('bulkPartnersFixService', {
                                    value: unmatchedService,
                                  })}
                                </option>
                              ) : (
                                <option value="">
                                  {t('selectServiceType')}
                                </option>
                              )}
                              {serviceOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              aria-label={t('geoState')}
                              value={
                                matchStateValue(row.state || '', geoStates)?._id ||
                                ''
                              }
                              disabled={readOnly}
                              onChange={(e) => {
                                const value = e.target.value;
                                const nextState = geoStates.find((s) => s._id === value);
                                const nextDistricts = geoDistricts.filter(
                                  (d) => d.stateId === value,
                                );
                                const keepDistrict = matchDistrictValue(
                                  row.district || '',
                                  nextDistricts,
                                );
                                updateRow(row.id, {
                                  state: nextState?.name || value,
                                  district: keepDistrict
                                    ? districtExcelLabel(keepDistrict)
                                    : '',
                                });
                              }}>
                              {(row.state || '').trim() &&
                              !matchStateValue(row.state || '', geoStates) ? (
                                <option value="" disabled>
                                  {row.state}
                                </option>
                              ) : (
                                <option value="">{t('geoState')}</option>
                              )}
                              {stateOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              aria-label={t('geoDistrict')}
                              value={
                                matchDistrictValue(
                                  row.district || '',
                                  geoDistricts,
                                )?._id || ''
                              }
                              disabled={readOnly}
                              onChange={(e) => {
                                const value = e.target.value;
                                const d = geoDistricts.find((x) => x._id === value);
                                updateRow(row.id, {
                                  district: d ? districtExcelLabel(d) : value,
                                  state: d
                                    ? geoStates.find((s) => s._id === d.stateId)
                                        ?.name || row.state
                                    : row.state,
                                  block: '',
                                  city: row.city || d?.name || '',
                                  pincode: row.pincode || d?.pincode || '',
                                });
                              }}>
                              {(row.district || '').trim() &&
                              !matchDistrictValue(row.district || '', geoDistricts) ? (
                                <option value="" disabled>
                                  {row.district}
                                </option>
                              ) : (
                                <option value="">{t('geoDistrict')}</option>
                              )}
                              {geoDistricts
                                .filter((d) => {
                                  const sid =
                                    matchStateValue(row.state || '', geoStates)
                                      ?._id ||
                                    (!((row.state || '').trim()) ? stateId : '');
                                  return !sid || d.stateId === sid;
                                })
                                .map((d) => (
                                  <option key={d._id} value={d._id}>
                                    {d.name}
                                  </option>
                                ))}
                            </select>
                          </td>
                          <td>
                            <select
                              aria-label={t('geoBlock')}
                              value={
                                matchBlockValue(row.block || '', geoBlocks)?._id ||
                                ''
                              }
                              disabled={readOnly}
                              onChange={(e) => {
                                const value = e.target.value;
                                const b = geoBlocks.find((x) => x._id === value);
                                updateRow(row.id, {
                                  block: b ? blockExcelLabel(b) : value,
                                  district: b
                                    ? districtExcelLabel({
                                        _id: b.districtId,
                                        name: b.districtName,
                                        stateId: b.stateId,
                                        stateName: b.stateName,
                                      })
                                    : row.district,
                                  state: b
                                    ? geoStates.find((s) => s._id === b.stateId)
                                        ?.name || row.state
                                    : row.state,
                                });
                              }}>
                              {(row.block || '').trim() &&
                              !matchBlockValue(row.block || '', geoBlocks) ? (
                                <option value="" disabled>
                                  {row.block}
                                </option>
                              ) : (
                                <option value="">{t('geoBlock')}</option>
                              )}
                              {geoBlocks
                                .filter((b) => {
                                  const did =
                                    matchDistrictValue(
                                      row.district || '',
                                      geoDistricts,
                                    )?._id ||
                                    (!((row.district || '').trim())
                                      ? districtId
                                      : '');
                                  return !did || b.districtId === did;
                                })
                                .map((b) => (
                                  <option key={b._id} value={b._id}>
                                    {b.name}
                                  </option>
                                ))}
                            </select>
                          </td>
                          <td>
                            <input
                              value={row.city ?? ''}
                              disabled={readOnly}
                              placeholder={t('geoCity')}
                              onChange={(e) =>
                                updateRow(row.id, {city: e.target.value})
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              value={row.pincode ?? ''}
                              disabled={readOnly}
                              placeholder="560001"
                              onChange={(e) =>
                                updateRow(row.id, {
                                  pincode: e.target.value.replace(/\D/g, '').slice(0, 6),
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={row.address ?? ''}
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
                              type="number"
                              min={0}
                              max={5}
                              step={0.1}
                              value={row.rating ?? ''}
                              disabled={readOnly}
                              onChange={(e) =>
                                updateRow(row.id, {rating: e.target.value})
                              }
                            />
                          </td>
                          <td>
                            <select
                              aria-label={t('bulkPartnersGender')}
                              value={genderNormalized || row.gender || ''}
                              disabled={readOnly}
                              onChange={(e) =>
                                updateRow(row.id, {gender: e.target.value})
                              }>
                              <option value="">{t('optional')}</option>
                              {row.gender && !genderNormalized ? (
                                <option value={row.gender}>{row.gender}</option>
                              ) : null}
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
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
                <p className="bulk-partners-gender-note">
                  {t('bulkPartnersGenderNote')}
                </p>
                <div className="bulk-partners-footer-actions">
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
              <div className="bulk-partners-empty">
                <Icon
                  name="table_rows"
                  size={40}
                  className="bulk-partners-empty__icon"
                />
                <h4>{t('bulkPartnersEmptyTitle')}</h4>
                <p>{t('bulkPartnersEmptyHint')}</p>
                <Button variant="ghost" onClick={() => downloadBulkTemplate(serviceOptions, geoStates, geoDistricts, geoBlocks)}>
                  {t('bulkPartnersDownloadTemplate')}
                </Button>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
