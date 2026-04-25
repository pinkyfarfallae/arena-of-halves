import React, { useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "../../../../hooks/useAuth";
import { Character, ItemInfo } from "../../../../types/character";
import { DEITY_THEMES, fetchAllCharacters, fetchItemInfo } from "../../../../data/characters";
import ChevronLeft from "../../../../icons/ChevronLeft";
import Close from "../../../../icons/Close";
import { Dropdown, Input } from "../../../../components/Form";
import Search from "../../../../icons/Search";
import { DEITY_SVG } from "../../../../data/deities";
import { DEITY_DISPLAY_OVERRIDES } from "../../../CharacterInfo/constants/overrides";
import { CABIN_DEITY, Deity } from "../../../../constants/deities";
import Person from "../../../../components/Navbar/icons/Person";
import { SEX } from "../../../../constants/sex";
import Table, { Column } from "../../../../components/Table/Table";
import { getBagData, giveItem, consumeItem, getItemAmount, setBagItemData } from "../../../../services/bag/bagService";
import { updateCharacterDrachma } from "../../../../services/character/currencyService";
import { addTrainingPoints, spendTrainingPoints } from "../../../../services/training/trainingPoints";
import { logActivity } from "../../../../services/activityLog/activityLogService";
import { BAG_ITEM_TYPES } from "../../../../constants/bag";
import ConfirmModal from "../../../../components/ConfirmModal/ConfirmModal";
import { ITEMS } from "../../../../constants/items";
import './PlayerInventory.scss';
import Trash from "../../../Shop/icons/Trash";
import Pencil from "../../../../icons/Pencil";
import Plus from "../../../../icons/Plus";

type SingleRow = {
  itemId: string;
  labelEng: string;
  labelThai: string;
  imageUrl?: string;
  amount: number
};

const ACTION = {
  ADD: 'add',
  CONSUME: 'consume',
} as const;

type Action = typeof ACTION[keyof typeof ACTION];

const PlayerInventory = () => {
  const { user } = useAuth();

  const isFirstRender = useRef(true);
  const checkboxRef = useRef<HTMLInputElement>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [loading, setLoading] = useState(true);
  const [allPlayers, setAllPlayers] = useState<Character[]>([]);
  const [players, setPlayers] = useState<Character[]>([]);

  const [playerSearchTerm, setPlayerSearchTerm] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<string[]>([]);
  const [pendingSelectedPlayer, setPendingSelectedPlayer] = useState<string[]>([]);

  const [loadingBag, setLoadingBag] = useState(false);
  const [allItems, setAllItems] = useState<ItemInfo[]>([]);

  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [bulkRows, setBulkRows] = useState<Array<{ id: string; itemId: string; action: Action; amount: number; prev?: string }>>([
    { id: `init-${Date.now()}`, itemId: '', action: ACTION.ADD, amount: 0 }
  ]);
  const [singleSelectedPlayerBagData, setSingleSelectedPlayerBagData] = useState<Record<string, number>>({});
  const [singleSelectedPlayerChangedItems, setSingleSelectedPlayerChangedItems] = useState<Record<string, { action: Action; amount: number }>>({});

  const [showConfirmChangeSelectedPlayer, setShowConfirmChangeSelectedPlayer] = useState(false);

  const hasPendingChanges = useMemo(() => {
    return Object.values(singleSelectedPlayerChangedItems).some(ch => !!(ch && ch.amount > 0));
  }, [singleSelectedPlayerChangedItems]);

  const hasBulkPending = useMemo(() => {
    return bulkRows.some(r => r && r.amount > 0);
  }, [bulkRows]);

  const bulkColumns = useMemo<Column<any>[]>(() => {
    return [
      {
        key: 'itemId',
        label: 'Bulk Item Name',
        width: '300px',
        render: (row: any) => {
          if (row.id === '__add_row__') {
            const canAdd = bulkRows.length > 0 && bulkRows.every((r) => !!r.itemId && r.amount > 0);
            return (
              <div className="admin-player-inventory--bulk-add-row">
                <button
                  className="at__btn at__btn--action admin-player-inventory--bulk-add-button"
                  disabled={!canAdd}
                  onClick={() => {
                    if (!canAdd) return;
                    const id = `${Date.now()}-${Math.random()}`;
                    setBulkRows(prev => ([...prev, { id, itemId: '', action: ACTION.ADD, amount: 0 }]));
                  }}
                >
                  <Plus width={14} height={14} />
                </button>
                <span className={`admin-player-inventory--bulk-add-label ${!canAdd ? 'disabled' : ''}`}>Add Row</span>
              </div>
            );
          }

          const currentItemIds = row.itemId;

          if (currentItemIds === '') {
            return (
              <Dropdown
                options={[
                  { label: 'Drachma', value: ITEMS.DRACHMA },
                  { label: 'Training Points', value: ITEMS.TRAINING_POINTS },
                  ...allItems.map(it => ({ label: it.labelEng, value: it.itemId })),
                ].filter(opt => (opt.value === row.itemId) || (opt.value === row.prev) || !bulkRows.find((r) => r.itemId === opt.value))}
                value={row.itemId || row.prev || ''}
                onChange={(value) => {
                  const itemId = value as string;
                  setBulkRows(prev => prev.map((r) => r.id === row.id ? { ...r, itemId, prev: undefined } : r));
                }}
                searchable
              />
            );
          }

          const drachma = {
            itemId: ITEMS.DRACHMA,
            labelEng: 'Drachma',
            labelThai: 'ดรัคมา',
            imageUrl: undefined,
          };

          const trainingPoints = {
            itemId: ITEMS.TRAINING_POINTS,
            labelEng: 'Training Points',
            labelThai: 'แต้มฝึกฝน',
            imageUrl: undefined,
          };

          const itemInfo = [drachma, trainingPoints, ...allItems].find(it => it.itemId === row.itemId);

          return (
            <div className="item__nick-cell admin-player-inventory--bulk-item">
              <div className="item__avatar">
                {itemInfo?.imageUrl
                  ? <img src={itemInfo.imageUrl} alt="" referrerPolicy="no-referrer" />
                  : <span>{(itemInfo?.labelEng ?? itemInfo?.labelEng ?? '?')[0]?.toUpperCase()}</span>
                }
              </div>
              <div className="item__nick-text">
                <span className="item__nick-eng admin-player-inventory--bulk-item-name-eng">
                  {itemInfo?.labelEng}
                  <button
                    className="admin-player-inventory--bulk-change-item-button"
                    onClick={() => {
                      setBulkRows([...bulkRows.map(r => r.id === row.id ? { ...r, itemId: '', prev: row.itemId } : r)]);
                    }}
                  >
                    <Pencil width={14} height={14} />
                  </button>
                </span>
                {itemInfo?.labelThai && <span className="item__nick-thai">{itemInfo.labelThai}</span>}
              </div>
            </div>
          )
        },
      },
      {
        key: 'action',
        label: 'Bulk Item Action',
        render: (row: any) => (
          row.id === '__add_row__' ? null : (
            <Dropdown
              options={[{ label: 'Add', value: ACTION.ADD }, { label: 'Consume', value: ACTION.CONSUME }]}
              value={row.action}
              onChange={(value) => {
                const action = value as Action;
                setBulkRows(prev => prev.map(r => r.id === row.id ? { ...r, action } : r));
              }}
            />
          )
        ),
      },
      {
        key: 'amount',
        label: 'Bulk Item Amount',
        render: (row: any) => (
          row.id === '__add_row__' ? null : (
            <Input
              type="number"
              value={row.amount?.toString() || '0'}
              onChange={(val) => {
                const num = Math.max(0, Number(val) || 0);
                setBulkRows(prev => prev.map(r => r.id === row.id ? { ...r, amount: num } : r));
              }}
            />
          )
        ),
      },
      {
        key: 'remove',
        label: 'Bulk Item Remove Row',
        width: '60px',
        render: (row: any) => (
          row.id === '__add_row__' ? null : (
            <button
              className="at__btn at__btn--action admin-player-inventory--bulk-remove-button"
              onClick={() => setBulkRows(prev => prev.filter(r => r.id !== row.id))}
              disabled={bulkRows.length === 1}
            >
              <Trash width={14} height={14} />
            </button>
          )
        ),
      }
    ];
  }, [allItems, itemSearchTerm, bulkRows]);

  const applySelectedPlayer = (next: string[]) => {
    setSelectedPlayer(next || []);
    setPendingSelectedPlayer(next || []);
    setSingleSelectedPlayerChangedItems({});
    setSingleSelectedPlayerBagData({});
    setShowConfirmChangeSelectedPlayer(false);
  };

  const requestChangeSelectedPlayer = (next: string[]) => {
    const hasPending = Object.keys(singleSelectedPlayerChangedItems).length > 0;
    if (!hasPending) {
      applySelectedPlayer(next || []);
      return;
    }
    setPendingSelectedPlayer(next || []);
    setShowConfirmChangeSelectedPlayer(true);
  };

  useEffect(() => {
    if (!user) return;

    setLoading(true);

    // Fetch player list on mount
    const fetchPlayers = async () => {
      try {
        const [players, items] = await Promise.all([
          fetchAllCharacters(user),
          fetchItemInfo(),
        ]);
        setAllPlayers(players);
        setPlayers(players);
        setAllItems(items);
        // After loading, pick initial selection: first player of the first (lowest) cabin group
        const groupedInit = (players || []).reduce<Record<number, Character[]>>((acc, p) => {
          const key = p.cabin ?? 0;
          if (!acc[key]) acc[key] = [];
          acc[key].push(p);
          return acc;
        }, {});

        const initGroupKeys = Object.keys(groupedInit).map(k => Number(k)).sort((a, b) => a - b);
        if (initGroupKeys.length > 0) {
          const firstGroup = (groupedInit[initGroupKeys[0]] || []).slice().sort((a, b) => a.nicknameEng.localeCompare(b.nicknameEng));
          if (firstGroup.length > 0) {
            setSelectedPlayer([firstGroup[0].characterId]);
            setPendingSelectedPlayer([firstGroup[0].characterId]);

            if (isFirstRender.current) {
              isFirstRender.current = false;
              setShowConfirmChangeSelectedPlayer(false);
            }
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

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate =
        selectedPlayer.length > 0 &&
        selectedPlayer.length < players.length;
    }
  }, [selectedPlayer, players.length]);

  useEffect(() => {
    const fetchBagData = async () => {
      if (selectedPlayer.length !== 1) {
        setSingleSelectedPlayerBagData({});
        return;
      }

      setLoadingBag(true);
      try {
        const bagData = await getBagData(selectedPlayer[0]);
        const simplifiedBagData: Record<string, number> = {};
        Object.entries(bagData).forEach(([itemId, itemInfo]) => {
          simplifiedBagData[itemId] = itemInfo.amount;
        });
        setSingleSelectedPlayerBagData(simplifiedBagData);
      } catch (error) {
        console.error('Failed to fetch bag data:', error);
      } finally {
        setLoadingBag(false);
      }
    };
    fetchBagData();
  }, [selectedPlayer]);

  const singlePlayerTableData = useMemo(() => {
    if (selectedPlayer.length !== 1) return [];
    const player = players.find(p => p.characterId === selectedPlayer[0]);
    if (!player) return [];

    const drachma = {
      itemId: ITEMS.DRACHMA,
      labelEng: 'Drachma',
      labelThai: 'ดรัคมา',
      imageUrl: undefined,
      amount: player.currency || 0,
    };

    const trainingPoints = {
      itemId: ITEMS.TRAINING_POINTS,
      labelEng: 'Training Points',
      labelThai: 'แต้มฝึกฝน',
      imageUrl: undefined,
      amount: player.trainingPoints || 0,
    };

    const items = allItems.map(item => ({
      itemId: item.itemId,
      labelEng: item.labelEng,
      labelThai: item.labelThai,
      imageUrl: item.imageUrl,
      amount: singleSelectedPlayerBagData[item.itemId] || 0,
    }));

    return [drachma, trainingPoints, ...items].filter(
      item => item.labelEng.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
        item.labelThai.toLowerCase().includes(itemSearchTerm.toLowerCase())
    );
  }, [selectedPlayer, singleSelectedPlayerBagData, itemSearchTerm, players, allItems]);

  const singlePlayerColumn = useMemo<Column<SingleRow>[]>(() => {
    if (selectedPlayer.length !== 1) return [];
    const player = players.find(p => p.characterId === selectedPlayer[0]);
    if (!player) return [];

    return [
      {
        key: 'labelEng' as keyof SingleRow & string,
        label: 'Name',
        render: (row: SingleRow) => {
          return (
            <div className="item__nick-cell">
              <div className="item__avatar">
                {row.imageUrl
                  ? <img src={row.imageUrl} alt="" referrerPolicy="no-referrer" />
                  : <span>{(row.labelEng ?? row.labelEng ?? '?')[0]?.toUpperCase()}</span>
                }
              </div>
              <div className="item__nick-text">
                <span className="item__nick-eng">{row.labelEng}</span>
                {row.labelThai && <span className="item__nick-thai">{row.labelThai}</span>}
              </div>
            </div>
          );
        },
      },
      {
        key: 'amount' as keyof SingleRow & string,
        label: 'Player Item Quantity',
        width: '515px',
        render: (row: SingleRow) => {
          const currentAmount = row.amount;
          const pendingChange = singleSelectedPlayerChangedItems[row.itemId];
          const pendingAction = pendingChange?.action || ACTION.ADD;
          const pendingAmount = pendingChange ? (pendingAction === ACTION.ADD ? pendingChange.amount : -pendingChange.amount) : 0;
          const finalAmount = currentAmount + pendingAmount;
          return (
            <div className="admin-player-inventory--player-inventory__item__amount">
              <div className="admin-player-inventory--player-inventory__item-current-amount">
                current
                <span className="admin-player-inventory--player-inventory__item-current-amount-value">{currentAmount}</span>
              </div>

              <div className="admin-player-inventory--player-inventory__item-current-input">
                <Dropdown
                  options={[
                    { label: 'Add', value: ACTION.ADD },
                    ...(currentAmount > 0 ? [{ label: 'Remove', value: ACTION.CONSUME }] : []),
                  ]}
                  placeholder="Select action"
                  value={singleSelectedPlayerChangedItems[row.itemId]?.action || ACTION.ADD}
                  onChange={(value) => {
                    const action = value as Action;
                    setSingleSelectedPlayerChangedItems(prev => ({
                      ...prev,
                      [row.itemId]: {
                        action: action,
                        amount: prev[row.itemId]?.amount || 0,
                      },
                    }));
                  }}
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  value={Math.abs(singleSelectedPlayerChangedItems[row.itemId]?.amount || 0).toString()}
                  onChange={(value) => {
                    const parsed = Math.abs(Math.max(0, Number(value)));
                    if (isNaN(parsed)) return;
                    setSingleSelectedPlayerChangedItems(prev => ({
                      ...prev,
                      [row.itemId]: {
                        ...prev[row.itemId],
                        action: prev[row.itemId]?.action || ACTION.ADD,
                        amount: parsed,
                      },
                    }));
                  }}
                />
              </div>

              <div className="admin-player-inventory--player-inventory__item-final-amount">
                final
                <span className="admin-player-inventory--player-inventory__item-final-amount-value">{finalAmount}</span>
              </div>

              {pendingChange && pendingChange.amount > 0 && (
                <div className="admin-player-inventory--player-inventory__item-changed-indicator" />
              )}
            </div>
          );
        }
      }
    ];
  }, [selectedPlayer, players, allItems, singleSelectedPlayerBagData, singleSelectedPlayerChangedItems]);

  return (
    <div className="admin-player-inventory">
      {/* Layout */}
      <div className={`admin-player-inventory__container ${sidebarOpen ? 'admin-player-inventory__container--sidebar-open' : ''}`}>
        {/* Main */}
        <main className="admin-player-inventory__main">
          {/* Top bar */}
          <header className="admin-player-inventory__bar">
            <div className="admin-player-inventory__bar-title">
              {selectedPlayer.length > 0
                ? selectedPlayer.length > 1
                  ? `Bulk Update: ${selectedPlayer.length} players selected`
                  : players.find(p => p.characterId === selectedPlayer[0])?.nicknameEng
                : "Player Inventory Manager"}
            </div>

            {/* Mobile toggle */}
            <button className={`admin-player-inventory__bar-chevron ${sidebarOpen ? 'admin-player-inventory__bar-chevron--open' : ''}`} onClick={() => setSidebarOpen(true)}>
              <ChevronLeft />
            </button>
          </header>

          {/* Content */}
          <div className="admin-player-inventory__content">
            {selectedPlayer.length === 0 ? (
              <div className="admin-player-inventory__content--empty">
                <Person />
                <h2>No player selected</h2>
                <p>Please select a player from the sidebar to view their inventory and details, or select multiple players for bulk actions.</p>
              </div>
            ) : selectedPlayer.length === 1 ? (
              <div
                className="admin-player-inventory__content--player"
                style={{
                  '--player-primary': players.find(p => p.characterId === selectedPlayer[0])?.theme[0] || DEITY_THEMES[players.find(p => p.characterId === selectedPlayer[0])?.deityBlood as Deity]?.[0] || DEITY_THEMES[DEITY_DISPLAY_OVERRIDES[selectedPlayer[0]] as Deity]?.[0],
                  '--player-accent-dark': players.find(p => p.characterId === selectedPlayer[0])?.theme[19] || DEITY_THEMES[players.find(p => p.characterId === selectedPlayer[0])?.deityBlood as Deity]?.[19] || DEITY_THEMES[DEITY_DISPLAY_OVERRIDES[selectedPlayer[0]] as Deity]?.[19],
                } as React.CSSProperties}
              >
                <div className="admin-player-inventory__content--player-header">
                  <div className="admin-player-inventory__content--player-avatar">
                    {players.find(p => p.characterId === selectedPlayer[0])?.image ? (
                      <img src={players.find(p => p.characterId === selectedPlayer[0])?.image} alt={players.find(p => p.characterId === selectedPlayer[0])?.nicknameEng} />
                    ) : (
                      <div className="admin-player-inventory__content--player-avatar-placeholder">
                        {players.find(p => p.characterId === selectedPlayer[0])?.nicknameEng.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="admin-player-inventory__content--player-name">
                    <h2>{players.find(p => p.characterId === selectedPlayer[0])?.nicknameEng}'s Bag</h2>
                    <p>
                      <b>{players.find(p => p.characterId === selectedPlayer[0])?.nameEng}</b>, {players.find(p => p.characterId === selectedPlayer[0])?.sex === SEX.MALE ? 'Son' : 'Daughter'} of {players.find(p => p.characterId === selectedPlayer[0])?.deityBlood}
                    </p>
                  </div>
                </div>
                <div className="item__toolbar">
                  <div className="item__search">
                    <Search width={14} height={14} className="item__search-icon" />
                    <input
                      className="item__search-input"
                      type="text"
                      placeholder="Search by name"
                      value={itemSearchTerm}
                      onChange={e => setItemSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <Table
                  columns={singlePlayerColumn}
                  data={singlePlayerTableData}
                  rowKey={(row) => row.itemId}
                  loading={loadingBag}
                  hideHeaders
                />
                <div className="admin-player-inventory__content--player-footer">
                  <button
                    className="admin-player-inventory__content--player-footer-reset"
                    disabled={!hasPendingChanges}
                    onClick={() => {
                      setSingleSelectedPlayerChangedItems({});
                    }}
                  >
                    Reset
                  </button>
                  <button
                    className="admin-player-inventory__content--player-footer-apply"
                    disabled={!hasPendingChanges}
                    onClick={async () => {
                      if (selectedPlayer.length !== 1) return;
                      const userId = selectedPlayer[0];
                      const entries = Object.entries(singleSelectedPlayerChangedItems);
                      if (entries.length === 0) return;

                      // console.log('Applying pending changes for user', userId, 'entries:', entries);
                      for (const [itemId, pending] of entries) {
                        if (!pending || !pending.amount || pending.amount <= 0) continue;

                        try {
                          if (itemId === ITEMS.DRACHMA) {
                            const delta = pending.action === ACTION.ADD ? pending.amount : -pending.amount;
                            const res = await updateCharacterDrachma(userId, delta, {
                              performedBy: user?.characterId || 'admin',
                              source: 'player_inventory',
                            });
                            // console.log('updateCharacterDrachma result', { userId, itemId, pending, res });
                            if (res.success) {
                              setPlayers(prev => prev.map(p => p.characterId === userId ? { ...p, currency: res.current ?? (p.currency ?? 0) } : p));
                            }
                          } else if (itemId === ITEMS.TRAINING_POINTS) {
                            if (pending.action === ACTION.ADD) {
                              const res = await addTrainingPoints(userId, pending.amount);
                              // console.log('addTrainingPoints result', { userId, itemId, pending, res });
                              if (res.success) {
                                setPlayers(prev => prev.map(p => p.characterId === userId ? { ...p, trainingPoints: res.current ?? (p.trainingPoints ?? 0) } : p));
                                logActivity({
                                  category: 'stat',
                                  action: 'add_training_points',
                                  characterId: userId,
                                  performedBy: user?.characterId || 'admin',
                                  amount: pending.amount,
                                  metadata: { source: 'player_inventory' },
                                });
                              }
                            } else {
                              const res = await spendTrainingPoints(userId, pending.amount);
                              // console.log('spendTrainingPoints result', { userId, itemId, pending, res });
                              if (res.success) {
                                setPlayers(prev => prev.map(p => p.characterId === userId ? { ...p, trainingPoints: res.current ?? (p.trainingPoints ?? 0) } : p));
                                logActivity({
                                  category: 'stat',
                                  action: 'deduct_training_points',
                                  characterId: userId,
                                  performedBy: user?.characterId || 'admin',
                                  amount: pending.amount,
                                  metadata: { source: 'player_inventory' },
                                });
                              }
                            }
                          } else {
                            if (pending.action === ACTION.ADD) {
                              const res = await giveItem(userId, itemId, pending.amount, BAG_ITEM_TYPES.ITEM);
                                if (res.success) {
                                  const newAmount = typeof res.newAmount === 'number' ? res.newAmount : await getItemAmount(userId, itemId).catch(() => undefined);
                                  if (typeof newAmount === 'number') setSingleSelectedPlayerBagData(prev => ({ ...prev, [itemId]: newAmount }));

                                  // Special-case item post-effects
                                  if (itemId === ITEMS.HERMES_S_PURSE) {
                                    // Ensure purse metadata exists (income, available)
                                    await setBagItemData(userId, itemId, {
                                      amount: newAmount ?? 0,
                                      type: BAG_ITEM_TYPES.ITEM,
                                      income: 0,
                                      available: true,
                                    });
                                  }
                                  logActivity({
                                    category: 'item',
                                    action: 'give_item',
                                    characterId: userId,
                                    performedBy: user?.characterId || 'admin',
                                    amount: pending.amount,
                                    metadata: { source: 'player_inventory', itemId },
                                  });
                                }
                            } else {
                              const res = await consumeItem(userId, itemId, pending.amount);
                              // console.log('consumeItem result', { userId, itemId, pending, res });
                              if (res.success) {
                                if (typeof res.newAmount === 'number') {
                                  setSingleSelectedPlayerBagData(prev => ({ ...prev, [itemId]: res.newAmount || 0 }));
                                } else {
                                  const current = await getItemAmount(userId, itemId).catch(() => undefined);
                                  if (typeof current === 'number') setSingleSelectedPlayerBagData(prev => ({ ...prev, [itemId]: current }));
                                }
                                logActivity({
                                  category: 'item',
                                  action: 'consume_item',
                                  characterId: userId,
                                  performedBy: user?.characterId || 'admin',
                                  amount: pending.amount,
                                  metadata: { source: 'player_inventory', itemId },
                                });
                              }
                            }
                          }
                        } catch (err) {
                          console.error('Failed to apply change for', itemId, err);
                        }
                      }

                      setSingleSelectedPlayerChangedItems({});
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="admin-player-inventory__content--bulk">
                <div className="admin-player-inventory__content--bulk-header">
                  <div className="admin-player-inventory__content--bulk-avatar">
                    <div className="admin-player-inventory__content--bulk-avatar-placeholder">
                      {selectedPlayer.length}
                    </div>
                  </div>
                  <div className="admin-player-inventory__content--bulk-info">
                    <h2>Players selected</h2>
                    <p>
                      <b>{selectedPlayer.length} players selected for bulk update.</b> Action will perform on all selected players.
                    </p>
                  </div>
                </div>
                <Table
                  columns={bulkColumns}
                  data={[...bulkRows, { id: '__add_row__' }]}
                  rowKey={(r) => r.id}
                  hideHeaders
                />

                <div className="admin-player-inventory__content--bulk-footer">
                  <button
                    className="admin-player-inventory__content--bulk-footer-reset"
                    disabled={!hasBulkPending}
                    onClick={() => setBulkRows([{
                      id: `reset-${Date.now()}`,
                      itemId: '',
                      amount: 0,
                      action: ACTION.ADD,
                    }])}
                  >
                    Reset
                  </button>
                  <button
                    className="admin-player-inventory__content--bulk-footer-apply"
                    disabled={!hasBulkPending || bulkRows.some(r => !r.itemId || r.amount <= 0)}
                    onClick={async () => {
                      if (bulkRows.length === 0) return;
                      const rowsToApply = bulkRows.filter(r => r.amount > 0);
                      if (rowsToApply.length === 0) return;

                      for (const userId of selectedPlayer) {
                        for (const row of rowsToApply) {
                          try {
                            if (row.itemId === ITEMS.DRACHMA) {
                              const delta = row.action === ACTION.ADD ? row.amount : -row.amount;
                              const res = await updateCharacterDrachma(userId, delta, {
                                performedBy: user?.characterId || 'admin',
                                source: 'player_inventory_bulk',
                              });
                              if (res.success) {
                                setPlayers(prev => prev.map(p => p.characterId === userId ? { ...p, currency: res.current ?? (p.currency ?? 0) } : p));
                              }
                            } else if (row.itemId === ITEMS.TRAINING_POINTS) {
                              if (row.action === ACTION.ADD) {
                                const res = await addTrainingPoints(userId, row.amount);
                                if (res.success) {
                                  setPlayers(prev => prev.map(p => p.characterId === userId ? { ...p, trainingPoints: res.current ?? (p.trainingPoints ?? 0) } : p));
                                  logActivity({
                                    category: 'stat',
                                    action: 'add_training_points',
                                    characterId: userId,
                                    performedBy: user?.characterId || 'admin',
                                    amount: row.amount,
                                    metadata: { source: 'player_inventory_bulk' },
                                  });
                                }
                              } else {
                                const res = await spendTrainingPoints(userId, row.amount);
                                if (res.success) {
                                  setPlayers(prev => prev.map(p => p.characterId === userId ? { ...p, trainingPoints: res.current ?? (p.trainingPoints ?? 0) } : p));
                                  logActivity({
                                    category: 'stat',
                                    action: 'deduct_training_points',
                                    characterId: userId,
                                    performedBy: user?.characterId || 'admin',
                                    amount: row.amount,
                                    metadata: { source: 'player_inventory_bulk' },
                                  });
                                }
                              }
                            } else {
                              if (row.action === ACTION.ADD) {
                                const res = await giveItem(userId, row.itemId, row.amount, BAG_ITEM_TYPES.ITEM);
                                if (res.success) {
                                  logActivity({
                                    category: 'item',
                                    action: 'give_item',
                                    characterId: userId,
                                    performedBy: user?.characterId || 'admin',
                                    amount: row.amount,
                                    metadata: { source: 'player_inventory_bulk', itemId: row.itemId },
                                  });
                                }
                              } else {
                                const res = await consumeItem(userId, row.itemId, row.amount);
                                if (res.success) {
                                  logActivity({
                                    category: 'item',
                                    action: 'consume_item',
                                    characterId: userId,
                                    performedBy: user?.characterId || 'admin',
                                    amount: row.amount,
                                    metadata: { source: 'player_inventory_bulk', itemId: row.itemId },
                                  });
                                }
                              }
                            }
                          } catch (err) {
                            console.error('Bulk apply failed for', userId, row, err);
                          }
                        }
                      }

                      // After applying, clear rows
                      setBulkRows([{
                        id: `reset-${Date.now()}`,
                        itemId: '',
                        amount: 0,
                        action: ACTION.ADD,
                      }]);
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Sidebar (right) */}
        <aside className={`admin-player-inventory__sidebar ${sidebarOpen ? 'admin-player-inventory__sidebar--open' : ''}`}>
          <div className="admin-player-inventory__sidebar__head">
            <div className="admin-player-inventory__sidebar__head-title">
              Players
            </div>
            <button className="admin-player-inventory__sidebar__close" onClick={() => setSidebarOpen(false)}>
              <Close />
            </button>
          </div>
          <div className="admin-player-inventory__sidebar__search-container">
            <Input
              placeholder="Search players"
              className="admin-player-inventory__sidebar__search"
              value={playerSearchTerm}
              onChange={(term) => {
                setPlayerSearchTerm(term);
                if (term.trim() === "") {
                  setPlayers(allPlayers);
                  requestChangeSelectedPlayer([]);
                } else {
                  const filtered = allPlayers.filter(player =>
                    player.nicknameEng.toLowerCase().includes(term.toLowerCase())
                  );
                  setPlayers(filtered);
                  requestChangeSelectedPlayer(filtered.length > 0 ? [filtered[0].characterId] : []);
                }
              }}
            />
            <Search className="admin-player-inventory__sidebar__search-icon" />
            <button
              className="admin-player-inventory__sidebar__search-clear"
              disabled={playerSearchTerm.trim() === ""}
              onClick={() => {
                setPlayerSearchTerm("");
                requestChangeSelectedPlayer([]);
                setPlayers(allPlayers);
              }}
            >
              <Close />
            </button>
          </div>
          <div className="admin-player-inventory__sidebar__select-all-container">
            <input
              type="checkbox"
              ref={checkboxRef}
              className="admin-player-inventory__sidebar__select-all-checkbox"
              checked={selectedPlayer.length === players.length && players.length > 0}
              onChange={() => {
                if (selectedPlayer.length === players.length) {
                  requestChangeSelectedPlayer([]);
                } else {
                  requestChangeSelectedPlayer(players.map(p => p.characterId));
                }
              }}
            />
            <span className="admin-player-inventory__sidebar__select-all-label">
              {selectedPlayer.length === players.length ? 'Deselect All' : 'Select All'}
            </span>
          </div>
          <div className="admin-player-inventory__sidebar__content">
            {loading ? (
              <div className="admin-player-inventory__sidebar__content--loading">Loading...</div>
            ) : players.length === 0 && playerSearchTerm.trim() !== "" ? (
              <div className="admin-player-inventory__sidebar__content--empty">no player matched</div>
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
                          className="admin-player-inventory__sidebar__group"
                        >
                          <div
                            className="admin-player-inventory__sidebar__group-title"
                            style={{ '--cabin-color': DEITY_THEMES[CABIN_DEITY[cabin]?.toLowerCase()]?.[0] || '#fff' } as React.CSSProperties}
                          >
                            Heirs of {CABIN_DEITY[cabin]}
                          </div>
                          {members.map(player => (
                            <div
                              key={player.characterId}
                              className={`admin-player-inventory__sidebar__item ${pendingSelectedPlayer.includes(player.characterId) ? 'admin-player-inventory__sidebar__item--selected' : ''}`}
                              onClick={() =>
                                requestChangeSelectedPlayer(
                                  pendingSelectedPlayer.includes(player.characterId) ?
                                    pendingSelectedPlayer.filter(id => id !== player.characterId) :
                                    [...pendingSelectedPlayer, player.characterId]
                                )}
                              style={{
                                '--player-primary': player.theme[0] || DEITY_THEMES[player.deityBlood]?.[0] || DEITY_THEMES[DEITY_DISPLAY_OVERRIDES[player.characterId] as Deity]?.[0],
                                '--player-accent-dark': player.theme[19] || DEITY_THEMES[player.deityBlood]?.[19] || DEITY_THEMES[DEITY_DISPLAY_OVERRIDES[player.characterId] as Deity]?.[19],
                              } as React.CSSProperties}
                            >
                              <input
                                type="checkbox"
                                className="admin-player-inventory__sidebar__item-checkbox"
                                checked={pendingSelectedPlayer.includes(player.characterId)}
                                onChange={() =>
                                  requestChangeSelectedPlayer(
                                    pendingSelectedPlayer.includes(player.characterId) ?
                                      pendingSelectedPlayer.filter(id => id !== player.characterId) :
                                      [...pendingSelectedPlayer, player.characterId]
                                  )}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="admin-player-inventory__sidebar__item-avatar">
                                {player.image ? (
                                  <img src={player.image} alt={player.nicknameEng} />
                                ) : (
                                  <div className="admin-player-inventory__sidebar__item-avatar-placeholder">
                                    {player.nicknameEng.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="admin-player-inventory__sidebar__item-name">
                                <span className="admin-player-inventory__sidebar__item-name-eng">{player.nicknameEng}</span>
                                <span className="admin-player-inventory__sidebar__item-name-deity">{player.deityBlood}</span>
                              </div>
                              <div className="admin-player-inventory__sidebar__item-deity-icon">
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
      </div >

      {showConfirmChangeSelectedPlayer && (
        <ConfirmModal
          title="Change Selected Player"
          message="Changing the selected player will discard any unsaved changes. Do you want to continue?"
          onConfirm={() => {
            applySelectedPlayer(pendingSelectedPlayer || []);
          }}
          onCancel={() => {
            setPendingSelectedPlayer([]);
            setShowConfirmChangeSelectedPlayer(false);
          }}
        />
      )}
    </div >
  );
}

export default PlayerInventory;