import { useState } from 'react';
import IrisMessage from '../../../IrisMessage/IrisMessage';
import DiceRoller from '../../../../components/DiceRoller/DiceRoller';
import './SystemTesting.scss';
import Close from '../../../../icons/Close';

type ActiveSystem = null | 'iris' | 'dice';

const SYSTEMS = [
  { key: 'iris' as const, label: 'Iris Wish', desc: 'Toss a drachma and receive a divine blessing' },
  { key: 'dice' as const, label: 'Dice Roller', desc: 'Roll d4 / d6 / d8 / d10 / d12 / d20 / d100' },
];

export default function SystemTesting() {
  const [active, setActive] = useState<ActiveSystem>(null);

  if (active) {
    return (
      <div className="st__full">
        <div className="st__system">
          {active === 'iris' && <IrisMessage retossable embedded />}
          {active === 'dice' && <DiceRoller />}
        </div>
        <button className="st__back" onClick={() => setActive(null)}>
          <Close height={18} width={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="st">
      <h2 className="st__title">System Testing</h2>
      <p className="st__desc">Select a system to test</p>
      <div className="st__grid">
        {SYSTEMS.map(s => (
          <button key={s.key} className="st__card" onClick={() => setActive(s.key)}>
            <span className="st__card-label">{s.label}</span>
            <span className="st__card-desc">{s.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
