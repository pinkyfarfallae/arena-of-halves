import React from 'react';
import type { EditField } from '../../../types/editField';
export type { EditField };

export const EDIT_FIELDS: EditField[] = [
  { key: 'nameThai', header: 'name (thai)', label: 'ชื่อ (Thai)', type: 'text', group: 'Names', placeholder: 'ชื่อภาษาไทย', required: true },
  { key: 'nameEng', header: 'name (eng)', label: 'Name (English)', type: 'text', group: 'Names', placeholder: 'Full name in English', required: true },
  { key: 'nicknameThai', header: 'nickname (thai)', label: 'ชื่อเล่น (Thai)', type: 'text', group: 'Names', placeholder: 'ชื่อเล่น', required: true },
  { key: 'nicknameEng', header: 'nickname (eng)', label: 'Nickname (English)', type: 'text', group: 'Names', placeholder: 'Nickname in English', required: true },
  { key: 'birthdate', header: 'birthdate', label: 'Birthdate', type: 'text', group: 'Personal Info', placeholder: 'e.g. March 15' },
  { key: 'genderIdentity', header: 'gender identity', label: 'Gender Identity', type: 'text', group: 'Personal Info', placeholder: 'e.g. Male, Female, Non-binary' },
  { key: 'species', header: 'species', label: 'Species', type: 'text', group: 'Personal Info', placeholder: 'e.g. Demigod' },
  { key: 'height', header: 'height', label: 'Height (cm)', type: 'text', group: 'Personal Info', placeholder: 'e.g. 175' },
  { key: 'weight', header: 'weight', label: 'Weight (kg)', type: 'text', group: 'Personal Info', placeholder: 'e.g. 65' },
  { key: 'ethnicity', header: 'ethnicity', label: 'Ethnicity', type: 'text', group: 'Personal Info', placeholder: 'e.g. Thai' },
  { key: 'nationality', header: 'nationality', label: 'Nationality', type: 'text', group: 'Personal Info', placeholder: 'e.g. Thai' },
  { key: 'religion', header: 'religion', label: 'Religion', type: 'text', group: 'Personal Info', placeholder: 'e.g. Buddhism' },
  { key: 'residence', header: 'residence', label: 'Residence', type: 'text', group: 'Personal Info', placeholder: 'e.g. Cabin 7' },
  { key: 'aliases', header: 'aliases', label: 'Aliases', type: 'text', group: 'Personal Info', placeholder: 'Type and press Enter' },
  { key: 'eyeColor', header: 'eye color', label: 'Eye Color', type: 'color', group: 'Appearance', placeholder: '#000000' },
  { key: 'hairColor', header: 'hair color', label: 'Hair Color', type: 'color', group: 'Appearance', placeholder: '#000000' },
  { key: 'appearance', header: 'appearance', label: 'Appearance', type: 'textarea', group: 'Appearance', placeholder: 'Describe physical appearance' },
  { key: 'personality', header: 'personality', label: 'Personality', type: 'textarea', group: 'Story', placeholder: 'Describe personality traits' },
  { key: 'background', header: 'background', label: 'Background', type: 'textarea', group: 'Story', placeholder: 'Character backstory' },
  { key: 'strengths', header: 'strengths', label: 'Strengths', type: 'textarea', group: 'Traits', placeholder: 'e.g. Swordsmanship: skilled with blade' },
  { key: 'weaknesses', header: 'weaknesses', label: 'Weaknesses', type: 'textarea', group: 'Traits', placeholder: 'e.g. Water: cannot swim' },
  { key: 'abilities', header: 'abilities', label: 'Supernatural Abilities', type: 'textarea', group: 'Traits', placeholder: 'e.g. Pyrokinesis: control fire' },
];

export const GROUP_ICONS: Record<string, React.ReactNode> = {
  Names: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M12 11a4 4 0 100-8 4 4 0 000 8zM4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
  'Personal Info': <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
  Appearance: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><circle cx="9" cy="10" r="1" fill="currentColor" /><circle cx="15" cy="10" r="1" fill="currentColor" /><path d="M8 15c1 2 3 3 4 3s3-1 4-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
  Story: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.5" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.5" /></svg>,
  Traits: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M12 2l2.09 6.26L21 9.27l-5.18 4.73L17.82 22 12 17.77 6.18 22l1.64-7.73L2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>,
};

export const GROUPS = ['Names', 'Personal Info', 'Appearance', 'Story', 'Traits'];
