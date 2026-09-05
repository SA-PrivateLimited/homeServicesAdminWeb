import type {EmployeeIdCardPayload} from '../../services/api/employeesApi';
import {formatExperienceYears, maskPhoneDisplay} from '../../services/api/employeesApi';
import './EmployeeIdCard.css';

type Props = {
  card: EmployeeIdCardPayload;
};

export function EmployeeIdCard({card}: Props) {
  const profession = card.profession || card.designation || '—';

  return (
    <div className="akanso-id-print-root">
      <article className="akanso-id-card akanso-id-card--front" aria-label="ID card front">
        <header className="akanso-id-card__silver">
          <div className="akanso-id-card__brand">
            <span className="akanso-id-card__logo">AKANSO</span>
            <span className="akanso-id-card__tag">EMPLOYEE IDENTITY</span>
          </div>
        </header>
        <div className="akanso-id-card__body">
          <div className="akanso-id-card__photo-wrap">
            {card.photoUrl ? (
              <img
                src={card.photoUrl}
                alt=""
                className="akanso-id-card__photo"
              />
            ) : (
              <div className="akanso-id-card__photo akanso-id-card__photo--fallback">
                {(card.fullName || '?').slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <h2 className="akanso-id-card__name">{card.fullName}</h2>
          <p className="akanso-id-card__role">{profession}</p>
          <dl className="akanso-id-card__fields">
            <div>
              <dt>Employee ID</dt>
              <dd>{card.employeeCode}</dd>
            </div>
            <div>
              <dt>Experience</dt>
              <dd>{formatExperienceYears(card.experienceYears)}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{maskPhoneDisplay(card.phone)}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{card.location || '—'}</dd>
            </div>
          </dl>
          <div className="akanso-id-card__qr-row">
            <img
              src={card.qrDataUrl}
              alt="Employee verification QR"
              className="akanso-id-card__qr"
            />
            <span className="akanso-id-card__footer-brand">Akanso</span>
          </div>
        </div>
      </article>

      <article className="akanso-id-card akanso-id-card--back" aria-label="ID card back">
        <header className="akanso-id-card__silver">
          <div className="akanso-id-card__brand">
            <span className="akanso-id-card__logo">AKANSO</span>
          </div>
        </header>
        <div className="akanso-id-card__body akanso-id-card__body--back">
          <p className="akanso-id-card__back-copy">
            This card identifies the holder as an authorized Akanso employee.
          </p>
          <p className="akanso-id-card__back-copy">
            If found, please return to Akanso.
          </p>
          <div className="akanso-id-card__back-id">
            <span>Employee ID</span>
            <strong>{card.employeeCode}</strong>
          </div>
          <img
            src={card.qrDataUrl}
            alt="Employee verification QR"
            className="akanso-id-card__qr akanso-id-card__qr--lg"
          />
          <p className="akanso-id-card__authorized">Authorized Employee</p>
        </div>
      </article>
    </div>
  );
}
