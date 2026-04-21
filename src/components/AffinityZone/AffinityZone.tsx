import React, { useMemo } from 'react';
import './AffinityZone.scss';
import type { Character } from '../../types/character';
import HeartAffinity from '../../pages/AdminManager/pages/NpcAffinityManagement/icons/HeartAffinity';
import { DEITY_THEMES } from '../../constants/theme';

type Props = {
  characterId?: string | null;
  affinities: Record<string, number>;
  npcs: Character[];
  maxShown?: number;
};

export default function AffinityZone({ characterId, affinities, npcs, maxShown = 6 }: Props) {
  const list = useMemo(() => {
    // show first `maxShown` NPCs (order comes from npcs array)
    return (npcs || []).slice(0, maxShown).map(n => ({ npc: n, affinity: affinities?.[n.characterId] ?? 0 }));
  }, [npcs, affinities, maxShown]);

  if (!characterId) return null;

  return (
    <div className="affinity-zone">
      <h3 className="affinity-zone__title">
        <span className="affinity-zone__diamond">◆</span>
        Affinity
      </h3>
      <div className="affinity-zone__list">
        {list.map(({ npc, affinity }) => (
          <div key={npc.characterId} className="affinity-zone__item" title={`${npc.nicknameEng} — ${affinity}/10`}>
            <div className="affinity-zone__avatar">
              {npc.image ? <img src={npc.image} alt={npc.nicknameEng} referrerPolicy="no-referrer" /> : <span>{(npc.nicknameEng || '?')[0]?.toUpperCase()}</span>}
            </div>
            <div className="affinity-zone__meta">
              <div className="affinity-zone__name">{npc.nicknameEng}</div>
              <div className="affinity-zone__hearts">
                {Array.from({ length: 10 }).map((_, i) => (
                  <HeartAffinity
                    key={i}
                    style={{ fill: i < (affinity || 0) ? npc.theme[0] || DEITY_THEMES[npc.deityBlood.toLowerCase()][0] : 'rgba(0, 0, 0, 0.1)' }}
                  />
                ))}
              </div>
            </div>
            <div className="affinity-zone__value">{affinity}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
