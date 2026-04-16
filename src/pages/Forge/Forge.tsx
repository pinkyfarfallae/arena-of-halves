import { Link } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { auth } from '../../firebase';
import { updateCharacterDrachma } from '../../services/character/currencyService';
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_TIERS,
  EquipmentCategory,
  EquipmentTier,
  CUSTOM_EQUIPMENT,
  EQUIPMENT_IMAGES,
  Equipment,
  UpgradeType,
  UPGRADE_TYPE
} from '../../constants/equipment';
import {
  upgradeEquipment,
  getUpgradeCost,
  initializeEquipment,
  getEquipmentData,
  addCustomEquipment
} from '../../services/equipment/equipmentService';
import { fetchCustomEquipment } from '../../data/characters';
import ChevronLeft from '../../icons/ChevronLeft';
import { getNonCustomEquipmentName } from '../../data/equipment';
import { useScreenSize } from '../../hooks/useScreenSize';
import ForgeBackground from './images/forge_background.jpg'
import ForgeTable from './images/forge_table.png';
import Frame from './images/frame.png';
import Label from './images/label.png';
import Drachma from '../../icons/Drachma';
import { useBag } from '../../hooks/useBag';
import { ITEMS } from '../../constants/items';
import Ticket from '../../icons/Ticket';
import { T } from '../../constants/translationKeys';
import { GuaranteedUpgradeModal } from './components/GuaranteedUpgradeModal/GuaranteedUpgradeModal';
import StandardUpgradeModal from './components/StandardUpgradeModal/StandardUpgradeModal';
import { consumeItem } from '../../services/bag/bagService';
import './Forge.scss';

function Forge() {
  const { user, refreshUser } = useAuth();
  const { t } = useTranslation();
  const { width } = useScreenSize();
  const { bagEntries } = useBag(user?.characterId || '');

  const [equipment, setEquipment] = useState<(any & Equipment[])[]>([]);
  const [pendingDeliveryEquipments, setPendingDeliveryEquipments] = useState<(any & Equipment[])[]>([]);
  const [starterEquipment, setStarterEquipment] = useState<(any & Equipment)[]>([]);
  const [focusedEquipment, setFocusedEquipment] = useState<any & Equipment | null>(null);

  const [loading, setLoading] = useState(true);
  const [receivingNew, setReceivingNew] = useState(false);

  const [upgradingMode, setUpgradingMode] = useState<UpgradeType | null>(null);


  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const [equipmentData, customEquipment] = await Promise.all([
          getEquipmentData(user.characterId).catch(() => null),
          fetchCustomEquipment().catch(() => []),
        ]);

        let formattedEquipment: any[] = [];

        if (equipmentData) {
          const weaponData = Object.entries(equipmentData).flatMap(([key, value]) => {
            if (key === CUSTOM_EQUIPMENT && value && typeof value === 'object') {
              return Object.entries(value).map(([customKey, each]: [string, any]) => {
                const imageUrl = customEquipment.find(ce => ce.itemId === customKey)?.imageUrl || '';
                const name = customEquipment.find(ce => ce.itemId === customKey)?.labelEng || customKey;
                return {
                  id: customKey,
                  name: name,
                  category: each.categories || [],
                  tier: each.tier.split('_')[1] || '1',
                  custom: true,
                  imageUrl: imageUrl,
                }
              });
            } else {
              const catagory = key as EquipmentCategory;
              const tier = value as EquipmentTier;
              const imageUrl = EQUIPMENT_IMAGES[catagory][tier] || '';

              return {
                id: key,
                name: getNonCustomEquipmentName(catagory, tier),
                category: catagory,
                tier: value.split('_')[1] || '1',
                custom: false,
                imageUrl: imageUrl,
              };
            }
          });

          formattedEquipment = weaponData;

          setEquipment(weaponData);
          setStarterEquipment(weaponData.filter(item => !item.custom));
        } else {
          await initializeEquipment(user.characterId);

          const initialEquipment: Record<EquipmentCategory, EquipmentTier> = {
            [EQUIPMENT_CATEGORIES.WEAPON]: EQUIPMENT_TIERS.LEVEL_1,
            [EQUIPMENT_CATEGORIES.ARMOR]: EQUIPMENT_TIERS.LEVEL_1,
            [EQUIPMENT_CATEGORIES.SHIELD]: EQUIPMENT_TIERS.LEVEL_1,
            [EQUIPMENT_CATEGORIES.BOOTS]: EQUIPMENT_TIERS.LEVEL_1,
          };

          formattedEquipment = Object.entries(initialEquipment).map(([key, value]) => ({
            id: key,
            name: getNonCustomEquipmentName(key as EquipmentCategory, value as EquipmentTier),
            category: key as EquipmentCategory,
            tier: '1',
            custom: false,
            imageUrl: '',
          }));

          setEquipment(formattedEquipment);
          setStarterEquipment(formattedEquipment);
        }

        const ownedIds = new Set(formattedEquipment.map(item => item.id));

        const pendingDeliveryEquipments = customEquipment.filter(
          item =>
            item.characterId === user.characterId &&
            !ownedIds.has(item.itemId)
        );

        setPendingDeliveryEquipments(pendingDeliveryEquipments);

        if (pendingDeliveryEquipments.length > 0) {
          setFocusedEquipment(pendingDeliveryEquipments[0]);
        } else if (formattedEquipment.length > 0) {
          setFocusedEquipment(formattedEquipment[0]);
        } else {
          setFocusedEquipment(null);
        }

      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.characterId]);

  const handleReceive = useMemo(() => async (equipment: any) => {
    if (!user) return;

    setReceivingNew(true);

    try {
      const categories = equipment.categories?.split(',').map((c: string) => c.trim()) || [];

      const [addCustomResult, updateDrachmaResult] = await Promise.all([
        addCustomEquipment(user?.characterId, equipment.itemId, categories),
        updateCharacterDrachma(user?.characterId, -equipment.price),
      ]);

      if (addCustomResult.success && updateDrachmaResult.success) {
        const newItem = {
          id: equipment.itemId,
          name: equipment.labelEng,
          category: equipment.categories ? equipment.categories.split(',').map((c: string) => c.trim()) : [],
          tier: EQUIPMENT_TIERS.LEVEL_1.split('_')[1] || '1',
          custom: equipment.custom,
          imageUrl: equipment.imageUrl,
        };
        setEquipment(prev => [...prev, newItem]);
        setPendingDeliveryEquipments(prev => prev.filter(item => item.itemId !== equipment.itemId));
        setFocusedEquipment(newItem);
        refreshUser();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReceivingNew(false);
    }
  }, [equipment, user]);

  const handleUpgradeClick = (type: UpgradeType) => {
    setUpgradingMode(type);
  };

  const handleConfirmUpgrade = async (equipmentToUpgrade: Equipment, ticketsUsed: number = 0) => {
    if (!equipmentToUpgrade || !user || equipment.length === 0 || !auth.currentUser) return;

    const currentTier = () => {
      switch (equipmentToUpgrade.tier) {
        case '1' as EquipmentTier:
          return EQUIPMENT_TIERS.LEVEL_1;
        case '2' as EquipmentTier:
          return EQUIPMENT_TIERS.LEVEL_2;
        default:
          return EQUIPMENT_TIERS.LEVEL_3;
      }
    };
    const cost = getUpgradeCost(currentTier() as EquipmentTier);

    const formattedEquipmentToUpgrade = { [equipmentToUpgrade.category]: currentTier() } as any & Equipment;

    try {
      // Consume tickets if any are being used
      if (ticketsUsed > 0) {
        const ticketResult = await consumeItem(user.characterId, ITEMS.UPGRADE_GUARANTEE_TICKET, ticketsUsed);
        if (!ticketResult.success) {
          setUpgradingMode(null);
          return;
        }
      }

      // Update equipment in Firestore
      const result = await upgradeEquipment(user.characterId, equipmentToUpgrade.category, formattedEquipmentToUpgrade);

      if (result.success && result.newTier) {
        // Deduct currency from Google Sheets
        const currencyResult = await updateCharacterDrachma(user.characterId, -cost);

        if (currencyResult.success) {
          // Update local equipment state - update the specific item in the array
          setEquipment(prev => prev.map(item =>
            item.id === equipmentToUpgrade.id || item.category === equipmentToUpgrade.category
              ? { ...item, tier: result.newTier?.split('_')[1] || item.tier }
              : item
          ));

          setStarterEquipment(prev => prev.map(item =>
            item.id === equipmentToUpgrade.id || item.category === equipmentToUpgrade.category
              ? { ...item, tier: result.newTier?.split('_')[1] || item.tier }
              : item
          ));

          // Refresh character data to get updated currency
          await refreshUser();
        }
      }
    } catch (error) {
      console.error('Error during upgrade:', error);
    }
  };

  const slotWidth = 150;

  const numberIfDummy = width / slotWidth > (equipment.length + pendingDeliveryEquipments.length)
    ? Math.ceil(width / slotWidth) - equipment.length - pendingDeliveryEquipments.length
    : 0;

  const updateGuaranteeTicket = useMemo(() => bagEntries.find(i => i.itemId === ITEMS.UPGRADE_GUARANTEE_TICKET)?.amount || 0, [bagEntries]);

  return (
    <div className="forge">
      <div className="forge__bar">
        <Link to="/life" className="forge__back">
          <ChevronLeft />
          Back to Camp
        </Link>

        {/* Drachma balance */}
        <div className="forge__bar-balance">
          <Drachma className="drachma--bar" />
          <span className="forge__bar-amount">{user?.currency?.toLocaleString() ?? '0'}</span>
          <span className="forge__bar-unit">{t(T.DRACHMA).toLowerCase()}</span>
        </div>

        {/* 30% Discount Ticket */}
        <div className="forge__bar-discount">
          <Ticket className="drachma--bar" />
          <span className="forge__bar-amount">{updateGuaranteeTicket || 0}</span>
          <span className="forge__bar-unit">Upgrade Guarantee Ticket</span>
        </div>
      </div>

      <div className="forge__container">
        <div className="forge__background">
          <img src={ForgeBackground} alt="Forge Background" />
          {/* Campfire embers */}
          <div className="forge__embers">
            {Array.from({ length: 24 }).map((_, i) => (
              <span key={i} className="forge__ember" />
            ))}
          </div>

          {/* Campfire glow */}
          <div className="forge__campfire" />
        </div>
        <div className="forge__equipment-shelf">
          {!loading && (
            <>
              {pendingDeliveryEquipments.map((item, index) => (
                <div
                  key={`pending-${item.id}-${index}`}
                  className="forge__equipment-card forge__equipment-card--pending"
                  onClick={() => !receivingNew && setFocusedEquipment(item)}
                >
                  <div className="forge__equipment-frame">
                    <img src={Frame} alt="Frame" />
                  </div>
                  <div className="forge__equipment-new-badge">New</div>
                  <div className="forge__equipment-image">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} referrerPolicy="no-referrer" />
                    ) : (
                      <span>{item.name[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="forge__equipment-name">
                    <div className={`forge__equipment-name-background ${focusedEquipment?.id === item.id ? 'focused' : ''}`}>
                      <img src={Label} alt="Label" />
                    </div>
                    <div
                      className={`forge__equipment-name-label ${focusedEquipment?.id === item.id ? 'focused' : ''}`}
                    >
                      {item.labelEng}
                    </div>
                  </div>
                </div>
              ))}
              {starterEquipment.map((item) => (
                <div
                  key={item.id}
                  className="forge__equipment-card"
                  onClick={() => !receivingNew && setFocusedEquipment(item)}
                >
                  <div className="forge__equipment-frame">
                    <img src={Frame} alt="Frame" />
                  </div>
                  <div className="forge__equipment-image">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} referrerPolicy="no-referrer" />
                    ) : (
                      <span>{item.name[0]?.toUpperCase()}</span>
                    )}
                    <div className="forge__equipment-tier">{item.tier}</div>
                  </div>
                  <div className="forge__equipment-name">
                    <div className={`forge__equipment-name-background ${focusedEquipment?.id === item.id ? 'focused' : ''}`}>
                      <img src={Label} alt="Label" />
                    </div>
                    <div
                      className={`forge__equipment-name-label ${focusedEquipment?.id === item.id ? 'focused' : ''}`}
                    >
                      {item.name}
                    </div>
                  </div>
                </div>
              ))}
              {equipment
                .filter(item => !starterEquipment.some(starter => starter.id === item.id))
                .sort((a, b) => {
                  const getCategory = (w: any) =>
                    Array.isArray(w.category) ? w.category[0] : w.category;

                  const categoryOrderMap: Record<string, number> = {
                    weapon: 1,
                    armor: 2,
                    shield: 3,
                    boots: 4,
                  };

                  if (a.custom !== b.custom) {
                    return a.custom ? 1 : -1;
                  }

                  const catA = categoryOrderMap[getCategory(a)] || 99;
                  const catB = categoryOrderMap[getCategory(b)] || 99;
                  if (catA !== catB) return catA - catB;

                  const tierA = parseInt(a.tier || '0', 10);
                  const tierB = parseInt(b.tier || '0', 10);

                  return tierB - tierA;
                })
                .map((item) => (
                  <div
                    key={item.id}
                    className="forge__equipment-card"
                    onClick={() => !receivingNew && setFocusedEquipment(item)}
                  >
                    <div className="forge__equipment-frame">
                      <img src={Frame} alt="Frame" />
                    </div>
                    <div className="forge__equipment-image">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} referrerPolicy="no-referrer" />
                      ) : (
                        <span>{item.name[0]?.toUpperCase()}</span>
                      )}
                      {!item.custom && <div className="forge__equipment-tier">{item.tier}</div>}
                    </div>
                    <div className="forge__equipment-name">
                      <div className={`forge__equipment-name-background ${focusedEquipment?.id === item.id ? 'focused' : ''}`}>
                        <img src={Label} alt="Label" />
                      </div>
                      <div
                        className={`forge__equipment-name-label ${focusedEquipment?.id === item.id ? 'focused' : ''}`}
                      >
                        {item.name}
                      </div>
                    </div>
                  </div>
                ))}
              {numberIfDummy > 0 && (
                Array.from({ length: numberIfDummy }).map((_, index) => (
                  <div key={`dummy-${index}`} className="forge__equipment-card forge__equipment-card--dummy">
                    <div className="forge__equipment-frame">
                      <img src={Frame} alt="Frame" />
                    </div>
                    <div className="forge__equipment-image">
                      <span>?</span>
                    </div>
                    <div className="forge__equipment-name">
                      <div className="forge__equipment-name-background">
                        <img src={Label} alt="Label" />
                      </div>
                      <div className="forge__equipment-name-label">
                        Unknown
                      </div>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        <div className="forge__equipment-forge">
          <div className="forge__forge-table">
            <img src={ForgeTable} alt="Forge Table" />
          </div>
          <div className="forge__focused-equipment">
            {!loading && focusedEquipment ? (
              <div className="forge__focused-image">
                {focusedEquipment.imageUrl ? (
                  <img src={focusedEquipment.imageUrl} alt={focusedEquipment.name} referrerPolicy="no-referrer" />
                ) : (
                  <span>{focusedEquipment.name[0]?.toUpperCase()}</span>
                )}
              </div>
            ) : !loading ? (
              <div className="forge__no-equipment">
                <p>No equipment selected</p>
              </div>
            ) : null}
          </div>
          {!loading && focusedEquipment && (
            <div className="forge__focused-equipment-name">
              <div className="forge__focused-equipment-name-background">
                <img src={Label} alt="Label" />
              </div>
              <div className="forge__focused-equipment-name-label">
                <div className="forge__focused-equipment-name-text">
                  {focusedEquipment.name || focusedEquipment.labelEng || 'Unknown Equipment'}
                </div>
                <span className="forge__focused-equipment-tier">
                  {focusedEquipment.custom ? 'Custom' : focusedEquipment.tier ? `Tier ${focusedEquipment.tier}` : 'Tier 1'}
                </span>
              </div>
            </div>
          )}
          {(!loading && focusedEquipment) ? (
            <div className="forge__focused-equipment-actions">
              {pendingDeliveryEquipments.find((item) => item.itemId === focusedEquipment.itemId) && (
                <button
                  className="forge__action-button forge__action-button--receive"
                  onClick={() => handleReceive(focusedEquipment)}
                  disabled={receivingNew || (user?.currency || 0) < focusedEquipment.price}
                >
                  {receivingNew
                    ? (
                      <span className="forge__action-button-label">
                        Delivering...
                      </span>
                    ) : (
                      <span className="forge__action-button-label">
                        Pay {focusedEquipment.price} <Drachma className='forge__action-button-icon' />
                      </span>
                    )}
                </button>
              )}
              {!pendingDeliveryEquipments.find((item) => item.itemId === focusedEquipment.itemId)
                && !focusedEquipment.custom && (
                  <>
                    <button
                      className="forge__action-button forge__action-button--guaranteed-upgrade"
                      onClick={() => {
                        handleUpgradeClick(UPGRADE_TYPE.GUARANTEED)
                      }}
                      disabled={user?.currency === undefined || user.currency < getUpgradeCost(focusedEquipment.tier) || updateGuaranteeTicket < 1 || focusedEquipment.tier === '3'}
                    >
                      Guaranteed Upgrade
                    </button>
                    <button
                      className="forge__action-button forge__action-button--standard-upgrade"
                      onClick={() => { handleUpgradeClick(UPGRADE_TYPE.STANDARD) }}
                      disabled={user?.currency === undefined || user.currency < getUpgradeCost(focusedEquipment.tier) || focusedEquipment.tier === '3'}
                    >
                      Standard Upgrade
                    </button>
                  </>
                )}
            </div>
          ) : null}
        </div>
      </div>

      {upgradingMode === UPGRADE_TYPE.GUARANTEED && focusedEquipment && (
        <GuaranteedUpgradeModal
          equipment={focusedEquipment}
          playerDrachma={user?.currency || 0}
          playerTickets={bagEntries.find(i => i.itemId === ITEMS.UPGRADE_GUARANTEE_TICKET)?.amount || 0}
          onCancel={() => setUpgradingMode(null)}
          onConfirm={(ticketsUsed) => handleConfirmUpgrade(focusedEquipment, ticketsUsed)}
        />
      )}

      {upgradingMode === UPGRADE_TYPE.STANDARD && focusedEquipment && (
        <StandardUpgradeModal
          equipment={focusedEquipment}
          playerDrachma={user?.currency || 0}
          playerTickets={bagEntries.find(i => i.itemId === ITEMS.UPGRADE_GUARANTEE_TICKET)?.amount || 0}
          onCancel={() => setUpgradingMode(null)}
          onConfirm={(ticketsUsed) => handleConfirmUpgrade(focusedEquipment, ticketsUsed)}
        />
      )}
    </div>
  );
}

export default Forge;
