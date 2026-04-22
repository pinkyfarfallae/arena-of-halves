import React from 'react';
import './ActionIcon.scss';
import Wish from './icons/Wish';
import Shop from './icons/Shop';
import Basket from './icons/Basket';
import Craft from './icons/Craft';
import Battle from './icons/Battle';
import DefaultIcon from './icons/Default';
import BigHouse from '../LocationIcon/icons/BigHouse';

function ActionIcon({ type }: { type: string }) {
  switch (type) {
    case 'wish': return <Wish />;
    case 'shop': return <Shop />;
    case 'basket': return <Basket />;
    case 'craft': return <Craft />;
    case 'battle': return <Battle />;
    case 'house': return <BigHouse strokeWidth={3} />;
    default: {
      return <DefaultIcon />;
    }
  }
}

export default ActionIcon;
