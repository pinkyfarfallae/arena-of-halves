import React from 'react';
import './ResurrectingModal.scss';

/**
 * Modal for the self-resurrect overlay (Hades Death Keeper):
 * Contains the sigil, flames, title, and name.
 * Styles are in BattleHUD.scss under .bhud__resurrect-overlay, .bhud__resurrect-sigil, etc.
 */
export default function ResurrectingModal({ name }: { name?: string }) {
  return (
    <div className="bhud__resurrect-overlay">
      <div className="bhud__resurrect-sigil" />
      <div className="bhud__resurrect-title">Resurrecting...</div>
      {name && <div className="bhud__resurrect-name">{name}</div>}
      <div className="bhud__resurrect-flames" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="bhud__resurrect-flame" />
        ))}
      </div>
    </div>
  );
}