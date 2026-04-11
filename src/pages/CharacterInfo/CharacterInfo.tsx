import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useBag } from '../../hooks/useBag';
import { fetchCharacter, fetchWishes as fetchWishesFromCharacter, fetchItemInfo, patchCharacter, Character, Power, WishEntry, ItemInfo, BagEntry, DEFAULT_THEME, DEITY_THEMES } from '../../data/characters';
import { fetchWishes } from '../../data/wishes';
import { getPowers } from '../../data/powers';
import EditCharacterModal from './components/EditCharacterModal/EditCharacterModal';
import { applyTheme } from '../../App';
import { DEITY_SVG, toDeityKey } from '../../data/deities';
import Drachma from '../../icons/Drachma';
import VitalBar from './components/VitalBar/VitalBar';
import StatOrb from './components/StatOrb/StatOrb';
import Slot from './components/Slot/Slot';
import DeityCard from './components/DeityCard/DeityCard';
import PowerCard from './components/PowerCard/PowerCard';
import TraitBox from './components/TraitBox/TraitBox';
import TwitterX from './icons/TwitterX';
import Beads from './icons/Beads';
import Gender from './icons/Gender';
import Species from './icons/Species';
import HeightIcon from './icons/Height';
import Weight from './icons/Weight';
import Ethnicity from './icons/Ethnicity';
import Nationality from './icons/Nationality';
import Star from './icons/Star';
import HeartPulse from './icons/HeartPulse';
import MapPin from './icons/MapPin';
import Calendar from './icons/Calendar';
import Person from './icons/Person';
import BackArrow from './icons/BackArrow';
import Document from './icons/Document';
import EditPencil from './icons/EditPencil';
import LockOpen from './icons/LockOpen';
import LockClosed from './icons/LockClosed';
import { DEITY_DISPLAY_OVERRIDES, POWER_OVERRIDES } from './constants/overrides';
import { isSkillUnlocked } from '../../constants/character';
import { SEX } from '../../constants/sex';
import { POWER_TYPES } from '../../constants/powers';
import Lightning from '../../icons/Lightning';
import { CHARACTER_PRACTICE_STATES } from '../../data/practiceStates';
import { fetchAllIrisWishes, fetchTodayIrisWish, WISHES_FALLBACK } from '../../data/wishes';
import { BAG_ITEM_TYPES } from '../../constants/bag';
import './CharacterInfo.scss';
import { Deity, DEITY } from '../../constants/deities';
import { Wish } from '../../types/wish';

/* ── Formatted text: supports / line breaks, * bullets, Label: bold ── */
function FormatText({ text }: { text: string }) {
  const lines = text.split(/\s*\\n\s*|\s*\/\s*|\n/).filter(Boolean);
  return (
    <>
      {lines.map((line, i) => {
        const bullet = line.match(/^\s*\*\s*(.*)/);
        const raw = bullet ? bullet[1] : line;
        const colonIdx = raw.indexOf(':');
        const content = colonIdx > 0 ? (
          <><strong>{raw.substring(0, colonIdx).trim()}:</strong> {raw.substring(colonIdx + 1).trim()}</>
        ) : (
          <>{raw.trim()}</>
        );
        return <span key={i} className={bullet ? 'cs__fmt-line cs__fmt-bullet' : 'cs__fmt-line'}>{content}</span>;
      })}
    </>
  );
}

/* ════ Main ════ */

function CharacterInfo() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [viewed, setViewed] = useState<Character | null>(null);
  const [loadingViewed, setLoadingViewed] = useState(false);
  const [powers, setPowers] = useState<Power[]>([]);
  const [wishesData, setWishesData] = useState<Wish[]>([]);
  const [wishes, setWishes] = useState<WishEntry[]>([]);
  const [todayWish, setUserTodayWish] = useState<WishEntry | null>(null);
  const [loadingPowers, setLoadingPowers] = useState(false);
  const [bagItems, setBagItems] = useState<(ItemInfo & BagEntry)[]>([]);
  const [bagWeapons, setBagWeapons] = useState<(any & BagEntry)[]>([]);

  // Modal open state (setters used by UI; values reserved for future use)
  const [weaponModal, setWeaponModal] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [itemModal, setItemModal] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  /* Lock body scroll when modal/overlay is open */
  useEffect(() => {
    if (editOpen || saving) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [editOpen, saving]);

  const isOwnProfile = !id || id === user?.characterId;
  const char = isOwnProfile ? user : viewed;

  // Use Firestore-based bag hook (must be after char is defined)
  const { bagEntries, loading: loadingBag } = useBag(char?.characterId);

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

  const charKey = char?.characterId?.toLowerCase() ?? '';
  const displayDeity = DEITY_DISPLAY_OVERRIDES[charKey] ?? char?.deityBlood;
  const powerDeity = POWER_OVERRIDES[charKey] ?? char?.deityBlood;

  useEffect(() => {
    if (!powerDeity) return;
    setLoadingPowers(true);
    setPowers(getPowers(powerDeity));
    setLoadingPowers(false);
  }, [powerDeity]);

  useEffect(() => {
    if (!char?.characterId) return;

    const fetchData = async () => {
      try {
        const [fetchedWishes, userWishes, wish] = await Promise.all([
          fetchWishes().catch(() => WISHES_FALLBACK),
          fetchWishesFromCharacter(char.characterId).catch(() => []),
          fetchTodayIrisWish(char.characterId).catch(() => null),
        ]);

        setWishesData(fetchedWishes);
        setWishes(userWishes);

        const matchedWish = wish
          ? { deity: wish.deity, count: 1 }
          : null;

        setUserTodayWish(matchedWish);

      } catch (error) {
        // console.error('Failed to fetch wish data:', error);
        setUserTodayWish(null);
      }
    };

    fetchData();
  }, [char?.characterId]);

  // Join bag data with item/weapon info when bag or character changes
  useEffect(() => {
    if (!char?.characterId || loadingBag) return;

    Promise.all([fetchItemInfo()])
      .then(([items]) => {
        const allInfo = [...items];
        const joinedItems = bagEntries
          .filter((b) => b.type === BAG_ITEM_TYPES.ITEM)
          .map((b) => {
            const info = allInfo.find((it) => it.itemId === b.itemId);
            return info ? { ...info, ...b } : null;
          })
          .filter(Boolean) as (ItemInfo & BagEntry)[];

        const joinedWeapons = bagEntries
          .map((b) => {
            const info = allInfo.find((it) => it.itemId === b.itemId);
            return info ? { ...info, ...b } : null;
          })
          .filter(Boolean) as (ItemInfo & BagEntry)[];

        setBagItems(joinedItems);
        setBagWeapons(joinedWeapons);
      })
      .catch(() => {
        setBagItems([]);
        setBagWeapons([]);
      });
  }, [char?.characterId, bagEntries, loadingBag]);

  const img = useMemo(() => char?.image || undefined, [char?.image]);

  const themeStyle = useMemo(() => !isOwnProfile && char ? applyTheme(char?.theme) : undefined, [char?.theme]);

  const SLOT_MIN = 12;

  const weaponSlots: { name: string; quantity: number; imageUrl?: string; tier?: string }[] = useMemo(() => {
    const slots = bagWeapons.map((w) => ({
      name: w.labelEng,
      quantity: w.amount,
      imageUrl: w.imageUrl || undefined,
      tier: w.tier || undefined,
    }));
    while (slots.length < SLOT_MIN) slots.push({ name: '', quantity: 0, imageUrl: undefined, tier: undefined });
    return slots;
  }, [bagWeapons]);

  const itemSlots: { name: string; quantity: number; imageUrl?: string; }[] = useMemo(() => {
    const slots = bagItems.map((b) => ({
      name: b.labelEng,
      quantity: b.amount,
      imageUrl: b.imageUrl || undefined,
    }));
    while (slots.length < SLOT_MIN) slots.push({ name: '', quantity: 0, imageUrl: undefined });
    return slots;
  }, [bagItems]);

  const orderedPowers = useMemo(() => {
    return [POWER_TYPES.PASSIVE, POWER_TYPES.FIRST_SKILL, POWER_TYPES.SECOND_SKILL, POWER_TYPES.ULTIMATE]
      .map(type => powers.find(p => p.type === type))
      .filter(Boolean) as Power[];
  }, [powers]);

  if (!char) return null;
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

  return (
    <div className="cs" style={themeStyle}>
      {/* ─── LEFT: Character Card ─── */}
      <aside className="cs__left">
        <div className="cs__nick-header">
          <h2 className="cs__nick">{char.nicknameEng}</h2>
          <p className="cs__nick-sub">{char.nicknameThai || char.nicknameEng} | {char.sex === SEX.FEMALE ? '♀' : '♂'} | {char.age ? `${char.age} years old` : 'Unknown'}</p>
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
              <TwitterX width="16" height="16" />
            </a>
          )}
          <div className="cs__overlay">
            <h1 className="cs__name">{char.nameEng.split(/\\n|\n/).map((part, i) => (
              i === 0 ? <span key={i}>{part}</span> : <span key={i}><br />{part}</span>
            ))}</h1>
            {char.nameThai && <p className="cs__name-th">{char.nameThai}</p>}
            <p className="cs__deity">
              {char.sex === SEX.FEMALE ? 'Daughter' : 'Son'} of {displayDeity} &middot; Cabin {char.cabin}
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
              <Drachma className="cs__currency-icon" />
              <span className="cs__currency-num">{char.currency.toLocaleString()}</span>
              <span className="cs__currency-label">Drachma{Number(char.currency) > 1 ? 's' : ''}</span>
            </div>
            <span className="cs__currency-sep">|</span>
            <div className="cs__currency-amount">
              <Beads className="cs__currency-icon" />
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
          <StatOrb value={char.defendDiceUp} label="DEFEND DICE" />
          <StatOrb value={char.attackDiceUp} label="ATTACK DICE" />
          <StatOrb value={char.reroll} label="REROLL" />
          {([
            [POWER_TYPES.PASSIVE, char.passiveSkillPoint],
            [POWER_TYPES.FIRST_SKILL, char.skillPoint],
            [POWER_TYPES.ULTIMATE, char.ultimateSkillPoint],
          ] as [string, string][]).map(([label, val]) => {
            const unlocked = isSkillUnlocked(val);
            return (
              <div key={label} className={`so so--accent ${unlocked ? 'so--unlocked' : 'so--locked'}`}>
                <div className="so__orb">
                  <svg className="so__svg" viewBox="0 0 60 60">
                    <circle cx="30" cy="30" r={26} className="so__track" />
                    <circle cx="30" cy="30" r={26} className="so__arc"
                      strokeDasharray={2 * Math.PI * 26} strokeDashoffset={unlocked ? 0 : 2 * Math.PI * 26} />
                    <circle cx="30" cy="30" r={18} className="so__inner" />
                  </svg>
                  {unlocked ? <LockOpen className="so__lock-icon" /> : <LockClosed className="so__lock-icon" />}
                </div>
                <span className="so__label">{label}</span>
              </div>
            );
          })}
        </div>

        {/* Scrollable content */}
        <div className="cs__scroll">

          {/* Today Wish */}
          {todayWish && todayWish.deity && (
            <div
              className={`cs__today-wish ${todayWish.count > 0 ? 'cs__today-wish--active' : ''}`}
              style={{
                '--deity-primary': DEITY_THEMES[todayWish.deity.toLowerCase()]?.[0] || DEFAULT_THEME[0],
                '--deity-secondary': DEITY_THEMES[todayWish.deity.toLowerCase()]?.[1] || DEFAULT_THEME[1],
              } as React.CSSProperties}
            >
              <div className="cs__today-wish-header">
                <span className="cs__today-wish-icon">
                  {toDeityKey(todayWish.deity) ? DEITY_SVG[toDeityKey(todayWish.deity) || DEITY.ZEUS] : <Lightning width={12} height={12} />}
                </span>
                <span className="cs__today-wish-text">
                  <span className="cs__today-wish-blessing-by">
                    By Iris’ hand, a word finds its way to {isOwnProfile ? 'you' : char.sex ? 'him' : 'her'} from
                    <b>{todayWish.deity}</b> ...
                  </span>
                  <span className="cs__today-wish-name">{wishesData.find(w => w.deity === todayWish.deity)?.name}</span>
                </span>
              </div>
              <span className="cs__today-wish-description">{wishesData.find(w => w.deity === todayWish.deity)?.description}</span>
            </div>
          )}

          {/* Practice Progress */}
          <div className="cs__practice">
            <h3 className="cs__practice-title"><span className="cs__practice-diamond">◆</span>Practice Progress</h3>
            <div className="cs__practice-grid">
              {(CHARACTER_PRACTICE_STATES(char) as [string, number][]).map(([label, val]) => (
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
                orderedPowers.map((p, i) => <PowerCard key={p.type} power={p} index={i} />)
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
                  <Slot key={`i${i}`} name={it.name || undefined} icon="◈" quantity={it.quantity} imageUrl={it.imageUrl} />
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
                {wishes.map(({ deity, count }) => {
                  const iconKey = toDeityKey(deity);
                  return (
                    <div key={deity} className={`cs__wish ${count > 0 ? 'cs__wish--active' : ''} ${todayWish?.deity === deity ? 'cs__wish--today' : ''}`}>
                      <span className="cs__wish-icon">
                        {iconKey
                          ? DEITY_SVG[iconKey]
                          : (<span> <Lightning width={12} height={12} /></span>)}
                      </span>
                      <span className="cs__wish-deity">{deity}</span>
                      <span className="cs__wish-count">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Personal Info */}
          <div className="cs__personal">
            <h3 className="cs__personal-title"><span className="cs__personal-diamond">◆</span>Personal Info</h3>
            <div className="cs__personal-stats">
              <div className="cs__personal-stat">
                <Gender className="cs__personal-stat-icon" />
                <span className="cs__personal-stat-label">Gender</span>
                <span className="cs__personal-stat-value">{char.genderIdentity || 'Prefer not to say'}</span>
              </div>
              <div className="cs__personal-stat">
                <Species className="cs__personal-stat-icon" />
                <span className="cs__personal-stat-label">Species</span>
                <span className="cs__personal-stat-value">{char.species || 'Demigod'}</span>
              </div>
              <div className="cs__personal-stat">
                <HeightIcon className="cs__personal-stat-icon" />
                <span className="cs__personal-stat-label">Height</span>
                <span className="cs__personal-stat-value">{char.height ? `${char.height} cm.` : 'Unknown'}</span>
              </div>
              <div className="cs__personal-stat">
                <Weight className="cs__personal-stat-icon" />
                <span className="cs__personal-stat-label">Weight</span>
                <span className="cs__personal-stat-value">{char.weight ? `${char.weight} kg.` : 'Unknown'}</span>
              </div>
              <div className="cs__personal-stat">
                <Ethnicity className="cs__personal-stat-icon" />
                <span className="cs__personal-stat-label">Ethnicity</span>
                <span className="cs__personal-stat-value">{char.ethnicity || 'Unknown'}</span>
              </div>
              <div className="cs__personal-stat">
                <Nationality className="cs__personal-stat-icon" />
                <span className="cs__personal-stat-label">Nationality</span>
                <span className="cs__personal-stat-value">{char.nationality || 'Unknown'}</span>
              </div>
              <div className="cs__personal-stat">
                <Star className="cs__personal-stat-icon" />
                <span className="cs__personal-stat-label">Religion</span>
                <span className="cs__personal-stat-value">{char.religion || 'Olympian'}</span>
              </div>
              <div className="cs__personal-stat">
                <HeartPulse className="cs__personal-stat-icon" />
                <span className="cs__personal-stat-label">Status</span>
                <span className="cs__personal-stat-value">Alive</span>
              </div>
            </div>
            {/* Residence + Birthdate row */}
            <div className="cs__info-row">
              <div className="cs__residence">
                <div className="cs__residence-pin">
                  <MapPin />
                </div>
                <div className="cs__residence-body">
                  <span className="cs__residence-label">Residence</span>
                  <span className="cs__residence-value">{char.residence || '—'}</span>
                </div>
              </div>
              <div className="cs__residence">
                <div className="cs__residence-pin">
                  <Calendar />
                </div>
                <div className="cs__residence-body">
                  <span className="cs__residence-label">Birthdate</span>
                  <span className="cs__residence-value">{char.birthdate || '—'}</span>
                </div>
              </div>
            </div>

            {/* Aliases */}
            {char.aliases && (
              <div className="cs__aliases">
                <span className="cs__aliases-label">
                  <span className="cs__aliases-quote">«</span>
                  Also known as
                  <span className="cs__aliases-quote">»</span>
                </span>
                <div className="cs__aliases-chips">
                  {char.aliases.split(',').map(a => a.trim()).filter(Boolean).map((alias, i) => (
                    <span key={i} className="cs__aliases-chip">{alias}</span>
                  ))}
                </div>
              </div>
            )}
            {char.personality && (
              <div className="cs__background">
                <span className="cs__background-label">Personality</span>
                <div className="cs__background-text"><FormatText text={char.personality} /></div>
              </div>
            )}
            {char.background && (
              <div className="cs__background">
                <span className="cs__background-label">Background</span>
                <div className="cs__background-text"><FormatText text={char.background} /></div>
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
                <div className="cs__appearance-text">{char.appearance ? <FormatText text={char.appearance} /> : 'No description yet.'}</div>
              </div>
              {/* Human parent — full width below scrapbook + appearance */}
              {(char.humanParent || char.deityBlood) && (
                <div className="cs__human-parent">
                  {displayDeity && (
                    <div className="cs__human-parent-entry cs__human-parent-entry--divine">
                      <Star className="cs__human-parent-icon" />
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
                        <Person className="cs__human-parent-icon" />
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
          {(() => {
            const displayDeityIconKey = displayDeity ? toDeityKey(displayDeity) : undefined;
            return (
              <>
                <div className="cs__trait-row">
                  <TraitBox label="Strengths" raw={char.strengths} variant="primary" icon={displayDeityIconKey ? DEITY_SVG[displayDeityIconKey] : undefined} />
                  <TraitBox label="Weaknesses" raw={char.weaknesses} variant="accent" icon={displayDeityIconKey ? DEITY_SVG[displayDeityIconKey] : undefined} />
                </div>
                <TraitBox label="Supernatural Abilities" raw={char.abilities} variant="mixed" icon={displayDeityIconKey ? DEITY_SVG[displayDeityIconKey] : undefined} />
              </>
            );
          })()}
        </div>
      </main>

      {/* Floating action buttons */}
      <div className="cs__actions">
        {id && (
          <button className="cs__action-btn cs__back" type="button" onClick={() => navigate(-1)} data-tooltip="Go Back" data-tooltip-pos="right">
            <BackArrow width="16" height="16" />
          </button>
        )}
        {char.document && (
          <a className="cs__action-btn" href={char.document} target="_blank" rel="noopener noreferrer" data-tooltip="View Document" data-tooltip-pos={isOwnProfile ? 'right' : 'left'}>
            <Document width="16" height="16" />
          </a>
        )}
        {isOwnProfile && !id && (
          <button className="cs__action-btn" type="button" data-tooltip="Edit Character" data-tooltip-pos="left" onClick={() => setEditOpen(true)}>
            <EditPencil width="16" height="16" />
          </button>
        )}
      </div>

      {/* Edit modal */}
      {editOpen && char && (
        <EditCharacterModal
          char={char}
          onClose={() => setEditOpen(false)}
          onSaved={(fields) => {
            setEditOpen(false);
            if (Object.keys(fields).length > 0) {
              setSaving(true);
              patchCharacter(char.characterId, fields)
                .then(() => refreshUser())
                .finally(() => setSaving(false));
            }
          }}
        />
      )}

      {/* Saving overlay */}
      {saving && (
        <div className="cs__saving-overlay">
          <div className="app-loader__ring" />
        </div>
      )}
    </div>
  );
}

export default CharacterInfo;
