import React from 'react';
import { useTranslation } from 'react-i18next';

interface InfoPageProps {
  titleKey: string;
  descriptionKey: string;
  hintKey?: string;
}

const InfoPage: React.FC<InfoPageProps> = ({ titleKey, descriptionKey, hintKey }) => {
  const { t } = useTranslation();
  const hintText = hintKey ? t(hintKey) : '';

  return (
    <div className="coming-soon">
      <h2>{t(titleKey)}</h2>
      <p>{t(descriptionKey)}</p>
      {hintText && (
        <div className="demo-instructions">
          <p>{hintText}</p>
        </div>
      )}
    </div>
  );
};

export default InfoPage;
