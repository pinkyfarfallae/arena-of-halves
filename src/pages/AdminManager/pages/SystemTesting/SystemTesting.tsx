import { useNavigate } from 'react-router-dom';
import IrisMessage from '../../../IrisMessage/IrisMessage';
import DiceRoller from '../../../../components/DiceRoller/DiceRoller';
import Close from '../../../../icons/Close';
import './SystemTesting.scss';

const SYSTEMS = [
  { path: 'dice', label: 'Dice Roller', desc: 'Roll d4 / d6 / d8 / d10 / d12 / d20 / d100' },
  { path: 'iris-message', label: 'Iris Wish', desc: 'Toss a drachma and receive a divine blessing' },
];

export default function SystemTesting() {
  const navigate = useNavigate();

  return (
    <div className="st">
      <h2 className="st__title">System Testing</h2>
      <p className="st__desc">Select a system to test</p>
      <div className="st__grid">
        {SYSTEMS.map(s => (
          <button key={s.path} className="st__card" onClick={() => navigate(`/admin/testing/${s.path}`)}>
            <span className="st__card-label">{s.label}</span>
            <span className="st__card-desc">{s.desc}</span>
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
