import { useState, useMemo, useEffect, useRef, type ReactElement, type CSSProperties } from 'react';
import Arena from '../../../Arena/Arena';
import { Dropdown, type OptionGroup } from '../../../../components/Form';
import type { FighterState } from '../../../../types/battle';
import type { Theme25 } from '../../../../types/character';
import { POWER_VFX_EFFECTS, buildSyntheticBattleFromChoices, buildSyntheticRoom } from '../../../../data/powerVfxRegistry';
import { SEASON_ORDER, SEASONS, type SeasonKey } from '../../../../data/seasons';
import SunIcon from '../../../../data/icons/seasons/SunIcon';
import MapleLeafIcon from '../../../../data/icons/seasons/MapleLeafIcon';
import SnowflakeIcon from '../../../../data/icons/seasons/SnowflakeIcon';
import RoseIcon from '../../../../data/icons/seasons/RoseIcon';
import { fetchAllCharacters } from '../../../../data/characters';
import { fetchNPCs } from '../../../../data/npcs';
import { getPowers } from '../../../../data/powers';
import { toFighterState } from '../../../../services/battleRoom/battleRoom';
import { POWER_OVERRIDES } from '../../../CharacterInfo/constants/overrides';
import EffectStackModal from './components/EffectStackModal/EffectStackModal';
import {
  DEITY_HADES_AND_PERSEPHONE,
  ALLOWED_GROUPS_HADES_AND_PERSEPHONE,
  EFFECT_GROUP_OTHER,
  FIGHTER_OPTION_GROUP,
  PLACEHOLDER,
  MODAL_TITLE,
  STATE_MESSAGE,
  BUTTON_LABEL,
  EFFECT_SIDE_LABEL,
} from './utils/constants';
import type { EffectSide, FighterOption } from './utils/types';
import './PowerVfxDemo.scss';
import { PANEL_SIDE } from '../../../../constants/battle';

/** Effect-only preview: reuses <Arena isDemo />; effect stack chosen via modal (power-select style). */


/** Map Theme25 to CSS vars so modal theme source has fighter theme. Indices: 0 primary, 2 light, 3 accent, 4 bg, 5 fg, 6 surface, 7 muted, 8 border, 9 primaryHover, 11 surfaceHover. */
function themeToCiStyle(theme: Theme25): CSSProperties {
  return {
    '--ci-primary': theme[0],
    '--ci-primary-hover': theme[9],
    '--ci-accent': theme[3],
    '--ci-bg': theme[4],
    '--ci-fg': theme[5],
    '--ci-surface': theme[6],
    '--ci-muted': theme[7],
    '--ci-border': theme[8],
    '--ci-surface-hover': theme[11],
    '--ci-light': theme[2],
  } as CSSProperties;
}

export default function PowerVfxDemo() {
  const [members, setMembers] = useState<FighterState[]>([]);
  const [npcs, setNpcs] = useState<FighterState[]>([]);
  const [loading, setLoading] = useState(true);
  const [replayCasterKey, setReplayCasterKey] = useState(0);
  const [replayTargetKey, setReplayTargetKey] = useState(0);
  const [casterFighterId, setCasterFighterId] = useState('');
  const [targetFighterId, setTargetFighterId] = useState('');
  const [casterEffectIds, setCasterEffectIds] = useState<string[]>([]);
  const [targetEffectIds, setTargetEffectIds] = useState<string[]>([]);
  const [demoSeason, setDemoSeason] = useState<SeasonKey | ''>('');
  const [casterEffectModalOpen, setCasterEffectModalOpen] = useState(false);
  const [targetEffectModalOpen, setTargetEffectModalOpen] = useState(false);
  const effectModalLeftRef = useRef<HTMLDivElement>(null);
  const effectModalRightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchAllCharacters().then((chars) =>
        chars.map((c) => {
          const powerDeity = POWER_OVERRIDES[c.characterId?.toLowerCase()] ?? c.deityBlood;
          const powers = getPowers(powerDeity);
          return toFighterState(c, powers);
        })
      ),
      fetchNPCs(),
    ])
      .then(([memberList, npcList]) => {
        if (!cancelled) {
          setMembers(memberList);
          setNpcs(npcList);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const fighterOptions = useMemo((): FighterOption[] => {
    const memberOpts = members.map((m) => ({
      id: m.characterId,
      label: `${FIGHTER_OPTION_GROUP.PLAYER}: ${m.nicknameEng}`,
      fighter: m,
    }));
    const npcOpts = npcs.map((n) => ({
      id: n.characterId,
      label: `${FIGHTER_OPTION_GROUP.NPC}: ${n.nicknameEng}`,
      fighter: n,
    }));
    return [...memberOpts, ...npcOpts];
  }, [members, npcs]);

  useEffect(() => {
    if (fighterOptions.length === 0) return;
    setCasterFighterId((prev) => (fighterOptions.some((o) => o.id === prev) ? prev : fighterOptions[0].id));
    setTargetFighterId((prev) => {
      if (fighterOptions.some((o) => o.id === prev)) return prev;
      return fighterOptions.length > 1 ? fighterOptions[1].id : fighterOptions[0].id;
    });
  }, [fighterOptions]);

  // When user swaps or changes caster/target fighter, clear effect selections so they apply to the current fighters
  const prevCasterIdRef = useRef<string>(casterFighterId);
  const prevTargetIdRef = useRef<string>(targetFighterId);
  useEffect(() => {
    if (prevCasterIdRef.current !== casterFighterId) {
      prevCasterIdRef.current = casterFighterId;
      setCasterEffectIds([]);
    }
    if (prevTargetIdRef.current !== targetFighterId) {
      prevTargetIdRef.current = targetFighterId;
      setTargetEffectIds([]);
    }
  }, [casterFighterId, targetFighterId]);

  const casterFighter = useMemo(() => {
    const opt = fighterOptions.find((o) => o.id === casterFighterId);
    return opt?.fighter ?? null;
  }, [fighterOptions, casterFighterId]);

  const targetFighter = useMemo(() => {
    const opt = fighterOptions.find((o) => o.id === targetFighterId);
    return opt?.fighter ?? null;
  }, [fighterOptions, targetFighterId]);

  const syntheticBattle = useMemo(() => {
    if (!casterFighter || !targetFighter) return undefined;
    const battle = buildSyntheticBattleFromChoices(
      casterEffectIds,
      targetEffectIds,
      casterFighter.characterId,
      targetFighter.characterId
    );
    return {
      ...battle,
      _demoReplayTargetKey: replayTargetKey,
      _demoShockHitReplayKey: replayTargetKey,
    };
  }, [casterFighter, targetFighter, casterEffectIds, targetEffectIds, replayTargetKey]);

  const syntheticRoom = useMemo(() => {
    if (!casterFighter || !targetFighter || !syntheticBattle) return null;
    return buildSyntheticRoom(casterFighter, targetFighter, syntheticBattle);
  }, [casterFighter, targetFighter, syntheticBattle]);

  const handleReplayCaster = () => setReplayCasterKey((k) => k + 1);
  const handleReplayTarget = () => setReplayTargetKey((k) => k + 1);

  const fighterDropdownOptions = useMemo((): OptionGroup[] => {
    const memberOpts = members.map((m) => ({
      value: m.characterId,
      label: m.nicknameEng,
    }));
    const npcOpts = npcs.map((n) => ({
      value: n.characterId,
      label: n.nicknameEng,
    }));
    return [
      { label: FIGHTER_OPTION_GROUP.PLAYER, options: memberOpts },
      { label: FIGHTER_OPTION_GROUP.NPC, options: npcOpts },
    ];
  }, [members, npcs]);
  const casterEffectOptions = useMemo((): OptionGroup[] => {
    const deity = casterFighter?.deityBlood;
    const allowedGroups =
      deity === DEITY_HADES_AND_PERSEPHONE
        ? [...ALLOWED_GROUPS_HADES_AND_PERSEPHONE]
        : deity
          ? [deity]
          : [];
    const effects = POWER_VFX_EFFECTS.filter((e) => {
      if (e.side === EFFECT_SIDE_LABEL.TARGET) return true;
      if (e.side === EFFECT_SIDE_LABEL.CASTER) return allowedGroups.length > 0 && !!e.group && allowedGroups.includes(e.group);
      return false;
    });
    const byGroup = effects.reduce<Record<string, { value: string; label: string }[]>>((acc, e) => {
      const g = e.group ?? EFFECT_GROUP_OTHER;
      if (!acc[g]) acc[g] = [];
      acc[g].push({ value: e.id, label: e.label });
      return acc;
    }, {});
    return Object.entries(byGroup).map(([label, options]) => ({ label, options }));
  }, [casterFighter?.deityBlood]);
  /** Right side: same as left — both caster-type (by right fighter deity) and target-type effects. */
  const targetEffectOptions = useMemo((): OptionGroup[] => {
    const deity = targetFighter?.deityBlood;
    const allowedGroups =
      deity === DEITY_HADES_AND_PERSEPHONE
        ? [...ALLOWED_GROUPS_HADES_AND_PERSEPHONE]
        : deity
          ? [deity]
          : [];
    const effects = POWER_VFX_EFFECTS.filter((e) => {
      if (e.side === EFFECT_SIDE_LABEL.TARGET) return true;
      if (e.side === EFFECT_SIDE_LABEL.CASTER) return allowedGroups.length > 0 && !!e.group && allowedGroups.includes(e.group);
      return false;
    });
    const byGroup = effects.reduce<Record<string, { value: string; label: string }[]>>((acc, e) => {
      const g = e.group ?? EFFECT_GROUP_OTHER;
      if (!acc[g]) acc[g] = [];
      acc[g].push({ value: e.id, label: e.label });
      return acc;
    }, {});
    return Object.entries(byGroup).map(([label, options]) => ({ label, options }));
  }, [targetFighter?.deityBlood]);

  /** Map effect id -> EffectSide for badge (effect type, not modal side) */
  const effectSideByValue = useMemo(
    (): Record<string, EffectSide> =>
      Object.fromEntries(
        POWER_VFX_EFFECTS.map((e) => [
          e.id,
          e.side === EFFECT_SIDE_LABEL.CASTER ? EFFECT_SIDE_LABEL.CASTER : EFFECT_SIDE_LABEL.TARGET,
        ])
      ),
    []
  );

  const SeasonIconByKey: Record<SeasonKey, () => ReactElement> = useMemo(
    () => ({
      summer: () => <SunIcon />,
      autumn: () => <MapleLeafIcon />,
      winter: () => <SnowflakeIcon />,
      spring: () => <RoseIcon />,
    }),
    []
  );

  if (loading) {
    return (
      <div className="power-vfx-demo">
        <div className="power-vfx-demo__state">{STATE_MESSAGE.LOADING_FIGHTERS}</div>
      </div>
    );
  }

  if (fighterOptions.length === 0) {
    return (
      <div className="power-vfx-demo">
        <div className="power-vfx-demo__state">{STATE_MESSAGE.NO_MEMBERS_OR_NPCS}</div>
      </div>
    );
  }

  if (!casterFighter || !targetFighter) {
    return (
      <div className="power-vfx-demo">
        <div className="power-vfx-demo__state">{STATE_MESSAGE.LOADING}</div>
      </div>
    );
  }

  return (
    <div className="power-vfx-demo">
      <div className="power-vfx-demo__layout">
        {/* Top bar: season icons only, centered */}
        <div className="power-vfx-demo__bar power-vfx-demo__bar--top">
          <div className="power-vfx-demo__bar-top-inner power-vfx-demo__bar-top-inner--center">
            <button
              type="button"
              className={`power-vfx-demo__season-btn power-vfx-demo__season-btn--none ${demoSeason === '' ? 'power-vfx-demo__season-btn--active' : ''}`}
              onClick={() => setDemoSeason('')}
              title="No season"
              aria-pressed={demoSeason === ''}
            >
              <span className="power-vfx-demo__season-icon power-vfx-demo__season-icon--none" aria-hidden>—</span>
            </button>
            {SEASON_ORDER.map((key) => {
              const config = SEASONS[key];
              const Icon = SeasonIconByKey[key];
              const isActive = demoSeason === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`power-vfx-demo__season-btn ${isActive ? 'power-vfx-demo__season-btn--active' : ''}`}
                  onClick={() => setDemoSeason(isActive ? '' : key)}
                  title={config.labelEn}
                  aria-pressed={isActive}
                  style={isActive ? { color: config.color } : undefined}
                >
                  <span className="power-vfx-demo__season-icon" style={isActive ? { color: config.color } : undefined}>
                    <Icon />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="power-vfx-demo__arena">
          <div key={`arena-${replayCasterKey}`} className="power-vfx-demo__arena-inner">
            <Arena
              isDemo
              demoRoom={syntheticRoom ?? undefined}
              demoSeason={demoSeason || undefined}
            />
          </div>
          <div
            ref={effectModalLeftRef}
            className={`power-vfx-demo__effect-modal-anchor power-vfx-demo__effect-modal-anchor--left ${casterEffectModalOpen ? 'power-vfx-demo__effect-modal-anchor--active' : ''}`}
            style={casterFighter ? themeToCiStyle(casterFighter.theme) : undefined}
            aria-hidden={!casterEffectModalOpen}
          />
          <div
            ref={effectModalRightRef}
            className={`power-vfx-demo__effect-modal-anchor power-vfx-demo__effect-modal-anchor--right ${targetEffectModalOpen ? 'power-vfx-demo__effect-modal-anchor--active' : ''}`}
            style={targetFighter ? themeToCiStyle(targetFighter.theme) : undefined}
            aria-hidden={!targetEffectModalOpen}
          />
        </div>

        {/* Bottom bar: left half, right half */}
        <div className="power-vfx-demo__bar power-vfx-demo__bar--bottom">
          <div className="power-vfx-demo__bar-half power-vfx-demo__bar-half--left">
            <div className="power-vfx-demo__bar-controls">
              <Dropdown
                value={casterFighterId}
                onChange={setCasterFighterId}
                options={fighterDropdownOptions}
                placeholder={PLACEHOLDER.FIGHTER}
                className="power-vfx-demo__dropdown"
                searchable
              />
              <button
                type="button"
                className="power-vfx-demo__btn power-vfx-demo__btn--effects"
                onClick={() => setCasterEffectModalOpen(true)}
              >
                {BUTTON_LABEL.EFFECTS}{casterEffectIds.length > 0 ? ` (${casterEffectIds.length})` : ''}
              </button>
              <button type="button" className="power-vfx-demo__btn power-vfx-demo__btn--primary" onClick={handleReplayCaster}>
                {BUTTON_LABEL.REPLAY}
              </button>
            </div>
          </div>
          <div className="power-vfx-demo__bar-divider" aria-hidden />
          <div className="power-vfx-demo__bar-half power-vfx-demo__bar-half--right">
            <div className="power-vfx-demo__bar-controls">
              <Dropdown
                value={targetFighterId}
                onChange={setTargetFighterId}
                options={fighterDropdownOptions}
                placeholder={PLACEHOLDER.FIGHTER}
                className="power-vfx-demo__dropdown"
                searchable
              />
              <button
                type="button"
                className="power-vfx-demo__btn power-vfx-demo__btn--effects"
                onClick={() => setTargetEffectModalOpen(true)}
              >
                {BUTTON_LABEL.EFFECTS}{targetEffectIds.length > 0 ? ` (${targetEffectIds.length})` : ''}
              </button>
              <button type="button" className="power-vfx-demo__btn power-vfx-demo__btn--primary" onClick={handleReplayTarget}>
                {BUTTON_LABEL.REPLAY}
              </button>
            </div>
          </div>
        </div>
      </div>

      <EffectStackModal
        key="left-effects"
        open={casterEffectModalOpen}
        title={MODAL_TITLE.LEFT_EFFECTS}
        groups={casterEffectOptions}
        selectedIds={casterEffectIds}
        onApply={(ids) => setCasterEffectIds(ids)}
        onClose={() => setCasterEffectModalOpen(false)}
        optionSideByValue={effectSideByValue}
        containerRef={effectModalLeftRef}
        themeSourceRef={effectModalLeftRef}
        side={PANEL_SIDE.LEFT}
      />
      <EffectStackModal
        key="right-effects"
        open={targetEffectModalOpen}
        title={MODAL_TITLE.RIGHT_EFFECTS}
        groups={targetEffectOptions}
        selectedIds={targetEffectIds}
        onApply={(ids) => setTargetEffectIds(ids)}
        onClose={() => setTargetEffectModalOpen(false)}
        optionSideByValue={effectSideByValue}
        containerRef={effectModalRightRef}
        themeSourceRef={effectModalRightRef}
        side={PANEL_SIDE.RIGHT}
      />
    </div>
  );
}
