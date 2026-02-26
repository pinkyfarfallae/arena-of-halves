import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchCharacter, fetchPowers, fetchWishes, fetchItemInfo, fetchWeaponInfo, fetchPlayerBag, patchCharacter, Character, Power, WishEntry, ItemInfo, BagEntry } from '../../data/characters';
import EditCharacterModal from './components/EditCharacterModal/EditCharacterModal';
import { applyTheme } from '../../App';
import { DEITY_SVG } from '../../data/deities';
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
import './CharacterInfo.scss';

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
  const [wishes, setWishes] = useState<WishEntry[]>([]);
  const [loadingPowers, setLoadingPowers] = useState(false);
  const [bagItems, setBagItems] = useState<(ItemInfo & BagEntry)[]>([]);
  const [bagWeapons, setBagWeapons] = useState<(ItemInfo & BagEntry)[]>([]);
  const [weaponModal, setWeaponModal] = useState(false);
  const [itemModal, setItemModal] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const charKey = char?.characterId?.toLowerCase() ?? '';
  const displayDeity = DEITY_DISPLAY_OVERRIDES[charKey] ?? char?.deityBlood;
  const powerDeity = POWER_OVERRIDES[charKey] ?? char?.deityBlood;

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
              <TwitterX width="16" height="16" />
            </a>
          )}
          <div className="cs__overlay">
            <h1 className="cs__name">{char.nameEng.split(/\\n|\n/).map((part, i) => (
              i === 0 ? <span key={i}>{part}</span> : <span key={i}><br />{part}</span>
            ))}</h1>
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
                  {unlocked ? <LockOpen className="so__lock-icon" /> : <LockClosed className="so__lock-icon" />}
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
          <div className="cs__trait-row">
            <TraitBox label="Strengths" raw={char.strengths} variant="primary" icon={displayDeity ? DEITY_SVG[displayDeity.toLowerCase()] : undefined} />
            <TraitBox label="Weaknesses" raw={char.weaknesses} variant="accent" icon={displayDeity ? DEITY_SVG[displayDeity.toLowerCase()] : undefined} />
          </div>
          <TraitBox label="Supernatural Abilities" raw={char.abilities} variant="mixed" icon={displayDeity ? DEITY_SVG[displayDeity.toLowerCase()] : undefined} />
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
