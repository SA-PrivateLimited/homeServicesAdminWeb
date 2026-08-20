/**
 * Browse section options — loaded from backend GET /api/serviceCategories/sections.
 * Local FALLBACK only used if the API is unreachable.
 */

export type CategorySectionOption = {
  key: string;
  labelEn: string;
  labelHi: string;
  order?: number;
};

/** Offline / boot fallback — prefer getCategorySections() from API. */
export const CATEGORY_SECTION_FALLBACK: CategorySectionOption[] = [
  {
    key: 'other',
    labelEn: 'Other',
    labelHi: 'अन्य',
    order: 99,
  },
];

export function categorySectionLabel(
  sectionKey: string | undefined,
  lang: 'hi' | 'en',
  options: CategorySectionOption[] = CATEGORY_SECTION_FALLBACK,
): string {
  const key = sectionKey || 'other';
  const opt =
    options.find((o) => o.key === key) ||
    options[options.length - 1] ||
    CATEGORY_SECTION_FALLBACK[0];
  return lang === 'hi' ? opt.labelHi : opt.labelEn;
}
