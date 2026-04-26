import React, { use, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../../hooks/useAuth";
import { Character } from "../../../../types/character";
import { DEITY_THEMES, fetchAllCharacters } from "../../../../data/characters";
import { DEFAULT_THEME } from "../../../../constants/theme";
import { isNearWhite } from "../../../../utils/color";
import { fetchAllNPCs } from "../../../../data/npcs";
import ChevronLeft from "../../../../icons/ChevronLeft";
import './NpcAffinityManagement.scss';
import Close from "../../../../icons/Close";
import Input from "../../../../components/Form/Input/Input";
import { CABIN_DEITY, Deity } from "../../../../constants/deities";
import { DEITY_DISPLAY_OVERRIDES } from "../../../CharacterInfo/constants/overrides";
import { DEITY_SVG } from "../../../../data/deities";
import Search from "../../../../icons/Search";
import { SEX } from "../../../../constants/sex";
import Table, { Column } from "../../../../components/Table/Table";
import ConfirmModal from "../../../../components/ConfirmModal/ConfirmModal";
import HeartAffinity from "./icons/HeartAffinity";
import { getAffinityForCharacter, saveAffinityForCharacter } from "../../../../services/character/npcAffinityService";

const EMPTY_CHARACTER: Character = {} as Character;

export default function NpcAffinityManagement() {
  const { user } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [loading, setLoading] = useState(true);
  const [loadingAffinities, setLoadingAffinities] = useState(false);

  const [allPlayers, setAllPlayers] = useState<Character[]>([]);
  const [players, setPlayers] = useState<Character[]>([]);

  const [npcs, setNpcs] = useState<Character[]>([]);

  const [playerSearchTerm, setPlayerSearchTerm] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Character>(EMPTY_CHARACTER);
  const [pendingSelectedPlayer, setPendingSelectedPlayer] = useState<Character | null>(null);
  const [showConfirmChangeSelectedPlayer, setShowConfirmChangeSelectedPlayer] = useState(false);

  const [npcSearchTerm, setNpcSearchTerm] = useState("");

  const [originalSelectedPlayerAffinities, setOriginalSelectedPlayerAffinities] = useState<Record<string, number>>({});
  const [affinityChanges, setAffinityChanges] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);

      const [fetchedPlayers, fetchedNpcs] = await Promise.all([
        fetchAllCharacters(user),
        fetchAllNPCs(),
      ]);

      setAllPlayers(fetchedPlayers);
      setPlayers(fetchedPlayers);

      // Initialize selected player: pick first member from the lowest-numbered cabin
      try {
        const grouped = (fetchedPlayers || []).reduce<Record<number, Character[]>>((acc, p) => {
          const key = p.cabin ?? 0;
          if (!acc[key]) acc[key] = [];
          acc[key].push(p);
          return acc;
        }, {});

        const groupKeys = Object.keys(grouped).map(k => Number(k)).sort((a, b) => a - b);
        if (groupKeys.length > 0) {
          const least = groupKeys[0];
          const members = (grouped[least] || []).slice().sort((a, b) => a.nicknameEng.localeCompare(b.nicknameEng));
          if (members.length > 0) applySelectedPlayer(members[0]);
        }
      } catch (e) {
        // ignore
      }

      setNpcs(fetchedNpcs || []);
      // setOriginalAffinities((fetchedNpcs || []).reduce<Record<string, number>>((acc, npc) => {
      //   acc[npc.characterId] = npc.affinity ?? 0;
      //   return acc;
      // }, {}));
      setLoading(false);
    };

    fetchData();
  }, [user?.characterId]);

  useEffect(() => {
    if (selectedPlayer === EMPTY_CHARACTER) return;

    let mounted = true;

    setLoadingAffinities(true);

    getAffinityForCharacter(selectedPlayer.characterId)
      .then((affinities: React.SetStateAction<Record<string, number>>) => {
        if (mounted) {
          setOriginalSelectedPlayerAffinities(affinities);
        }
      })
      .finally(() => {
        if (mounted) setLoadingAffinities(false);
      });

    return () => {
      mounted = false;
    };
  }, [selectedPlayer?.characterId]);

  const applySelectedPlayer = (next: Character | null) => {
    setSelectedPlayer(next || EMPTY_CHARACTER);
    setPendingSelectedPlayer(next || EMPTY_CHARACTER);
    setShowConfirmChangeSelectedPlayer(false);
    setAffinityChanges({});
    setOriginalSelectedPlayerAffinities({});
  };

  const requestChangeSelectedPlayer = (next: Character | null) => {
    if (next?.characterId === selectedPlayer.characterId) return;

    const hasPending = Object.keys(affinityChanges).length > 0;
    if (!hasPending) {
      applySelectedPlayer(next || EMPTY_CHARACTER);
      return;
    }

    setPendingSelectedPlayer(next || EMPTY_CHARACTER);
    setShowConfirmChangeSelectedPlayer(true);
  };

  const npcColumn = useMemo<Column<Record<string, any>>[]>(() => {
    return [
      {
        key: 'nicknameEng' as keyof Character,
        label: 'Name',
        render: (row: Record<string, any>) => {
          return (
            <div className="item__nick-cell">
              <div className="item__avatar npc-affinity-management__npc-avatar">
                {row.image
                  ? <img src={row.image} alt="" referrerPolicy="no-referrer" />
                  : <span>{(row.nicknameEng ?? row.nicknameThai ?? '?')[0]?.toUpperCase()}</span>
                }
              </div>
              <div className="item__nick-text">
                <span className="item__nick-eng">{row.nicknameEng}</span>
                {row.nicknameThai && <span className="item__nick-thai">{row.nicknameThai}</span>}
              </div>
            </div>
          );
        },
      },
      {
        key: 'affinity' as keyof Character,
        label: 'Affinity',
        width: '450px',
        render: (row: Record<string, any>) => {
          const affinity = affinityChanges[row.characterId] ?? originalSelectedPlayerAffinities[row.characterId] ?? 0;
          return (
            <div className="npc-affinity-management__heart-affinity-cell">
              <div className={`npc-affinity-management__heart-affinity-wrapper ${isDragging ? 'dragging' : ''}`}>
                {Array.from({ length: 10 }).map((_, i) => {
                  const value = 10 - i;
                  return (
                    <React.Fragment key={i}>
                      <input
                        type="checkbox"
                        name={`rating-${row.characterId}`}
                        id={`h${value}-${row.characterId}`}
                        value={String(value)}
                        checked={affinity >= value}
                        onMouseDown={(e) => { e.preventDefault(); }}
                        readOnly
                      />
                      <label
                        htmlFor={`h${value}-${row.characterId}`}
                        data-value={value}
                        onClick={(e) => {
                          // if this click follows a drag, ignore it
                          if (draggingRef.current) {
                            e.preventDefault();
                            return;
                          }
                          e.preventDefault();
                          const current = affinity;
                          const next = (current >= value) ? Math.max(0, value - 1) : value;
                          setAffinityChanges(prev => ({ ...prev, [row.characterId]: next }));
                        }}
                        onPointerDown={(e) => {
                          // start a short hold timer; only enter drag mode after the hold
                          if (dragTimeoutRef.current) {
                            window.clearTimeout(dragTimeoutRef.current);
                          }
                          dragTimeoutRef.current = window.setTimeout(() => {
                            draggingRef.current = true;
                            setIsDragging(true);
                            setAffinityChanges(prev => ({ ...prev, [row.characterId]: value }));
                            dragTimeoutRef.current = null;
                          }, 200);
                        }}
                        onPointerEnter={(e) => {
                          // if dragging, update affinity as user moves across hearts
                          if (!draggingRef.current) return;
                          e.preventDefault();
                          setAffinityChanges(prev => ({ ...prev, [row.characterId]: value }));
                        }}
                      >
                        <HeartAffinity />
                      </label>
                    </React.Fragment>
                  );
                })}
              </div>
              <span className="npc-affinity-management__heart-affinity-value">{affinity}</span>
            </div>
          );
        },
      }
    ]
  }, [npcs, affinityChanges, originalSelectedPlayerAffinities, selectedPlayer]);

  const hasChanges = useMemo(() => {
    return Object.keys(affinityChanges).some(key => (affinityChanges[key] ?? 0) !== (originalSelectedPlayerAffinities[key] ?? 0));
  }, [affinityChanges, originalSelectedPlayerAffinities]);

  const savingRef = useRef(false);

  const draggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const onUp = () => {
      // clear any pending drag-start timeout
      if (dragTimeoutRef.current) {
        window.clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = null;
      }

      if (draggingRef.current) {
        draggingRef.current = false;
        setIsDragging(false);
      }
    };

    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointerup', onUp);
      if (dragTimeoutRef.current) {
        window.clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className="npc-affinity-management"
      style={{
        '--player-primary': (!isNearWhite(players.find(p => p.characterId === selectedPlayer.characterId)?.theme[0]) ? players.find(p => p.characterId === selectedPlayer.characterId)?.theme[0] : undefined) || DEITY_THEMES[(players.find(p => p.characterId === selectedPlayer.characterId)?.deityBlood || '').toLowerCase() as Deity]?.[0] || DEITY_THEMES[DEITY_DISPLAY_OVERRIDES[selectedPlayer.characterId] as Deity]?.[0] || DEFAULT_THEME[0],
        '--player-accent-dark': players.find(p => p.characterId === selectedPlayer.characterId)?.theme[19] || DEITY_THEMES[players.find(p => p.characterId === selectedPlayer.characterId)?.deityBlood as Deity]?.[19] || DEITY_THEMES[DEITY_DISPLAY_OVERRIDES[selectedPlayer.characterId] as Deity]?.[19],
      } as React.CSSProperties}
    >
      {/* Layout */}
      <div className={`npc-affinity-management__container ${sidebarOpen ? 'npc-affinity-management__container--sidebar-open' : ''}`}>
        {/* Main */}
        <main className="npc-affinity-management__main">
          {/* Top bar */}
          <header className="npc-affinity-management__bar">
            <div className="npc-affinity-management__bar-title">
              {loading || (selectedPlayer === EMPTY_CHARACTER)
                ? 'NPC Affinity Management'
                : selectedPlayer
                  ? selectedPlayer.nicknameEng
                  : 'NPC Affinity Management'}
            </div>

            {/* Mobile toggle */}
            <button className={`npc-affinity-management__bar-chevron ${sidebarOpen ? 'npc-affinity-management__bar-chevron--open' : ''}`} onClick={() => setSidebarOpen(true)}>
              <ChevronLeft />
            </button>
          </header>

          {/* Content */}
          <div className="npc-affinity-management__content">
            <div className="npc-affinity-management__content-header">
              <div className="npc-affinity-management__content-avatar">
                {loading ?
                  <div className="npc-affinity-management__content-avatar-placeholder">?</div>
                  : selectedPlayer.image ? (
                    <img src={selectedPlayer.image} alt={selectedPlayer.nicknameEng} />
                  ) : (
                    <div className="npc-affinity-management__content-avatar-placeholder">
                      {selectedPlayer.nicknameEng?.charAt(0).toUpperCase()}
                    </div>
                  )}
              </div>
              <div className="npc-affinity-management__content-name">
                {loading ? (
                  <h2 className="npc-affinity-management__content-name-loading">Loading...</h2>
                ) : (
                  <h2>{`${selectedPlayer.nicknameEng}'s Affinity`}</h2>
                )}
                {!loading && (
                  <p>
                    <b>{selectedPlayer.nameEng}</b>, {selectedPlayer.sex === SEX.MALE ? 'Son' : 'Daughter'} of {selectedPlayer?.deityBlood}
                  </p>
                )}
              </div>
            </div>
            <div className="item__toolbar">
              <div className="item__search">
                <Search width={14} height={14} className="item__search-icon" />
                <input
                  className="item__search-input"
                  type="text"
                  placeholder="Search by name"
                  value={npcSearchTerm}
                  onChange={e => setNpcSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Table
              rowKey={(row) => row.characterId}
              columns={npcColumn}
              data={npcs.filter(npc => npc.nicknameEng.toLowerCase().includes(npcSearchTerm.toLowerCase()) || npc.nameEng.toLowerCase().includes(npcSearchTerm.toLowerCase()) || npc.nicknameThai.toLowerCase().includes(npcSearchTerm.toLowerCase()) || npc.nameThai.toLowerCase().includes(npcSearchTerm.toLowerCase()))}
              loading={loading}
              hideHeaders
            />
            <div className="npc-affinity-management__content-footer">
              <button
                className="admin-player-inventory__content--bulk-footer-reset"
                disabled={!hasChanges || loadingAffinities}
                onClick={() => { setAffinityChanges({}); }}
              >
                Reset
              </button>
              <button
                className="admin-player-inventory__content--bulk-footer-apply"
                disabled={!hasChanges || selectedPlayer === EMPTY_CHARACTER || loadingAffinities || savingRef.current}
                onClick={async () => {
                  if (selectedPlayer === EMPTY_CHARACTER) return;
                  if (savingRef.current) return;
                  savingRef.current = true;
                  setLoadingAffinities(true);
                  try {
                    const affinities: Record<string, number> = {};
                    (npcs || []).forEach(npc => {
                      affinities[npc.characterId] = affinityChanges[npc.characterId] ?? originalSelectedPlayerAffinities[npc.characterId] ?? 0;
                    });

                    await saveAffinityForCharacter(String(selectedPlayer.characterId), affinities);

                    setOriginalSelectedPlayerAffinities(affinities);
                    setAffinityChanges({});
                  } catch (e) {
                    // ignore
                  } finally {
                    setLoadingAffinities(false);
                    savingRef.current = false;
                  }
                }}
              >
                {loadingAffinities || savingRef.current ? 'Saving...' : 'Apply'}
              </button>
            </div>
          </div>
        </main>

        {/* Sidebar (right) */}
        <aside className={`npc-affinity-management__sidebar ${sidebarOpen ? 'npc-affinity-management__sidebar--open' : ''}`}>
          <div className="npc-affinity-management__sidebar__head">
            <div className="npc-affinity-management__sidebar__head-title">
              Players
            </div>
            <button className="npc-affinity-management__sidebar__close" onClick={() => setSidebarOpen(false)}>
              <Close />
            </button>
          </div>
          <div className="npc-affinity-management__sidebar__search-container">
            <Input
              placeholder="Search players"
              className="npc-affinity-management__sidebar__search"
              value={playerSearchTerm}
              onChange={(term) => {
                setPlayerSearchTerm(term);
                if (term.trim() === "") {
                  setPlayers(allPlayers);
                  requestChangeSelectedPlayer(null);
                } else {
                  const filtered = allPlayers.filter(player =>
                    player.nicknameEng.toLowerCase().includes(term.toLowerCase())
                  );
                  setPlayers(filtered);
                  requestChangeSelectedPlayer(filtered.length > 0 ? filtered[0] : null);
                }
              }}
            />
            <Search className="npc-affinity-management__sidebar__search-icon" />
            <button
              className="npc-affinity-management__sidebar__search-clear"
              disabled={playerSearchTerm.trim() === ""}
              onClick={() => {
                setPlayerSearchTerm("");
                requestChangeSelectedPlayer(null);
                setPlayers(allPlayers);
              }}
            >
              <Close />
            </button>
          </div>
          <div className="npc-affinity-management__sidebar__content">
            {loading ? (
              <div className="npc-affinity-management__sidebar__content--loading">Loading...</div>
            ) : players.length === 0 && playerSearchTerm.trim() !== "" ? (
              <div className="npc-affinity-management__sidebar__content--empty">no player matched</div>
            ) : (
              (() => {
                const grouped = players.reduce<Record<number, Character[]>>((acc, p) => {
                  const key = p.cabin ?? 0;
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(p);
                  return acc;
                }, {});

                const groupKeys = Object.keys(grouped).map(k => Number(k)).sort((a, b) => a - b);

                return (
                  <>
                    {groupKeys.map((cabin) => {
                      const members = grouped[cabin].slice().sort((a, b) => a.nicknameEng.localeCompare(b.nicknameEng));
                      return (
                        <div
                          key={`group-${cabin}`}
                          className="npc-affinity-management__sidebar__group"
                        >
                          <div
                            className="npc-affinity-management__sidebar__group-title"
                            style={{ '--cabin-color': DEITY_THEMES[CABIN_DEITY[cabin]?.toLowerCase()]?.[0] || '#fff' } as React.CSSProperties}
                          >
                            Heirs of {CABIN_DEITY[cabin]}
                          </div>
                          {members.map(player => (
                            <div
                              key={player.characterId}
                              className={`npc-affinity-management__sidebar__item ${(selectedPlayer?.characterId === player.characterId || pendingSelectedPlayer?.characterId === player.characterId) ? 'npc-affinity-management__sidebar__item--selected' : ''}`}
                              onClick={() =>
                                requestChangeSelectedPlayer(player)}
                              style={{
                                '--player-primary': (!isNearWhite(player.theme[0]) ? player.theme[0] : undefined) || DEITY_THEMES[(player.deityBlood || '').toLowerCase() as Deity]?.[0] || DEITY_THEMES[DEITY_DISPLAY_OVERRIDES[player.characterId] as Deity]?.[0] || DEFAULT_THEME[0],
                                '--player-accent-dark': player.theme[19] || DEITY_THEMES[player.deityBlood]?.[19] || DEITY_THEMES[DEITY_DISPLAY_OVERRIDES[player.characterId] as Deity]?.[19],
                              } as React.CSSProperties}
                            >
                              <div className="npc-affinity-management__sidebar__item-avatar">
                                {player.image ? (
                                  <img src={player.image} alt={player.nicknameEng} />
                                ) : (
                                  <div className="npc-affinity-management__sidebar__item-avatar-placeholder">
                                    {player.nicknameEng.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="npc-affinity-management__sidebar__item-name">
                                <span className="npc-affinity-management__sidebar__item-name-eng">{player.nicknameEng}</span>
                                <span className="npc-affinity-management__sidebar__item-name-deity">{player.deityBlood}</span>
                              </div>
                              <div className="npc-affinity-management__sidebar__item-deity-icon">
                                {DEITY_SVG[player.deityBlood] || DEITY_SVG[DEITY_DISPLAY_OVERRIDES[player.characterId] as Deity]}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </>
                );
              })()
            )}
          </div>
        </aside>
      </div>

      {/* Confirm change selected player */}
      {showConfirmChangeSelectedPlayer && (
        <ConfirmModal
          title="Discard unsaved changes?"
          message={`You have unsaved affinity changes for ${selectedPlayer.nicknameEng}. If you switch to another player, those changes will be lost. Do you want to continue?`}
          onConfirm={() => applySelectedPlayer(pendingSelectedPlayer)}
          onCancel={() => {
            setAffinityChanges({});
            setShowConfirmChangeSelectedPlayer(false);
            setPendingSelectedPlayer(null);
            setSelectedPlayer(selectedPlayer);
          }}
        />
      )}
    </div>
  );
}