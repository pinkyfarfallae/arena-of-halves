import { Link } from 'react-router-dom';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { auth } from '../../firebase';
import { updateCharacterDrachma } from '../../services/character/currencyService';
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_TIERS,
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_CATEGORY_DESCRIPTIONS,
  TIER_LABELS,
  EQUIPMENT_TIER_NAMES,
  EQUIPMENT_TIER_EFFECTS,
  EquipmentCategory,
  EquipmentTier,
  CUSTOM_EQUIPMENT,
  EQUIPMENT_IMAGES,
  Equipment
} from '../../constants/equipment';
import {
  upgradeEquipment,
  getNextTier,
  getUpgradeCost,
  initializeEquipment,
  canCreateCustomEquipment,
  getEquipmentData,
  getPlayerCustomEquipment,
  upgradeCustomEquipment,
  addCustomEquipment
} from '../../services/equipment/equipmentService';
import { fetchCustomEquipment } from '../../data/characters';
import { CustomEquipmentInfo } from '../../types/character';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import ChevronLeft from '../../icons/ChevronLeft';
import Hephaetus from '../../data/icons/deities/Hephaestus';
import './Forge.scss';
import { getNonCustomEquipmentName } from '../../data/equipment';
import Key from '../CampMembers/components/Doodle/icons/Key';
import { useScreenSize } from '../../hooks/useScreenSize';
import ForgeBackground from './images/forge_background.jpg'
import ForgeTable from './images/forge_table.png';
import Frame from './images/frame.png';
import Label from './images/label.png';
import Drachma from '../../icons/Drachma';

function Forge() {
  const { user, updateUser, refreshUser } = useAuth();
  const { t } = useTranslation();
  const { width } = useScreenSize();

  const [equipment, setEquipment] = useState<(any & Equipment[])[]>([]);
  const [pendingDeliveryEquipments, setPendingDeliveryEquipments] = useState<(any & Equipment[])[]>([]);
  const [starterEquipment, setStarterEquipment] = useState<(any & Equipment)[]>([]);

  const [focusedEquipment, setFocusedEquipment] = useState<any & Equipment | null>(null);

  const [loading, setLoading] = useState(true);
  const [receivingNew, setReceivingNew] = useState(false);
  const [upgrading, setUpgrading] = useState<EquipmentCategory | null>(null);

  const [upgradingCustom, setUpgradingCustom] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<EquipmentCategory | null>(null);
  const [selectedCustomItem, setSelectedCustomItem] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCustomInfo, setShowCustomInfo] = useState(false);

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
      const result = await addCustomEquipment(user?.characterId, equipment.itemId, categories);

      if (result.success) {
        const newItem = {
          id: equipment.itemId,
          name: equipment.labelEng,
          category: equipment.categories ? equipment.categories.split(',').map((c: string) => c.trim()) : [],
          tier: equipment.tier,
          custom: equipment.custom,
          imageUrl: equipment.imageUrl,
        };
        setEquipment(prev => [...prev, newItem]);
        setPendingDeliveryEquipments(prev => prev.filter(item => item.itemId !== equipment.itemId));
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'An error occurred while assigning equipment' });
      console.error(err);
    } finally {
      setReceivingNew(false);
    }
  }, [equipment, user]);

  const handleUpgradeClick = (category: EquipmentCategory) => {
    setSelectedCategory(category);
    setShowConfirm(true);
  };

  // const handleConfirmUpgrade = async () => {
  //   if (!selectedCategory || !user || !equipment || !auth.currentUser) return;

  //   const currentTier = equipment[selectedCategory];
  //   const cost = getUpgradeCost(currentTier);

  //   if (user.currency < cost) {
  //     setMessage({ type: 'error', text: `Insufficient funds. Need ${cost} drachmas` });
  //     setShowConfirm(false);
  //     setTimeout(() => setMessage(null), 3000);
  //     return;
  //   }

  //   setUpgrading(selectedCategory);
  //   setShowConfirm(false);

  //   try {
  //     // Update equipment in Firestore
  //     const result = await upgradeEquipment(user.characterId, selectedCategory, equipment);

  //     if (result.success && result.newTier) {
  //       // Deduct currency from Google Sheets
  //       const currencyResult = await updateCharacterDrachma(user.characterId, -cost);

  //       if (currencyResult.success) {
  //         setMessage({ type: 'success', text: result.message });

  //         // Update local equipment state
  //         setEquipment({
  //           ...equipment,
  //           [selectedCategory]: result.newTier,
  //         });

  //         // Refresh character data to get updated currency
  //         await refreshUser();
  //       } else {
  //         setMessage({ type: 'error', text: 'Equipment upgraded but failed to deduct currency' });
  //       }
  //     } else {
  //       setMessage({ type: 'error', text: result.message });
  //     }
  //   } catch (error) {
  //     console.error('Error during upgrade:', error);
  //     setMessage({ type: 'error', text: 'An error occurred during upgrade' });
  //   }

  //   setUpgrading(null);
  //   setTimeout(() => setMessage(null), 3000);
  // };

  const handleCustomUpgradeClick = (itemId: string) => {
    setSelectedCustomItem(itemId);
    setShowConfirm(true);
  };

  // const handleConfirmCustomUpgrade = async () => {
  //   if (!selectedCustomItem || !user || !equipment || !auth.currentUser) return;

  //   const customItem = equipment.custom?.[selectedCustomItem];
  //   if (!customItem) return;

  //   const cost = getUpgradeCost(customItem.tier);

  //   if (user.currency < cost) {
  //     setMessage({ type: 'error', text: `Insufficient funds. Need ${cost} drachmas` });
  //     setShowConfirm(false);
  //     setTimeout(() => setMessage(null), 3000);
  //     return;
  //   }

  //   setUpgradingCustom(selectedCustomItem);
  //   setShowConfirm(false);

  //   try {
  //     const result = await upgradeCustomEquipment(user.characterId, selectedCustomItem);

  //     if (result.success && result.newTier) {
  //       const currencyResult = await updateCharacterDrachma(user.characterId, -cost);

  //       if (currencyResult.success) {
  //         setMessage({ type: 'success', text: result.message });

  //         // Update local equipment state
  //         setEquipment({
  //           ...equipment,
  //           custom: {
  //             ...equipment.custom,
  //             [selectedCustomItem]: {
  //               ...customItem,
  //               tier: result.newTier,
  //             },
  //           },
  //         });

  //         await refreshUser();
  //       } else {
  //         setMessage({ type: 'error', text: 'Equipment upgraded but failed to deduct currency' });
  //       }
  //     } else {
  //       setMessage({ type: 'error', text: result.message });
  //     }
  //   } catch (error) {
  //     console.error('Error during custom equipment upgrade:', error);
  //     setMessage({ type: 'error', text: 'An error occurred during upgrade' });
  //   }

  //   setUpgradingCustom(null);
  //   setTimeout(() => setMessage(null), 3000);
  // };

  // const renderEquipmentCard = (category: EquipmentCategory) => {
  //   if (!equipment || !user) return null;

  //   const currentTier = equipment[category] || EQUIPMENT_TIERS.LEVEL_1;
  //   const nextTier = getNextTier(currentTier);
  //   const cost = getUpgradeCost(currentTier);
  //   const canAfford = user.currency >= cost;
  //   const isMaxLevel = !nextTier;
  //   const isUpgrading = upgrading === category;

  //   const categoryIcons = {
  //     weapon: '⚔️',
  //     armor: '🛡️',
  //     shield: '🔰',
  //     boots: '👢',
  //   };

  //   const currentName = EQUIPMENT_TIER_NAMES[category][currentTier];
  //   const currentEffect = EQUIPMENT_TIER_EFFECTS[category][currentTier];
  //   const nextName = nextTier ? EQUIPMENT_TIER_NAMES[category][nextTier] : null;
  //   const nextEffect = nextTier ? EQUIPMENT_TIER_EFFECTS[category][nextTier] : null;

  //   return (
  //     <div key={category} className={`equipment-card ${isMaxLevel ? 'max-level' : ''}`}>
  //       <div className="equipment-card__icon">{categoryIcons[category]}</div>
  //       <h3 className="equipment-card__title">{EQUIPMENT_CATEGORY_LABELS[category]}</h3>
  //       <p className="equipment-card__description">{EQUIPMENT_CATEGORY_DESCRIPTIONS[category]}</p>

  //       <div className="equipment-card__current">
  //         <div className="equipment-card__current-name">{currentName}</div>
  //         <div className="equipment-card__current-effect">{currentEffect}</div>
  //       </div>

  //       {!isMaxLevel ? (
  //         <>
  //           <div className="equipment-card__upgrade">
  //             <div className="equipment-card__next-info">
  //               <div className="equipment-card__next-label">Next Upgrade:</div>
  //               <div className="equipment-card__next-name">{nextName}</div>
  //               <div className="equipment-card__next-effect">{nextEffect}</div>
  //             </div>

  //             <div className="equipment-card__cost">
  //               <span className="equipment-card__cost-label">Cost:</span>
  //               <span className={`equipment-card__cost-value ${!canAfford ? 'insufficient' : ''}`}>
  //                 {cost} 🪙
  //               </span>
  //             </div>
  //           </div>

  //           <button
  //             className="equipment-card__button"
  //             onClick={() => handleUpgradeClick(category)}
  //             disabled={!canAfford || isUpgrading}
  //           >
  //             {isUpgrading ? 'Upgrading...' : canAfford ? 'Upgrade' : 'Insufficient Funds'}
  //           </button>
  //         </>
  //       ) : (
  //         <div className="equipment-card__max">
  //           <span className="equipment-card__max-badge">✨ MAX LEVEL ✨</span>
  //         </div>
  //       )}
  //     </div>
  //   );
  // };

  // const renderCustomEquipmentCard = (itemId: string) => {
  //   if (!equipment || !user) return null;

  //   const customItem = equipment.custom?.[itemId];
  //   if (!customItem) return null;

  //   const itemInfo = customEquipmentCatalog.find((item: CustomEquipmentInfo) => item.itemId === itemId);
  //   if (!itemInfo) return null;

  //   const currentTier = customItem.tier;
  //   const nextTier = getNextTier(currentTier);
  //   const cost = getUpgradeCost(currentTier);
  //   const canAfford = user.currency >= cost;
  //   const isMaxLevel = !nextTier;
  //   const isUpgrading = upgradingCustom === itemId;

  //   const categories = customItem.categories.map((cat) => {
  //     const categoryKey = cat as EquipmentCategory;
  //     return EQUIPMENT_CATEGORY_LABELS[categoryKey] || cat;
  //   }).join(' + ');

  //   return (
  //     <div key={itemId} className={`equipment-card equipment-card--custom ${isMaxLevel ? 'max-level' : ''}`}>
  //       <div className="equipment-card__custom-image">
  //         {itemInfo.imageUrl ? (
  //           <img src={itemInfo.imageUrl} alt={itemInfo.labelEng} referrerPolicy="no-referrer" />
  //         ) : (
  //           <span>{(itemInfo.labelEng ?? '?')[0]?.toUpperCase()}</span>
  //         )}
  //       </div>

  //       <h3 className="equipment-card__title">{itemInfo.labelEng}</h3>
  //       {itemInfo.labelThai && (
  //         <p className="equipment-card__subtitle">{itemInfo.labelThai}</p>
  //       )}

  //       <p className="equipment-card__description">{itemInfo.description}</p>

  //       <div className="equipment-card__custom-categories">
  //         <span className="equipment-card__custom-categories-label">Categories:</span>
  //         <span className="equipment-card__custom-categories-value">{categories}</span>
  //       </div>

  //       <div className="equipment-card__current">
  //         <div className="equipment-card__current-name">
  //           {TIER_LABELS[currentTier].replace('Level ', 'Tier ')}
  //         </div>
  //       </div>

  //       {!isMaxLevel ? (
  //         <>
  //           <div className="equipment-card__upgrade">
  //             <div className="equipment-card__next-info">
  //               <div className="equipment-card__next-label">Next Upgrade:</div>
  //               <div className="equipment-card__next-name">
  //                 {TIER_LABELS[nextTier].replace('Level ', 'Tier ')}
  //               </div>
  //             </div>

  //             <div className="equipment-card__cost">
  //               <span className="equipment-card__cost-label">Cost:</span>
  //               <span className={`equipment-card__cost-value ${!canAfford ? 'insufficient' : ''}`}>
  //                 {cost} 🪙
  //               </span>
  //             </div>
  //           </div>

  //           <button
  //             className="equipment-card__button equipment-card__button--custom"
  //             onClick={() => handleCustomUpgradeClick(itemId)}
  //             disabled={!canAfford || isUpgrading}
  //           >
  //             {isUpgrading ? 'Upgrading...' : canAfford ? 'Upgrade' : 'Insufficient Funds'}
  //           </button>
  //         </>
  //       ) : (
  //         <div className="equipment-card__max">
  //           <span className="equipment-card__max-badge">✨ MAX LEVEL ✨</span>
  //         </div>
  //       )}
  //     </div>
  //   );
  // };

  // const renderCustomEquipmentInfo = () => {
  //   if (!equipment) return null;

  //   const allCategories = Object.values(EQUIPMENT_CATEGORIES) as EquipmentCategory[];
  //   const { canCreate, missingCategories } = canCreateCustomEquipment(equipment, allCategories);

  //   return (
  //     <div className="custom-equipment">
  //       <div className="custom-equipment__header">
  //         <h2 className="custom-equipment__title">⚒️ Custom Equipment</h2>
  //         <button
  //           className="custom-equipment__toggle"
  //           onClick={() => setShowCustomInfo(!showCustomInfo)}
  //         >
  //           {showCustomInfo ? 'Hide Info' : 'Show Info'}
  //         </button>
  //       </div>

  //       {showCustomInfo && (
  //         <div className="custom-equipment__info">
  //           <p className="custom-equipment__description">
  //             Create custom equipment to match your character's narrative! Custom items can combine abilities from multiple categories.
  //           </p>

  //           <div className="custom-equipment__requirements">
  //             <h3>Requirements:</h3>
  //             <ul>
  //               <li>Category must be Level 3 to create custom equipment in that category</li>
  //               <li>For multi-type items, all relevant categories must be Level 3</li>
  //               <li>Contact staff via DM or tag staff in a thread to process your request</li>
  //             </ul>
  //           </div>

  //           <div className="custom-equipment__status">
  //             <h3>Your Status:</h3>
  //             {canCreate ? (
  //               <div className="custom-equipment__ready">
  //                 ✅ All equipment at Level 3! You can create any custom equipment.
  //               </div>
  //             ) : (
  //               <div className="custom-equipment__pending">
  //                 <p>To unlock all custom equipment options, upgrade:</p>
  //                 <ul>
  //                   {missingCategories.map(cat => (
  //                     <li key={cat}>
  //                       {EQUIPMENT_CATEGORY_LABELS[cat]} to Level 3
  //                     </li>
  //                   ))}
  //                 </ul>
  //               </div>
  //             )}
  //           </div>

  //           <div className="custom-equipment__example">
  //             <h3>Example:</h3>
  //             <p>
  //               Want an item that deals damage (Weapon) and heals (Armor)?
  //               Upgrade both Weapon and Armor to Level 3, then request your custom combination!
  //             </p>
  //           </div>
  //         </div>
  //       )}
  //     </div>
  //   );
  // };

  // if (!user || loading) {
  //   return (
  //     <div className="forge">
  //       <Link to="/life" className="forge__back">
  //         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  //           <polyline points="15 18 9 12 15 6" />
  //         </svg>
  //         Back to Camp
  //       </Link>
  //       <div className="forge__container">
  //         <span className="forge__loading-container">
  //           <div className="forge__loading" />
  //         </span>
  //       </div>
  //     </div>
  //   );
  // }

  const numberIfDummy = width / 150 > (equipment.length + pendingDeliveryEquipments.length)
    ? Math.ceil(width / 150) - equipment.length - pendingDeliveryEquipments.length
    : 0;

  return (
    <div className="forge">
      <Link to="/life" className="forge__back">
        <ChevronLeft />
        Back to Camp
      </Link>

      <div className="forge__container">
        <div className="forge__background">
          <img src={ForgeBackground} alt="Forge Background" />
        </div>
        <div className="forge__equipment-shelf">
          {!loading && (
            <>
              {pendingDeliveryEquipments.map((item, index) => (
                <div
                  key={`pending-${item.id}-${index}`}
                  className="forge__equipment-card forge__equipment-card--pending"
                  onClick={() => setFocusedEquipment(item)}
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
                  onClick={() => setFocusedEquipment(item)}
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
                    onClick={() => setFocusedEquipment(item)}
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
                  {focusedEquipment.tier ? `Tier ${focusedEquipment.tier}` : 'Tier 1'}
                </span>
              </div>
            </div>
          )}
          {(!loading && focusedEquipment) ? (
            <div className="forge__focused-equipment-actions">
              {pendingDeliveryEquipments.find((item) => item.id === focusedEquipment.id) && (
                <button
                  className="forge__action-button--receive"
                  onClick={() => handleReceive(focusedEquipment)}
                  disabled={receivingNew}
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
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default Forge;
