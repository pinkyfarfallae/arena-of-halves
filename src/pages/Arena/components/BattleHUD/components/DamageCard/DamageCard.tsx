import { useEffect, useRef } from 'react';
import type { PanelSide } from '../../../../../../constants/battle';
import { POWER_NAMES } from '../../../../../../constants/powers';
import Lightning from '../../../../../../icons/Lightning';
import './DamageCard.scss';

interface ResolveData {
  isHit: boolean;
  isPower: boolean;
  powerName: string;
  isCrit: boolean;
  /** Keraunos: explicit crit from D4 so card shows -6 and CRIT! when rolled crit (avoids -3 from overwrites). */
  isCritForKeraunos?: boolean;
  /** Keraunos: which target this card is for — 0 = main (3/6), 1 = 1st secondary (2/4), 2 = 2nd secondary (1/2). Used when damage is 0 or to show correct single value. */
  keraunosDamageTier?: 0 | 1 | 2;
  baseDmg: number;
  damage: number;
  shockBonus: number;
  atkRoll: number;
  isDodged: boolean;
  coAttackHit: boolean;
  coAttackDamage: number;
  attackerName: string;
  attackerTheme: string;
  defenderName: string;
  defenderTheme: string;
}

interface Props {
  data: ResolveData;
  exiting: boolean;
  side: PanelSide;
  displayMs?: number;
  onDisplayComplete?: () => void;
}

export type { ResolveData };

export default function DamageCard({ data, exiting, side, displayMs, onDisplayComplete }: Props) {
  const rc = data;
  const cardStyle = { '--card-atk': rc.attackerTheme, '--card-def': rc.defenderTheme } as React.CSSProperties;
  // Show breakdown (base + crit + shock) for any hit that has crit or shock bonus — including self-buff+attack (e.g. Beyond the Nimbus).
  // Fallback: damage > baseDmg indicates crit/bonus even if isCrit/shockBonus weren't written to cache.
  const hasBreakdown = rc.isHit && (
    rc.isCrit ||
    rc.shockBonus > 0 ||
    (rc.baseDmg > 0 && rc.damage > rc.baseDmg)
  );
  const onDisplayCompleteRef = useRef<typeof onDisplayComplete>(onDisplayComplete);

  useEffect(() => {
    onDisplayCompleteRef.current = onDisplayComplete;
  }, [onDisplayComplete]);

  useEffect(() => {
    if (exiting || displayMs == null || !onDisplayCompleteRef.current) return;
    const t = window.setTimeout(() => onDisplayCompleteRef.current?.(), displayMs);
    return () => clearTimeout(t);
  }, [displayMs, exiting]);

  // skipDice powers (Jolt Arc, Keraunos Voltage)
  if (rc.isPower && rc.atkRoll === 0) {
    const isCritKeraunos = rc.powerName === POWER_NAMES.KERAUNOS_VOLTAGE ? (rc.isCritForKeraunos ?? rc.isCrit) : rc.isCrit;
    // Keraunos: one card per target — show damage for this resolving fighter only (tier 0 = main 3/6, 1 = 2/4, 2 = 1/2)
    const tier = (rc as { keraunosDamageTier?: 0 | 1 | 2 }).keraunosDamageTier ?? 0;
    const keraunosBaseByTier = [3, 2, 1];
    const keraunosDmgByTier = isCritKeraunos ? [6, 4, 2] : [3, 2, 1];
    // Jolt Arc: แบบเดียวกับ Keraunos — damage > 0 ใช้ damage, ไม่ก็ใช้ baseDmg (caster damage)
    const dmgForThisTarget = rc.powerName === POWER_NAMES.KERAUNOS_VOLTAGE
      ? (rc.damage > 0 ? rc.damage : keraunosDmgByTier[tier])
      : rc.powerName === POWER_NAMES.JOLT_ARC
        ? rc.baseDmg
        : rc.damage;
    const showKeraunosBreakdown = rc.powerName === POWER_NAMES.KERAUNOS_VOLTAGE && (rc.shockBonus > 0 || isCritKeraunos) && dmgForThisTarget > 0;
    return (
      <div className={`bhud__dice-zone bhud__dice-zone--${side}`}>
        <div className={`dmg-card dmg-card--power ${exiting ? 'dmg-card--exit' : ''}`} style={cardStyle}>
          <div className="dmg-card__header">
            <span className="dmg-card__atkname" style={{ color: rc.attackerTheme }}>{rc.attackerName}</span>
            <span className="dmg-card__arrow">→</span>
            <span className="dmg-card__defname" style={{ color: rc.defenderTheme }}>{rc.defenderName}</span>
          </div>
          <span className="dmg-card__power">{rc.powerName}</span>
          {showKeraunosBreakdown ? (
            <>
              <div className="dmg-card__breakdown">
                <span className="dmg-card__base">{keraunosBaseByTier[tier]}</span>
                {isCritKeraunos && (
                  <>
                    <span className="dmg-card__base">+</span>
                    <span className="dmg-card__crit">{keraunosBaseByTier[tier]}</span>
                  </>
                )}
                {rc.shockBonus > 0 && (
                  <>
                    <span className="dmg-card__base">+</span>
                    <span className="dmg-card__shock">
                      {rc.shockBonus}
                      <Lightning width={12} height={12} />
                    </span>
                  </>
                )}
                <span className="dmg-card__eq">=</span>
              </div>
              <span className="dmg-card__total">-{dmgForThisTarget} DMG</span>
            </>
          ) : dmgForThisTarget > 0 ? (
            <span className="dmg-card__total">-{dmgForThisTarget} DMG</span>
          ) : rc.powerName === POWER_NAMES.KERAUNOS_VOLTAGE ? (
            <>
              {isCritKeraunos && <span className="dmg-card__crit-label">CRIT!</span>}
              <span className="dmg-card__total">-{keraunosDmgByTier[tier]} DMG</span>
            </>
          ) : (
            <span className="dmg-card__invoked">NO EFFECT</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`bhud__dice-zone bhud__dice-zone--${side}`}>
      <div className={`dmg-card ${!rc.isHit ? 'dmg-card--miss' : ''} ${rc.isDodged ? 'dmg-card--dodged' : ''} ${exiting ? 'dmg-card--exit' : ''}`} style={cardStyle}>
        <div className="dmg-card__header">
          <span className="dmg-card__atkname" style={{ color: rc.attackerTheme }}>{rc.attackerName}</span>
          <span className="dmg-card__arrow">→</span>
          <span className="dmg-card__defname" style={{ color: rc.defenderTheme }}>{rc.defenderName}</span>
        </div>
        <div className="dmg-card__divider" />
        {rc.isDodged ? (
          <span className="dmg-card__blocked dmg-card__blocked--dodged">DODGED!</span>
        ) : rc.isHit ? (
          <div className="dmg-card__body">
            {hasBreakdown && (
              <div className="dmg-card__breakdown">
                <span className="dmg-card__base">{rc.baseDmg}</span>
                {(rc.isCrit || (rc.baseDmg > 0 && rc.damage > rc.baseDmg && rc.shockBonus <= 0)) && (
                  <>
                    <span className="dmg-card__base">+</span>
                    <span className="dmg-card__crit">{rc.isCrit ? rc.baseDmg : (rc.damage - rc.baseDmg - rc.shockBonus)}</span>
                  </>
                )}
                {rc.shockBonus > 0 && (
                  <>
                    <span className="dmg-card__base">+</span>
                    <span className="dmg-card__shock">
                      {rc.shockBonus}
                      <Lightning width={12} height={12} />
                    </span>
                  </>
                )}
                <span className="dmg-card__eq">=</span>
              </div>
            )}
            <span className="dmg-card__total">-{rc.damage} DMG</span>
          </div>
        ) : (
          <span className="dmg-card__blocked">{rc.isPower ? 'RESISTED!' : 'BLOCKED!'}</span>
        )}
      </div>
    </div>
  );
}
