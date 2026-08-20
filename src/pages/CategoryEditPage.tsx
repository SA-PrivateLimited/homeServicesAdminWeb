import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QuestionnaireEditor } from '../components/QuestionnaireEditor';
import {Button, Loader, Select} from 'sapvt-ltd-web-packages';
import {
  createServiceCategory,
  getServiceCategoryById,
  getServiceCategorySections,
  updateServiceCategory,
  type QuestionnaireQuestion,
  type ServiceCategorySection,
} from '../services/api/serviceCategoriesApi';
import { getClientPrimary } from '../theme';
import { CATEGORY_SECTION_FALLBACK } from '../constants/categorySections';
import '../styles/pages.css';

const DEFAULT_ICON = 'build';

function themePrimary(): string {
  return getClientPrimary();
}

function parseSearchTerms(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n,]+/)) {
    const term = part.trim().replace(/^['"]+|['"]+$/g, '').trim();
    if (!term) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(term);
  }
  return out;
}

export function CategoryEditPage() {
  const { categoryId } = useParams();
  const isNew = !categoryId || categoryId === 'new';
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isHindi = i18n.language?.startsWith('hi');
  const [sections, setSections] = useState<ServiceCategorySection[]>(
    CATEGORY_SECTION_FALLBACK,
  );

  const sectionOptions = useMemo(
    () =>
      sections.map((opt) => ({
        value: opt.key,
        label: isHindi ? opt.labelHi : opt.labelEn,
        searchText: `${opt.labelEn} ${opt.labelHi} ${opt.key}`,
      })),
    [isHindi, sections],
  );

  const [name, setName] = useState('');
  const [nameHi, setNameHi] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionHi, setDescriptionHi] = useState('');
  const [isPopular, setIsPopular] = useState(false);
  const [sectionKey, setSectionKey] = useState('other');
  const [searchTermsText, setSearchTermsText] = useState('');
  const [icon, setIcon] = useState(DEFAULT_ICON);
  const [color, setColor] = useState(themePrimary);
  const [order, setOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [requiresVehicle, setRequiresVehicle] = useState(false);
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireQuestion[]>(
    [],
  );
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getServiceCategorySections()
      .then((rows) => {
        if (!cancelled && rows.length) setSections(rows);
      })
      .catch(() => {
        /* keep FALLBACK */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    (async () => {
      try {
        const cat = await getServiceCategoryById(categoryId!);
        if (cancelled) return;
        if (!cat) {
          setError(t('notFound'));
          return;
        }
        setName(cat.name);
        setNameHi(cat.nameHi || '');
        setDescription(cat.description || '');
        setDescriptionHi(cat.descriptionHi || '');
        setIsPopular(Boolean(cat.isPopular));
        setSectionKey(cat.sectionKey || 'other');
        setSearchTermsText((cat.searchTerms || []).join(', '));
        setIcon(cat.icon || DEFAULT_ICON);
        setColor(cat.color || themePrimary());
        setOrder(cat.order ?? 0);
        setIsActive(cat.isActive !== false);
        setRequiresVehicle(Boolean(cat.requiresVehicle));
        setQuestionnaire(cat.questionnaire || []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('errorGeneric'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryId, isNew, t]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError(t('nameRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      nameHi: nameHi.trim() || undefined,
      description: description.trim() || undefined,
      descriptionHi: descriptionHi.trim() || undefined,
      icon: icon.trim() || DEFAULT_ICON,
      color: color.trim() || themePrimary(),
      order: Number(order) || 0,
      isActive,
      isPopular,
      sectionKey: sectionKey.trim() || 'other',
      searchTerms: parseSearchTerms(searchTermsText),
      requiresVehicle,
      questionnaire,
    };
    try {
      if (isNew) {
        await createServiceCategory(payload);
      } else {
        await updateServiceCategory(categoryId!, payload);
      }
      navigate('/categories');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loader label={t('loading')} />;
  }

  return (
    <div className="admin-page scale-baseline-80" data-testid="category-edit-root">
      <header className="page-header row-header">
        <div>
          <p className="breadcrumb">
            <Link to="/categories">{t('navCategories')}</Link> /{' '}
            {isNew ? t('addCategory') : t('editCategory')}
          </p>
          <h1>{isNew ? t('addCategory') : t('editCategory')}</h1>
          <p>{t('categoryEditLead')}</p>
        </div>
        <div className="row-header-actions actions">
          <Link className="hs-btn hs-btn--ghost hs-btn--md" to="/categories">
            {t('cancel')}
          </Link>
          <Button
            type="submit"
            form="category-edit-form"
            variant="primary"
            data-testid="save-category-btn-top"
            disabled={saving}>
            {saving ? t('saving') : t('save')}
          </Button>
        </div>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      <form
        id="category-edit-form"
        className="panel form-panel"
        onSubmit={onSubmit}>
        <div className="form-row">
          <label>
            {t('name')} (English) *
            <input
              data-testid="category-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Plumber"
            />
          </label>
          <label>
            {t('nameHi', 'Category name (Hindi)')} *
            <input
              value={nameHi}
              onChange={(e) => setNameHi(e.target.value)}
              placeholder="e.g. प्लंबर"
              lang="hi"
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            {t('order')}
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
            />
          </label>
          <label className="checkbox-label" style={{alignSelf: 'flex-end', paddingBottom: '6px'}}>
            <input
              type="checkbox"
              checked={isPopular}
              onChange={(e) => setIsPopular(e.target.checked)}
            />
            {t('isPopular', 'Show in Popular Services')}
          </label>
        </div>
        <div className="form-row">
          <label>
            {t('description')} (English)
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label>
            {t('descriptionHi')} (Hindi)
            <input
              value={descriptionHi}
              onChange={(e) => setDescriptionHi(e.target.value)}
              lang="hi"
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            {t('icon')}
            <input value={icon} onChange={(e) => setIcon(e.target.value)} />
          </label>
          <label>
            {t('color')}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
        </div>
        <div className="form-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            {t('active')}
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={requiresVehicle}
              onChange={(e) => setRequiresVehicle(e.target.checked)}
            />
            {t('requiresVehicle')}
          </label>
        </div>

        <section className="category-discovery" data-testid="category-discovery-section">
          <h3>{t('categoryDiscoveryTitle')}</h3>
          <p className="muted compact">{t('categoryDiscoveryLead')}</p>
          <div className="form-row">
            <Select
              label={t('categorySectionLabel')}
              options={sectionOptions}
              value={sectionKey}
              onChange={setSectionKey}
              allowClear={false}
              showSearch
              searchPlaceholder={t('categorySectionSearch')}
              emptyMessage={t('empty')}
            />
          </div>
          <div className="form-row">
            <label>
              {t('categorySearchTermsLabel')}
              <textarea
                value={searchTermsText}
                onChange={(e) => setSearchTermsText(e.target.value)}
                rows={4}
                placeholder={t('categorySearchTermsPlaceholder')}
              />
            </label>
          </div>
          <p className="muted compact">{t('categorySearchTermsHint')}</p>
        </section>

        <QuestionnaireEditor value={questionnaire} onChange={setQuestionnaire} />

        <div className="actions form-actions">
          <Button type="submit" variant="primary" data-testid="save-category-btn" disabled={saving}>
            {saving ? t('saving') : t('save')}
          </Button>
          <Link className="hs-btn hs-btn--ghost hs-btn--md" to="/categories">
            {t('cancel')}
          </Link>
        </div>
      </form>
    </div>
  );
}
