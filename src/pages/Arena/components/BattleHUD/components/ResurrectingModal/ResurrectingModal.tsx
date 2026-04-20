import React from 'react';
import './ResurrectingModal.scss';
import { Theme25 } from '../../../../../../types/character';
import { colorMix, darken, lightenColor, rgbToHex, rgbValues } from '../../../../../../utils/color';

/**
 * Modal for the self-resurrect overlay (Hades Death Keeper):
 * Contains the sigil, flames, title, and name.
 * Styles: ResurrectingModal.scss (.bhud__resurrect-*).
 */
export default function ResurrectingModal({ name, byHadesWish, theme }: { name?: string, byHadesWish?: boolean, theme?: Theme25 }) {
  const colorStyle = {
    '--resurrect': byHadesWish && theme ? rgbValues(rgbToHex(theme[0])) : rgbValues(rgbToHex('#7e57c2')),
    '--resurrect-background': byHadesWish && theme ? rgbValues(darken(theme[0], 0.65)) : rgbValues(rgbToHex('#1a0a2e')),
    '--resurrect-shadow': byHadesWish && theme ? rgbValues(darken(theme[0], 0.38)) : rgbValues(rgbToHex('#4a148c')),
    '--resurrect-text': byHadesWish && theme ? rgbValues(lightenColor(theme[0], 0.75)) : rgbValues(rgbToHex('#ce93d8')),
    '--resurrect-title': byHadesWish && theme ? rgbValues(lightenColor(theme[0], 0.6)) : rgbValues(rgbToHex('#b39ddb')),
    '--resurrect-glow': byHadesWish && theme ? rgbValues(colorMix(theme[0], '#ffffff', 0.5)) : rgbValues(rgbToHex('#9c27b0')),
  } as React.CSSProperties;

  return (
    <div
      className="bhud__resurrect-overlay"
      style={colorStyle}
    >
      <div className="bhud__resurrect-sigil" />
      <div className="bhud__resurrect-title" >Resurrecting...</div>
      {name && <div className="bhud__resurrect-name" >{name}</div>}
      <div className="bhud__resurrect-flames" aria-hidden="true" >
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="bhud__resurrect-flame" />
        ))}
      </div>
    </div >
  );
}