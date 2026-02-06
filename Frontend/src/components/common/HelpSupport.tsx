import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const HelpSupport: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="info-page">
      <div className="info-header">
        <h1>{t('pages.help_support.title')}</h1>
        <p>{t('pages.help_support.description')}</p>
      </div>

      <div className="info-grid">
        <section className="info-card">
          <h2>{t('pages.help_support.sections.getting_started.title')}</h2>
          <ul className="info-list">
            <li>{t('pages.help_support.sections.getting_started.items.apply')}</li>
            <li>{t('pages.help_support.sections.getting_started.items.track')}</li>
            <li>{t('pages.help_support.sections.getting_started.items.profile')}</li>
          </ul>
        </section>

        <section className="info-card">
          <h2>{t('pages.help_support.sections.common_issues.title')}</h2>
          <ul className="info-list">
            <li>{t('pages.help_support.sections.common_issues.items.login')}</li>
            <li>{t('pages.help_support.sections.common_issues.items.language')}</li>
            <li>{t('pages.help_support.sections.common_issues.items.balance')}</li>
          </ul>
        </section>

        <section className="info-card">
          <h2>{t('pages.help_support.sections.contact.title')}</h2>
          <p className="info-paragraph">{t('pages.help_support.sections.contact.description')}</p>
          <div className="info-pills">
            <span className="info-pill">{t('pages.help_support.sections.contact.email')}</span>
            <span className="info-pill">{t('pages.help_support.sections.contact.phone')}</span>
            <span className="info-pill">{t('pages.help_support.sections.contact.hours')}</span>
          </div>
        </section>
      </div>

      <div className="info-actions">
        <button className="primary" onClick={() => navigate('/profile-settings')}>
          {t('pages.help_support.actions.profile')}
        </button>
        <button className="secondary" onClick={() => navigate('/leave-history')}>
          {t('pages.help_support.actions.leave_history')}
        </button>
        <button className="secondary" onClick={() => navigate('/about-system')}>
          {t('pages.help_support.actions.about')}
        </button>
      </div>

      <div className="info-note">
        {t('pages.help_support.hint')}
      </div>
    </div>
  );
};

export default HelpSupport;
