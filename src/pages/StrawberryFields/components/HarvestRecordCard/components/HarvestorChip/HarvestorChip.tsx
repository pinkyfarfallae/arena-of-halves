import exp from "constants";
import React from "react";
import { hexToRgb } from "../../../../../../utils/color";
import { Character } from "../../../../../../types/character";
import './HarvestorChip.scss';

export default function HarvestorChip({ character }: { character: Character | undefined }) {
  return (
    <div
      className="strawberry-fields__harvest-record-submitter-avatar-wrapper"
      data-tooltip={character?.nicknameEng || "Unknown"}
      data-tooltip-pos="bottom"
      style={{
        '--avatar-border-color': hexToRgb(character?.theme[0] || '#000000'),
      } as React.CSSProperties}
    >
      { (character && character.image) ? (
        <img
        src={character?.image || ''}
        className="strawberry-fields__harvest-record-submitter-avatar"
      />
      ) : (
        <div className="strawberry-fields__harvest-record-submitter-avatar-placeholder">
          ?
        </div>
      )}
    </div>
  );
}