import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Character, fetchAllCharacters } from '../../data/characters';
import { DEITY_SVG, parseDeityNames } from '../../data/deities';
import { useAuth } from '../../hooks/useAuth';
import { hash } from '../../utils/hash';
import Pin from './components/Pin/Pin';
import Tape from './components/Tape/Tape';
import Doodle, { DoodleType, DoodlePos, GENERIC_DOODLES, DEITY_DOODLES, DOODLE_POSITIONS } from './components/Doodle/Doodle';
import Laurel from './icons/Laurel';
import './CampMembers.scss';

/* ── Decoration types ── */
type Deco = 'pin' | 'tape-l' | 'tape-r' | 'tape-c';
const DECOS: Deco[] = ['pin', 'pin', 'pin', 'tape-l', 'tape-r', 'tape-c'];

function CampMembers() {
  const [members, setMembers] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchAllCharacters()
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, []);

  /* stable per-card rotation + decoration + deity-based doodles (8–10) */
  const cardMeta = useMemo(() =>
    members.map((m) => {
      const h = hash(m.characterId);
      const deityKeys = parseDeityNames(m.dietyBlood);
      const isRosabella = m.nicknameEng.toLowerCase() === 'rosabella';

      /* pick doodle pool based on deity */
      let pool: DoodleType[];
      if (isRosabella) {
        // Special: heart + rose, then Persephone + Hades doodles
        const persephonePick = (DEITY_DOODLES.persephone || GENERIC_DOODLES).slice(0, 4);
        const hadesPick = (DEITY_DOODLES.hades || GENERIC_DOODLES).slice(0, 4);
        pool = ['heart' as DoodleType, 'rose' as DoodleType, ...persephonePick, ...hadesPick];
      } else {
        // Combine doodle sets from all deity parents
        const sets = deityKeys.map((k) => DEITY_DOODLES[k] || GENERIC_DOODLES);
        pool = sets.flat();
        // Pad with generic if pool is too small
        while (pool.length < 10) pool = [...pool, ...GENERIC_DOODLES];
      }

      // Pad pool with generics (avoiding duplicates) so we never cycle
      const count = 14 + (h % 3); // 14–16 doodles
      if (pool.length < count) {
        const extras = GENERIC_DOODLES.filter((g) => !pool.includes(g));
        pool = [...pool, ...extras];
      }

      const doodles: { type: DoodleType; pos: DoodlePos }[] = [];
      const usedPos = new Set<DoodlePos>();
      const usedTypes = new Set<DoodleType>();
      for (let d = 0; d < count && d < DOODLE_POSITIONS.length; d++) {
        const hd = hash(m.characterId + `d${d}`);
        // Pick type, skip duplicates when possible
        let type = pool[d % pool.length];
        if (usedTypes.has(type)) {
          const alt = pool.find((t, i) => i >= d && !usedTypes.has(t))
                   || pool.find((t) => !usedTypes.has(t));
          if (alt) type = alt;
        }
        usedTypes.add(type);
        // pick unique positions
        let pos = DOODLE_POSITIONS[hd % DOODLE_POSITIONS.length];
        if (usedPos.has(pos)) {
          pos = DOODLE_POSITIONS.find((p) => !usedPos.has(p)) || pos;
        }
        usedPos.add(pos);
        doodles.push({ type, pos });
      }
      return {
        rotation: ((h % 9) - 4) * 1.3,
        deco: DECOS[h % DECOS.length],
        doodles,
      };
    }), [members]);

  if (loading) {
    return (
      <div className="camp camp--loading">
        <div className="app-loader__ring" />
      </div>
    );
  }

  return (
    <div className="camp">
      {/* Header */}
      <div className="camp__header">
        <div className="camp__laurel" aria-hidden="true">
          <Laurel className="camp__laurel-svg" />
        </div>
        <h2 className="camp__title">Camp Half-Blood</h2>
        <p className="camp__sub">{members.length} Demigod{members.length !== 1 ? 's' : ''} &middot; Arena of Halves</p>
        <div className="camp__divider" />
      </div>

      {/* Corkboard grid */}
      <div className="camp__board">
        <div className="camp__grid">
          {members.map((m, i) => {
            const deityKey = parseDeityNames(m.dietyBlood)[0];
            const { rotation, deco, doodles } = cardMeta[i];
            const isPin = deco === 'pin';
            const isMe = user?.characterId === m.characterId;

            return (
              <button
                key={m.characterId}
                className={`camp__card${isMe ? ' camp__card--me' : ''}`}
                onClick={() => navigate(`/character/${m.characterId}`)}
                style={{ '--card-rot': `${rotation}deg` } as React.CSSProperties}
              >
                {/* Pin or tape decoration */}
                {isPin
                  ? <Pin color={m.theme[0]} />
                  : <Tape side={deco.replace('tape-', '') as 'l' | 'r' | 'c'} color={m.theme[0]} />
                }

                {/* "ME" label for current user */}
                {isMe && <span className="camp__me" style={{ background: m.theme[0] }}>ME</span>}

                {/* Polaroid */}
                <div className="camp__polaroid">
                  <div className="camp__photo">
                    {m.image ? (
                      <img src={m.image} alt={m.nicknameEng} className="camp__img" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="camp__ph" style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${m.theme[0]} 15%, #f0e8d8), color-mix(in srgb, ${m.theme[0]} 25%, #e0d8c8))`, color: m.theme[0] }}>{m.nicknameEng[0]?.toUpperCase() ?? '?'}</div>
                    )}
                  </div>
                  {/* Doodle overlays scattered around the photo */}
                  {m.image && doodles.map((d, di) => (
                    <Doodle key={di} type={d.type} pos={d.pos} />
                  ))}

                  {/* Bottom strip with info */}
                  <div className="camp__strip">
                    <div className="camp__text">
                      <span className="camp__nick">{m.nicknameEng}</span>
                      <span className="camp__name">{m.nameEng}</span>
                    </div>
                    <div className="camp__badge">
                      <span className="camp__deity-icon">
                        {DEITY_SVG[deityKey] || <span>&#x26A1;</span>}
                      </span>
                    </div>
                  </div>

                  {/* Deity label */}
                  <div className="camp__deity-label">
                    <span className="camp__deity">{m.characterId.toLowerCase() === 'rosabella' ? 'Persephone' : (m.dietyBlood || 'Unknown')}</span>
                    <span className="camp__cabin">{m.cabin ? `Cabin ${m.cabin}` : '???'}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CampMembers;
