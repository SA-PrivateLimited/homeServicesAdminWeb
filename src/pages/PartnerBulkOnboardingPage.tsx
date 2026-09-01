import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {Icon} from 'sapvt-ltd-web-packages';
import {BulkPartnersPanel} from '../components/providers/BulkPartnersPanel';
import {getServiceCategories} from '../services/api/serviceCategoriesApi';
import {
  getGeographyMeta,
  type GeographyMetaBlock,
  type GeographyMetaDistrict,
  type GeographyMetaState,
} from '../services/api/geographyApi';
import '../styles/pages.css';
import './PartnerBulkOnboardingPage.css';

export function PartnerBulkOnboardingPage() {
  const {t} = useTranslation();
  const [geoStates, setGeoStates] = useState<GeographyMetaState[]>([]);
  const [geoDistricts, setGeoDistricts] = useState<GeographyMetaDistrict[]>(
    [],
  );
  const [geoBlocks, setGeoBlocks] = useState<GeographyMetaBlock[]>([]);
  const [serviceOptions, setServiceOptions] = useState<
    {value: string; label: string}[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      getGeographyMeta({force: true}),
      getServiceCategories(false),
    ])
      .then(([meta, cats]) => {
        if (cancelled) return;
        setGeoStates(meta.states || []);
        setGeoDistricts(meta.districts || []);
        setGeoBlocks(meta.blocks || []);
        setServiceOptions(
          cats
            .filter((c) => c.isActive !== false)
            .map((c) => ({value: c.name, label: c.name})),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setGeoStates([]);
        setGeoDistricts([]);
        setGeoBlocks([]);
        setServiceOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="admin-page scale-baseline-80 bulk-partners-page"
      data-testid="partner-bulk-onboarding-page">
      <header className="page-header bulk-partners-page__header">
        <nav className="bulk-partners-page__breadcrumb" aria-label="Breadcrumb">
          <Link to="/providers" className="bulk-partners-page__back">
            <Icon name="arrow_back" size={18} />
            {t('bulkPartnersBackToProviders')}
          </Link>
        </nav>
        <h1>{t('bulkPartnersTitle')}</h1>
        <p>{t('bulkPartnersLead')}</p>
      </header>

      {loading ? (
        <div className="panel bulk-partners-page__loading">
          <p>{t('loading')}</p>
        </div>
      ) : (
        <BulkPartnersPanel
          standalone
          geoStates={geoStates}
          geoDistricts={geoDistricts}
          geoBlocks={geoBlocks}
          serviceOptions={serviceOptions}
          onProviderCreated={async () => {}}
        />
      )}
    </div>
  );
}
