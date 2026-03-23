import { useState, useEffect, useMemo } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../../../../firebase';
import { deleteRoom, toFighterState } from '../../../../services/battleRoom';
import { fetchNPCs } from '../../../../data/npcs';
import { fetchAllCharacters } from '../../../../data/characters';
import { getPowers } from '../../../../data/powers';
import { POWER_OVERRIDES } from '../../../CharacterInfo/constants/overrides';
import type { FighterState, InviteReservation } from '../../../../types/battle';
import Close from '../../../../icons/Close';
import AresHelmet from '../../icons/AresHelmet';
import NPCTeamSelection from './NPCTeamSelection/NPCTeamSelection';
import './ConfigArenaModal.scss';
import { COPY_TYPE, type CopyType } from '../../../../constants/lobby';
import { ARENA_PATH, ARENA_ROLE, BATTLE_TEAM, ROOM_STATUS, teamPath } from '../../../../constants/battle';
import { CHARACTER } from '../../../../constants/characters';
import { DEITY } from '../../../../constants/deities';
import { ROLE } from '../../../../constants/role';
import { useAuth } from '../../../../hooks/useAuth';

const ROOM_TITLE_MAX_LEN = 120;

function rosterSideTitle(fighters: FighterState[]): string {
  const s = fighters
    .map((f) => (f.nicknameEng || f.characterId).trim())
    .filter(Boolean)
    .join(' & ');
  return s.length > 0 ? s : '?';
}

function capAutoRoomTitle(title: string): string {
  if (title.length <= ROOM_TITLE_MAX_LEN) return title;
  return `${title.slice(0, ROOM_TITLE_MAX_LEN - 1)}…`;
}

interface Props {
  arenaId: string;
  /** Custom title from lobby input at create time — re-written on config updates so it is not lost before entering arena. */
  preservedRoomLabel?: string;
  player?: FighterState;
  onClose: () => void;
  onEnter: (arenaId: string) => void;
}

export default function ConfigArenaModal({ arenaId, preservedRoomLabel, player, onClose, onEnter }: Props) {
  const { role } = useAuth();
  const isDeveloper = role === ROLE.DEVELOPER;
  const [teamSizeA, setTeamSizeA] = useState(1);
  const [teamSizeB, setTeamSizeB] = useState(1);
  const [selectedAlliesA, setSelectedAlliesA] = useState<FighterState[]>([]);
  const [selectedB, setSelectedB] = useState<FighterState[]>([]);
  const [copied, setCopied] = useState<CopyType | null>(null);
  const [npcs, setNpcs] = useState<FighterState[]>([]);
  const [playerCharacters, setPlayerCharacters] = useState<FighterState[]>([]);
  const [devPlayAllFightersSelf, setDevPlayAllFightersSelf] = useState(false);

  useEffect(() => {
    fetchNPCs().then(setNpcs);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAllCharacters()
      .then((chars) => {
        if (cancelled) return;
        setPlayerCharacters(
          chars.map((c) => {
            const powerDeity = POWER_OVERRIDES[c.characterId?.toLowerCase()] ?? c.deityBlood;
            return toFighterState(c, getPowers(powerDeity));
          }),
        );
      })
      .catch(() => setPlayerCharacters([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const npcIdSet = useMemo(
    () => new Set(npcs.map((n) => n.characterId.toLowerCase())),
    [npcs],
  );
  const isNpcFighter = (f: FighterState) => npcIdSet.has(f.characterId.toLowerCase());

  const roomNamePatch = (): { roomName: string } | Record<string, never> => {
    const t = preservedRoomLabel?.trim();
    return t ? { roomName: t } : {};
  };

  useEffect(() => {
    const t = preservedRoomLabel?.trim();
    if (!t) return;
    update(ref(db, `arenas/${arenaId}`), { roomName: t }).catch(() => { });
  }, [arenaId, preservedRoomLabel]);

  const viewerLink = `${window.location.origin}${window.location.pathname}#/arena/${arenaId}?watch=true`;

  const onDevPlayAllFightersSelfChange = (checked: boolean) => {
    setDevPlayAllFightersSelf(checked);
  };

  const handleCopy = async (type: CopyType) => {
    const text = type === COPY_TYPE.CODE ? arenaId : viewerLink;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('clipboard api unavailable');
      }
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        return;
      }
    }
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleClose = async () => {
    await deleteRoom(arenaId);
    onClose();
  };

  const syncRoomCaps = async (a: number, b: number) => {
    await update(ref(db, `arenas/${arenaId}`), {
      ...roomNamePatch(),
      teamSize: Math.max(a, b),
      [teamPath(BATTLE_TEAM.A, 'maxSize')]: a,
      [teamPath(BATTLE_TEAM.B, 'maxSize')]: b,
    });
  };

  const alliesNeeded = Math.max(0, teamSizeA - 1);

  const handleTeamSizeA = async (size: number) => {
    setTeamSizeA(size);
    setSelectedAlliesA((prev) => prev.slice(0, Math.max(0, size - 1)));
    await syncRoomCaps(size, teamSizeB);
  };

  const handleTeamSizeB = async (size: number) => {
    setTeamSizeB(size);
    setSelectedB((prev) => prev.slice(0, size));
    await syncRoomCaps(teamSizeA, size);
  };

  const excludedForA = useMemo(() => {
    const s = new Set<string>();
    if (player) s.add(player.characterId);
    selectedB.forEach((f) => s.add(f.characterId));
    return s;
  }, [player, selectedB]);

  const excludedForB = useMemo(() => {
    const s = new Set<string>();
    if (player) s.add(player.characterId);
    selectedAlliesA.forEach((f) => s.add(f.characterId));
    return s;
  }, [player, selectedAlliesA]);

  const rosterComplete =
    selectedAlliesA.length === alliesNeeded &&
    selectedB.length === teamSizeB;

  const handleEnter = async () => {
    if (!player || !rosterComplete) return;

    /** Solo dev: every pick is a full in-room fighter (camp + NPC); host plays all turns like test NPCs */
    const embedAllRoster = isDeveloper && devPlayAllFightersSelf;

    let membersA: FighterState[];
    let membersB: FighterState[];
    let inviteReservations: InviteReservation[];

    if (embedAllRoster) {
      membersA = [player, ...selectedAlliesA];
      membersB = [...selectedB];
      inviteReservations = [];
    } else {
      membersA = [player, ...selectedAlliesA.filter(isNpcFighter)];
      const invitesA: InviteReservation[] = selectedAlliesA
        .filter((f) => !isNpcFighter(f))
        .map((f) => ({ characterId: f.characterId, team: ARENA_ROLE.TEAM_A }));

      membersB = selectedB.filter(isNpcFighter);
      const invitesB: InviteReservation[] = selectedB
        .filter((f) => !isNpcFighter(f))
        .map((f) => ({ characterId: f.characterId, team: ARENA_ROLE.TEAM_B }));

      inviteReservations = [...invitesA, ...invitesB];
    }

    const hasNpc = [...membersA, ...membersB].some((f) => isNpcFighter(f));
    const pendingInvites = inviteReservations.length;
    const invitesA = embedAllRoster ? 0 : selectedAlliesA.filter((f) => !isNpcFighter(f)).length;
    const invitesB = embedAllRoster ? 0 : selectedB.filter((f) => !isNpcFighter(f)).length;
    const rosterAFull = membersA.length + invitesA >= teamSizeA;
    const rosterBFull = membersB.length + invitesB >= teamSizeB;
    const canReady = rosterAFull && rosterBFull && pendingInvites === 0;

    const autoTitle = `${rosterSideTitle([player, ...selectedAlliesA])} vs ${rosterSideTitle(selectedB)}`;
    const roomTitle = preservedRoomLabel?.trim()
      ? preservedRoomLabel.trim()
      : capAutoRoomTitle(autoTitle);

    await update(ref(db, `arenas/${arenaId}`), {
      roomName: roomTitle,
      [ARENA_PATH.STATUS]: canReady ? ROOM_STATUS.READY : ROOM_STATUS.WAITING,
      [teamPath(BATTLE_TEAM.A, 'members')]: membersA,
      [teamPath(BATTLE_TEAM.B, 'members')]: membersB,
      testMode: embedAllRoster || hasNpc ? true : null,
      npcId: null,
      npcTeam: null,
      inviteReservations: inviteReservations.length > 0 ? inviteReservations : null,
      devNpcAutoPlay: true,
      devPlayAllFightersSelf: isDeveloper ? devPlayAllFightersSelf : false,
      devPlayAllHostCharacterId: embedAllRoster ? player.characterId : null,
    });
    onEnter(arenaId);
  };

  const hostChip = player ? (
    <div className="cam__player-chip">
      <div className="cam__player-chip-accent" style={{ backgroundColor: player.theme[0] }} aria-hidden />
      <div className="cam__player-chip-body">
        {player.image ? (
          <img className="cam__player-avatar" src={player.image} alt={player.nicknameEng} referrerPolicy="no-referrer" />
        ) : (
          <div className="cam__player-avatar cam__player-avatar--placeholder" style={{ background: player.theme[0] }}>
            {player.nicknameEng.charAt(0)}
          </div>
        )}
        <div className="cam__player-info">
          <span className="cam__player-name">{player.nicknameEng}</span>
          <span className="cam__player-deity">
            {player.characterId.toLowerCase() === CHARACTER.ROSABELLA ? DEITY.PERSEPHONE : player.deityBlood}
          </span>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="cam__overlay">
      <div className="cam" onClick={(e) => e.stopPropagation()}>
        <header className="cam__header">
          <h2 className="cam__title">
            <AresHelmet width={20} height={20} /> Room Created
          </h2>
          <button type="button" className="cam__close" onClick={handleClose}>
            <Close width={16} height={16} />
          </button>
        </header>

        <div className="cam__content">
          <label className="cam__label">Fighters per team</label>
          <div className="cam__team-size-grid">
            <div className="cam__team-size-card">
              <div className="cam__team-size-card-head">
                <span className="cam__team-size-card-title">Team A</span>
                <span className="cam__team-size-card-tag">Left</span>
              </div>
              <div className="cam__team-size-seg" role="group" aria-label="Team A fighters">
                {[1, 2, 3].map((n) => (
                  <button
                    key={`a-${n}`}
                    type="button"
                    className={`cam__team-size-seg-btn ${teamSizeA === n ? 'cam__team-size-seg-btn--active' : ''}`}
                    onClick={() => handleTeamSizeA(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="cam__team-size-card">
              <div className="cam__team-size-card-head">
                <span className="cam__team-size-card-title">Team B</span>
                <span className="cam__team-size-card-tag">Right</span>
              </div>
              <div className="cam__team-size-seg" role="group" aria-label="Team B fighters">
                {[1, 2, 3].map((n) => (
                  <button
                    key={`b-${n}`}
                    type="button"
                    className={`cam__team-size-seg-btn ${teamSizeB === n ? 'cam__team-size-seg-btn--active' : ''}`}
                    onClick={() => handleTeamSizeB(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="cam__label">Roster — players &amp; NPCs</label>
          <div className="cam__team-split cam__team-split--unified">
            <div className="cam__team-col cam__team-col--a">
              <div className="cam__unified-roster-head">
                <span className="cam__unified-roster-title">Team A</span>
                <span className="cam__unified-roster-count">
                  {alliesNeeded > 0 ? `${selectedAlliesA.length} / ${alliesNeeded}` : 'Host only'}
                </span>
              </div>
              {hostChip}
              <div className="cam__unified-grid-wrap">
                <NPCTeamSelection
                  teamSize={alliesNeeded}
                  players={playerCharacters}
                  npcs={npcs}
                  initialSelection={selectedAlliesA.map((f) => f.characterId)}
                  excludedIds={excludedForA}
                  onSelect={setSelectedAlliesA}
                />
              </div>
            </div>
            <div className="cam__team-col cam__team-col--b">
              <div className="cam__unified-roster-head">
                <span className="cam__unified-roster-title">Team B</span>
                <span className="cam__unified-roster-count">
                  {selectedB.length} / {teamSizeB}
                </span>
              </div>
              <div className="cam__unified-grid-wrap">
                <NPCTeamSelection
                  teamSize={teamSizeB}
                  players={playerCharacters}
                  npcs={npcs}
                  initialSelection={selectedB.map((f) => f.characterId)}
                  excludedIds={excludedForB}
                  onSelect={setSelectedB}
                />
              </div>
            </div>
          </div>

          {isDeveloper && (
            <div className="cam__dev-config">
              <label className="cam__label">Developer Config</label>
              <label className="cam__dev-row">
                <input
                  type="checkbox"
                  checked={devPlayAllFightersSelf}
                  onChange={(e) => onDevPlayAllFightersSelfChange(e.target.checked)}
                />
                <span className="cam__dev-row-text">
                  <span className="cam__dev-row-title">Play Every Fighters by Self</span>
                  <span className="cam__dev-row-desc">
                    Default: Off — Fills the roster in-room (camp + NPC picks count as members; no pending invites). You
                    control every fighter in turn; disables NPC auto script.
                  </span>
                </span>
              </label>
            </div>
          )}

          <label className="cam__label">Room code &amp; spectate</label>
          <div className="cam__copy-row">
            <span className="cam__code">{arenaId}</span>
            <button
              type="button"
              className={`cam__copy ${copied === COPY_TYPE.CODE ? 'cam__copy--done' : ''}`}
              onClick={() => handleCopy(COPY_TYPE.CODE)}
            >
              {copied === COPY_TYPE.CODE ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div className="cam__copy-row">
            <span className="cam__link">{viewerLink}</span>
            <button
              type="button"
              className={`cam__copy ${copied === COPY_TYPE.LINK ? 'cam__copy--done' : ''}`}
              onClick={() => handleCopy(COPY_TYPE.LINK)}
            >
              {copied === COPY_TYPE.LINK ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="cam__footer">
          <button
            type="button"
            className="cam__btn cam__btn--enter"
            onClick={handleEnter}
            disabled={!player || !rosterComplete}
          >
            Enter the Field
          </button>
        </div>
      </div>
    </div>
  );
}
