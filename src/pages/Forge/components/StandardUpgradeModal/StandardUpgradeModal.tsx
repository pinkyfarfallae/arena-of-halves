import React, { useState } from "react";
import { Equipment, EQUIPMENT_IMAGES, EQUIPMENT_TIER_EFFECTS, EQUIPMENT_TIER_NAMES, EQUIPMENT_TIERS, EquipmentCategory, EquipmentTier, UPGRADE_COSTS, UPGRADE_SUCCESS_RATES } from "../../../../constants/equipment";
import Drachma from "../../../../icons/Drachma";
import Ticket from "../../../../icons/Ticket";
import Lightning from "../../../../icons/Lightning";
import Close from "../../../../icons/Close";
import Forge from "../../../LifeInCamp/components/LocationIcon/icons/Forge";
import './StandardUpgradeModal.scss';

interface StandardUpgradeModalProps {
  equipment: any & Equipment;
  playerDrachma: number;
  playerTickets: number;
  onConfirm: (ticketsUsed: number) => Promise<void>;
  onCancel: () => void;
}

export const StandardUpgradeModal: React.FC<StandardUpgradeModalProps> = ({
  equipment,
  playerDrachma,
  playerTickets,
  onConfirm,
  onCancel,
}) => {
  const [loading, setLoading] = useState(false);
  const [ticketsToUse, setTicketsToUse] = useState(0);

  const currentTier = ("level_" + equipment.tier) as EquipmentTier || EQUIPMENT_TIERS.LEVEL_1;
  const nextTier = (() => {
    switch (currentTier) {
      case EQUIPMENT_TIERS.LEVEL_1:
        return EQUIPMENT_TIERS.LEVEL_2;
      case EQUIPMENT_TIERS.LEVEL_2:
        return EQUIPMENT_TIERS.LEVEL_3;
      default:
        return null;
    }
  })();

  if (!nextTier) return null;

  const upgradeCost = UPGRADE_COSTS[nextTier];
  const baseSuccessRate = UPGRADE_SUCCESS_RATES[nextTier];

  // Calculate current success rate based on tickets
  const actuallyUsedTickets = Math.min(ticketsToUse, playerTickets);
  const currentSuccessRate = Math.min(100, baseSuccessRate + (actuallyUsedTickets * 30));

  const canAffordDrachma = playerDrachma >= upgradeCost;
  const canUpgrade = canAffordDrachma;

  const handleConfirm = async () => {
    if (!canUpgrade) return;

    setLoading(true);
    try {
      await onConfirm(actuallyUsedTickets);
    } finally {
      setLoading(false);
    }
  };

  const handleTicketChange = (delta: number) => {
    const newValue = Math.max(0, Math.min(ticketsToUse + delta, playerTickets));
    setTicketsToUse(newValue);
  };

  // Get all effects from tier 1 up to next tier (stacked powers)
  const getAllEffects = () => {
    const category = equipment.category as EquipmentCategory;
    const effects = [];

    effects.push({
      tier: 1,
      effect: EQUIPMENT_TIER_EFFECTS[category]?.[EQUIPMENT_TIERS.LEVEL_1] || '',
      isNew: false,
      isLocked: false,
    });

    effects.push({
      tier: 2,
      effect: EQUIPMENT_TIER_EFFECTS[category]?.[EQUIPMENT_TIERS.LEVEL_2] || '',
      isNew: nextTier === EQUIPMENT_TIERS.LEVEL_2,
      isLocked: false,
    });

    effects.push({
      tier: 3,
      effect: EQUIPMENT_TIER_EFFECTS[category]?.[EQUIPMENT_TIERS.LEVEL_3] || '',
      isNew: nextTier === EQUIPMENT_TIERS.LEVEL_3,
      isLocked: nextTier !== EQUIPMENT_TIERS.LEVEL_3,
    });

    return effects;
  };


  const effects = getAllEffects();

  return (
    <div className="modal-overlay">
      <div className="standard-upgrade-modal" onClick={(e) => e.stopPropagation()}>
        <button className="standard-upgrade-modal__close" onClick={onCancel}>
          <Close />
        </button>

        <div className="standard-upgrade-modal__flame-top" />

        <div className="standard-upgrade-modal__icon">
          <Forge />
        </div>
        <h2 className="standard-upgrade-modal__title">Standard Forging</h2>
        <p className="standard-upgrade-modal__subtitle">Test Your Luck with the Forge</p>

        <div className="standard-upgrade-modal__equipment">
          <div className="standard-upgrade-modal__equipment--left">
            <div className="standard-upgrade-modal__equipment-image">
              <img src={equipment.imageUrl} alt={equipment.name} />
            </div>
            <div className="standard-upgrade-modal__equipment-name">
              {equipment.name}
            </div>
          </div>

          <div className="standard-upgrade-modal__arrow">→</div>

          <div className="standard-upgrade-modal__equipment--right">
            <div className="standard-upgrade-modal__equipment-image">
              <img src={EQUIPMENT_IMAGES[equipment.category as EquipmentCategory][nextTier]} alt={equipment.name} />
            </div>
            <div className="standard-upgrade-modal__equipment-name">
              {EQUIPMENT_TIER_NAMES[equipment.category as EquipmentCategory][nextTier]}
            </div>
          </div>
        </div>
        <div className="standard-upgrade-modal__ticket-section">
          <div className="standard-upgrade-modal__ticket-header">
            <div className="standard-upgrade-modal__ticket-title">Optional: Add Guaranteed Tickets</div>
            <div className="standard-upgrade-modal__ticket-info">
              Each ticket adds <span className="standard-upgrade-modal__highlight">+30%</span> success rate
            </div>
          </div>

          <div className="standard-upgrade-modal__ticket-control">
            <button
              className="standard-upgrade-modal__ticket-btn"
              onClick={() => handleTicketChange(-1)}
              disabled={ticketsToUse === 0}
            >
              −
            </button>
            <div className="standard-upgrade-modal__ticket-display">
              <div className="standard-upgrade-modal__ticket-count">{actuallyUsedTickets}</div>
              <div className="standard-upgrade-modal__ticket-label">tickets</div>
            </div>
            <button
              className="standard-upgrade-modal__ticket-btn"
              onClick={() => handleTicketChange(1)}
              disabled={ticketsToUse >= playerTickets || currentSuccessRate >= 100}
            >
              +
            </button>
          </div>
        </div>

        <div className="standard-upgrade-modal__rates">
          <div className="standard-upgrade-modal__rate standard-upgrade-modal__rate--success">
            <div className="standard-upgrade-modal__rate-label">Success Rate</div>
            <div className="standard-upgrade-modal__rate-bar">
              <div
                className="standard-upgrade-modal__rate-fill standard-upgrade-modal__rate-fill--success"
                style={{ width: `${currentSuccessRate}%` }}
              />
            </div>
            <div className="standard-upgrade-modal__rate-value">{currentSuccessRate}%</div>
          </div>
        </div>
        <div className="standard-upgrade-modal__info">
          <div className="standard-upgrade-modal__power-stack">
            {effects.map((item, index) => (
              <div
                key={index}
                className={`standard-upgrade-modal__power-item ${item.isNew ? 'standard-upgrade-modal__power-item--new' : ''}`}
              >
                <div className="standard-upgrade-modal__power-tier">T{item.tier}</div>
                <div className="standard-upgrade-modal__power-effect">{item.effect}</div>
                {item.isNew && (
                  <div className="standard-upgrade-modal__power-badge">NEW</div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="standard-upgrade-modal__actions">
          <button
            className="standard-upgrade-modal__button standard-upgrade-modal__button--primary"
            onClick={handleConfirm}
            disabled={!canUpgrade || loading}
          >
            {loading ? (
              <span>Upgrading...</span>
            ) : canUpgrade ? (
              <span>Upgrade Now</span>
            ) : (
              'Insufficient Drachma'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StandardUpgradeModal;
