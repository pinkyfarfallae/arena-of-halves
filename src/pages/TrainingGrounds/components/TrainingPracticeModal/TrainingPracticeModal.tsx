import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Character, fetchAllCharacters } from '../../../../data/characters';
import Close from '../../../../icons/Close';
import { ROLE } from '../../../../constants/role';
import { ROOM_STATUS } from '../../../../constants/battle';
import { ArenaAction, ARENA_ACTIONS } from '../../../../constants/arenaAction';
import { COPY_TYPE, CopyType } from '../../../../constants/lobby';
import './TrainingPracticeModal.scss';

interface ThemeVars {
  primaryColor: string;
  primaryColorRgb: string;
  darkColor: string;
  darkColorRgb: string;
  lightColor: string;
  surfaceHover: string;
  overlayText: string;
  accentDark: string;
}

interface Props {
  open: boolean;
  currentCharacterId?: string;
  theme: ThemeVars;
  role?: string;
  onClose: () => void;
  onFinalizePracticeRoom: (opponent: Character) => Promise<string>;
  onJoinPracticeRoom: (roomCode: string) => Promise<string>;
  onDeletePracticeRoom?: (roomCode: string) => Promise<void>;
  initialTab?: ArenaAction;
  initialJoinCode?: string;
  arenaId?: string; // Match arena pattern: room exists before modal opens
  roomStatus?: string;
  keepCreateTabAfterFinalize?: boolean;
}

function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }

  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  return Promise.resolve();
}

export default function TrainingPracticeModal({
  open,
  currentCharacterId,
  theme,
  role,
  onClose,
  onFinalizePracticeRoom,
  onJoinPracticeRoom,
  onDeletePracticeRoom,
  initialTab = ARENA_ACTIONS.CREATE,
  initialJoinCode = '',
  arenaId = '', // Match arena pattern
  roomStatus = '',
  keepCreateTabAfterFinalize = false,
}: Props) {
  const navigate = useNavigate();
  const isDeveloper = role === ROLE.DEVELOPER;
  const [tab, setTab] = useState<ArenaAction>(initialTab);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<CopyType | null>(null);
  const isBusy = loading || submitting;
  const busyLabel = loading ? 'Loading players...' : submitting ? 'Creating room...' : '';

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    setError('');

    fetchAllCharacters()
      .then((data) => {
        if (!mounted) return;
        const currentId = currentCharacterId?.toLowerCase();
        setCharacters((data || []).filter((c) => c.characterId.toLowerCase() !== currentId));
      })
      .catch(() => {
        if (mounted) setCharacters([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [open, currentCharacterId]);

  useEffect(() => {
    if (open) {
      // If room is already joined (not configuring), force Join tab
      if (arenaId && roomStatus && roomStatus !== ROOM_STATUS.CONFIGURING && !keepCreateTabAfterFinalize) {
        setTab(ARENA_ACTIONS.JOIN);
      } else {
        setTab(initialTab);
      }
      setJoinCode(initialJoinCode);
    } else {
      // Reset state when closing
      setTab(ARENA_ACTIONS.CREATE);
      setSelectedId('');
      setJoinCode('');
      setSubmitting(false);
      setError('');
      setCopied(null);
    }
  }, [open, initialTab, initialJoinCode, arenaId, roomStatus, keepCreateTabAfterFinalize]);

  useEffect(() => {
    if (!open) return;
    if (arenaId && roomStatus !== ROOM_STATUS.CONFIGURING) {
      setSelectedId('');
    }
  }, [open, arenaId, roomStatus]);

  const selectedOpponent = useMemo(
    () => characters.find((c) => c.characterId === selectedId) ?? null,
    [characters, selectedId],
  );

  const viewerLink = arenaId
    ? `${window.location.origin}${window.location.pathname}#/training-grounds/pvp/${arenaId}`
    : '';

  if (!open) return null;

  const themeStyle = {
    '--primary-color': theme.primaryColor,
    '--primary-color-rgb': theme.primaryColorRgb,
    '--dark-color': theme.darkColor,
    '--dark-color-rgb': theme.darkColorRgb,
    '--light-color': theme.lightColor,
    '--surface-hover': theme.surfaceHover,
    '--overlay-text': theme.overlayText,
    '--accent-dark': theme.accentDark,
  } as CSSProperties;

  const handleSelectOpponent = async (character: Character) => {
    if (submitting || roomStatus !== ROOM_STATUS.CONFIGURING) return;
    const isSameSelection = selectedId === character.characterId;
    setSelectedId(isSameSelection ? '' : character.characterId);
    setError('');
  };

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code || submitting) {
      setError('Enter a room code.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const arenaId = await onJoinPracticeRoom(code);
      onClose();
      navigate(`/training-grounds/pvp/${arenaId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join training room');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async (type: CopyType) => {
    if (!arenaId) return;
    await copyText(type === 'code' ? arenaId : viewerLink);
    setCopied(type);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleDelete = async () => {
    if (!arenaId || !onDeletePracticeRoom || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await onDeletePracticeRoom(arenaId);
      setCopied(null);
      setSelectedId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete training room');
    } finally {
      setSubmitting(false);
    }
  };

  const handleModalClose = async () => {
    if (submitting) return;
    const shouldDeleteOnClose = arenaId && onDeletePracticeRoom && (
      roomStatus === ROOM_STATUS.CONFIGURING || roomStatus === ROOM_STATUS.WAITING
    );
    if (shouldDeleteOnClose) {
      try {
        await onDeletePracticeRoom(arenaId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete training room');
        return;
      }
    }
    onClose();
  };

  const isCreateTab = tab === ARENA_ACTIONS.CREATE;
  const canEnterRoom = roomStatus === ROOM_STATUS.CONFIGURING ? !!selectedOpponent : !!arenaId;

  const handleEnterRoom = async () => {
    if (!arenaId || submitting) return;

    if (roomStatus === ROOM_STATUS.CONFIGURING) {
      if (!selectedOpponent) return;
      setSubmitting(true);
      setError('');
      try {
        const finalizedArenaId = await onFinalizePracticeRoom(selectedOpponent);
        onClose();
        navigate(`/training-grounds/pvp/${finalizedArenaId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to configure training room');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    onClose();
    navigate(`/training-grounds/pvp/${arenaId}`);
  };

  return (
    <div className="tpm__overlay" role="presentation">
      <div className="tpm__panel" onClick={(e) => e.stopPropagation()} style={themeStyle}>
        <header className="tpm__header">
          <div className="tpm__header-copy">
            <h2 className="tpm__title">Practice Room</h2>
            <p className="tpm__subtitle">Create a one-opponent room or join a code.</p>
          </div>
          <button type="button" className="tpm__close" onClick={handleModalClose} aria-label="Close" disabled={submitting}>
            <Close width={16} height={16} />
          </button>
        </header>

        <div className="tpm__tabs" role="tablist" aria-label="Training room tabs">
          {(!roomStatus || roomStatus === ROOM_STATUS.CONFIGURING) && (
            <>
              <button
                type="button"
                role="tab"
                aria-selected={isCreateTab}
                className={`tpm__tab ${isCreateTab ? 'tpm__tab--active' : ''}`}
                onClick={() => setTab('create')}
              >
                Create
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!isCreateTab}
                className={`tpm__tab ${!isCreateTab ? 'tpm__tab--active' : ''}`}
                onClick={() => setTab(ARENA_ACTIONS.JOIN)}
              >
                Join
              </button>
            </>
          )}
        </div>

        <div className="tpm__body">
          {error && <div className="tpm__error">{error}</div>}

          {isBusy ? (
            <div className="tpm__loading-block">
              <div className="tpm__spinner" />
              <div className="tpm__loading-text">{busyLabel}</div>
            </div>
          ) : tab === ARENA_ACTIONS.CREATE ? (
            <>
              <div className="tpm__grid">
                {characters.map((character) => {
                  const selected = character.characterId === selectedId;
                  return (
                    <button
                      key={character.characterId}
                      type="button"
                      className={`tpm__card ${selected ? 'tpm__card--selected' : ''}`}
                      onClick={() => handleSelectOpponent(character)}
                      style={{ '--accent': character.theme[0] } as CSSProperties}
                    >
                      {character.image ? (
                        <img className="tpm__avatar" src={character.image} alt={character.nicknameEng} referrerPolicy="no-referrer" />
                      ) : (
                        <div className="tpm__avatar tpm__avatar--placeholder" style={{ background: character.theme[0] }}>
                          {character.nicknameEng.charAt(0)}
                        </div>
                      )}
                      <span className="tpm__name">{character.nicknameEng}</span>
                      <span className="tpm__sub">{character.deityBlood}</span>
                      {selected && <span className="tpm__check">✓</span>}
                    </button>
                  );
                })}
              </div>
              {arenaId && (
                <div className="tpm__created">
                  <div className="tpm__section-head">
                    <div className="tpm__section-title">Training room ready</div>
                    <div className="tpm__section-note">Share this code or link with the invited opponent.</div>
                  </div>
                  <div className="tpm__share-grid">
                    <div className="tpm__share-row">
                      <span className="tpm__share-label">Code</span>
                      <span className="tpm__share-value">{arenaId}</span>
                      <button type="button" className="tpm__copy" onClick={() => handleCopy(COPY_TYPE.CODE)}>
                        {copied === COPY_TYPE.CODE ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="tpm__share-row">
                      <span className="tpm__share-label">Link</span>
                      <span className="tpm__share-value tpm__share-value--link">{viewerLink}</span>
                      <button type="button" className="tpm__copy" onClick={() => handleCopy(COPY_TYPE.LINK)}>
                        {copied === COPY_TYPE.LINK ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="tpm__join">
              <div className="tpm__section-head">
                <div className="tpm__section-title">Join a training room</div>
                <div className="tpm__section-note">Paste the room code to enter. Non-invited users become viewers.</div>
              </div>
              <input
                id="training-room-code"
                className="tpm__input"
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter code"
                maxLength={6}
              />
            </div>
          )}
        </div>

        <footer className="tpm__footer">
          <div className="tpm__footer-left">
            {isDeveloper && onDeletePracticeRoom && (
              <button
                type="button"
                className="tpm__btn tpm__btn--danger tpm__btn--delete"
                onClick={handleDelete}
                disabled={!arenaId || submitting || roomStatus === ROOM_STATUS.CONFIGURING}
                title={!arenaId ? 'No room to delete' : 'Delete room'}
              >
                Delete Room
              </button>
            )}
          </div>
          <div className="tpm__footer-right">
            {!isCreateTab ? (
              <>
                <button type="button" className="tpm__btn tpm__btn--ghost" onClick={handleModalClose} disabled={submitting}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="tpm__btn tpm__btn--primary"
                  onClick={handleJoin}
                  disabled={submitting || !joinCode.trim()}
                >
                  {submitting ? 'Joining...' : 'Join as Fighter'}
                </button>
              </>
            ) : arenaId ? (
              <>
                <button type="button" className="tpm__btn tpm__btn--ghost" onClick={handleModalClose} disabled={submitting}>
                  Close
                </button>
                <button
                  type="button"
                  className="tpm__btn tpm__btn--primary"
                  onClick={handleEnterRoom}
                  disabled={submitting || !canEnterRoom}
                >
                  {roomStatus === ROOM_STATUS.CONFIGURING ? 'Enter the Field' : 'Open Room'}
                </button>
              </>
            ) : (
              <button type="button" className="tpm__btn tpm__btn--ghost" onClick={handleModalClose} disabled={submitting}>
                Cancel
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
