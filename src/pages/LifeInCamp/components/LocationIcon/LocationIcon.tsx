import React from 'react';
import './LocationIcon.scss';
import Hill from './icons/Hill';
import BigHouse from './icons/BigHouse';
import Woods from './icons/Woods';
import Lake from './icons/Lake';
import Dining from './icons/Dining';
import Cabins from './icons/Cabins';
import Arena from './icons/Arena';
import Forge from './icons/Forge';
import Archery from './icons/Archery';
import Amphitheater from './icons/Amphitheater';
import Stables from './icons/Stables';
import Strawberry from './icons/Strawberry';
import Climbing from './icons/Climbing';
import Campfire from './icons/Campfire';
import Armory from './icons/Armory';
import Fountain from './icons/Fountain';
import Store from './icons/Store';

function LocationIcon({ type }: { type: string }) {
  switch (type) {
    case 'hill': return <Hill />;
    case 'big-house': return <BigHouse />;
    case 'woods': return <Woods />;
    case 'lake': return <Lake />;
    case 'dining': return <Dining />;
    case 'cabins': return <Cabins />;
    case 'arena': return <Arena />;
    case 'forge': return <Forge />;
    case 'archery': return <Archery />;
    case 'amphitheater': return <Amphitheater />;
    case 'stables': return <Stables />;
    case 'strawberry': return <Strawberry />;
    case 'climbing': return <Climbing />;
    case 'campfire': return <Campfire />;
    case 'armory': return <Armory />;
    case 'fountain': return <Fountain />;
    case 'store': return <Store />;
    default: {
      const props = { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: '1', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
      return <svg {...props}><circle cx="16" cy="16" r="8" fill="currentColor" opacity="0.15" /><circle cx="16" cy="16" r="8" /><circle cx="16" cy="16" r="3" fill="currentColor" opacity="0.3" /></svg>;
    }
  }
}

export default LocationIcon;
