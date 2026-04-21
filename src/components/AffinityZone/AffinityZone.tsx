import React, { useMemo } from 'react';
import type { Character } from '../../types/character';
import HeartAffinity from '../../pages/AdminManager/pages/NpcAffinityManagement/icons/HeartAffinity';
import { DEITY_THEMES } from '../../constants/theme';
import './AffinityZone.scss';

type Props = {
  character: Character;
  affinities: Record<string, number>;
  npcs: Character[];
  maxShown?: number;
};

export default function AffinityZone({ character, affinities, npcs, maxShown }: Props) {

  const characterId = character?.characterId;

  const list = useMemo(() => {
    // show all NPCs (or limited by maxShown if provided)
    const npcList = maxShown ? (npcs || []).slice(0, maxShown) : (npcs || []);
    return npcList.map(n => ({ npc: n, affinity: affinities?.[n.characterId] ?? 0 }));
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
          <div key={npc.characterId} className="affinity-zone__item">
            <div className="affinity-zone__avatar">
              {npc.image ? <img src={npc.image} alt={npc.nicknameEng} referrerPolicy="no-referrer" /> : <span>{(npc.nicknameEng || '?')[0]?.toUpperCase()}</span>}
            </div>
            <div className="affinity-zone__meta">
              <div className="affinity-zone__name">{npc.nicknameEng}</div>
              <div className="affinity-zone__hearts">
                {Array.from({ length: 10 }).map((_, i) => {
                  const isFilled = i < (affinity || 0);
                  return (
                    <HeartAffinity
                      key={i}
                      style={{ 
                        fill: isFilled 
                          ? `url(#gradient-${npc.characterId})` 
                          : 'rgba(0, 0, 0, 0.1)' 
                      }}
                    />
                  );
                })}
                <svg width="0" height="0" style={{ position: 'absolute' }}>
                  <defs>
                    <linearGradient id={`gradient-${npc.characterId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={npc.theme[0] || DEITY_THEMES[npc.deityBlood.toLowerCase()][0]} />
                      <stop offset="100%" stopColor={character.theme[0]} />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
            <div className="affinity-zone__value">{affinity}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
