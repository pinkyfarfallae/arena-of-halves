import { useEffect, useRef } from 'react';
import type { PanelSide } from '../../../../../../constants/battle';
import './DamageCard.scss';

interface ResolveData {
  isHit: boolean;
  isPower: boolean;
  powerName: string;
  isCrit: boolean;
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
  const hasBreakdown = rc.isHit && !rc.isPower && (rc.isCrit || rc.shockBonus > 0);
  const onDisplayCompleteRef = useRef<typeof onDisplayComplete>(onDisplayComplete);

  useEffect(() => {
    onDisplayCompleteRef.current = onDisplayComplete;
  }, [onDisplayComplete]);

  useEffect(() => {
    if (exiting || displayMs == null || !onDisplayCompleteRef.current) return;
    const t = window.setTimeout(() => onDisplayCompleteRef.current?.(), displayMs);
    return () => clearTimeout(t);
  }, [displayMs, exiting]);

  // skipDice powers (Jolt Arc, Thunderbolt)
  if (rc.isPower && rc.atkRoll === 0) {
    return (
      <div className={`bhud__dice-zone bhud__dice-zone--${side}`}>
        <div className={`dmg-card dmg-card--power ${exiting ? 'dmg-card--exit' : ''}`} style={cardStyle}>
          <div className="dmg-card__header">
            <span className="dmg-card__atkname" style={{ color: rc.attackerTheme }}>{rc.attackerName}</span>
            <span className="dmg-card__arrow">→</span>
            <span className="dmg-card__defname" style={{ color: rc.defenderTheme }}>{rc.defenderName}</span>
          </div>
          <span className="dmg-card__power">{rc.powerName}</span>
          {rc.damage > 0 ? (
            <span className="dmg-card__total">-{rc.damage} DMG</span>
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
                {rc.isCrit && (
                  <>
                    <span className="dmg-card__base">+</span>
                    <span className="dmg-card__crit">{rc.baseDmg}</span>
                  </>
                )}
                {rc.shockBonus > 0 && (
                  <>
                    <span className="dmg-card__base">+</span>
                    <span className="dmg-card__shock">{rc.shockBonus}⚡</span>
                  </>
                )}
                <span className="dmg-card__eq">=</span>
              </div>
            )}
            <span className="dmg-card__total">-{rc.damage} DMG</span>
            {rc.coAttackHit && rc.coAttackDamage > 0 && (
              <span className="dmg-card__total dmg-card__total--co">Co-Attack: -{rc.coAttackDamage}</span>
            )}
          </div>
        ) : (
          <span className="dmg-card__blocked">{rc.isPower ? 'RESISTED!' : 'BLOCKED!'}</span>
        )}
      </div>
    </div>
  );
}
