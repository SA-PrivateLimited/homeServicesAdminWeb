import { apiDelete, apiGet, apiPost, apiPut } from './apiClient';

export type QuestionType =
  | 'text'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'boolean';

export interface QuestionnaireQuestion {
  id: string;
  question: string;
  questionHi?: string;
  type: QuestionType;
  options?: string[];
  optionsHi?: string[];
  required: boolean;
  placeholder?: string;
  placeholderHi?: string;
}

export interface ServiceCategory {
  _id: string;
  name: string;
  nameHi?: string;
  icon?: string;
  color?: string;
  description?: string;
  descriptionHi?: string;
  isActive?: boolean;
  isPopular?: boolean;
  /** Browse "See all" section key (Admin-managed). */
  sectionKey?: string;
  sectionLabelEn?: string;
  sectionLabelHi?: string;
  /** Search aliases for CustomerWeb (Admin-managed). */
  searchTerms?: string[];
  order?: number;
  questionnaire?: QuestionnaireQuestion[];
  requiresVehicle?: boolean;
  partnerDocuments?: Array<{
    key: string;
    label?: string;
    labelHi?: string;
    required?: boolean;
  }>;
}

export interface ServiceCategorySection {
  key: string;
  labelEn: string;
  labelHi: string;
  order?: number;
  isActive?: boolean;
}

export type CategoryInput = Omit<ServiceCategory, '_id'>;

export type CategorySectionInput = {
  key?: string;
  labelEn: string;
  labelHi: string;
  order?: number;
  isActive?: boolean;
};

function asList(
  data: ServiceCategory[] | { categories?: ServiceCategory[]; data?: ServiceCategory[] },
): ServiceCategory[] {
  if (Array.isArray(data)) return data;
  return data.data ?? data.categories ?? [];
}

function asSectionList(
  data:
    | ServiceCategorySection[]
    | { data?: ServiceCategorySection[]; sections?: ServiceCategorySection[] },
): ServiceCategorySection[] {
  if (Array.isArray(data)) return data;
  return data.data ?? data.sections ?? [];
}

export async function getServiceCategories(
  includeInactive = true,
): Promise<ServiceCategory[]> {
  const qs = includeInactive ? '?includeInactive=true' : '';
  const data = await apiGet<
    ServiceCategory[] | { categories?: ServiceCategory[]; data?: ServiceCategory[] }
  >(`/api/serviceCategories${qs}`);
  return asList(data);
}

export async function getServiceCategorySections(
  includeInactive = false,
): Promise<ServiceCategorySection[]> {
  const qs = includeInactive ? '?includeInactive=true' : '';
  const data = await apiGet<
    | ServiceCategorySection[]
    | { data?: ServiceCategorySection[]; sections?: ServiceCategorySection[] }
  >(`/api/serviceCategories/sections${qs}`);
  return asSectionList(data).sort(
    (a, b) =>
      (a.order ?? 999) - (b.order ?? 999) || a.key.localeCompare(b.key),
  );
}

export async function createServiceCategorySection(
  input: CategorySectionInput,
): Promise<ServiceCategorySection> {
  return apiPost<ServiceCategorySection>(
    '/api/serviceCategories/sections',
    input,
  );
}

export async function updateServiceCategorySection(
  sectionKey: string,
  updates: Partial<CategorySectionInput>,
): Promise<ServiceCategorySection> {
  return apiPut<ServiceCategorySection>(
    `/api/serviceCategories/sections/${encodeURIComponent(sectionKey)}`,
    updates,
  );
}

export async function deleteServiceCategorySection(
  sectionKey: string,
): Promise<void> {
  await apiDelete(
    `/api/serviceCategories/sections/${encodeURIComponent(sectionKey)}`,
  );
}

export async function getServiceCategoryById(
  categoryId: string,
): Promise<ServiceCategory | null> {
  try {
    return await apiGet<ServiceCategory>(`/api/serviceCategories/${categoryId}`);
  } catch {
    return null;
  }
}

export async function createServiceCategory(
  category: CategoryInput,
): Promise<ServiceCategory> {
  return apiPost<ServiceCategory>('/api/serviceCategories', category);
}

export async function updateServiceCategory(
  categoryId: string,
  updates: Partial<CategoryInput>,
): Promise<ServiceCategory> {
  const payload = { ...updates };
  if (Array.isArray(payload.questionnaire) && payload.questionnaire.length === 0) {
    payload.questionnaire = undefined;
  }
  return apiPut<ServiceCategory>(`/api/serviceCategories/${categoryId}`, payload);
}

export async function deleteServiceCategory(categoryId: string): Promise<void> {
  await apiDelete(`/api/serviceCategories/${categoryId}`);
}
