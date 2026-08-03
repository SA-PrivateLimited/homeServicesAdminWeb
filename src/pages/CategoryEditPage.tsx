import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QuestionnaireEditor } from '../components/QuestionnaireEditor';
import {
  createServiceCategory,
  getServiceCategoryById,
  updateServiceCategory,
  type QuestionnaireQuestion,
} from '../services/api/serviceCategoriesApi';
import { getClientPrimary } from '../theme';
import '../styles/pages.css';

const DEFAULT_ICON = 'build';

function themePrimary(): string {
  return getClientPrimary();
}

export function CategoryEditPage() {
  const { categoryId } = useParams();
  const isNew = !categoryId || categoryId === 'new';
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionHi, setDescriptionHi] = useState('');
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
        setDescription(cat.description || '');
        setDescriptionHi(cat.descriptionHi || '');
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
      description: description.trim() || undefined,
      descriptionHi: descriptionHi.trim() || undefined,
      icon: icon.trim() || DEFAULT_ICON,
      color: color.trim() || themePrimary(),
      order: Number(order) || 0,
      isActive,
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
    return <p className="muted">{t('loading')}</p>;
  }

  return (
    <div className="admin-page scale-baseline-80" data-testid="category-edit-root">
      <header className="page-header">
        <p className="breadcrumb">
          <Link to="/categories">{t('navCategories')}</Link> /{' '}
          {isNew ? t('addCategory') : t('editCategory')}
        </p>
        <h1>{isNew ? t('addCategory') : t('editCategory')}</h1>
        <p>{t('categoryEditLead')}</p>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      <form className="panel form-panel" onSubmit={onSubmit}>
        <div className="form-row">
          <label>
            {t('name')}
            <input
              data-testid="category-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            {t('order')}
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            {t('description')}
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label>
            {t('descriptionHi')}
            <input
              value={descriptionHi}
              onChange={(e) => setDescriptionHi(e.target.value)}
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

        <QuestionnaireEditor value={questionnaire} onChange={setQuestionnaire} />

        <div className="actions form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            data-testid="save-category-btn"
            disabled={saving}
          >
            {saving ? t('saving') : t('save')}
          </button>
          <Link className="btn btn-ghost" to="/categories">
            {t('cancel')}
          </Link>
        </div>
      </form>
    </div>
  );
}
