import { useState, useEffect } from 'react';
import { fetchAllCharacters } from '../../../../../data/characters';
import { getPowers } from '../../../../../data/powers';
import { toFighterState } from '../../../../../services/battleRoom/battleRoom';
import { POWER_OVERRIDES } from '../../../../CharacterInfo/constants/overrides';
import type { FighterState } from '../../../../../types/battle';

interface Props {
  teamSize: number;
  onSelect: (fighters: FighterState[]) => void;
}

export default function TeamMemberSelection({ teamSize, onSelect }: Props) {
  const [fighters, setFighters] = useState<FighterState[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCharacters = async () => {
      try {
        const chars = await fetchAllCharacters();
        const fighterList = chars.map((c) => {
          const powerDeity = POWER_OVERRIDES[c.characterId?.toLowerCase()] ?? c.deityBlood;
          const powers = getPowers(powerDeity);
          return toFighterState(c, powers);
        });
        setFighters(fighterList);
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };

    loadCharacters();
  }, []);

  const handleToggle = (characterId: string) => {
    const newSelected = new Set(selected);

    if (newSelected.has(characterId)) {
      newSelected.delete(characterId);
    } else if (newSelected.size < teamSize) {
      newSelected.add(characterId);
    }

    setSelected(newSelected);
  };

  const handleSubmit = () => {
    const selectedFighters = fighters.filter((f) => selected.has(f.characterId));
    onSelect(selectedFighters);
  };

  if (loading) return null;

  return (
    <div className="tms">
      <div className="tms__grid">
        {fighters.map((fighter) => (
          <button
            key={fighter.characterId}
            className={`tms__card ${selected.has(fighter.characterId) ? 'tms__card--selected' : ''}`}
            onClick={() => handleToggle(fighter.characterId)}
            style={{ '--accent': fighter.theme[0] } as React.CSSProperties}
          >
            {fighter.image ? (
              <img className="tms__avatar" src={fighter.image} alt={fighter.nicknameEng} />
            ) : (
              <div className="tms__avatar tms__avatar--placeholder" style={{ background: fighter.theme[0] }}>
                {fighter.nicknameEng.charAt(0)}
              </div>
            )}
            <span className="tms__name">{fighter.nicknameEng}</span>
            {selected.has(fighter.characterId) && <span className="tms__check">✓</span>}
          </button>
        ))}
      </div>

      <button
        className="tms__btn"
        onClick={handleSubmit}
        disabled={selected.size === 0}
      >
        Confirm Team ({selected.size})
      </button>
    </div>
  );
}
