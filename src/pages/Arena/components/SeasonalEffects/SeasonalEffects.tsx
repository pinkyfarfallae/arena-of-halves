import { useMemo, useSyncExternalStore } from 'react';
import { SEASON_KEYS, type SeasonKey } from '../../../../data/seasons';
import type { PanelSide } from '../../../../constants/battle';
import './SeasonalEffects.scss';

/** Narrow viewports: fewer layers + stronger hero cues (matches `$bp-compact` / chip particle cull). */
const BP_VFX_LEAN = 600;

function subscribeVfxLean(cb: () => void) {
  const mq = window.matchMedia(`(max-width: ${BP_VFX_LEAN}px)`);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

function getVfxLeanSnapshot() {
  return window.matchMedia(`(max-width: ${BP_VFX_LEAN}px)`).matches;
}

function getServerVfxLeanSnapshot() {
  return false;
}

const MAPLE_PATH =
  'M383.8 351.7c2.5-2.5 105.2-92.4 105.2-92.4l-17.5-7.5c-10-4.9-7.4-11.5-5-17.4 2.4-7.6 20.1-67.3 20.1-67.3s-47.7 10-57.7 12.5c-7.5 2.4-10-2.5-12.5-7.5s-15-32.4-15-32.4-52.6 59.9-55.1 62.3c-10 7.5-20.1 0-17.6-10 0-10 27.6-129.6 27.6-129.6s-30.1 17.4-40.1 22.4c-7.5 5-12.6 5-17.6-5C293.5 72.3 255.9 0 255.9 0s-37.5 72.3-42.5 79.8c-5 10-10 10-17.6 5-10-5-40.1-22.4-40.1-22.4S183.3 182 183.3 192c2.5 10-7.5 17.5-17.6 10-2.5-2.5-55.1-62.3-55.1-62.3S98.1 167 95.6 172s-5 9.9-12.5 7.5C73 177 25.4 167 25.4 167s17.6 59.7 20.1 67.3c2.4 6 5 12.5-5 17.4L23 259.3s102.6 89.9 105.2 92.4c5.1 5 10 7.5 5.1 22.5-5.1 15-10.1 35.1-10.1 35.1s95.2-20.1 105.3-22.6c8.7-.9 18.3 2.5 18.3 12.5S241 512 241 512h30s-5.8-102.7-5.8-112.8 9.5-13.4 18.4-12.5c10 2.5 105.2 22.6 105.2 22.6s-5-20.1-10-35.1 0-17.5 5-22.5z';

const AUTUMN_COLORS = ['#F5A623', '#EDAE49', '#F7C948', '#E8963A', '#FBD87F'];

const PETAL_COLORS = [
  'rgba(255, 255, 255, 0.8)',
  'rgba(255, 183, 197, 0.7)',
  'rgba(255, 210, 220, 0.75)',
  'rgba(255, 228, 235, 0.78)',
];

interface Props {
  season?: SeasonKey;
  side: PanelSide;
  isActive: boolean;
}

/**
 * SeasonalEffects — Displays visual theme effects based on selected season
 * Appears on both sides of the arena field during Ephemeral Season power duration
 */
export default function SeasonalEffects({ season, side, isActive }: Props) {
  const vfxLean = useSyncExternalStore(subscribeVfxLean, getVfxLeanSnapshot, getServerVfxLeanSnapshot);

  const effectClass = useMemo(() => {
    if (!season || !isActive) return '';
    return `seasonal-effects--${season}`;
  }, [season, isActive]);

  if (!isActive || !season) return null;

  const nParticles = vfxLean ? 6 : 12;
  const nAutumnLeaves = vfxLean ? 7 : 15;
  const nAutumnSpores = vfxLean ? 4 : 8;
  const nSummerMotes = vfxLean ? 5 : 10;
  const nSummerEmbers = vfxLean ? 4 : 8;
  const nWinterSparkles = vfxLean ? 5 : 8;
  const nSpringPetals = vfxLean ? 7 : 14;
  const nSpringSparkles = vfxLean ? 10 : 20;
  const nSpringSunDrops = vfxLean ? 10 : 20;
  const nSpringPollen = vfxLean ? 5 : 10;

  return (
    <div
      className={[
        'seasonal-effects',
        effectClass,
        `seasonal-effects--${side}`,
        vfxLean ? 'seasonal-effects--vfx-lean' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Animated particles/effects based on season */}
      <div className="seasonal-effects__particles">
        {Array.from({ length: nParticles }).map((_, i) => (
          <div
            key={i}
            className="seasonal-effects__particle"
            style={{
              '--delay': `${i * 0.3 + (i % 3) * 0.15}s`,
              '--duration': `${3 + (i % 3)}s`,
              '--x': `${5 + (i * 8) % 90}%`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Autumn-specific layers */}
      {season === SEASON_KEYS.AUTUMN && (
        <>
          {/* Falling maple leaf SVGs */}
          <div className="seasonal-effects__leaves">
            {Array.from({ length: nAutumnLeaves }).map((_, i) => (
              <svg
                key={i}
                className="seasonal-effects__leaf"
                viewBox="0 0 512 512"
                style={{
                  '--leaf-delay': `${i * 0.9 + (i % 3) * 0.4}s`,
                  '--leaf-duration': `${8 + (i % 4) * 2}s`,
                  '--leaf-x': `${4 + (i * 9) % 88}%`,
                  '--leaf-size': vfxLean
                    ? `${20 + (i % 3) * 5}px`
                    : `${15 + (i % 3) * 4}px`,
                  color: AUTUMN_COLORS[i % AUTUMN_COLORS.length],
                } as React.CSSProperties}
              >
                <path d={MAPLE_PATH} fill="currentColor" />
              </svg>
            ))}
          </div>

          {!vfxLean && (
            <>
              {/* Wind gust — sweeping streak */}
              <div className="seasonal-effects__wind" />

              {/* Ground leaf pile — accumulated leaves at the bottom */}
              <div className="seasonal-effects__leaf-pile" />
            </>
          )}

          {/* Floating warm spores / dust */}
          <div className="seasonal-effects__spores">
            {Array.from({ length: nAutumnSpores }).map((_, i) => (
              <div
                key={i}
                className="seasonal-effects__spore"
                style={{
                  '--spore-x': `${8 + (i * 12) % 84}%`,
                  '--spore-y': `${15 + (i * 11) % 65}%`,
                  '--spore-delay': `${i * 0.7}s`,
                  '--spore-duration': `${6 + (i % 3) * 2}s`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        </>
      )}

      {/* Summer-specific layers */}
      {season === SEASON_KEYS.SUMMER && (
        <>
          {/* Sun corona — pulsing glow at the top center */}
          <div className="seasonal-effects__corona" />

          {/* Diagonal light shafts — god rays from top */}
          <div className="seasonal-effects__shafts">
            <div className="seasonal-effects__shaft seasonal-effects__shaft--1" />
            <div className="seasonal-effects__shaft seasonal-effects__shaft--2" />
            {!vfxLean && <div className="seasonal-effects__shaft seasonal-effects__shaft--3" />}
          </div>

          {!vfxLean && (
            <>
              {/* Sweeping light beam */}
              <div className="seasonal-effects__beam" />

              {/* Heat distortion at the ground */}
              <div className="seasonal-effects__heat" />
            </>
          )}

          {/* Floating dust motes — lazy golden particles */}
          <div className="seasonal-effects__motes">
            {Array.from({ length: nSummerMotes }).map((_, i) => (
              <div
                key={i}
                className="seasonal-effects__mote"
                style={{
                  '--mote-x': `${6 + (i * 9) % 88}%`,
                  '--mote-y': `${10 + (i * 13) % 75}%`,
                  '--mote-delay': `${i * 0.8}s`,
                  '--mote-duration': `${5 + (i % 4)}s`,
                } as React.CSSProperties}
              />
            ))}
          </div>

          {/* Rising embers / sparks */}
          <div className="seasonal-effects__embers">
            {Array.from({ length: nSummerEmbers }).map((_, i) => (
              <div
                key={i}
                className="seasonal-effects__ember"
                style={{
                  '--ember-delay': `${i * 0.6}s`,
                  '--ember-duration': `${4 + (i % 3)}s`,
                  '--ember-x': `${8 + (i * 11) % 84}%`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        </>
      )}

      {/* Winter-specific layers */}
      {season === SEASON_KEYS.WINTER && (
        <>
          {/* Aurora — color-shifting curtain */}
          <div className="seasonal-effects__aurora">
            <div className="seasonal-effects__aurora-band seasonal-effects__aurora-band--1" />
            <div className="seasonal-effects__aurora-band seasonal-effects__aurora-band--2" />
            <div className="seasonal-effects__aurora-band seasonal-effects__aurora-band--3" />
          </div>

          {/* Frost mist at the ground */}
          <div className="seasonal-effects__frost" />

          {/* Rising white sparkles */}
          <div className="seasonal-effects__sparkles">
            {Array.from({ length: nWinterSparkles }).map((_, i) => (
              <div
                key={i}
                className="seasonal-effects__sparkle"
                style={{
                  '--sparkle-x': `${6 + (i * 12) % 88}%`,
                  '--sparkle-delay': `${i * 0.7}s`,
                  '--sparkle-duration': `${5 + (i % 3) * 2}s`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        </>
      )}

      {/* Spring-specific layers */}
      {season === SEASON_KEYS.SPRING && (
        <>
          {/* Falling cherry blossom petals */}
          <div className="seasonal-effects__petals">
            {Array.from({ length: nSpringPetals }).map((_, i) => (
              <div
                key={i}
                className="seasonal-effects__petal"
                style={{
                  '--petal-delay': `${i * 0.8 + (i % 3) * 0.3}s`,
                  '--petal-duration': `${7 + (i % 4) * 2}s`,
                  '--petal-x': `${3 + (i * 7) % 90}%`,
                  '--petal-size': vfxLean
                    ? `${13 + (i % 3) * 4}px`
                    : `${10 + (i % 3) * 3}px`,
                  '--petal-color': PETAL_COLORS[i % PETAL_COLORS.length],
                } as React.CSSProperties}
              />
            ))}
          </div>

          {/* Flower bloom — pulsing pink glow */}
          <div className="seasonal-effects__bloom" />

          {!vfxLean && <div className="seasonal-effects__carpet" aria-hidden="true" />}

          {/* Rising pink & white sparkles */}
          <div className="seasonal-effects__spring-sparkles">
            {Array.from({ length: nSpringSparkles }).map((_, i) => (
              <div
                key={i}
                className="seasonal-effects__spring-sparkle"
                style={{
                  '--ss-x': `${5 + (i * 10) % 90}%`,
                  '--ss-delay': `${i * 0.6}s`,
                  '--ss-duration': `${5 + (i % 3) * 2}s`,
                  '--ss-color': i % 2 === 0
                    ? 'rgba(255, 255, 255, 1)'
                    : 'rgba(255, 182, 193, 1)',
                } as React.CSSProperties}
              />
            ))}
          </div>

          {/* Yellow sparkles falling from top */}
          <div className="seasonal-effects__sun-drops">
            {Array.from({ length: nSpringSunDrops }).map((_, i) => (
              <div
                key={i}
                className="seasonal-effects__sun-drop"
                style={{
                  '--sd-x': `${4 + (i * 9) % 88}%`,
                  '--sd-delay': `${i * 0.65}s`,
                  '--sd-duration': `${5 + (i % 3) * 2}s`,
                  '--sd-color': i % 3 === 0
                    ? 'rgba(255, 235, 100, 1)'
                    : i % 3 === 1
                      ? 'rgba(255, 220, 80, 1)'
                      : 'rgba(255, 245, 150, 1)',
                } as React.CSSProperties}
              />
            ))}
          </div>

          {/* Floating pollen */}
          <div className="seasonal-effects__pollen">
            {Array.from({ length: nSpringPollen }).map((_, i) => (
              <div
                key={i}
                className="seasonal-effects__pollen-dot"
                style={{
                  '--pollen-x': `${8 + (i * 12) % 84}%`,
                  '--pollen-y': `${12 + (i * 11) % 70}%`,
                  '--pollen-delay': `${i * 0.8}s`,
                  '--pollen-duration': `${6 + (i % 3) * 2}s`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        </>
      )}

      {/* Background glow overlay */}
      <div className="seasonal-effects__glow" />

      {/* Top accent bar */}
      <div className="seasonal-effects__accent-top" />

      {/* Bottom accent bar */}
      <div className="seasonal-effects__accent-bottom" />
    </div>
  );
}
