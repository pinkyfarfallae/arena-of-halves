import { useNavigate } from 'react-router-dom';
import IrisMessage from '../../../IrisMessage/IrisMessage';
import DiceRoller from '../../../../components/DiceRoller/DiceRoller';
import Close from '../../../../icons/Close';
import Dice from '../../../../components/Navbar/icons/Dice';
import './SystemTesting.scss';
import IrisFountain from './icons/IrisFountain';

const SYSTEMS = [
  {
    path: 'dice',
    label: 'Dice Roller',
    icon: <Dice />,
  },
  {
    path: 'iris-message',
    label: 'Iris Wish',
    icon: <IrisFountain />,
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
        <IrisMessage retossable embedded isAdmin />
      </div>
      <button className="st__back" onClick={() => navigate('/admin/testing')}>
        <Close height={18} width={18} />
      </button>
    </div>
  );
}
