import React from 'react';
import './Background.scss';

export const BG_ELEMENTS = (
  <>
    {/* Light rays */}
    <div className="training-stats__light-rays" />

    {/* Animated pattern */}
    <div className="training-stats__pattern" />

    {/* Floating dust */}
    <div className="training-stats__dust" />

    {/* Magical orbs */}
    <div className="training-stats__orbs">
      <div className="orb" />
      <div className="orb" />
      <div className="orb" />
      <div className="orb" />
      <div className="orb" />
    </div>

    {/* Header decorative elements */}
    <div className="training-stats__header-particles">
      <div className="particle" />
      <div className="particle" />
      <div className="particle" />
      <div className="particle" />
      <div className="particle" />
      <div className="particle" />
    </div>

    <div className="training-stats__header-sparkles">
      <div className="sparkle" />
      <div className="sparkle" />
      <div className="sparkle" />
      <div className="sparkle" />
      <div className="sparkle" />
      <div className="sparkle" />
      <div className="sparkle" />
      <div className="sparkle" />
    </div>

    <div className="training-stats__header-arcs">
      <div className="arc" />
      <div className="arc" />
      <div className="arc" />
    </div>

    {/* Floating crystals */}
    <div className="training-stats__crystals">
      <div className="crystal" />
      <div className="crystal" />
      <div className="crystal" />
      <div className="crystal" />
      <div className="crystal" />
      <div className="crystal" />
    </div>

    {/* Ancient runes */}
    <div className="training-stats__runes">
      <div className="rune" />
      <div className="rune" />
      <div className="rune" />
      <div className="rune" />
      <div className="rune" />
      <div className="rune" />
    </div>

    {/* Energy pillars */}
    <div className="training-stats__pillars">
      <div className="pillar pillar--left" />
      <div className="pillar pillar--right" />
    </div>

    {/* Starfield */}
    <div className="training-stats__stars" />
    <div className="training-stats__stars training-stats__stars--mid" />
    <div className="training-stats__stars training-stats__stars--slow" />

    {/* Campfire embers */}
    <div className="training-stats__embers">
      {Array.from({ length: 12 }).map((_, i) => (
        <span key={i} className="training-stats__ember" />
      ))}
    </div>

    {/* Campfire glow */}
    <div className="training-stats__campfire" />

    {/* Mist layer */}
    <div className="training-stats__mist" />
    <div className="training-stats__mist training-stats__mist--reverse" />
  </>
);