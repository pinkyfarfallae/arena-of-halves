import exp from "constants";
import React from "react";
import { hexToRgb } from "../../../../../../utils/color";
import { Character } from "../../../../../../types/character";
import './HarvestorChip.scss';

export default function HarvestorChip({ character }: { character: Character }) {
  return (
    <div
      className="strawberry-fields__harvest-record-submitter-avatar-wrapper"
      data-tooltip={character.nicknameEng}
      data-tooltip-pos="bottom"
      style={{
        '--avatar-border-color': hexToRgb(character.theme[0]),
      } as React.CSSProperties}
    >
      <img
        src={character.image}
        className="strawberry-fields__harvest-record-submitter-avatar"
      />
    </div>
  );
}