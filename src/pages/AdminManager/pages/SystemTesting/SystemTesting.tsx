import { useNavigate } from 'react-router-dom';
import IrisMessage from '../../../IrisMessage/IrisMessage';
import DiceRoller from '../../../../components/DiceRoller/DiceRoller';
import Close from '../../../../icons/Close';
import './SystemTesting.scss';

const SYSTEMS = [
  {
    path: 'dice',
    label: 'Dice Roller',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="st__icon">
        <rect x="8" y="8" width="32" height="32" rx="6" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="16.5" cy="16.5" r="2.5" fill="currentColor" />
        <circle cx="31.5" cy="16.5" r="2.5" fill="currentColor" />
        <circle cx="24" cy="24" r="2.5" fill="currentColor" />
        <circle cx="16.5" cy="31.5" r="2.5" fill="currentColor" />
        <circle cx="31.5" cy="31.5" r="2.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    path: 'iris-message',
    label: 'Iris Wish',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="st__icon">
        <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="24" cy="24" r="11" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <path d="M24 10v28M16 14l16 20M32 14L16 34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function SystemTesting() {
  const navigate = useNavigate();

  return (
    <div className="st">
      <div className="st__grid">
        {SYSTEMS.map(s => (
          <button key={s.path} className="st__card" onClick={() => navigate(`/admin/testing/${s.path}`)}>
            <div className="st__card-icon">{s.icon}</div>
            <span className="st__card-label">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SystemTestDice() {
  const navigate = useNavigate();
  return (
    <div className="st__full">
      <div className="st__system">
        <DiceRoller />
      </div>
      <button className="st__back" onClick={() => navigate('/admin/testing')}>
        <Close height={18} width={18} />
      </button>
    </div>
  );
}

export function SystemTestIris() {
  const navigate = useNavigate();
  return (
    <div className="st__full">
      <div className="st__system">
        <IrisMessage retossable embedded />
      </div>
      <button className="st__back" onClick={() => navigate('/admin/testing')}>
        <Close height={18} width={18} />
      </button>
    </div>
  );
}
