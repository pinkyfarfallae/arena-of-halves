# Language System Implementation Guide

## Overview
The language system supports Thai (TH) and English (EN) throughout the entire website while keeping proper nouns (power names, character names) unchanged.

## Setup

### 1. Wrap your app with LanguageProvider

```tsx
// src/index.tsx or src/App.tsx
import { LanguageProvider } from './contexts/LanguageContext';

function App() {
  return (
    <LanguageProvider>
      {/* Your app components */}
    </LanguageProvider>
  );
}
```

### 2. Add language switcher to navigation

```tsx
import { useLanguage } from './contexts/LanguageContext';

function Navbar() {
  const { language, setLanguage } = useLanguage();
  
  return (
    <nav>
      <button onClick={() => setLanguage('en')} className={language === 'en' ? 'active' : ''}>
        EN
      </button>
      <button onClick={() => setLanguage('th')} className={language === 'th' ? 'active' : ''}>
        TH
      </button>
    </nav>
  );
}
```

## Usage Examples

### Basic UI Translation

```tsx
import { useTranslation } from '../hooks/useTranslation';

function ShopPage(){
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('SHOP_TITLE')}</h1>
      <button>{t('ADD_TO_CART')}</button>
      <p>{t('PRICE')}: {item.price} {t('DRACHMA')}</p>
    </div>
  );
}
```

### Camp Locations

```tsx
import { useLanguage } from '../contexts/LanguageContext';
import { getCampLocationName, getCampLocationDescription } from '../constants/campLocationTranslations';

function LocationCard({ location }) {
  const { language } = useLanguage();
  
  return (
    <div>
      <h2>{getCampLocationName(location.id, language)}</h2>
      <p>{getCampLocationDescription(location.id, language)}</p>
    </div>
  );
}
```

### Effect Names (Afflictions/Blessings)

```tsx
import { useTranslation } from '../hooks/useTranslation';

function EffectPip({ effect }) {
  const { translateEffect } = useTranslation();
  
  return (
    <div className="effect-pip">
      {translateEffect(effect.tag)}
    </div>
  );
}
```

### Battle Phase Labels

```tsx
import { useTranslation } from '../hooks/useTranslation';

function PhaseIndicator({ phase }) {
  const { t } = useTranslation();
  
  const phaseMap = {
    'select-target': 'SELECT_TARGET',
    'select-action': 'SELECT_ACTION',
    'rolling-attack': 'ROLLING',
    'rolling-defend': 'DEFENDING',
    'resolving': 'RESOLVING',
  };
  
  return <div>{t(phaseMap[phase])}</div>;
}
```

### Character Stats

```tsx
import { useTranslation } from '../hooks/useTranslation';

function StatsPanel({ fighter }) {
  const { t } = useTranslation();
  
  return (
    <div>
      {/* Keep character name in English (proper noun) */}
      <h2>{fighter.nicknameEng}</h2>
      
      {/* Translate stat labels */}
      <div>{t('HP')}: {fighter.currentHp} / {fighter.maxHp}</div>
      <div>{t('DAMAGE')}: {fighter.damage}</div>
      <div>{t('SPEED')}: {fighter.speed}</div>
      <div>{t('CRITICAL_RATE')}: {fighter.criticalRate}%</div>
    </div>
  );
}
```

### Shop Items

```tsx
import { useTranslation } from '../hooks/useTranslation';

function ShopItem({ item }) {
  const { t } = useTranslation();
  
  return (
    <div className="shop-item">
      {/* Item name comes from Google Sheets - can be bilingual there */}
      <h3>{item.name}</h3>
      <p>{item.description}</p>
      
      <div className="item-footer">
        <span>{t('PRICE')}: {item.price} {t('DRACHMA')}</span>
        <span>
          {t('STOCK')}: {item.stock === -1 ? t('UNLIMITED') : item.stock}
        </span>
        <button disabled={item.stock === 0}>
          {item.stock === 0 ? t('OUT_OF_STOCK') : t('ADD_TO_CART')}
        </button>
      </div>
    </div>
  );
}
```

## Available Translation Keys

See `src/constants/translations.ts` for the complete list of available keys including:

- **Navigation**: HOME, ARENA, SHOP, LIFE_IN_CAMP, etc.
- **Battle**: SELECT_TARGET, ROLLING, DEFENDING, etc.
- **Stats**: HP, DAMAGE, SPEED, CRITICAL_RATE, etc.
- **Actions**: ATTACK, DEFEND, POWER, CONFIRM, CANCEL, etc.
- **Status**: ELIMINATED, MISSED, DODGED, BLOCKED, HIT, etc.
- **Shop**: CART, PRICE, STOCK, CHECKOUT, etc.
- **Common**: LOADING, ERROR, SUCCESS, SAVE, DELETE, etc.

## What NOT to Translate

- Power names (e.g., "Beyond the Nimbus", "Blossom Scentra")
- Character names (e.g., "Percy", "Annabeth")
- Character IDs and technical identifiers
- Firebase paths and database keys

## Language Persistence

The user's language preference is automatically saved to `localStorage` and will persist across sessions.

## Adding New Translations

1. Add the key and translations to `UI_TEXT` in `src/constants/translations.ts`
2. Use the key with the `t()` function in your component
3. The TypeScript types will auto-update to include your new key

Example:
```tsx
// In translations.ts
export const UI_TEXT = {
  // ... existing keys
  MY_NEW_LABEL: { en: 'My Label', th: 'ป้ายกำกับของฉัน' },
} as const;

// In your component
const { t } = useTranslation();
return <div>{t('MY_NEW_LABEL')}</div>;
```
