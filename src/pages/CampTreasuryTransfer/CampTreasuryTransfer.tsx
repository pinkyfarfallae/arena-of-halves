import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { Character, ItemInfo } from "../../types/character";
import { isNearWhite } from "../../utils/color";
import { DEITY_THEMES, fetchAllCharacters, fetchItemInfo } from "../../data/characters";
import { DEFAULT_THEME } from "../../constants/theme";
import ChevronLeft from "../../icons/ChevronLeft";
import Close from "../../icons/Close";
import { Dropdown, Input } from "../../components/Form";
import Search from "../../icons/Search";
import Trash from "../Shop/icons/Trash";
import Plus from "../../icons/Plus";
import { DEITY_SVG } from "../../data/deities";
import { DEITY_DISPLAY_OVERRIDES } from "../CharacterInfo/constants/overrides";
import { CABIN_DEITY, DEITY, Deity } from "../../constants/deities";
import Person from "../../components/Navbar/icons/Person";
import { SEX } from "../../constants/sex";
import Table, { Column } from "../../components/Table/Table";
import { transferItem } from "../../services/bag/bagService";
import { updateCharacterDrachma } from "../../services/character/currencyService";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import { ITEMS } from "../../constants/items";
import { useBag } from "../../hooks/useBag";
import './CampTreasuryTransfer.scss';
import { HIDDEN_AMPHITRITE_FOR } from "../../constants/characters";
import Pencil from "../../icons/Pencil";

type BulkRow = {
  id: string;
  itemId: string;
  amount: number;
  prev?: string;
};

const CampTreasuryTransfer = () => {
  const { user } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [loading, setLoading] = useState(true);
  const [allPlayers, setAllPlayers] = useState<Character[]>([]);
  const [players, setPlayers] = useState<Character[]>([]);

  const [playerSearchTerm, setPlayerSearchTerm] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");
  const [pendingSelectedPlayer, setPendingSelectedPlayer] = useState<string>("");

  const [allItems, setAllItems] = useState<ItemInfo[]>([]);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([{ id: `init-${Date.now()}`, itemId: '', amount: 0 }]);
  const [sending, setSending] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showConfirmChangeSelectedPlayer, setShowConfirmChangeSelectedPlayer] = useState(false);

  const { items: ownBagItems, loading: loadingBag } = useBag(user?.characterId);
  const hasPendingSend = bulkRows.some(r => r.amount > 0 && !!r.itemId);

  const applySelectedPlayer = (next: string) => {
    setSelectedPlayer(next);
    setPendingSelectedPlayer(next);
    setBulkRows([{ id: `reset-${Date.now()}`, itemId: '', amount: 0 }]);
    setShowSuccessModal(false);
    setSuccessMessage('');
    setShowConfirmChangeSelectedPlayer(false);
  };

  const requestChangeSelectedPlayer = (next: string) => {
    if (!hasPendingSend) {
      applySelectedPlayer(next);
      return;
    }
    setPendingSelectedPlayer(next);
    setShowConfirmChangeSelectedPlayer(true);
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const fetchPlayers = async () => {
      try {
        const [fetched, items] = await Promise.all([
          fetchAllCharacters(user),
          fetchItemInfo(),
        ]);

        const others = (fetched || []).filter((p: Character) => p.characterId !== user.characterId).filter(
          p => {
            if (HIDDEN_AMPHITRITE_FOR.includes(user.characterId as typeof HIDDEN_AMPHITRITE_FOR[number])) {
              return p.deityBlood !== DEITY.AMPHITRITE;
            }
            return true;
          }
        );

        setAllPlayers(others);
        setPlayers(others);
        setAllItems(items);
        const groupedInit = others.reduce<Record<number, Character[]>>((acc, p) => {
          const key = p.cabin ?? 0;
          if (!acc[key]) acc[key] = [];
          acc[key].push(p);
          return acc;
        }, {});
        const initGroupKeys = Object.keys(groupedInit).map(k => Number(k)).sort((a, b) => a - b);
        if (initGroupKeys.length > 0) {
          const firstGroup = (groupedInit[initGroupKeys[0]] || []).slice().sort((a: Character, b: Character) => a.nicknameEng.localeCompare(b.nicknameEng));
          if (firstGroup.length > 0) {
            setSelectedPlayer(firstGroup[0].characterId);
            setPendingSelectedPlayer(firstGroup[0].characterId);
          }
        }
      } catch (error) {
        console.error('Failed to fetch players:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPlayers();
  }, [user?.characterId]);

  // All items the sender actually owns (drachma + bag items with amount > 0)
  const ownItemOptions = useMemo(() => {
    const opts: { itemId: string; labelEng: string; labelThai: string; imageUrl?: string; ownedAmount: number }[] = [];
    if ((user?.currency || 0) > 0) {
      opts.push({ itemId: ITEMS.DRACHMA, labelEng: 'Drachma', labelThai: 'ดรัคมา', imageUrl: undefined, ownedAmount: user?.currency || 0 });
    }
    for (const entry of ownBagItems) {
      if (entry.amount <= 0) continue;
      const meta = allItems.find(i => i.itemId === entry.itemId);
      opts.push({
        itemId: entry.itemId,
        labelEng: meta?.labelEng || entry.itemId,
        labelThai: meta?.labelThai || '',
        imageUrl: meta?.imageUrl,
        ownedAmount: entry.amount,
      });
    }
    return opts;
  }, [user?.currency, ownBagItems, allItems]);

  const bulkColumns = useMemo<Column<any>[]>(() => {
    return [
      {
        key: 'itemId',
        label: 'Item',
        width: '300px',
        render: (row: any) => {
          if (row.id === '__add_row__') {
            const canAdd = bulkRows.length > 0 && bulkRows.every(r => !!r.itemId && r.amount > 0);
            return (
              <div className="camp-treasury--bulk-add-row">
                <button
                  className="at__btn at__btn--action camp-treasury--bulk-add-button"
                  disabled={!canAdd}
                  onClick={() => {
                    if (!canAdd) return;
                    setBulkRows(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, itemId: '', amount: 0 }]);
                  }}
                >
                  <Plus width={14} height={14} />
                </button>
                <span className={`camp-treasury--bulk-add-label${!canAdd ? ' disabled' : ''}`}>Add Row</span>
              </div>
            );
          }

          if (row.itemId === '') {
            const available = ownItemOptions.filter(
              opt => opt.itemId === row.itemId || opt.itemId === row.prev || !bulkRows.find(r => r.itemId === opt.itemId)
            );
            return (
              <Dropdown
                options={available.map(opt => ({ label: opt.labelEng, value: opt.itemId }))}
                value={row.prev || ''}
                onChange={(value: string) => {
                  setBulkRows(prev => prev.map(r => r.id === row.id ? { ...r, itemId: value, prev: undefined, amount: 0 } : r));
                }}
                searchable
              />
            );
          }

          const item = ownItemOptions.find(o => o.itemId === row.itemId);
          return (
            <div className="item__nick-cell camp-treasury--bulk-item">
              <div className="item__avatar">
                {item?.imageUrl
                  ? <img src={item.imageUrl} alt="" referrerPolicy="no-referrer" />
                  : <span>{(item?.labelEng ?? '?')[0]?.toUpperCase()}</span>
                }
              </div>
              <div className="item__nick-text">
                <span className="item__nick-eng camp-treasury--bulk-item-name-eng">
                  {item?.labelEng}
                  <button
                    className="camp-treasury--bulk-change-item-button"
                    onClick={() => setBulkRows(prev => prev.map(r => r.id === row.id ? { ...r, itemId: '', prev: row.itemId, amount: 0 } : r))}
                  >
                    <Pencil width={14} height={14} />
                  </button>
                </span>
                {item?.labelThai && <span className="item__nick-thai">{item.labelThai}</span>}
              </div>
            </div>
          );
        },
      },
      {
        key: 'amount',
        label: 'Amount',
        render: (row: any) => {
          if (row.id === '__add_row__') return null;
          const item = ownItemOptions.find(o => o.itemId === row.itemId);
          const max = item?.ownedAmount ?? 0;
          return (
            <div className="camp-treasury--amount-card">
              <div className="camp-treasury--amount-balance">
                <span className="camp-treasury--amount-balance-label">have</span>
                <span className="camp-treasury--amount-balance-value">{max}</span>
              </div>

              <div className="camp-treasury--amount-give">
                <div className="camp-treasury--amount-give-head">
                  <span className="camp-treasury--amount-give-label">give</span>
                  <button
                    type="button"
                    className="camp-treasury--amount-max-btn"
                    onClick={() => {
                      setBulkRows(prev => prev.map(r => r.id === row.id ? { ...r, amount: max } : r));
                    }}
                    disabled={max <= 0 || row.amount === max}
                  >
                    Max
                  </button>
                </div>

                <span className="camp-treasury--amount-give-label camp-treasury--amount-give-label--inline">give</span>

                <div className="camp-treasury--amount-input-wrap">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={row.amount.toString()}
                    className="camp-treasury--amount-input-field"
                    onChange={(value: string) => {
                      const parsed = Math.max(0, Math.min(max, Number(value) || 0));
                      setBulkRows(prev => prev.map(r => r.id === row.id ? { ...r, amount: parsed } : r));
                    }}
                  />
                </div>

                <button
                  type="button"
                  className="camp-treasury--amount-max-btn camp-treasury--amount-max-btn--inline"
                  onClick={() => {
                    setBulkRows(prev => prev.map(r => r.id === row.id ? { ...r, amount: max } : r));
                  }}
                  disabled={max <= 0 || row.amount === max}
                >
                  Max
                </button>
              </div>
            </div>
          );
        },
      },
      {
        key: 'remove',
        label: 'Remove',
        width: '60px',
        render: (row: any) => {
          if (row.id === '__add_row__') return null;
          return (
            <button
              className="at__btn at__btn--action camp-treasury--bulk-remove-button"
              disabled={bulkRows.length === 1}
              onClick={() => setBulkRows(prev => prev.filter(r => r.id !== row.id))}
            >
              <Trash width={14} height={14} />
            </button>
          );
        },
      },
    ];
  }, [ownItemOptions, bulkRows]);

  const recipientPlayer = players.find(p => p.characterId === selectedPlayer);

  const handleSend = async () => {
    if (!selectedPlayer || !user?.characterId) return;
    const rowsToSend = bulkRows.filter(r => r.itemId && r.amount > 0);
    if (rowsToSend.length === 0) return;

    setSending(true);
    const errors: string[] = [];

    for (const row of rowsToSend) {
      const { itemId, amount } = row;
      try {
        if (itemId === ITEMS.DRACHMA) {
          const senderName = user.nicknameEng || user.nameEng || user.characterId;
          const receiverName = recipientPlayer?.nicknameEng || recipientPlayer?.nameEng || selectedPlayer;
          const deductRes = await updateCharacterDrachma(user.characterId, -amount, {
            performedBy: user.characterId,
            source: 'treasury_transfer',
            extraMetadata: { toUserId: selectedPlayer, toName: receiverName },
          });
          if (!deductRes.success) {
            errors.push(`Drachma deduct failed: ${deductRes.error || 'unknown'}`);
            continue;
          }
          const addRes = await updateCharacterDrachma(selectedPlayer, amount, {
            performedBy: user.characterId,
            source: 'treasury_transfer',
            extraMetadata: { fromUserId: user.characterId, fromName: senderName },
          });
          if (!addRes.success) {
            await updateCharacterDrachma(user.characterId, amount, {
              performedBy: user.characterId,
              source: 'treasury_transfer_rollback',
            });
            errors.push(`Drachma send failed: ${addRes.error || 'unknown'}`);
          }
        } else {
          const res = await transferItem(user.characterId, selectedPlayer, itemId, amount, {
            fromName: user.nicknameEng || user.nameEng || user.characterId,
            toName: recipientPlayer?.nicknameEng || recipientPlayer?.nameEng || selectedPlayer,
          });
          if (!res.success) {
            errors.push(`${itemId} transfer failed: ${res.error || 'unknown'}`);
          }
        }
      } catch (err) {
        errors.push(`${itemId}: ${(err as Error).message}`);
      }
    }

    setSending(false);
    if (errors.length === 0) {
      setBulkRows([{ id: `reset-${Date.now()}`, itemId: '', amount: 0 }]);
      setSuccessMessage(`Successfully sent to ${recipientPlayer?.nicknameEng}`);
      setShowSuccessModal(true);
      window.setTimeout(() => {
        setShowSuccessModal(false);
      }, 2200);
    } else {
      console.error('Treasury transfer failed:', errors.join(' | '));
    }
  };

  return (
    <div className="camp-treasury">
      <div className={`camp-treasury__container ${sidebarOpen ? 'camp-treasury__container--sidebar-open' : ''}`}>
        <main className="camp-treasury__main">
          <header className="camp-treasury__bar">
            <div className="camp-treasury__bar-title">
              {selectedPlayer ? `Send to ${recipientPlayer?.nicknameEng || '...'}` : 'Treasury Transfer'}
            </div>
            <button
              className={`camp-treasury__bar-chevron ${sidebarOpen ? 'camp-treasury__bar-chevron--open' : ''}`}
              onClick={() => setSidebarOpen(true)}
            >
              <ChevronLeft />
            </button>
          </header>

          <div className="camp-treasury__content">
            {!selectedPlayer ? (
              <div className="camp-treasury__content--empty">
                <Person />
                <h2>No recipient selected</h2>
                <p>Select a player from the sidebar to send them drachma or items from your bag.</p>
              </div>
            ) : (
              <div
                className="camp-treasury__content--player"
                style={{
                  '--player-primary': (!isNearWhite(recipientPlayer?.theme[0]) ? recipientPlayer?.theme[0] : undefined) || DEITY_THEMES[(recipientPlayer?.deityBlood || '').toLowerCase() as Deity]?.[0] || DEITY_THEMES[DEITY_DISPLAY_OVERRIDES[selectedPlayer] as Deity]?.[0] || DEFAULT_THEME[0],
                  '--player-accent-dark': recipientPlayer?.theme[19] || DEITY_THEMES[recipientPlayer?.deityBlood as Deity]?.[19] || DEITY_THEMES[DEITY_DISPLAY_OVERRIDES[selectedPlayer] as Deity]?.[19],
                } as React.CSSProperties}
              >
                <div className="camp-treasury__content--player-header">
                  <div className="camp-treasury__content--player-avatar">
                    {recipientPlayer?.image ? (
                      <img src={recipientPlayer.image} alt={recipientPlayer.nicknameEng} />
                    ) : (
                      <div className="camp-treasury__content--player-avatar-placeholder">
                        {recipientPlayer?.nicknameEng.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="camp-treasury__content--player-name">
                    <h2>Send to {recipientPlayer?.nicknameEng}</h2>
                    <p>
                      <b>{recipientPlayer?.nameEng}</b>, {recipientPlayer?.sex === SEX.MALE ? 'Son' : 'Daughter'} of {recipientPlayer?.deityBlood}
                    </p>
                  </div>
                </div>

                <Table
                  columns={bulkColumns}
                  data={[...bulkRows, { id: '__add_row__' }]}
                  rowKey={(r: any) => r.id}
                  loading={loadingBag}
                  hideHeaders
                />

                <div className="camp-treasury__content--player-footer">
                  <button
                    className="camp-treasury__content--player-footer-reset"
                    disabled={!hasPendingSend || sending}
                    onClick={() => {
                      setBulkRows([{
                        id: `reset-${Date.now()}`,
                        itemId: '', amount: 0
                      }]);
                      setSuccessMessage('');
                    }}
                  >
                    Reset
                  </button>
                  <button
                    className="camp-treasury__content--player-footer-send"
                    disabled={!hasPendingSend || sending}
                    onClick={handleSend}
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        <aside className={`camp-treasury__sidebar ${sidebarOpen ? 'camp-treasury__sidebar--open' : ''}`}>
          <div className="camp-treasury__sidebar__head">
            <div className="camp-treasury__sidebar__head-title">Players</div>
            <button className="camp-treasury__sidebar__close" onClick={() => setSidebarOpen(false)}>
              <Close />
            </button>
          </div>

          <div className="camp-treasury__sidebar__search-container">
            <Input
              placeholder="Search players"
              className="camp-treasury__sidebar__search"
              value={playerSearchTerm}
              onChange={(term: string) => {
                setPlayerSearchTerm(term);
                if (term.trim() === "") {
                  setPlayers(allPlayers);
                } else {
                  const filtered = allPlayers.filter(p =>
                    p.nicknameEng.toLowerCase().includes(term.toLowerCase())
                  );
                  setPlayers(filtered);
                }
              }}
            />
            <Search className="camp-treasury__sidebar__search-icon" />
            <button
              className="camp-treasury__sidebar__search-clear"
              disabled={playerSearchTerm.trim() === ""}
              onClick={() => { setPlayerSearchTerm(""); setPlayers(allPlayers); }}
            >
              <Close />
            </button>
          </div>

          <div className="camp-treasury__sidebar__content">
            {loading ? (
              <div className="camp-treasury__sidebar__content--loading">Loading...</div>
            ) : players.length === 0 && playerSearchTerm.trim() !== "" ? (
              <div className="camp-treasury__sidebar__content--empty">no player matched</div>
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
                    {groupKeys.map(cabin => {
                      const members = grouped[cabin].slice().sort((a: Character, b: Character) => a.nicknameEng.localeCompare(b.nicknameEng));
                      return (
                        <div key={`group-${cabin}`} className="camp-treasury__sidebar__group">
                          <div
                            className="camp-treasury__sidebar__group-title"
                            style={{ '--cabin-color': DEITY_THEMES[CABIN_DEITY[cabin]?.toLowerCase()]?.[0] || '#fff' } as React.CSSProperties}
                          >
                            Heirs of {CABIN_DEITY[cabin]}
                          </div>
                          {members.map((player: Character) => (
                            <div
                              key={player.characterId}
                              className={`camp-treasury__sidebar__item ${pendingSelectedPlayer === player.characterId ? 'camp-treasury__sidebar__item--selected' : ''}`}
                              onClick={() => requestChangeSelectedPlayer(player.characterId)}
                              style={{
                                '--player-primary': (!isNearWhite(player.theme[0]) ? player.theme[0] : undefined) || DEITY_THEMES[(player.deityBlood || '').toLowerCase() as Deity]?.[0] || DEITY_THEMES[DEITY_DISPLAY_OVERRIDES[player.characterId] as Deity]?.[0] || DEFAULT_THEME[0],
                                '--player-accent-dark': player.theme[19] || DEITY_THEMES[player.deityBlood]?.[19] || DEITY_THEMES[DEITY_DISPLAY_OVERRIDES[player.characterId] as Deity]?.[19],
                              } as React.CSSProperties}
                            >
                              <div className="camp-treasury__sidebar__item-avatar">
                                {player.image ? (
                                  <img src={player.image} alt={player.nicknameEng} />
                                ) : (
                                  <div className="camp-treasury__sidebar__item-avatar-placeholder">
                                    {player.nicknameEng.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="camp-treasury__sidebar__item-name">
                                <span className="camp-treasury__sidebar__item-name-eng">{player.nicknameEng}</span>
                                <span className="camp-treasury__sidebar__item-name-deity">{player.deityBlood}</span>
                              </div>
                              <div className="camp-treasury__sidebar__item-deity-icon">
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

      {showConfirmChangeSelectedPlayer && (
        <ConfirmModal
          title="Change Recipient"
          message="Changing the recipient will discard unsaved send amounts. Continue?"
          onConfirm={() => applySelectedPlayer(pendingSelectedPlayer)}
          onCancel={() => {
            setPendingSelectedPlayer(selectedPlayer);
            setShowConfirmChangeSelectedPlayer(false);
          }}
        />
      )}

      {showSuccessModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Transfer success">
          <div className="modal-content modal-content--success">
            <div className="modal-success-icon">✓</div>
            <p className="modal-success-message">{successMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampTreasuryTransfer;
