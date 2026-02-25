import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchCharacter, fetchPowers, fetchWishes, fetchItemInfo, fetchWeaponInfo, fetchPlayerBag, Character, Power, WishEntry, ItemInfo, BagEntry } from '../../data/characters';
import { applyTheme } from '../../App';
import { DEITY_SVG, parseDeityNames } from '../../data/deities';
import './CharacterInfo.scss';

/* ── HP / SPD bar ── */
function VitalBar({ value, max, label, accent }: {
  value: number; max: number; label: string; accent?: boolean;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="vbar">
      <span className="vbar__label">{label}</span>
      <div className="vbar__track">
        <div className={`vbar__fill ${accent ? 'vbar__fill--accent' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="vbar__num">{value}</span>
    </div>
  );
}

/* ── Stat orb ── */
function StatOrb({ value, label, max = 10, accent }: {
  value: number; label: string; max?: number; accent?: boolean;
}) {
  const pct = Math.min(value / max, 1);
  const r = 26;
  const circ = 2 * Math.PI * r; 
  const offset = circ * (1 - pct);

  return (
    <div className={`so ${accent ? 'so--accent' : ''}`}>
      <div className="so__orb">
        <svg className="so__svg" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r={r} className="so__track" />
          <circle cx="30" cy="30" r={r} className="so__arc"
            strokeDasharray={circ} strokeDashoffset={offset} />
          {/* decorative inner ring */}
          <circle cx="30" cy="30" r={18} className="so__inner" />
        </svg>
        <span className="so__val">{value}</span>
      </div>
      <span className="so__label">{label}</span>
    </div>
  );
}

/* ── Slot (shared for weapons & items) ── */
function Slot({ name, icon, quantity, imageUrl, tier }: { name?: string; icon: string; quantity?: number; imageUrl?: string; tier?: string }) {
  const tierCls = tier ? `wslot--${tier.toLowerCase()}` : '';
  return (
    <div className={`wslot ${!name ? 'wslot--empty' : ''} ${name ? tierCls : ''}`}>
      <div className="wslot__frame">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="wslot__img" referrerPolicy="no-referrer" />
        ) : (
          <span className="wslot__icon">{name ? icon : '+'}</span>
        )}
        {quantity != null && quantity > 0 && <span className="wslot__qty">{quantity}</span>}
        {name && tier && <span className="wslot__tier">{tier}</span>}
      </div>
      <span className="wslot__name">{name || 'Empty'}</span>
    </div>
  );
}

/* ── Deity card ── */
function DeityCard({ deity }: { deity: string }) {
  const names = parseDeityNames(deity);

  return (
    <div className="dcard">
      <div className={`dcard__icons ${names.length > 1 ? 'dcard__icons--dual' : ''}`}>
        {names.map(name => (
          <div key={name} className="dcard__deity">
            <div className="dcard__icon">
              {DEITY_SVG[name] || <span className="dcard__fallback">⚡</span>}
            </div>
            <span className="dcard__label">{name}</span>
          </div>
        ))}
      </div>
      <div className="dcard__line" />
      <span className="dcard__sub">Divine Parent</span>
    </div>
  );
}

/* ── Power card ── */
const POWER_META: Record<string, { icon: string; tag: string; cls: string }> = {
  Passive:      { icon: '◈', tag: 'PASSIVE',   cls: 'pcard--passive' },
  '1st Skill':  { icon: '⚔', tag: '1ST SKILL', cls: 'pcard--skill' },
  '2nd Skill':  { icon: '⚔', tag: '2ND SKILL', cls: 'pcard--skill' },
  Ultimate:     { icon: '✦', tag: 'ULTIMATE',  cls: 'pcard--ult' },
};

function PowerCard({ power, index }: { power: Power; index: number }) {
  const meta = POWER_META[power.status] || { icon: '◇', tag: power.status.toUpperCase(), cls: '' };

  return (
    <div className={`pcard ${meta.cls}`} style={{ animationDelay: `${index * 0.1}s` }}>
      <div className="pcard__accent" />
      <div className="pcard__orb">
        <span className="pcard__orb-icon">{meta.icon}</span>
      </div>
      <div className="pcard__body">
        <span className="pcard__tag">{meta.tag}</span>
        <h4 className="pcard__name">{power.name}</h4>
        <p className="pcard__desc">{power.description}</p>
      </div>
    </div>
  );
}

/* ── Trait chip box ── */
function TraitBox({ label, raw, variant }: {
  label: string; raw: string; variant: 'primary' | 'accent' | 'mixed';
}) {
  const items = raw
    ? raw.split(',').map(s => s.trim()).filter(Boolean).map(s => {
        const [title, ...rest] = s.split(':');
        return { title: title.trim(), desc: rest.join(':').trim() || '' };
      })
    : [];

  return (
    <div className={`cs__trait cs__trait--${variant}`}>
      <h3 className="cs__trait-label"><span className="cs__trait-diamond">◆</span>{label}</h3>
      <div className="cs__trait-chips">
        {items.length > 0 ? items.map((item, i) => (
          <span key={i} className="cs__chip">
            <span className="cs__chip-title">{item.title}</span>
            {item.desc && <span className="cs__chip-desc">{item.desc}</span>}
          </span>
        )) : (
          <div className="cs__trait-empty">
            <svg className="cs__trait-empty-icon" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="cs__trait-empty-text">Undiscovered</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════ Main ════ */

function CharacterInfo() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [viewed, setViewed] = useState<Character | null>(null);
  const [loadingViewed, setLoadingViewed] = useState(false);
  const [powers, setPowers] = useState<Power[]>([]);
  const [wishes, setWishes] = useState<WishEntry[]>([]);
  const [loadingPowers, setLoadingPowers] = useState(false);
  const [bagItems, setBagItems] = useState<(ItemInfo & BagEntry)[]>([]);
  const [bagWeapons, setBagWeapons] = useState<(ItemInfo & BagEntry)[]>([]);
  const [weaponModal, setWeaponModal] = useState(false);
  const [itemModal, setItemModal] = useState(false);

  const isOwnProfile = !id || id === user?.characterId;
  const char = isOwnProfile ? user : viewed;

  useEffect(() => {
    if (isOwnProfile || !id) {
      setViewed(null);
      return;
    }
    setLoadingViewed(true);
    fetchCharacter(id)
      .then(setViewed)
      .catch(() => setViewed(null))
      .finally(() => setLoadingViewed(false));
  }, [id, isOwnProfile]);

  const DEITY_DISPLAY_OVERRIDES: Record<string, string> = {
    rosabella: 'Persephone',
  };
  const POWER_OVERRIDES: Record<string, string> = {
    rosabella: 'Demeter',
  };
  const charKey = char?.characterId?.toLowerCase() ?? '';
  const displayDeity = DEITY_DISPLAY_OVERRIDES[charKey] ?? char?.dietyBlood;
  const powerDeity = POWER_OVERRIDES[charKey] ?? char?.dietyBlood;

  useEffect(() => {
    if (!powerDeity) return;
    setLoadingPowers(true);
    fetchPowers(powerDeity)
      .then(setPowers)
      .catch(() => setPowers([]))
      .finally(() => setLoadingPowers(false));
  }, [powerDeity]);

  useEffect(() => {
    if (!char?.characterId) return;
    fetchWishes(char.characterId).then(setWishes).catch(() => setWishes([]));
  }, [char?.characterId]);

  useEffect(() => {
    if (!char?.characterId) return;
    Promise.all([fetchItemInfo(), fetchWeaponInfo(), fetchPlayerBag(char.characterId)])
      .then(([items, weapons, bag]) => {
        const allInfo = [...items, ...weapons];
        const joinedItems = bag
          .filter((b) => b.itemId.startsWith('item_'))
          .map((b) => { const info = allInfo.find((it) => it.itemId === b.itemId); return info ? { ...info, ...b } : null; })
          .filter(Boolean) as (ItemInfo & BagEntry)[];
        const joinedWeapons = bag
          .filter((b) => b.itemId.startsWith('weapon_'))
          .map((b) => { const info = allInfo.find((it) => it.itemId === b.itemId); return info ? { ...info, ...b } : null; })
          .filter(Boolean) as (ItemInfo & BagEntry)[];
        setBagItems(joinedItems);
        setBagWeapons(joinedWeapons);
      })
      .catch(() => { setBagItems([]); setBagWeapons([]); });
  }, [char?.characterId]);

  if (!user) return null;

  if (loadingViewed) {
    return (
      <div className="cs cs--loading">
        <div className="app-loader__ring" />
      </div>
    );
  }

  if (!isOwnProfile && !viewed) {
    return (
      <div className="cs cs--loading">
        <p style={{ color: 'var(--ci-muted)' }}>Character not found.</p>
      </div>
    );
  }

  if (!char) return null;

  const img = char.image || undefined;
  const themeStyle = !isOwnProfile && char ? applyTheme(char.theme) : undefined;

  const SLOT_MIN = 12;

  const weaponSlots: { name: string; quantity: number; imageUrl?: string; tier?: string }[] = bagWeapons.map((b) => ({
    name: b.labelEng,
    quantity: b.quantity,
    imageUrl: b.imageUrl || undefined,
    tier: b.tier || undefined,
  }));
  while (weaponSlots.length < SLOT_MIN) weaponSlots.push({ name: '', quantity: 0 });

  const itemSlots: { name: string; quantity: number; imageUrl?: string; tier?: string }[] = bagItems.map((b) => ({
    name: b.labelEng,
    quantity: b.quantity,
    imageUrl: b.imageUrl || undefined,
    tier: b.tier || undefined,
  }));
  while (itemSlots.length < SLOT_MIN) itemSlots.push({ name: '', quantity: 0 });

  const orderedPowers = ['Passive', '1st Skill', '2nd Skill', 'Ultimate']
    .map(s => powers.find(p => p.status === s))
    .filter(Boolean) as Power[];

  return (
    <div className="cs" style={themeStyle}>
      {/* ─── LEFT: Character Card ─── */}
      <aside className="cs__left">
        <div className="cs__nick-header">
          <h2 className="cs__nick">{char.nicknameEng}</h2>
          <p className="cs__nick-sub">{char.nicknameThai || char.nicknameEng} | {char.sex === 'female' ? '♀' : '♂'} | {char.age ? `${char.age} years old` : 'Unknown'}</p>
        </div>

        <div className="cs__portrait">
          {img ? (
            <img src={img} alt={char.nicknameEng} className="cs__portrait-img" referrerPolicy="no-referrer" />
          ) : (
            <div className="cs__portrait-ph">{char.nicknameEng[0]?.toUpperCase() ?? '?'}</div>
          )}
          {char.twitter && (
            <a href={char.twitter.startsWith('http') ? char.twitter : `https://x.com/${char.twitter.replace(/^@/, '')}`}
              target="_blank" rel="noopener noreferrer" className="cs__twitter" title="Twitter / X">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          )}
          <div className="cs__overlay">
            <h1 className="cs__name">{char.nameEng}</h1>
            {char.nameThai && <p className="cs__name-th">{char.nameThai}</p>}
            <p className="cs__deity">
              {char.sex === 'female' ? 'Daughter' : 'Son'} of {displayDeity} &middot; Cabin {char.cabin}
            </p>
          </div>
        </div>

        <div className="cs__bars">
          <VitalBar value={char.hp} max={20} label="HP" />
          <VitalBar value={char.speed} max={20} label="SPD" accent />
        </div>

      </aside>

      {/* ─── RIGHT: Journal Panel ─── */}
      <main className="cs__right">
        {/* Currency banner */}
        <div className="cs__currency">
          <div className="cs__currency-line" />
          <div className="cs__currency-inner">
            <span className="cs__currency-star">✦</span>
            <div className="cs__currency-amount">
              <svg className="cs__currency-icon" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="1" />
                <path d="M12 5.5v13M8.5 7.5l7 9M15.5 7.5l-7 9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              </svg>
              <span className="cs__currency-num">{char.currency.toLocaleString()}</span>
              <span className="cs__currency-label">Drachma{Number(char.currency) > 1 ? 's' : ''}</span>
            </div>
            <span className="cs__currency-sep">|</span>
            <div className="cs__currency-amount">
              <svg className="cs__currency-icon" viewBox="0 0 24 24" fill="none">
                <circle cx="7" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="17" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9.5 10l2.5-2M14.5 10l-2.5-2M9.5 14l2.5 2M14.5 14l-2.5 2" stroke="currentColor" strokeWidth="1" />
              </svg>
              <span className="cs__currency-num">{char.beads}</span>
              <span className="cs__currency-label">Bead{Number(char.beads) > 1 ? 's' : ''}</span>
            </div>
            <span className="cs__currency-star">✦</span>
          </div>
          <div className="cs__currency-line" />
        </div>

        {/* Stats grid */}
        <div className="cs__stats">
          <StatOrb value={char.damage} label="DAMAGE" />
          <StatOrb value={char.protectionDiceUp} label="PROTECT DICE" />
          <StatOrb value={char.attackDiceUp} label="ATTACK DICE" />
          <StatOrb value={char.reroll} label="REROLL" />
          {([
            ['PASSIVE', char.passiveSkillPoint],
            ['SKILL', char.skillPoint],
            ['ULTIMATE', char.ultimateSkillPoint],
          ] as [string, string][]).map(([label, val]) => {
            const unlocked = val.toLowerCase() === 'unlock';
            return (
              <div key={label} className={`so so--accent ${unlocked ? 'so--unlocked' : 'so--locked'}`}>
                <div className="so__orb">
                  <svg className="so__svg" viewBox="0 0 60 60">
                    <circle cx="30" cy="30" r={26} className="so__track" />
                    <circle cx="30" cy="30" r={26} className="so__arc"
                      strokeDasharray={2 * Math.PI * 26} strokeDashoffset={unlocked ? 0 : 2 * Math.PI * 26} />
                    <circle cx="30" cy="30" r={18} className="so__inner" />
                  </svg>
                  <svg className="so__lock-icon" viewBox="0 0 24 24" fill="none">
                    {unlocked ? (
                      <>
                        <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M7 11V7a5 5 0 0 1 9.9-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        <circle cx="12" cy="16" r="1.5" fill="currentColor" />
                      </>
                    ) : (
                      <>
                        <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        <circle cx="12" cy="16" r="1.5" fill="currentColor" />
                      </>
                    )}
                  </svg>
                </div>
                <span className="so__label">{label}</span>
              </div>
            );
          })}
        </div>

        {/* Scrollable content */}
        <div className="cs__scroll">
          {/* Practice Progress */}
          <div className="cs__practice">
            <h3 className="cs__practice-title"><span className="cs__practice-diamond">◆</span>Practice Progress</h3>
            <div className="cs__practice-grid">
              {([
                ['Strength', char.strength],
                ['Mobility', char.mobility],
                ['Intelligence', char.intelligence],
                ['Technique', char.technique],
                ['Experience', char.experience],
                ['Fortune', char.fortune],
              ] as [string, number][]).map(([label, val]) => (
                <div key={label} className="cs__practice-row">
                  <span className="cs__practice-label">{label}</span>
                  <span className="cs__practice-stars">
                    {Array.from({ length: 5 }, (_, i) => (
                      <span key={i} className={`cs__star ${i < Math.min(val, 5) ? 'cs__star--filled' : 'cs__star--empty'}`}>{i < Math.min(val, 5) ? '✦' : '✧'}</span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Powers */}
          <div className="cs__powers-row">
            <DeityCard deity={displayDeity} />
            <div className="cs__powers">
              {loadingPowers ? (
                <div className="cs__powers-loader"><div className="app-loader__ring" /></div>
              ) : orderedPowers.length > 0 ? (
                orderedPowers.map((p, i) => <PowerCard key={p.status} power={p} index={i} />)
              ) : (
                <p className="cs__ptext cs__ptext--empty">{'\u2014'}</p>
              )}
            </div>
          </div>

          {/* Weapons & Items */}
          <div className="cs__arsenal-row">
            <div className="cs__arsenal">
              <div className="cs__arsenal-label">
                <span className="cs__arsenal-text">Weapons</span>
              </div>
              <div className="cs__slots">
                {weaponSlots.map((w, i) => (
                  <Slot key={`w${i}`} name={w.name || undefined} icon="⚔" quantity={w.quantity} imageUrl={w.imageUrl} tier={w.tier} />
                ))}
              </div>
              <button className="cs__slots-more" onClick={() => setWeaponModal(true)}>
                <span className="cs__slots-more-text">Show All</span>
              </button>
            </div>

            <div className="cs__arsenal cs__arsenal--items">
              <div className="cs__arsenal-label">
                <span className="cs__arsenal-text">Items</span>
              </div>
              <div className="cs__slots">
                {itemSlots.map((it, i) => (
                  <Slot key={`i${i}`} name={it.name || undefined} icon="◈" quantity={it.quantity} imageUrl={it.imageUrl} tier={it.tier} />
                ))}
              </div>
              <button className="cs__slots-more" onClick={() => setItemModal(true)}>
                <span className="cs__slots-more-text">Show All</span>
              </button>
            </div>
          </div>

          {/* Wishes */}
          {wishes.length > 0 && (
            <div className="cs__wishes">
              <h3 className="cs__wishes-title"><span className="cs__wishes-diamond">◆</span>Divine Wishes</h3>
              <div className="cs__wishes-grid">
                {wishes.map(({ deity, count }) => (
                  <div key={deity} className={`cs__wish ${count > 0 ? 'cs__wish--active' : ''}`}>
                    <span className="cs__wish-icon">{DEITY_SVG[deity.toLowerCase()] || <span>⚡</span>}</span>
                    <span className="cs__wish-deity">{deity}</span>
                    <span className="cs__wish-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Personal Info */}
          <div className="cs__personal">
            <h3 className="cs__personal-title"><span className="cs__personal-diamond">◆</span>Personal Info</h3>
            <div className="cs__personal-stats">
              <div className="cs__personal-stat">
                <svg className="cs__personal-stat-icon" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2v20M8 4h8M8 20h8M10 8h4M10 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="cs__personal-stat-label">Height</span>
                <span className="cs__personal-stat-value">{char.height ? `${char.height} cm.` : 'Unknown'}</span>
              </div>
              <div className="cs__personal-stat">
                <svg className="cs__personal-stat-icon" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3L4 9h16L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M4 9v3a8 8 0 0016 0V9" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="12" cy="14" r="2" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                <span className="cs__personal-stat-label">Weight</span>
                <span className="cs__personal-stat-value">{char.weight ? `${char.weight} kg.` : 'Unknown'}</span>
              </div>
              <div className="cs__personal-stat">
                <svg className="cs__personal-stat-icon" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 13v8M9 18h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="cs__personal-stat-label">Gender</span>
                <span className="cs__personal-stat-value">{char.genderIdentity || 'Prefer not to say'}</span>
              </div>
              <div className="cs__personal-stat">
                <svg className="cs__personal-stat-icon" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M3 12h18M12 3c-3 3-3 15 0 18M12 3c3 3 3 15 0 18" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                <span className="cs__personal-stat-label">Nationality</span>
                <span className="cs__personal-stat-value">{char.nationality || 'Unknown'}</span>
              </div>
            </div>
            {char.background && (
              <div className="cs__background">
                <span className="cs__background-label">Background</span>
                <p className="cs__background-text">{char.background}</p>
              </div>
            )}
            <div className="cs__identity-row">
              {/* Scrapbook — appearance colors */}
              <div className="cs__scrapbook">
                <div className="cs__swatch">
                  <div className="cs__swatch-circle" style={{ background: char.eyeColor || '#888' }} />
                  <span className="cs__swatch-label">Eye Color</span>
                  <span className="cs__swatch-hex">{char.eyeColor || '—'}</span>
                </div>
                <div className="cs__swatch">
                  <div className="cs__swatch-circle" style={{ background: char.hairColor || '#888' }} />
                  <span className="cs__swatch-label">Hair Color</span>
                  <span className="cs__swatch-hex">{char.hairColor || '—'}</span>
                </div>
              </div>
              {/* Appearance text */}
              <div className="cs__appearance">
                <span className="cs__appearance-label">Appearance</span>
                <p className="cs__appearance-text">{char.appearance || 'No description yet.'}</p>
              </div>
              {/* Human parent — full width below scrapbook + appearance */}
              {(char.humanParent || char.dietyBlood) && (
                <div className="cs__human-parent">
                  {displayDeity && (
                    <div className="cs__human-parent-entry cs__human-parent-entry--divine">
                      <svg className="cs__human-parent-icon" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2l2.09 6.26L21 9.27l-5.18 4.73L17.82 22 12 17.77 6.18 22l1.64-7.73L2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                      </svg>
                      <span className="cs__human-parent-label">Deity</span>
                      <span className="cs__human-parent-name">{displayDeity}</span>
                    </div>
                  )}
                  {char.humanParent && (() => {
                    const parts = char.humanParent.split(',').map(s => s.trim()).filter(Boolean);
                    const name = parts[0];
                    const role = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase() : 'Parent';
                    return (
                      <div className="cs__human-parent-entry">
                        <svg className="cs__human-parent-icon" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        <span className="cs__human-parent-label">{role}</span>
                        <span className="cs__human-parent-name">{name}</span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Traits */}
          <div className="cs__trait-row">
            <TraitBox label="Strengths" raw={char.strengths} variant="primary" />
            <TraitBox label="Weaknesses" raw={char.weaknesses} variant="accent" />
          </div>
          <TraitBox label="Supernatural Abilities" raw={char.abilities} variant="mixed" />
        </div>
      </main>

      {/* Floating action buttons */}
      <div className="cs__actions">
        {id && (
          <button className="cs__action-btn cs__back" type="button" onClick={() => navigate(-1)} data-tooltip="Go Back" data-tooltip-pos="right">
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
              <path d="M19 12H5M5 12l6-6M5 12l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {char.document && (
          <a className="cs__action-btn" href={char.document} target="_blank" rel="noopener noreferrer" data-tooltip="View Document" data-tooltip-pos="left">
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M14 2v6h6M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </a>
        )}
        {isOwnProfile && !id && (
          <button className="cs__action-btn" type="button" data-tooltip="Edit Character" data-tooltip-pos="left">
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
              <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M15 5l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default CharacterInfo;
