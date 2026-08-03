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
  icon?: string;
  color?: string;
  description?: string;
  descriptionHi?: string;
  isActive?: boolean;
  order?: number;
  questionnaire?: QuestionnaireQuestion[];
  requiresVehicle?: boolean;
}

export type CategoryInput = Omit<ServiceCategory, '_id'>;

function asList(
  data: ServiceCategory[] | { categories?: ServiceCategory[] },
): ServiceCategory[] {
  if (Array.isArray(data)) return data;
  return data.categories ?? [];
}

export async function getServiceCategories(
  includeInactive = true,
): Promise<ServiceCategory[]> {
  const qs = includeInactive ? '?includeInactive=true' : '';
  const data = await apiGet<ServiceCategory[] | { categories?: ServiceCategory[] }>(
    `/api/serviceCategories${qs}`,
  );
  return asList(data);
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
