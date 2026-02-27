import React from 'react';
import type { EditField } from '../../../types/editField';
import Person from '../icons/Person';
import Calendar from '../icons/Calendar';
import Face from '../icons/Face';
import Book from '../icons/Book';
import Star from '../icons/Star';
import Link from '../icons/Link';
export type { EditField };

export const EDIT_FIELDS: EditField[] = [
  { key: 'nameThai', header: 'name (thai)', label: 'ชื่อ (Thai)', type: 'text', group: 'Names', placeholder: 'ชื่อภาษาไทย', required: true },
  { key: 'nameEng', header: 'name (eng)', label: 'Name (English)', type: 'text', group: 'Names', placeholder: 'Full name in English', required: true },
  { key: 'nicknameThai', header: 'nickname (thai)', label: 'ชื่อเล่น (Thai)', type: 'text', group: 'Names', placeholder: 'ชื่อเล่น', required: true },
  { key: 'nicknameEng', header: 'nickname (eng)', label: 'Nickname (English)', type: 'text', group: 'Names', placeholder: 'Nickname in English', required: true },
  { key: 'sex', header: 'sex', label: 'Sex', type: 'sex', group: 'Personal Info', required: true },
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
  { key: 'twitter', header: 'twitter', label: 'Twitter / X', type: 'text', group: 'Links', placeholder: '@handle or full URL' },
  { key: 'document', header: 'document', label: 'Document URL', type: 'text', group: 'Links', placeholder: 'Link to character document' },
];

export const GROUP_ICONS: Record<string, React.ReactNode> = {
  Names: <Person width={14} height={14} />,
  'Personal Info': <Calendar width={14} height={14} />,
  Appearance: <Face width={14} height={14} />,
  Story: <Book width={14} height={14} />,
  Traits: <Star width={14} height={14} />,
  Links: <Link width={14} height={14} />,
};

export const GROUPS = ['Names', 'Personal Info', 'Appearance', 'Story', 'Traits', 'Links'];
