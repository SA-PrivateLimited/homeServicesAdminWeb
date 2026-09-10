import type {EmployeeIdCardPayload} from '../../services/api/employeesApi';
import {
  formatExperienceYears,
  maskPhoneDisplay,
} from '../../services/api/employeesApi';
import './EmployeeIdCard.css';

type Props = {
  card: EmployeeIdCardPayload;
};

export function EmployeeIdCard({card}: Props) {
  const profession = card.profession || card.designation || '—';
  const initial = (card.fullName || '?').trim().slice(0, 1).toUpperCase();

  return (
    <div className="akanso-id-print-root">
      <article
        className="akanso-id-card akanso-id-card--front"
        aria-label="ID card front">
        <header className="akanso-id-card__silver">
          <div className="akanso-id-card__brand">
            <img
              className="akanso-id-card__logo"
              src="/logo-mark.webp"
              alt=""
              width={48}
              height={48}
            />
            <div className="akanso-id-card__brand-text">
              <span className="akanso-id-card__wordmark">AKANSHO</span>
              <span className="akanso-id-card__tag">Employee Identity</span>
            </div>
          </div>
          <span className="akanso-id-card__chip" aria-hidden />
        </header>

        <div className="akanso-id-card__body akanso-id-card__body--front">
          <div className="akanso-id-card__photo-col">
            {card.photoUrl ? (
              <img
                src={card.photoUrl}
                alt=""
                className="akanso-id-card__photo"
              />
            ) : (
              <div
                className="akanso-id-card__photo akanso-id-card__photo--fallback"
                aria-hidden>
                {initial}
              </div>
            )}
          </div>

          <div className="akanso-id-card__info-col">
            <h2 className="akanso-id-card__name">{card.fullName}</h2>
            <p className="akanso-id-card__role">{profession}</p>

            <dl className="akanso-id-card__fields">
              <div className="akanso-id-card__field">
                <dt>Employee ID</dt>
                <dd>{card.employeeCode}</dd>
              </div>
              <div className="akanso-id-card__field">
                <dt>Experience</dt>
                <dd>{formatExperienceYears(card.experienceYears)}</dd>
              </div>
              <div className="akanso-id-card__field">
                <dt>Phone</dt>
                <dd>{maskPhoneDisplay(card.phone)}</dd>
              </div>
              <div className="akanso-id-card__field">
                <dt>Location</dt>
                <dd>{card.location || '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="akanso-id-card__qr-col">
            <img
              src={card.qrDataUrl}
              alt="Employee verification QR"
              className="akanso-id-card__qr"
            />
            <span className="akanso-id-card__footer-brand">Akansho</span>
          </div>
        </div>
      </article>

      <article
        className="akanso-id-card akanso-id-card--back"
        aria-label="ID card back">
        <header className="akanso-id-card__silver">
          <div className="akanso-id-card__brand akanso-id-card__brand--text-only">
            <div className="akanso-id-card__brand-text">
              <span className="akanso-id-card__wordmark">AKANSHO</span>
              <span className="akanso-id-card__tag">Authorized Employee</span>
            </div>
          </div>
        </header>

        <div className="akanso-id-card__body akanso-id-card__body--back">
          <div className="akanso-id-card__back-main">
            <p className="akanso-id-card__back-copy">
              This card identifies the holder as an authorized Akansho employee.
            </p>
            <p className="akanso-id-card__back-copy">
              If found, please return to Akansho.
            </p>
            <div className="akanso-id-card__back-id">
              <span>Employee ID</span>
              <strong>{card.employeeCode}</strong>
            </div>
          </div>
          <div className="akanso-id-card__back-qr">
            <img
              src={card.qrDataUrl}
              alt="Employee verification QR"
              className="akanso-id-card__qr akanso-id-card__qr--lg"
            />
            <p className="akanso-id-card__authorized">Authorized Employee</p>
          </div>
        </div>
      </article>
    </div>
  );
}
