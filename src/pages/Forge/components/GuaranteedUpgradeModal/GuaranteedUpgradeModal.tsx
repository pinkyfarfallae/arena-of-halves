import React, { useState } from "react";
import { Equipment, EQUIPMENT_IMAGES, EQUIPMENT_TIER_EFFECTS, EQUIPMENT_TIER_NAMES, EQUIPMENT_TIERS, EquipmentCategory, EquipmentTier, UPGRADE_COSTS, UPGRADE_SUCCESS_RATES } from "../../../../constants/equipment";
import Drachma from "../../../../icons/Drachma";
import Ticket from "../../../../icons/Ticket";
import Close from "../../../../icons/Close";
import Forge from "../../../LifeInCamp/components/LocationIcon/icons/Forge";
import { useScreenSize } from "../../../../hooks/useScreenSize";
import './GuaranteedUpgradeModal.scss';

interface GuaranteedUpgradeModalProps {
  equipment: any & Equipment;
  playerDrachma: number;
  playerTickets: number;
  onConfirm: (ticketsUsed: number) => Promise<void>;
  onCancel: () => void;
}

export const GuaranteedUpgradeModal: React.FC<GuaranteedUpgradeModalProps> = ({
  equipment,
  playerDrachma,
  playerTickets,
  onConfirm,
  onCancel,
}) => {
  const { width } = useScreenSize();
  const [loading, setLoading] = useState(false);
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
  const failureRate = 100 - baseSuccessRate;

  // Auto-calculate exact tickets needed for 100% success
  const ticketsNeeded = Math.ceil(failureRate / 30);

  const canAffordDrachma = playerDrachma >= upgradeCost;
  const hasEnoughTickets = playerTickets >= ticketsNeeded;
  const canUpgrade = canAffordDrachma && hasEnoughTickets;

  const handleConfirm = async () => {
    if (!canUpgrade) return;

    setLoading(true);
    try {
      await onConfirm(ticketsNeeded);
    } finally {
      setLoading(false);
    }
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
      <div className="guaranteed-upgrade-modal" onClick={(e) => e.stopPropagation()}>
        <button className="guaranteed-upgrade-modal__close" onClick={onCancel}>
          <Close />
        </button>

        <div className="guaranteed-upgrade-modal__flame-top" />

        <div className="guaranteed-upgrade-modal__icon">
          <Forge />
        </div>
        <h2 className="guaranteed-upgrade-modal__title">Guaranteed Upgrade</h2>
        <p className="guaranteed-upgrade-modal__subtitle">
          Guaranteed Success 100% with Tickets
        </p>

        <div className="guaranteed-upgrade-modal__equipment">
          <div className="guaranteed-upgrade-modal__equipment--left">
            <div className="guaranteed-upgrade-modal__equipment-image">
              <img src={equipment.imageUrl} alt={equipment.name} />
            </div>
            <div className="guaranteed-upgrade-modal__equipment-name">
              {equipment.name}
            </div>
          </div>

          <div className="guaranteed-upgrade-modal__arrow">→</div>

          <div className="guaranteed-upgrade-modal__equipment--right">
            <div className="guaranteed-upgrade-modal__equipment-image">
              <img src={EQUIPMENT_IMAGES[equipment.category as EquipmentCategory][nextTier]} alt={equipment.name} />
            </div>
            <div className="guaranteed-upgrade-modal__equipment-name">
              {EQUIPMENT_TIER_NAMES[equipment.category as EquipmentCategory][nextTier]}
            </div>
          </div>
        </div>

        <div className="guaranteed-upgrade-modal__costs">
          <div className="guaranteed-upgrade-modal__cost-title">Cost</div>
          <div className="guaranteed-upgrade-modal__cost-row">
            <div className="guaranteed-upgrade-modal__cost-item">
              <Drachma className="guaranteed-upgrade-modal__cost-icon" />
              <span className="guaranteed-upgrade-modal__cost-value">{upgradeCost}</span>
            </div>
            <div className="guaranteed-upgrade-modal__cost-plus">+</div>
            <div className="guaranteed-upgrade-modal__cost-item">
              <Ticket className="guaranteed-upgrade-modal__cost-icon" />
              <span className="guaranteed-upgrade-modal__cost-value">{ticketsNeeded}</span>
            </div>
          </div>
          <div className="guaranteed-upgrade-modal__cost-divider" />
          <div className="guaranteed-upgrade-modal__cost-chance">
            100% {width > 460 ? 'Guaranteed' : ''}
          </div>
        </div>

        <div className="guaranteed-upgrade-modal__info">
          <div className="guaranteed-upgrade-modal__power-stack">
            {effects.map((item, index) => (
              <div
                key={index}
                className={`guaranteed-upgrade-modal__power-item ${item.isNew ? 'guaranteed-upgrade-modal__power-item--new' : ''} ${item.isLocked ? 'guaranteed-upgrade-modal__power-item--locked' : ''}`}
              >
                <div className="guaranteed-upgrade-modal__power-tier">T{item.tier}</div>
                <div className="guaranteed-upgrade-modal__power-effect">{item.effect}</div>
                {item.isNew && (
                  <div className="guaranteed-upgrade-modal__power-badge">NEW</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="guaranteed-upgrade-modal__actions">
          <button
            className="guaranteed-upgrade-modal__button--confirm"
            onClick={handleConfirm}
            disabled={!canUpgrade || loading}
          >
            {loading ? (
              <span>Upgrading...</span>
            ) : canUpgrade ? (
              <span>Upgrade Now</span>
            ) : !canAffordDrachma ? (
              'Insufficient Drachma'
            ) : (
              'Insufficient Tickets'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuaranteedUpgradeModal;
