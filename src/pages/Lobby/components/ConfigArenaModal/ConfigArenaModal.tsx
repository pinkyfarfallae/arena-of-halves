import { useState } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../../../../firebase';
import { deleteRoom } from '../../../../services/battleRoom';
import Close from '../../../../icons/Close';
import AresHelmet from '../../icons/AresHelmet';
import './ConfigArenaModal.scss';

interface Props {
  arenaId: string;
  isDev?: boolean;
  onClose: () => void;
  onEnter: (arenaId: string) => void;
}

export default function ConfigArenaModal({ arenaId, isDev, onClose, onEnter }: Props) {
  const [teamSize, setTeamSize] = useState(1);
  const [testMode, setTestMode] = useState(false);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const viewerLink = `${window.location.origin}${window.location.pathname}#/arena/${arenaId}?watch=true`;

  const handleCopy = async (type: 'code' | 'link') => {
    const text = type === 'code' ? arenaId : viewerLink;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for when document isn't focused (e.g. inside modal overlay)
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleClose = async () => {
    await deleteRoom(arenaId);
    onClose();
  };

  const handleEnter = async () => {
    await update(ref(db, `arenas/${arenaId}`), { status: 'waiting' });
    onEnter(arenaId);
  };

  const handleTestMode = async () => {
    const next = !testMode;
    setTestMode(next);
    await update(ref(db, `arenas/${arenaId}`), { testMode: next || null });
  };

  const handleTeamSize = async (size: number) => {
    setTeamSize(size);
    await update(ref(db, `arenas/${arenaId}`), {
      teamSize: size,
      'teamA/maxSize': size,
      'teamB/maxSize': size,
    });
  };

  return (
    <div className="cam__overlay" onClick={handleClose}>
      <div className="cam" onClick={(e) => e.stopPropagation()}>
        <button className="cam__close" onClick={handleClose}>
          <Close width={16} height={16} />
        </button>

        <h2 className="cam__title">
          <AresHelmet width={20} height={20} /> Room Created
        </h2>

        <label className="cam__label">Room Code</label>
        <div className="cam__copy-row">
          <span className="cam__code">{arenaId}</span>
          <button
            className={`cam__copy ${copied === 'code' ? 'cam__copy--done' : ''}`}
            onClick={() => handleCopy('code')}
          >
            {copied === 'code' ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <label className="cam__label">Viewer Link</label>
        <div className="cam__copy-row">
          <span className="cam__link">{viewerLink}</span>
          <button
            className={`cam__copy ${copied === 'link' ? 'cam__copy--done' : ''}`}
            onClick={() => handleCopy('link')}
          >
            {copied === 'link' ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <label className="cam__label">Team Size</label>
        <div className="cam__sizes">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              className={`cam__size ${teamSize === n ? 'cam__size--active' : ''}`}
              onClick={() => handleTeamSize(n)}
            >
              {n}v{n}
            </button>
          ))}
        </div>

        {isDev && (
          <button
            className={`cam__btn cam__btn--test ${testMode ? 'cam__btn--test-active' : ''}`}
            onClick={handleTestMode}
          >
            {testMode ? 'Testing Mode: ON' : 'Testing Mode'}
          </button>
        )}

        <button
          className="cam__btn cam__btn--enter"
          onClick={handleEnter}
        >
          Enter the Field
        </button>
      </div>
    </div>
  );
}
