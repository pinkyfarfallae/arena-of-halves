import React from 'react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { T } from '../../../../constants/translationKeys';
import './SubmissionSuccessCard.scss';

export default function SubmissionSuccessCard() {
  const { t } = useTranslation();

  return (
    <div className="strawberry-fields__success">
      <h3>{t(T.SUCCESSFUL_HARVEST_TITLE)}</h3>
      <p>{t(T.SUCCESSFUL_HARVEST_MESSAGE)}</p>
    </div>
  );
};