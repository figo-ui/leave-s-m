import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const AboutSystem: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const version = import.meta.env.VITE_APP_VERSION || '1.0.0';

  return (
    <div className="info-page">
      <div className="info-header">
        <h1>{t('pages.about_system.title')}</h1>
        <p>{t('pages.about_system.description')}</p>
      </div>

      <div className="info-grid">
        <section className="info-card">
          <h2>{t('pages.about_system.sections.summary.title')}</h2>
          <p className="info-paragraph">{t('pages.about_system.sections.summary.body')}</p>
          <div className="info-pills">
            <span className="info-pill">{t('pages.about_system.sections.summary.version', { version })}</span>
            <span className="info-pill">{t('app.university_name')}</span>
          </div>
        </section>

        <section className="info-card">
          <h2>{t('pages.about_system.sections.features.title')}</h2>
          <ul className="info-list">
            <li>{t('pages.about_system.sections.features.items.apply')}</li>
            <li>{t('pages.about_system.sections.features.items.approve')}</li>
            <li>{t('pages.about_system.sections.features.items.reports')}</li>
          </ul>
        </section>

        <section className="info-card">
          <h2>{t('pages.about_system.sections.roles.title')}</h2>
          <ul className="info-list">
            <li>{t('pages.about_system.sections.roles.items.employee')}</li>
            <li>{t('pages.about_system.sections.roles.items.manager')}</li>
            <li>{t('pages.about_system.sections.roles.items.hr')}</li>
          </ul>
        </section>
      </div>

      <div className="info-actions">
        <button className="primary" onClick={() => navigate('/help-support')}>
          {t('pages.about_system.actions.help')}
        </button>
        <button className="secondary" onClick={() => navigate('/dashboard')}>
          {t('pages.about_system.actions.dashboard')}
        </button>
      </div>
    </div>
  );
};

export default AboutSystem;
