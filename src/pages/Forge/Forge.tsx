import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
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
  EquipmentTier
} from '../../constants/equipment';
import { 
  upgradeEquipment, 
  getNextTier, 
  getUpgradeCost,
  initializeEquipment,
  canCreateCustomEquipment,
  getEquipmentData,
  getPlayerCustomEquipment,
  upgradeCustomEquipment
} from '../../services/equipment/equipmentService';
import { fetchCustomEquipment } from '../../data/characters';
import { CustomEquipmentInfo } from '../../types/character';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import './Forge.scss';

interface PlayerEquipmentData {
  weapon?: EquipmentTier;
  armor?: EquipmentTier;
  shield?: EquipmentTier;
  boots?: EquipmentTier;
  custom?: {
    [itemId: string]: {
      tier: EquipmentTier;
      categories: string[];
    };
  };
}

function Forge() {
  const { user, updateUser, refreshUser } = useAuth();
  const { t } = useTranslation();
  const [equipment, setEquipment] = useState<PlayerEquipmentData | null>(null);
  const [customEquipmentCatalog, setCustomEquipmentCatalog] = useState<CustomEquipmentInfo[]>([]);
  const [upgrading, setUpgrading] = useState<EquipmentCategory | null>(null);
  const [upgradingCustom, setUpgradingCustom] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<EquipmentCategory | null>(null);
  const [selectedCustomItem, setSelectedCustomItem] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCustomInfo, setShowCustomInfo] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEquipment = async () => {
      if (user && auth.currentUser) {
        try {
          const equipmentData = await getEquipmentData(user.characterId);
          setEquipment(equipmentData);
          
          // Initialize equipment if it doesn't exist
          if (!equipmentData.weapon && !equipmentData.armor && !equipmentData.shield && !equipmentData.boots) {
            await initializeEquipment(user.characterId);
            // Reload after initialization
            const newEquipmentData = await getEquipmentData(user.characterId);
            setEquipment(newEquipmentData);
          }

          // Load custom equipment catalog
          const catalog = await fetchCustomEquipment();
          setCustomEquipmentCatalog(catalog);
        } catch (error) {
          console.error('Error loading equipment:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadEquipment();
  }, [user]);

  const handleUpgradeClick = (category: EquipmentCategory) => {
    setSelectedCategory(category);
    setShowConfirm(true);
  };

  const handleConfirmUpgrade = async () => {
    if (!selectedCategory || !user || !equipment || !auth.currentUser) return;

    const currentTier = equipment[selectedCategory];
    const cost = getUpgradeCost(currentTier);

    if (user.currency < cost) {
      setMessage({ type: 'error', text: `Insufficient funds. Need ${cost} drachmas` });
      setShowConfirm(false);
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setUpgrading(selectedCategory);
    setShowConfirm(false);

    try {
      // Update equipment in Firestore
      const result = await upgradeEquipment(user.characterId, selectedCategory, equipment);
      
      if (result.success && result.newTier) {
        // Deduct currency from Google Sheets
        const currencyResult = await updateCharacterDrachma(user.characterId, -cost);
        
        if (currencyResult.success) {
          setMessage({ type: 'success', text: result.message });
          
          // Update local equipment state
          setEquipment({
            ...equipment,
            [selectedCategory]: result.newTier,
          });
          
          // Refresh character data to get updated currency
          await refreshUser();
        } else {
          setMessage({ type: 'error', text: 'Equipment upgraded but failed to deduct currency' });
        }
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      console.error('Error during upgrade:', error);
      setMessage({ type: 'error', text: 'An error occurred during upgrade' });
    }

    setUpgrading(null);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCustomUpgradeClick = (itemId: string) => {
    setSelectedCustomItem(itemId);
    setShowConfirm(true);
  };

  const handleConfirmCustomUpgrade = async () => {
    if (!selectedCustomItem || !user || !equipment || !auth.currentUser) return;

    const customItem = equipment.custom?.[selectedCustomItem];
    if (!customItem) return;

    const cost = getUpgradeCost(customItem.tier);

    if (user.currency < cost) {
      setMessage({ type: 'error', text: `Insufficient funds. Need ${cost} drachmas` });
      setShowConfirm(false);
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setUpgradingCustom(selectedCustomItem);
    setShowConfirm(false);

    try {
      const result = await upgradeCustomEquipment(user.characterId, selectedCustomItem);

      if (result.success && result.newTier) {
        const currencyResult = await updateCharacterDrachma(user.characterId, -cost);

        if (currencyResult.success) {
          setMessage({ type: 'success', text: result.message });

          // Update local equipment state
          setEquipment({
            ...equipment,
            custom: {
              ...equipment.custom,
              [selectedCustomItem]: {
                ...customItem,
                tier: result.newTier,
              },
            },
          });

          await refreshUser();
        } else {
          setMessage({ type: 'error', text: 'Equipment upgraded but failed to deduct currency' });
        }
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      console.error('Error during custom equipment upgrade:', error);
      setMessage({ type: 'error', text: 'An error occurred during upgrade' });
    }

    setUpgradingCustom(null);
    setTimeout(() => setMessage(null), 3000);
  };

  const renderEquipmentCard = (category: EquipmentCategory) => {
    if (!equipment || !user) return null;

    const currentTier = equipment[category] || EQUIPMENT_TIERS.LEVEL_1;
    const nextTier = getNextTier(currentTier);
    const cost = getUpgradeCost(currentTier);
    const canAfford = user.currency >= cost;
    const isMaxLevel = !nextTier;
    const isUpgrading = upgrading === category;

    const categoryIcons = {
      weapon: '⚔️',
      armor: '🛡️',
      shield: '🔰',
      boots: '👢',
    };

    const currentName = EQUIPMENT_TIER_NAMES[category][currentTier];
    const currentEffect = EQUIPMENT_TIER_EFFECTS[category][currentTier];
    const nextName = nextTier ? EQUIPMENT_TIER_NAMES[category][nextTier] : null;
    const nextEffect = nextTier ? EQUIPMENT_TIER_EFFECTS[category][nextTier] : null;

    return (
      <div key={category} className={`equipment-card ${isMaxLevel ? 'max-level' : ''}`}>
        <div className="equipment-card__icon">{categoryIcons[category]}</div>
        <h3 className="equipment-card__title">{EQUIPMENT_CATEGORY_LABELS[category]}</h3>
        <p className="equipment-card__description">{EQUIPMENT_CATEGORY_DESCRIPTIONS[category]}</p>
        
        <div className="equipment-card__current">
          <div className="equipment-card__current-name">{currentName}</div>
          <div className="equipment-card__current-effect">{currentEffect}</div>
        </div>

        {!isMaxLevel ? (
          <>
            <div className="equipment-card__upgrade">
              <div className="equipment-card__next-info">
                <div className="equipment-card__next-label">Next Upgrade:</div>
                <div className="equipment-card__next-name">{nextName}</div>
                <div className="equipment-card__next-effect">{nextEffect}</div>
              </div>
              
              <div className="equipment-card__cost">
                <span className="equipment-card__cost-label">Cost:</span>
                <span className={`equipment-card__cost-value ${!canAfford ? 'insufficient' : ''}`}>
                  {cost} 🪙
                </span>
              </div>
            </div>

            <button
              className="equipment-card__button"
              onClick={() => handleUpgradeClick(category)}
              disabled={!canAfford || isUpgrading}
            >
              {isUpgrading ? 'Upgrading...' : canAfford ? 'Upgrade' : 'Insufficient Funds'}
            </button>
          </>
        ) : (
          <div className="equipment-card__max">
            <span className="equipment-card__max-badge">✨ MAX LEVEL ✨</span>
          </div>
        )}
      </div>
    );
  };

  const renderCustomEquipmentCard = (itemId: string) => {
    if (!equipment || !user) return null;

    const customItem = equipment.custom?.[itemId];
    if (!customItem) return null;

    const itemInfo = customEquipmentCatalog.find((item) => item.itemId === itemId);
    if (!itemInfo) return null;

    const currentTier = customItem.tier;
    const nextTier = getNextTier(currentTier);
    const cost = getUpgradeCost(currentTier);
    const canAfford = user.currency >= cost;
    const isMaxLevel = !nextTier;
    const isUpgrading = upgradingCustom === itemId;

    const categories = customItem.categories.map((cat) => {
      const categoryKey = cat as EquipmentCategory;
      return EQUIPMENT_CATEGORY_LABELS[categoryKey] || cat;
    }).join(' + ');

    return (
      <div key={itemId} className={`equipment-card equipment-card--custom ${isMaxLevel ? 'max-level' : ''}`}>
        <div className="equipment-card__custom-image">
          {itemInfo.imageUrl ? (
            <img src={itemInfo.imageUrl} alt={itemInfo.labelEng} referrerPolicy="no-referrer" />
          ) : (
            <span>{(itemInfo.labelEng ?? '?')[0]?.toUpperCase()}</span>
          )}
        </div>
        
        <h3 className="equipment-card__title">{itemInfo.labelEng}</h3>
        {itemInfo.labelThai && (
          <p className="equipment-card__subtitle">{itemInfo.labelThai}</p>
        )}
        
        <p className="equipment-card__description">{itemInfo.description}</p>
        
        <div className="equipment-card__custom-categories">
          <span className="equipment-card__custom-categories-label">Categories:</span>
          <span className="equipment-card__custom-categories-value">{categories}</span>
        </div>
        
        <div className="equipment-card__current">
          <div className="equipment-card__current-name">
            {TIER_LABELS[currentTier].replace('Level ', 'Tier ')}
          </div>
        </div>

        {!isMaxLevel ? (
          <>
            <div className="equipment-card__upgrade">
              <div className="equipment-card__next-info">
                <div className="equipment-card__next-label">Next Upgrade:</div>
                <div className="equipment-card__next-name">
                  {TIER_LABELS[nextTier].replace('Level ', 'Tier ')}
                </div>
              </div>
              
              <div className="equipment-card__cost">
                <span className="equipment-card__cost-label">Cost:</span>
                <span className={`equipment-card__cost-value ${!canAfford ? 'insufficient' : ''}`}>
                  {cost} 🪙
                </span>
              </div>
            </div>

            <button
              className="equipment-card__button equipment-card__button--custom"
              onClick={() => handleCustomUpgradeClick(itemId)}
              disabled={!canAfford || isUpgrading}
            >
              {isUpgrading ? 'Upgrading...' : canAfford ? 'Upgrade' : 'Insufficient Funds'}
            </button>
          </>
        ) : (
          <div className="equipment-card__max">
            <span className="equipment-card__max-badge">✨ MAX LEVEL ✨</span>
          </div>
        )}
      </div>
    );
  };

  const renderCustomEquipmentInfo = () => {
    if (!equipment) return null;

    const allCategories = Object.values(EQUIPMENT_CATEGORIES) as EquipmentCategory[];
    const { canCreate, missingCategories } = canCreateCustomEquipment(equipment, allCategories);

    return (
      <div className="custom-equipment">
        <div className="custom-equipment__header">
          <h2 className="custom-equipment__title">⚒️ Custom Equipment</h2>
          <button 
            className="custom-equipment__toggle"
            onClick={() => setShowCustomInfo(!showCustomInfo)}
          >
            {showCustomInfo ? 'Hide Info' : 'Show Info'}
          </button>
        </div>

        {showCustomInfo && (
          <div className="custom-equipment__info">
            <p className="custom-equipment__description">
              Create custom equipment to match your character's narrative! Custom items can combine abilities from multiple categories.
            </p>
            
            <div className="custom-equipment__requirements">
              <h3>Requirements:</h3>
              <ul>
                <li>Category must be Level 3 to create custom equipment in that category</li>
                <li>For multi-type items, all relevant categories must be Level 3</li>
                <li>Contact staff via DM or tag staff in a thread to process your request</li>
              </ul>
            </div>

            <div className="custom-equipment__status">
              <h3>Your Status:</h3>
              {canCreate ? (
                <div className="custom-equipment__ready">
                  ✅ All equipment at Level 3! You can create any custom equipment.
                </div>
              ) : (
                <div className="custom-equipment__pending">
                  <p>To unlock all custom equipment options, upgrade:</p>
                  <ul>
                    {missingCategories.map(cat => (
                      <li key={cat}>
                        {EQUIPMENT_CATEGORY_LABELS[cat]} to Level 3
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="custom-equipment__example">
              <h3>Example:</h3>
              <p>
                Want an item that deals damage (Weapon) and heals (Armor)? 
                Upgrade both Weapon and Armor to Level 3, then request your custom combination!
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!user || loading) {
    return (
      <div className="forge">
        <Link to="/life" className="forge__back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Camp
        </Link>
        <div className="forge__container">
          <p className="forge__loading">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="forge">
      <Link to="/life" className="forge__back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Camp
      </Link>

      <div className="forge__container">
        <div className="forge__header">
          <div className="forge__icon">
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 38h28v4H10z" opacity="0.15" fill="currentColor" />
              <path d="M10 38h28v4H10z" />
              <path d="M20 24h8v14h-8z" opacity="0.1" fill="currentColor" />
              <path d="M20 24h8v14h-8z" />
              <path d="M14 24h20" />
              <path d="M6 12l6 12M42 12l-6 12" opacity="0.4" />
              <path d="M16 6a8 8 0 0116 0" opacity="0.3" />
              <circle cx="24" cy="16" r="4" fill="currentColor" opacity="0.2" />
              <path d="M24 12v-6M20 8h8" strokeWidth="2" />
            </svg>
          </div>
          <h1 className="forge__title">The Forge</h1>
          <p className="forge__subtitle">
            Upgrade your equipment in Hephaestus cabin's eternal flames. Each piece of equipment can be enhanced separately.
          </p>
          
          <div className="forge__currency">
            <span className="forge__currency-label">Your Drachmas:</span>
            <span className="forge__currency-value">{user.currency} 🪙</span>
          </div>
        </div>

        {message && (
          <div className={`forge__message forge__message--${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="forge__equipment-grid">
          {Object.values(EQUIPMENT_CATEGORIES).map(category => 
            renderEquipmentCard(category as EquipmentCategory)
          )}
        </div>

        {equipment?.custom && Object.keys(equipment.custom).length > 0 && (
          <div className="forge__custom-section">
            <h2 className="forge__section-title">Your Custom Equipment</h2>
            <div className="forge__equipment-grid">
              {Object.keys(equipment.custom).map(itemId => 
                renderCustomEquipmentCard(itemId)
              )}
            </div>
          </div>
        )}

        {renderCustomEquipmentInfo()}

        <div className="forge__info">
          <h3>Equipment Tiers:</h3>
          <div className="forge__tier-info">
            <div className="forge__tier-row">
              <span className="forge__tier-name">Level 1 (Wooden/Basic)</span>
              <span className="forge__tier-cost">Starting equipment</span>
            </div>
            <div className="forge__tier-row">
              <span className="forge__tier-name">Level 2 (Iron/Leather)</span>
              <span className="forge__tier-cost">500 🪙</span>
            </div>
            <div className="forge__tier-row">
              <span className="forge__tier-name">Level 3 (Bronze/Winged)</span>
              <span className="forge__tier-cost">1,000 🪙</span>
            </div>
          </div>
        </div>
      </div>

      {showConfirm && selectedCategory && equipment && (() => {
        const currentTier = equipment[selectedCategory] || EQUIPMENT_TIERS.LEVEL_1;
        const nextTier = getNextTier(currentTier);
        if (!nextTier) return null;
        
        const currentName = EQUIPMENT_TIER_NAMES[selectedCategory][currentTier];
        const nextName = EQUIPMENT_TIER_NAMES[selectedCategory][nextTier];
        const cost = getUpgradeCost(currentTier);
        
        return (
          <ConfirmModal
            title="Confirm Upgrade"
            message={`Upgrade ${EQUIPMENT_CATEGORY_LABELS[selectedCategory]} from ${currentName} to ${nextName} for ${cost} drachmas?`}
            onConfirm={handleConfirmUpgrade}
            onCancel={() => {
              setShowConfirm(false);
              setSelectedCategory(null);
            }}
          />
        );
      })()}

      {showConfirm && selectedCustomItem && equipment && (() => {
        const customItem = equipment.custom?.[selectedCustomItem];
        if (!customItem) return null;

        const itemInfo = customEquipmentCatalog.find((item) => item.itemId === selectedCustomItem);
        if (!itemInfo) return null;

        const currentTier = customItem.tier;
        const nextTier = getNextTier(currentTier);
        if (!nextTier) return null;

        const cost = getUpgradeCost(currentTier);
        const currentTierLabel = TIER_LABELS[currentTier];
        const nextTierLabel = TIER_LABELS[nextTier];

        return (
          <ConfirmModal
            title="Confirm Custom Equipment Upgrade"
            message={`Upgrade ${itemInfo.labelEng} from ${currentTierLabel} to ${nextTierLabel} for ${cost} drachmas?`}
            onConfirm={handleConfirmCustomUpgrade}
            onCancel={() => {
              setShowConfirm(false);
              setSelectedCustomItem(null);
            }}
          />
        );
      })()}
    </div>
  );
}

export default Forge;
