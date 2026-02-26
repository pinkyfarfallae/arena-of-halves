import React from 'react';
import './ActionIcon.scss';
import Wish from './icons/Wish';
import Shop from './icons/Shop';
import Basket from './icons/Basket';
import Craft from './icons/Craft';

function ActionIcon({ type }: { type: string }) {
  switch (type) {
    case 'wish': return <Wish />;
    case 'shop': return <Shop />;
    case 'basket': return <Basket />;
    case 'craft': return <Craft />;
    default: {
      const p = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
      return <svg {...p}><circle cx="12" cy="12" r="10" /><path d="M12 8l4 4-4 4M8 12h8" /></svg>;
    }
  }
}

export default ActionIcon;
