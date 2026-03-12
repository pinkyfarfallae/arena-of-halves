import { useState, useMemo, useEffect, useRef } from 'react';
import Arena from '../../../Arena/Arena';
import { Dropdown, type OptionGroup } from '../../../../components/Form';
import type { FighterState } from '../../../../types/battle';
import { POWER_VFX_EFFECTS, buildSyntheticBattleFromChoices, buildSyntheticRoom } from '../../../../data/powerVfxRegistry';
import { SEASON_ORDER, type SeasonKey } from '../../../../data/seasons';
import { fetchAllCharacters } from '../../../../data/characters';
import { fetchNPCs } from '../../../../data/npcs';
import { getPowers } from '../../../../data/powers';
import { toFighterState } from '../../../../services/battleRoom';
import { POWER_OVERRIDES } from '../../../CharacterInfo/constants/overrides';
import EffectStackModal from './components/EffectStackModal/EffectStackModal';
import './PowerVfxDemo.scss';

/** Effect-only preview: reuses <Arena isDemo />; effect stack chosen via modal (power-select style). */

/** Effects that can be applied to the target/defender (side === 'target'). */
const TARGET_TYPE_EFFECTS = POWER_VFX_EFFECTS.filter((e) => e.side === 'target');

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

  const fighterOptions = useMemo(() => {
    const memberOpts = members.map((m) => ({
      id: m.characterId,
      label: `Member: ${m.nicknameEng}`,
      fighter: m,
    }));
    const npcOpts = npcs.map((n) => ({
      id: n.characterId,
      label: `NPC: ${n.nicknameEng}`,
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
    return buildSyntheticBattleFromChoices(
      casterEffectIds,
      targetEffectIds,
      casterFighter.characterId,
      targetFighter.characterId
    );
  }, [casterFighter, targetFighter, casterEffectIds, targetEffectIds]);

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
      { label: 'Player', options: memberOpts },
      { label: 'NPC', options: npcOpts },
    ];
  }, [members, npcs]);
  const casterEffectOptions = useMemo((): OptionGroup[] => {
    const deity = casterFighter?.deityBlood;
    const allowedGroups =
      deity === 'Hades and Persephone'
        ? ['Persephone']
        : deity
          ? [deity]
          : [];
    const effects = POWER_VFX_EFFECTS.filter((e) => {
      if (e.side === 'target') return true;
      if (e.side === 'caster') return allowedGroups.length > 0 && !!e.group && allowedGroups.includes(e.group);
      return false;
    });
    const byGroup = effects.reduce<Record<string, { value: string; label: string }[]>>((acc, e) => {
      const g = e.group ?? 'Other';
      if (!acc[g]) acc[g] = [];
      acc[g].push({ value: e.id, label: e.label });
      return acc;
    }, {});
    return Object.entries(byGroup).map(([label, options]) => ({ label, options }));
  }, [casterFighter?.deityBlood]);
  const targetEffectOptions = useMemo((): OptionGroup[] => {
    const byGroup = TARGET_TYPE_EFFECTS.reduce<Record<string, { value: string; label: string }[]>>((acc, e) => {
      const g = e.group ?? 'Other';
      if (!acc[g]) acc[g] = [];
      acc[g].push({ value: e.id, label: e.label });
      return acc;
    }, {});
    return Object.entries(byGroup).map(([label, options]) => ({ label, options }));
  }, []);
  const seasonDropdownOptions = useMemo(
    () => [
      { value: '', label: 'None' },
      ...SEASON_ORDER.map((k) => ({ value: k, label: k.charAt(0).toUpperCase() + k.slice(1) })),
    ],
    []
  );

  if (loading) {
    return (
      <div className="power-vfx-demo">
        <div className="power-vfx-demo__state">Loading fighters…</div>
      </div>
    );
  }

  if (fighterOptions.length === 0) {
    return (
      <div className="power-vfx-demo">
        <div className="power-vfx-demo__state">No members or NPCs found.</div>
      </div>
    );
  }

  if (!casterFighter || !targetFighter) {
    return (
      <div className="power-vfx-demo">
        <div className="power-vfx-demo__state">Loading…</div>
      </div>
    );
  }

  return (
    <div className="power-vfx-demo">
      <div className="power-vfx-demo__layout">
        {/* Top bar: Season only (1v1) */}
        <div className="power-vfx-demo__bar power-vfx-demo__bar--top">
          <div className="power-vfx-demo__bar-top-inner">
            <div className="power-vfx-demo__bar-field">
              <span className="power-vfx-demo__label">Season</span>
              <Dropdown
                value={demoSeason}
                onChange={(v) => setDemoSeason(v as SeasonKey | '')}
                options={seasonDropdownOptions}
                placeholder="None"
                className="power-vfx-demo__dropdown"
              />
            </div>
          </div>
        </div>

        <div className="power-vfx-demo__arena">
          <div key={`arena-${replayCasterKey}-${replayTargetKey}`} className="power-vfx-demo__arena-inner">
            <Arena
              isDemo
              demoRoom={syntheticRoom ?? undefined}
              demoSeason={demoSeason || undefined}
            />
          </div>
          <div
            ref={effectModalLeftRef}
            className={`power-vfx-demo__effect-modal-anchor power-vfx-demo__effect-modal-anchor--left ${casterEffectModalOpen ? 'power-vfx-demo__effect-modal-anchor--active' : ''}`}
            aria-hidden
          />
          <div
            ref={effectModalRightRef}
            className={`power-vfx-demo__effect-modal-anchor power-vfx-demo__effect-modal-anchor--right ${targetEffectModalOpen ? 'power-vfx-demo__effect-modal-anchor--active' : ''}`}
            aria-hidden
          />
        </div>

        {/* Bottom bar: half Caster, half Target */}
        <div className="power-vfx-demo__bar power-vfx-demo__bar--bottom">
          <div className="power-vfx-demo__bar-half power-vfx-demo__bar-half--caster">
            <span className="power-vfx-demo__side-title">Caster</span>
            <div className="power-vfx-demo__bar-controls">
              <Dropdown
                value={casterFighterId}
                onChange={setCasterFighterId}
                options={fighterDropdownOptions}
                placeholder="Fighter"
                className="power-vfx-demo__dropdown"
                searchable
              />
              <button
                type="button"
                className="power-vfx-demo__btn power-vfx-demo__btn--effects"
                onClick={() => setCasterEffectModalOpen(true)}
              >
                Effects{casterEffectIds.length > 0 ? ` (${casterEffectIds.length})` : ''}
              </button>
              <button type="button" className="power-vfx-demo__btn power-vfx-demo__btn--primary" onClick={handleReplayCaster}>
                Replay
              </button>
            </div>
          </div>
          <div className="power-vfx-demo__bar-divider" aria-hidden />
          <div className="power-vfx-demo__bar-half power-vfx-demo__bar-half--target">
            <span className="power-vfx-demo__side-title">Target</span>
            <div className="power-vfx-demo__bar-controls">
              <Dropdown
                value={targetFighterId}
                onChange={setTargetFighterId}
                options={fighterDropdownOptions}
                placeholder="Fighter"
                className="power-vfx-demo__dropdown"
                searchable
              />
              <button
                type="button"
                className="power-vfx-demo__btn power-vfx-demo__btn--effects"
                onClick={() => setTargetEffectModalOpen(true)}
              >
                Effects{targetEffectIds.length > 0 ? ` (${targetEffectIds.length})` : ''}
              </button>
              <button type="button" className="power-vfx-demo__btn power-vfx-demo__btn--primary" onClick={handleReplayTarget}>
                Replay
              </button>
            </div>
          </div>
        </div>
      </div>

      <EffectStackModal
        open={casterEffectModalOpen}
        title="Caster effects"
        groups={casterEffectOptions}
        selectedIds={casterEffectIds}
        onApply={setCasterEffectIds}
        onClose={() => setCasterEffectModalOpen(false)}
        containerRef={effectModalLeftRef}
        themeSourceRef={effectModalLeftRef}
        side="left"
      />
      <EffectStackModal
        open={targetEffectModalOpen}
        title="Target effects"
        groups={targetEffectOptions}
        selectedIds={targetEffectIds}
        onApply={setTargetEffectIds}
        onClose={() => setTargetEffectModalOpen(false)}
        containerRef={effectModalRightRef}
        themeSourceRef={effectModalRightRef}
        side="right"
      />
    </div>
  );
}
