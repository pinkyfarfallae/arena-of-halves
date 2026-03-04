import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { fetchNPCs } from '../../../../../data/npcs';
import Dice from './icons/Dice';
import type { FighterState } from '../../../../../types/battle';
import './NPCTeamSelection.scss';

interface Props {
  teamSize: number;
  onSelect: (fighters: FighterState[]) => void;
  triggerSubmit?: boolean;
  excludedIds?: Set<string>;
}

export default function NPCTeamSelection({ teamSize, onSelect, triggerSubmit, excludedIds }: Props) {
  const [npcs, setNpcs] = useState<FighterState[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    fetchNPCs().then(setNpcs).finally(() => setLoading(false));
  }, []);

  // Submit when parent requests it
  useEffect(() => {
    if (triggerSubmit && selected.size > 0) {
      const selectedNpcs = npcs.filter((n) => selected.has(n.characterId));
      onSelect(selectedNpcs);
    }
  }, [triggerSubmit, selected, npcs, onSelect]);

  const handleToggle = (characterId: string) => {
    // Prevent selecting NPCs that are in other team
    if (excludedIds?.has(characterId)) return;
    
    const newSelected = new Set(selected);

    if (newSelected.has(characterId)) {
      newSelected.delete(characterId);
    } else if (newSelected.size < teamSize) {
      newSelected.add(characterId);
    }

    setSelected(newSelected);
    
    // Call onSelect immediately when selection changes
    const selectedNpcs = npcs.filter((n) => newSelected.has(n.characterId));
    onSelect(selectedNpcs);
  };

  const handleRandom = () => {
    // Filter out excluded NPCs
    const availableIndices = Array.from({ length: npcs.length }, (_, i) => i)
      .filter((i) => !excludedIds?.has(npcs[i].characterId));
    
    // Shuffle available indices
    for (let i = availableIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableIndices[i], availableIndices[j]] = [availableIndices[j], availableIndices[i]];
    }

    const randomSelected = new Set<string>();
    for (let i = 0; i < Math.min(teamSize, availableIndices.length); i++) {
      randomSelected.add(npcs[availableIndices[i]].characterId);
    }
    setSelected(randomSelected);
    
    // Call onSelect immediately
    const selectedNpcs = npcs.filter((n) => randomSelected.has(n.characterId));
    onSelect(selectedNpcs);
  };

  if (loading) {
    return (
      <div className="nts">
        <button className="nts__random" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
          <Dice width={16} height={16} />
          Random Team
        </button>
        <div className="nts__grid">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="nts__card nts__card--loading">
              <div className="nts__skeleton nts__skeleton--avatar" />
              <div className="nts__skeleton nts__skeleton--text nts__skeleton--name" />
              <div className="nts__skeleton nts__skeleton--text nts__skeleton--stats" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="nts">
      <button className="nts__random" onClick={handleRandom}>
        <Dice width={16} height={16} />
        Random Team
      </button>

      <div className="nts__grid">
        {npcs.map((npc) => (
          <button
            key={npc.characterId}
            ref={(el) => {
              if (el) cardRefs.current?.set(npc.characterId, el);
            }}
            className={`nts__card ${selected.has(npc.characterId) ? 'nts__card--selected' : ''} ${excludedIds?.has(npc.characterId) ? 'nts__card--excluded' : ''}`}
            onClick={() => handleToggle(npc.characterId)}
            disabled={excludedIds?.has(npc.characterId)}
            style={{ '--accent': npc.theme[0] } as React.CSSProperties}
          >
            {npc.image ? (
              <img className="nts__avatar" src={npc.image} alt={npc.nicknameEng} />
            ) : (
              <div className="nts__avatar nts__avatar--placeholder" style={{ background: npc.theme[0] }}>
                {npc.nicknameEng.charAt(0)}
              </div>
            )}
            <span className="nts__name">{npc.nicknameEng}</span>
            <span className="nts__stats">{npc.maxHp}HP</span>
            {selected.has(npc.characterId) && 
              cardRefs.current?.get(npc.characterId) &&
              createPortal(
                <span className="nts__check">✓</span>,
                cardRefs.current.get(npc.characterId)!
              )
            }
          </button>
        ))}
      </div>
    </div>
  );
}
