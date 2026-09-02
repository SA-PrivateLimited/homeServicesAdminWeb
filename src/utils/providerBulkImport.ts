import {ApiError} from '../services/api/apiClient';
import {invalidateGeographyListCache} from '../services/api/geographyApi';
import {createUser, setUserPin} from '../services/api/usersApi';
import {localTenDigits, toE164} from './phone';

export type BulkRowStatus = 'pending' | 'inserting' | 'success' | 'failed';

export interface ProviderBulkDraftRow {
  id: string;
  phone: string;
  name: string;
  service: string;
  address: string;
  experience: string;
  gender: string;
  state: string;
  district: string;
  block: string;
  city: string;
  pincode: string;
  rating: string;
  status: BulkRowStatus;
  error?: string;
  createdUserId?: string;
  loginPin?: string;
}

export interface BulkGeoDefaults {
  stateId: string;
  districtId: string;
  blockId: string;
  city: string;
  pincode: string;
  stateName: string;
  districtName: string;
  blockName: string;
}

export interface ServiceOption {
  value: string;
  label: string;
}

export interface BulkStateOption {
  _id: string;
  name: string;
}

export interface BulkDistrictOption {
  _id: string;
  name: string;
  stateId: string;
  stateName: string;
  pincode?: string;
}

export interface BulkBlockOption {
  _id: string;
  name: string;
  districtId: string;
  districtName: string;
  stateId: string;
  stateName: string;
}

export const BULK_DRAFT_STORAGE_KEY = 'admin-provider-bulk-draft-v1';

type DraftField = keyof Pick<
  ProviderBulkDraftRow,
  | 'phone'
  | 'name'
  | 'service'
  | 'address'
  | 'experience'
  | 'gender'
  | 'state'
  | 'district'
  | 'block'
  | 'city'
  | 'pincode'
  | 'rating'
>;

const HEADER_MAP: Record<string, DraftField> = {
  phone: 'phone',
  mobile: 'phone',
  number: 'phone',
  phonenumber: 'phone',
  mobilenumber: 'phone',
  name: 'name',
  servicetype: 'service',
  service: 'service',
  address: 'address',
  experience: 'experience',
  exp: 'experience',
  years: 'experience',
  gender: 'gender',
  sex: 'gender',
  state: 'state',
  statename: 'state',
  district: 'district',
  districtname: 'district',
  block: 'block',
  blockname: 'block',
  tehsil: 'block',
  taluka: 'block',
  city: 'city',
  pincode: 'pincode',
  pin: 'pincode',
  pincode6: 'pincode',
  rating: 'rating',
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function detectDelimiter(line: string): '\t' | ',' {
  return line.includes('\t') ? '\t' : ',';
}

function splitRow(line: string, delimiter: '\t' | ','): string[] {
  if (delimiter === '\t') {
    return line.split('\t').map((c) => c.trim());
  }
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function isHeaderRow(cells: string[]): boolean {
  return cells.some((cell) => {
    const key = normalizeHeader(cell);
    return key in HEADER_MAP;
  });
}

function newDraftRow(
  partial: Partial<Omit<ProviderBulkDraftRow, 'id' | 'status'>>,
): ProviderBulkDraftRow {
  return {
    id: crypto.randomUUID(),
    phone: partial.phone || '',
    name: partial.name || '',
    service: partial.service || '',
    address: partial.address || '',
    experience: partial.experience || '',
    gender: partial.gender || '',
    state: partial.state || '',
    district: partial.district || '',
    block: partial.block || '',
    city: partial.city || '',
    pincode: partial.pincode || '',
    rating: partial.rating || '',
    status: 'pending',
  };
}

export function parseBulkPaste(text: string): ProviderBulkDraftRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const delimiter = detectDelimiter(lines[0]);
  const firstCells = splitRow(lines[0], delimiter);
  const hasHeader = isHeaderRow(firstCells);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  let columnMap: Array<DraftField | null> = [];
  if (hasHeader) {
    columnMap = firstCells.map((cell) => HEADER_MAP[normalizeHeader(cell)] || null);
  } else {
    const defaults: DraftField[] = [
      'phone',
      'name',
      'service',
      'address',
      'experience',
      'gender',
      'state',
      'district',
      'block',
      'city',
      'pincode',
      'rating',
    ];
    columnMap = defaults.map((field) => field);
  }

  const rows: ProviderBulkDraftRow[] = [];
  for (const line of dataLines) {
    const cells = splitRow(line, delimiter);
    if (!cells.some((c) => c.trim())) continue;

    const partial: Partial<Omit<ProviderBulkDraftRow, 'id' | 'status'>> = {};
    columnMap.forEach((field, index) => {
      if (!field) return;
      const value = (cells[index] || '').trim();
      if (value) partial[field] = value;
    });

    if (partial.phone) {
      partial.phone = localTenDigits(partial.phone);
    }

    rows.push(newDraftRow(partial));
  }

  return rows;
}

export function matchServiceValue(
  raw: string,
  options: ServiceOption[],
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const exact = options.find(
    (o) => o.value === trimmed || o.label === trimmed,
  );
  if (exact) return exact.value;
  const lower = trimmed.toLowerCase();
  const ci = options.find(
    (o) =>
      o.value.toLowerCase() === lower || o.label.toLowerCase() === lower,
  );
  return ci?.value ?? null;
}

function namesEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function matchStateValue(
  raw: string,
  states: BulkStateOption[],
): BulkStateOption | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return (
    states.find((s) => s._id === trimmed || namesEqual(s.name, trimmed)) ||
    null
  );
}

function parseDistrictLabel(raw: string): {district: string; stateHint?: string} {
  const trimmed = raw.trim();
  const wrapped = trimmed.match(/^(.*)\s+\(([^)]+)\)\s*$/);
  if (wrapped) {
    return {district: wrapped[1].trim(), stateHint: wrapped[2].trim()};
  }
  return {district: trimmed};
}

export function districtExcelLabel(district: BulkDistrictOption): string {
  return `${district.name} (${district.stateName})`;
}

export function matchDistrictValue(
  raw: string,
  districts: BulkDistrictOption[],
): BulkDistrictOption | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const byId = districts.find((d) => d._id === trimmed);
  if (byId) return byId;
  const parsed = parseDistrictLabel(trimmed);
  const exactLabel = districts.find((d) =>
    namesEqual(districtExcelLabel(d), trimmed),
  );
  if (exactLabel) return exactLabel;
  const nameMatches = districts.filter((d) => namesEqual(d.name, parsed.district));
  if (parsed.stateHint) {
    const withState = nameMatches.find(
      (d) =>
        namesEqual(d.stateName, parsed.stateHint || '') ||
        d.stateId === parsed.stateHint,
    );
    if (withState) return withState;
  }
  return nameMatches.length === 1 ? nameMatches[0] : null;
}

export function blockExcelLabel(block: BulkBlockOption): string {
  return `${block.name} (${block.districtName})`;
}

export function matchBlockValue(
  raw: string,
  blocks: BulkBlockOption[],
): BulkBlockOption | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const byId = blocks.find((b) => b._id === trimmed);
  if (byId) return byId;
  const parsed = parseWrappedLabel(trimmed);
  const exactLabel = blocks.find((b) => namesEqual(blockExcelLabel(b), trimmed));
  if (exactLabel) return exactLabel;
  const nameMatches = blocks.filter((b) => namesEqual(b.name, parsed.name));
  if (parsed.hint) {
    const withHint = nameMatches.find(
      (b) =>
        namesEqual(b.districtName, parsed.hint || '') ||
        b.districtId === parsed.hint,
    );
    if (withHint) return withHint;
  }
  return nameMatches.length === 1 ? nameMatches[0] : null;
}

function parseWrappedLabel(raw: string): {name: string; hint?: string} {
  const trimmed = raw.trim();
  const splitAt = trimmed.lastIndexOf(' (');
  if (splitAt > 0 && trimmed.endsWith(')')) {
    return {
      name: trimmed.slice(0, splitAt).trim(),
      hint: trimmed.slice(splitAt + 2, -1).trim(),
    };
  }
  return {name: trimmed};
}

export function inferGeoFromText(
  text: string,
  states: BulkStateOption[],
  districts: BulkDistrictOption[],
  blocks: BulkBlockOption[] = [],
): {
  state: BulkStateOption | null;
  district: BulkDistrictOption | null;
  block: BulkBlockOption | null;
} {
  const hay = (text || '').trim();
  if (!hay) return {state: null, district: null, block: null};

  const containsName = (name: string) => {
    const n = name.trim();
    if (n.length < 3) return false;
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, 'iu').test(hay);
  };

  const stateHits = states
    .filter((s) => containsName(s.name))
    .sort((a, b) => b.name.length - a.name.length);
  const matchedState = stateHits[0] ?? null;
  const districtPool = matchedState
    ? districts.filter((d) => d.stateId === matchedState._id)
    : districts;
  const districtHits = districtPool
    .filter((d) => containsName(d.name))
    .sort((a, b) => b.name.length - a.name.length);
  let district: BulkDistrictOption | null = districtHits[0] ?? null;
  let state: BulkStateOption | null = matchedState;
  if (district && !state) {
    const districtId = district.stateId;
    state = states.find((s) => s._id === districtId) ?? null;
  }
  const districtForBlocks = district;
  const stateForBlocks = state;
  const blockPool = districtForBlocks
    ? blocks.filter((b) => b.districtId === districtForBlocks._id)
    : stateForBlocks
      ? blocks.filter((b) => b.stateId === stateForBlocks._id)
      : blocks;
  const blockHits = blockPool
    .filter((b) => containsName(b.name))
    .sort((a, b) => b.name.length - a.name.length);
  const block = blockHits[0] || null;
  if (block && !district) {
    district = districts.find((d) => d._id === block.districtId) || null;
    state = state || states.find((s) => s._id === block.stateId) || null;
  }
  return {state, district, block};
}

export function resolveBulkGeo(
  row: ProviderBulkDraftRow,
  page: BulkGeoDefaults,
  states: BulkStateOption[],
  districts: BulkDistrictOption[],
  blocks: BulkBlockOption[] = [],
): {ok: true; geo: BulkGeoDefaults} | {ok: false; message: string} {
  const inferred = inferGeoFromText(
    [row.state, row.district, row.block, row.city, row.address]
      .filter(Boolean)
      .join(', '),
    states,
    districts,
    blocks,
  );
  const stateRaw = (row.state || '').trim() || page.stateName || page.stateId;
  const matchedState =
    matchStateValue(stateRaw, states) ||
    (page.stateId ? states.find((s) => s._id === page.stateId) || null : null) ||
    inferred.state;
  if (!matchedState) {
    return {ok: false, message: 'geoStateRequired'};
  }

  const inState = districts.filter((d) => d.stateId === matchedState._id);
  const districtRaw = (row.district || '').trim();
  const pageDistrictInState = page.districtId
    ? inState.find((d) => d._id === page.districtId) || null
    : null;
  const matchedDistrict =
    (districtRaw ? matchDistrictValue(districtRaw, inState) : null) ||
    (districtRaw ? matchDistrictValue(districtRaw, districts) : null) ||
    (inferred.district && inferred.district.stateId === matchedState._id
      ? inferred.district
      : null) ||
    pageDistrictInState ||
    matchDistrictValue(page.districtName, inState);

  if (!matchedDistrict || matchedDistrict.stateId !== matchedState._id) {
    return {ok: false, message: 'geoDistrictRequired'};
  }

  const inDistrict = blocks.filter((b) => b.districtId === matchedDistrict._id);
  const blockRaw = (row.block || '').trim();
  const pageBlockInDistrict = page.blockId
    ? inDistrict.find((b) => b._id === page.blockId) || null
    : null;
  const matchedBlock =
    (blockRaw ? matchBlockValue(blockRaw, inDistrict) : null) ||
    (blockRaw ? matchBlockValue(blockRaw, blocks) : null) ||
    (inferred.block && inferred.block.districtId === matchedDistrict._id
      ? inferred.block
      : null) ||
    pageBlockInDistrict ||
    matchBlockValue(page.blockName, inDistrict);

  if (inDistrict.length > 0 && !matchedBlock) {
    return {ok: false, message: 'geoBlockRequired'};
  }
  if (matchedBlock && matchedBlock.districtId !== matchedDistrict._id) {
    return {ok: false, message: 'geoBlockRequired'};
  }

  const pageSameState = page.stateId === matchedState._id;
  return {
    ok: true,
    geo: {
      stateId: matchedState._id,
      districtId: matchedDistrict._id,
      blockId: matchedBlock?._id || '',
      city:
        (row.city || '').trim() ||
        (pageSameState ? page.city.trim() : '') ||
        matchedDistrict.name,
      pincode:
        (row.pincode || '').trim() ||
        (pageSameState ? page.pincode.trim() : '') ||
        matchedDistrict.pincode ||
        '',
      stateName: matchedState.name,
      districtName: matchedDistrict.name,
      blockName: matchedBlock?.name || '',
    },
  };
}

export function partnerPinFromPhone(phone: string): string {
  return localTenDigits(phone).slice(0, 6);
}

export function validateBulkRow(
  row: ProviderBulkDraftRow,
  geo: BulkGeoDefaults,
  serviceOptions: ServiceOption[],
  states: BulkStateOption[] = [],
  districts: BulkDistrictOption[] = [],
  blocks: BulkBlockOption[] = [],
): {ok: true; geo: BulkGeoDefaults} | {ok: false; message: string} {
  const ten = localTenDigits(row.phone);
  if (ten.length !== 10) {
    return {ok: false, message: 'phoneTenDigits'};
  }
  const resolved = resolveBulkGeo(row, geo, states, districts, blocks);
  if (!resolved.ok) return resolved;
  if (!(row.service || '').trim()) {
    return {ok: false, message: 'serviceRequired'};
  }
  const matched = matchServiceValue(row.service, serviceOptions);
  if (!matched) {
    return {ok: false, message: 'bulkPartnersServiceUnknown'};
  }
  if ((row.experience || '').trim()) {
    const exp = Number(row.experience);
    if (!Number.isFinite(exp) || exp < 0) {
      return {ok: false, message: 'bulkPartnersExperienceInvalid'};
    }
  }
  if ((row.rating || '').trim()) {
    const rating = Number(row.rating);
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
      return {ok: false, message: 'bulkPartnersRatingInvalid'};
    }
  }
  return {ok: true, geo: resolved.geo};
}

export function isAlreadyExistsError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 409;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('already exists') || msg === 'already_exists';
  }
  return false;
}

export async function insertBulkPartnerRow(
  row: ProviderBulkDraftRow,
  geo: BulkGeoDefaults,
  serviceOptions: ServiceOption[],
  states: BulkStateOption[] = [],
  districts: BulkDistrictOption[] = [],
  blocks: BulkBlockOption[] = [],
): Promise<{userId: string; loginPin: string}> {
  const validation = validateBulkRow(
    row,
    geo,
    serviceOptions,
    states,
    districts,
    blocks,
  );
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const resolved = validation.geo;
  const ten = localTenDigits(row.phone);
  const service =
    matchServiceValue(row.service, serviceOptions) || row.service.trim();
  const experience =
    (row.experience || '').trim() === '' ? undefined : Number(row.experience);
  const rating = (row.rating || '').trim() === '' ? undefined : Number(row.rating);
  const pin = partnerPinFromPhone(ten);

  try {
    const created = await createUser({
      name: row.name.trim() || undefined,
      phone: toE164(ten),
      role: 'provider',
      serviceType: service,
      serviceCategories: [service],
      address: (row.address || '').trim() || undefined,
      city: resolved.city || undefined,
      state: resolved.stateName || undefined,
      district: resolved.districtName || undefined,
      stateId: resolved.stateId || undefined,
      districtId: resolved.districtId || undefined,
      block: resolved.blockName || undefined,
      blockId: resolved.blockId || undefined,
      pincode: resolved.pincode || undefined,
      experience: Number.isFinite(experience) ? experience : undefined,
      rating: Number.isFinite(rating) ? rating : undefined,
      onboardingSource: 'admin_bulk',
    });

    invalidateGeographyListCache({
      districtId: resolved.districtId,
      stateId: resolved.stateId,
    });

    const pinResult = await setUserPin(created._id, pin, 'partner');
    return {userId: created._id, loginPin: pinResult.loginPin};
  } catch (err) {
    if (isAlreadyExistsError(err)) {
      throw new Error('bulkPartnersAlreadyExists');
    }
    throw err;
  }
}

export interface BulkDraftStorage {
  rows: ProviderBulkDraftRow[];
  pasteText: string;
  stateId: string;
  districtId: string;
  blockId?: string;
  city: string;
  pincode: string;
  expanded?: boolean;
}

export function loadBulkDraftFromStorage(): BulkDraftStorage | null {
  try {
    const raw = localStorage.getItem(BULK_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BulkDraftStorage;
    if (!Array.isArray(parsed.rows)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveBulkDraftToStorage(draft: BulkDraftStorage): void {
  try {
    localStorage.setItem(BULK_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // ignore quota errors
  }
}

export function clearBulkDraftStorage(): void {
  localStorage.removeItem(BULK_DRAFT_STORAGE_KEY);
}

function xmlEscape(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function colLetter(col0: number): string {
  let n = col0 + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function inlineCell(col0: number, row1: number, value: string, style?: number): string {
  const ref = `${colLetter(col0)}${row1}`;
  const styleAttr = style != null ? ` s="${style}"` : '';
  return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t>${xmlEscape(value)}</t></is></c>`;
}

function sheetRow(row1: number, values: string[], header = false): string {
  const cells = values
    .map((value, i) => inlineCell(i, row1, value, header ? 1 : undefined))
    .join('');
  return `<row r="${row1}">${cells}</row>`;
}

function listRows(header: string, values: string[]): string {
  const names = values.length ? values : ['-'];
  return [sheetRow(1, [header], true), ...names.map((name, i) => sheetRow(i + 2, [name]))].join(
    '',
  );
}

function listLastRow(values: string[]): number {
  return Math.max(2, values.length + 1);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function u16le(n: number): Uint8Array {
  const b = new Uint8Array(2);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  return b;
}

function u32le(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  b[2] = (n >>> 16) & 0xff;
  b[3] = (n >>> 24) & 0xff;
  return b;
}

/** Uncompressed ZIP — Excel opens this as a normal .xlsx. */
function zipStore(files: Array<{path: string; content: string}>): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const local = concatBytes([
      u32le(0x04034b50),
      u16le(20),
      u16le(0),
      u16le(0),
      u16le(0),
      u16le(0),
      u32le(crc),
      u32le(data.length),
      u32le(data.length),
      u16le(nameBytes.length),
      u16le(0),
      nameBytes,
      data,
    ]);
    locals.push(local);
    const central = concatBytes([
      u32le(0x02014b50),
      u16le(20),
      u16le(20),
      u16le(0),
      u16le(0),
      u16le(0),
      u16le(0),
      u32le(crc),
      u32le(data.length),
      u32le(data.length),
      u16le(nameBytes.length),
      u16le(0),
      u16le(0),
      u16le(0),
      u16le(0),
      u32le(0),
      u32le(offset),
      nameBytes,
    ]);
    centrals.push(central);
    offset += local.length;
  }

  const centralDir = concatBytes(centrals);
  const end = concatBytes([
    u32le(0x06054b50),
    u16le(0),
    u16le(0),
    u16le(files.length),
    u16le(files.length),
    u32le(centralDir.length),
    u32le(offset),
    u16le(0),
  ]);
  return concatBytes([...locals, centralDir, end]);
}

function worksheetXml(
  rowsXml: string,
  options?: {
    selected?: boolean;
    freezeHeader?: boolean;
    colWidths?: number[];
    validations?: Array<{sqref: string; formula: string}>;
  },
): string {
  const selected = options?.selected ? ' tabSelected="1"' : '';
  const freeze = options?.freezeHeader
    ? `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>`
    : '';
  const cols = (options?.colWidths || [])
    .map(
      (w, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`,
    )
    .join('');
  const validations = options?.validations?.length
    ? `<dataValidations count="${options.validations.length}">${options.validations
        .map(
          (v) =>
            `<dataValidation type="list" allowBlank="1" sqref="${v.sqref}"><formula1>${xmlEscape(v.formula)}</formula1></dataValidation>`,
        )
        .join('')}</dataValidations>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView${selected} workbookViewId="0">${freeze}</sheetView></sheetViews>
  ${cols ? `<cols>${cols}</cols>` : ''}
  <sheetData>${rowsXml}</sheetData>
  ${validations}
</worksheet>`;
}

export function buildBulkOnboardingXlsx(
  serviceOptions: ServiceOption[],
  states: BulkStateOption[] = [],
  districts: BulkDistrictOption[] = [],
  blocks: BulkBlockOption[] = [],
): Uint8Array {
  const services = serviceOptions
    .map((o) => (o.label || o.value).trim())
    .filter(Boolean);
  const stateNames = states.map((s) => s.name.trim()).filter(Boolean);
  const districtLabels = districts
    .slice()
    .sort((a, b) =>
      a.stateName === b.stateName
        ? a.name.localeCompare(b.name)
        : a.stateName.localeCompare(b.stateName),
    )
    .map(districtExcelLabel);
  const blockLabels = blocks
    .slice()
    .sort((a, b) =>
      a.districtName === b.districtName
        ? a.name.localeCompare(b.name)
        : a.districtName.localeCompare(b.districtName),
    )
    .map(blockExcelLabel);
  const sampleService = services[0] || 'Electrician';
  const sampleState = stateNames[0] || 'Jharkhand';
  const sampleDistrict =
    districtLabels.find((label) => label.endsWith(`(${sampleState})`)) ||
    districtLabels[0] ||
    'Garhwa (Jharkhand)';
  const districtNameOnly = sampleDistrict.split(' (')[0] || '';
  const sampleBlock =
    blockLabels.find((label) => label.endsWith(`(${districtNameOnly})`)) ||
    blockLabels[0] ||
    '';

  const partnersRows = [
    sheetRow(
      1,
      [
        'Phone',
        'Name',
        'Service',
        'Address',
        'Experience',
        'Gender',
        'State',
        'District',
        'Block',
        'City',
        'Pincode',
        'Rating',
      ],
      true,
    ),
    sheetRow(2, [
      '9876543210',
      'Ramesh Kumar',
      sampleService,
      '12 MG Road',
      '5',
      'Male',
      sampleState,
      sampleDistrict,
      sampleBlock,
      districtNameOnly || 'Garhwa',
      '',
      '',
    ]),
  ].join('');

  const notesRows = [
    sheetRow(1, ['How to use this template'], true),
    sheetRow(2, [
      'Phone: 10-digit Indian mobile. Partner PIN is the first 6 digits of this number.',
    ]),
    sheetRow(3, [
      'Service, State, District, and Block: pick from the dropdowns. Block is required when the district has blocks (for example Garhwa).',
    ]),
    sheetRow(4, [
      'Name, Address, Experience (years), Gender, City, Pincode, Rating (0-5) are optional.',
    ]),
    sheetRow(5, [
      'If State, District, or Block is blank, Admin uses the Default location on the bulk onboarding page.',
    ]),
    sheetRow(6, ['Gender is for your notes; it is not saved on the Partner yet.']),
    sheetRow(7, [
      'Copy the Partners sheet rows (including the header) and paste into Admin, then click Load rows.',
    ]),
  ].join('');

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet5.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet6.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Partners" sheetId="1" r:id="rId1"/>
    <sheet name="Services" sheetId="2" r:id="rId2"/>
    <sheet name="StateList" sheetId="3" r:id="rId3"/>
    <sheet name="DistrictList" sheetId="4" r:id="rId4"/>
    <sheet name="BlockList" sheetId="5" r:id="rId5"/>
    <sheet name="Notes" sheetId="6" r:id="rId6"/>
  </sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet5.xml"/>
  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet6.xml"/>
  <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf/></cellStyleXfs>
  <cellXfs count="2">
    <xf xfId="0"/>
    <xf xfId="0" fontId="1" applyFont="1"/>
  </cellXfs>
</styleSheet>`;

  const files = [
    {path: '[Content_Types].xml', content: contentTypes},
    {path: '_rels/.rels', content: rels},
    {path: 'xl/workbook.xml', content: workbook},
    {path: 'xl/_rels/workbook.xml.rels', content: workbookRels},
    {path: 'xl/styles.xml', content: styles},
    {
      path: 'xl/worksheets/sheet1.xml',
      content: worksheetXml(partnersRows, {
        selected: true,
        freezeHeader: true,
        colWidths: [12, 16, 18, 22, 12, 10, 16, 22, 22, 14, 10, 8],
        validations: [
          {
            sqref: 'C2:C1000',
            formula: `'Services'!$A$2:$A$${listLastRow(services)}`,
          },
          {sqref: 'F2:F1000', formula: '"Male,Female,Other"'},
          {
            sqref: 'G2:G1000',
            formula: `'StateList'!$A$2:$A$${listLastRow(stateNames)}`,
          },
          {
            sqref: 'H2:H1000',
            formula: `'DistrictList'!$A$2:$A$${listLastRow(districtLabels)}`,
          },
          {
            sqref: 'I2:I1000',
            formula: `'BlockList'!$A$2:$A$${listLastRow(blockLabels)}`,
          },
        ],
      }),
    },
    {
      path: 'xl/worksheets/sheet2.xml',
      content: worksheetXml(listRows('ServiceType', services), {
        colWidths: [28],
      }),
    },
    {
      path: 'xl/worksheets/sheet3.xml',
      content: worksheetXml(listRows('State', stateNames), {colWidths: [22]}),
    },
    {
      path: 'xl/worksheets/sheet4.xml',
      content: worksheetXml(listRows('District', districtLabels), {
        colWidths: [32],
      }),
    },
    {
      path: 'xl/worksheets/sheet5.xml',
      content: worksheetXml(listRows('Block', blockLabels), {colWidths: [36]}),
    },
    {
      path: 'xl/worksheets/sheet6.xml',
      content: worksheetXml(notesRows, {colWidths: [90]}),
    },
  ];

  return zipStore(files);
}

export function downloadBulkTemplate(
  serviceOptions: ServiceOption[] = [],
  states: BulkStateOption[] = [],
  districts: BulkDistrictOption[] = [],
  blocks: BulkBlockOption[] = [],
): void {
  const bytes = buildBulkOnboardingXlsx(
    serviceOptions,
    states,
    districts,
    blocks,
  );
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'partner-bulk-onboarding-template.xlsx';
  anchor.click();
  URL.revokeObjectURL(url);
}
