import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { FC } from 'react';
import type { FighterState } from '../../../../../../types/battle';
import { PANEL_SIDE, type PanelSide } from '../../../../../../constants/battle';
import { EFFECT_TAGS } from '../../../../../../constants/effectTags';
import { getImprecatedPoemCurse as getImprecatedPoemCurseShared } from '../../../../../../data/imprecatedPoemCurse';
import HealingNullifiedIcon from './icons/HealingNullifiedIcon';
import DisorientedIcon from './icons/DisorientedIcon';
import EternalAgonyIcon from './icons/EternalAgonyIcon';
import './PoemSelectModal.scss';

export interface PoemConfig {
  labelEn: string;
  labelTh: string;
  effectTh: string;
  icon: FC<{ className?: string }>;
  poem?: string;
}

export const POEM_VERSE_INFO: Record<string, PoemConfig> = {
  [EFFECT_TAGS.HEALING_NULLIFIED]: {
    labelEn: 'Healing Nullified',
    labelTh: 'สูญสิ้นเยียวยา',
    effectTh: 'ผลการฟื้นฟู HP ที่ผู้ต้องสาปได้รับจะไม่มีผลใด ๆ',
    icon: HealingNullifiedIcon,
    poem: getImprecatedPoemCurseShared([EFFECT_TAGS.HEALING_NULLIFIED]),
  },
  [EFFECT_TAGS.DISORIENTED]: {
    labelEn: 'Disoriented',
    labelTh: 'ดวงเนตรเลือนพร่า',
    effectTh: 'ผู้ต้องสาปจะไม่สามารถเลือกเป้าหมายในการโจมตีหรือใช้พลังใด ๆ ได้ รวมทั้งยังทำให้โอกาสที่การกระทำของผู้ต้องสาปจะไร้ผลในอัตรา 25%',
    icon: DisorientedIcon,
    poem: getImprecatedPoemCurseShared([EFFECT_TAGS.DISORIENTED]),
  },
  [EFFECT_TAGS.ETERNAL_AGONY]: {
    labelEn: 'Eternal Agony',
    labelTh: 'ทุกขาอนันต์',
    effectTh: 'ระยะเวลาของสถานะผิดปกติที่ต้องสาปมีทั้งหมดจะขยายออกไปอีก 2 รอบ จากนั้นฤทธิ์ของบทกลอนจะสิ้นลงทันที',
    icon: EternalAgonyIcon,
    poem: getImprecatedPoemCurseShared([EFFECT_TAGS.ETERNAL_AGONY]),
  },
};

export function getImprecatedPoemCurse(poemTags: string[]): string {
  return getImprecatedPoemCurseShared(poemTags);
}

const POEM_VERSE_ORDER = [EFFECT_TAGS.HEALING_NULLIFIED, EFFECT_TAGS.DISORIENTED, EFFECT_TAGS.ETERNAL_AGONY] as const;

/* ── Portal tooltip: poem detail panel ── */
function PoemTooltip({
  anchorEl,
  poemTag,
  themeColor,
  themeColorDark,
}: {
  anchorEl: HTMLElement;
  poemTag: string;
  themeColor?: string;
  themeColorDark?: string;
}) {
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const rect = anchorEl.getBoundingClientRect();
    const tipW = tipRef.current?.offsetWidth ?? 180;
    let left = rect.left + rect.width / 2 - tipW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
    setPos({ top: rect.top - 3, left });
  }, [anchorEl]);

  const info = POEM_VERSE_INFO[poemTag];

  return createPortal(
    <div
      ref={tipRef}
      className={`poem-tip ${pos ? 'poem-tip--visible' : ''}`}
      style={{
        '--modal-primary': themeColor,
        '--modal-dark': themeColorDark,
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
      } as React.CSSProperties}
    >
      <div className="poem-tip__inner">
        <span className="poem-tip__title">{info?.labelTh ?? ''}</span>
        <p className="poem-tip__effect-th">{info?.effectTh ?? ''}</p>
        <span className="poem-tip__scope">ศัตรู 1 เป้าหมาย · 2 รอบ</span>
      </div>
    </div>,
    document.body,
  );
}

interface Props {
  attacker: FighterState;
  isMyTurn: boolean;
  phase: string;
  themeColor?: string;
  themeColorDark?: string;
  side?: PanelSide;
  onSelectPoem: (poemTag: string) => void;
  onBack?: () => void;
}

export default function PoemSelectModal({
  attacker,
  isMyTurn,
  phase,
  themeColor,
  themeColorDark,
  side = PANEL_SIDE.LEFT,
  onSelectPoem,
  onBack,
}: Props) {
  const [selectedVerse, setSelectedVerse] = useState<string | null>(null);
  const [hoveredVerse, setHoveredVerse] = useState<string | null>(null);
  const [hoveredEl, setHoveredEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSelectedVerse(null);
    setHoveredVerse(null);
    setHoveredEl(null);
  }, [phase]);

  const handleEnter = useCallback((tag: string, el: HTMLElement) => {
    setHoveredVerse(tag);
    setHoveredEl(el);
  }, []);

  const handleLeave = useCallback(() => {
    setHoveredVerse(null);
    setHoveredEl(null);
  }, []);

  const themeStyle = {
    '--modal-primary': themeColor,
    '--modal-dark': themeColorDark,
  } as React.CSSProperties;

  if (!isMyTurn) {
    return (
      <div className="bhud__dice-modal" style={themeStyle}>
        <span className="bhud__dice-label">Choosing Verse</span>
        <span className="bhud__dice-sub">{attacker.nicknameEng} is deciding...</span>
        <div className="bhud__dice-roller bhud__dice-roller--waiting">
          <div className="bhud__roll-waiting-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="bhud__action-modal bhud__action-modal--poem" style={themeStyle}>
      <span className="bhud__dice-label">Choose Poem Verse</span>
      <span className="bhud__dice-sub">Imprecated Poem</span>

      <div className="bhud__poem-picker">
        {POEM_VERSE_ORDER.map((tag) => {
          const info = POEM_VERSE_INFO[tag];
          const IconComponent = info?.icon;
          const selected = selectedVerse === tag;
          return (
            <button
              key={tag}
              type="button"
              className={`bhud__poem-btn ${selected ? 'bhud__poem-btn--selected' : ''}`}
              onMouseEnter={(e) => handleEnter(tag, e.currentTarget)}
              onMouseLeave={handleLeave}
              onClick={() => setSelectedVerse(selected ? null : tag)}
            >
              <span className="bhud__poem-icon">
                {IconComponent && <IconComponent />}
              </span>
              <span className="bhud__poem-labels">
                <span className="bhud__poem-label-th">{info?.labelTh ?? ''}</span>
                <span className="bhud__poem-label-en">{info?.labelEn ?? tag}</span>
              </span>
            </button>
          );
        })}
      </div>

      {hoveredVerse && hoveredEl && (
        <PoemTooltip
          anchorEl={hoveredEl}
          poemTag={hoveredVerse}
          themeColor={themeColor}
          themeColorDark={themeColorDark}
        />
      )}

      <div className="bhud__power-actions">
        {onBack && (
          <button type="button" className="bhud__power-back" onClick={onBack}>
            Back
          </button>
        )}
        <button
          type="button"
          className="bhud__power-confirm"
          disabled={selectedVerse == null}
          onClick={() => {
            if (selectedVerse) onSelectPoem(selectedVerse);
          }}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
