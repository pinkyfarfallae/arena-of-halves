import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchWishes, WISHES_FALLBACK, Wish } from '../../data/wishes';
import { DEITY_SVG } from '../../data/deities';
import './IrisMessage.scss';

type Phase = 'idle' | 'tossing' | 'reveal';

/* Scattered around the page */
const ORB_SCATTER: [number, number][] = [
  [10, 8],   [7, 72],  [14, 82], [13, 18],  [20, 5],
  [10, 65], [30, 78], [26, 14], [30, 25],  [25, 85],
  [44, 22], [16, 88], [46, 75], [34, 3],  [58, 22],
  [42, 88], [47, 3], [55, 82], [60, 12], [60, 72],
];

function IrisMessage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [wish, setWish] = useState<Wish | null>(null);
  const [discovered, setDiscovered] = useState<Set<string>>(new Set());
  const [wishes, setWishes] = useState<Wish[]>(WISHES_FALLBACK);

  useEffect(() => {
    fetchWishes()
      .then(data => { if (data.length) setWishes(data); })
      .catch(() => {});
  }, []);

  const deityOrder = wishes.map(w => w.deity).slice(0, ORB_SCATTER.length);

  const toss = useCallback(() => {
    if (phase === 'tossing') return;
    const pick = wishes[Math.floor(Math.random() * wishes.length)];
    setWish(pick);
    setPhase('tossing');
    setTimeout(() => {
      setPhase('reveal');
      setDiscovered(prev => new Set(prev).add(pick.deity));
    }, 2200);
  }, [phase, wishes]);

  const reset = useCallback(() => {
    setPhase('idle');
    setWish(null);
  }, []);

  const deityLabel = wish ? wish.deity.charAt(0).toUpperCase() + wish.deity.slice(1) : '';

  return (
    <>
    <div className={`iris iris--${phase}`}>
      {/* Prismatic light rays */}
      <div className="iris__prism" />
      <div className="iris__prism iris__prism--2" />
      <div className="iris__prism iris__prism--3" />

      {/* Rainbow lines across background */}
      <div className="iris__band" />
      <div className="iris__band iris__band--2" />
      <div className="iris__band iris__band--3" />

      {/* Background bubbles */}
      <div className="iris__bg-bubbles">
        <div className="iris__bg-bubble" style={{ left: '8%', animationDuration: '14s', animationDelay: '-2s', width: 44, height: 44 }} />
        <div className="iris__bg-bubble" style={{ left: '22%', animationDuration: '18s', animationDelay: '-7s', width: 32, height: 32 }} />
        <div className="iris__bg-bubble" style={{ left: '38%', animationDuration: '12s', animationDelay: '-4s', width: 56, height: 56 }} />
        <div className="iris__bg-bubble" style={{ left: '55%', animationDuration: '16s', animationDelay: '-10s', width: 38, height: 38 }} />
        <div className="iris__bg-bubble" style={{ left: '70%', animationDuration: '20s', animationDelay: '-1s', width: 50, height: 50 }} />
        <div className="iris__bg-bubble" style={{ left: '85%', animationDuration: '15s', animationDelay: '-6s', width: 28, height: 28 }} />
        <div className="iris__bg-bubble" style={{ left: '15%', animationDuration: '22s', animationDelay: '-13s', width: 62, height: 62 }} />
        <div className="iris__bg-bubble" style={{ left: '48%', animationDuration: '17s', animationDelay: '-9s', width: 34, height: 34 }} />
        <div className="iris__bg-bubble" style={{ left: '92%', animationDuration: '13s', animationDelay: '-3s', width: 40, height: 40 }} />
        <div className="iris__bg-bubble" style={{ left: '62%', animationDuration: '19s', animationDelay: '-15s', width: 52, height: 52 }} />
      </div>

      {/* Background winks */}
      <div className="iris__bg-wink" style={{ top: '12%', left: '10%', animationDelay: '0s' }} />
      <div className="iris__bg-wink" style={{ top: '25%', left: '82%', animationDelay: '-1.5s' }} />
      <div className="iris__bg-wink" style={{ top: '45%', left: '5%', animationDelay: '-3.2s' }} />
      <div className="iris__bg-wink" style={{ top: '60%', left: '90%', animationDelay: '-0.8s' }} />
      <div className="iris__bg-wink" style={{ top: '78%', left: '18%', animationDelay: '-4.5s' }} />
      <div className="iris__bg-wink" style={{ top: '15%', left: '55%', animationDelay: '-2.4s' }} />
      <div className="iris__bg-wink" style={{ top: '82%', left: '72%', animationDelay: '-5.8s' }} />
      <div className="iris__bg-wink" style={{ top: '35%', left: '30%', animationDelay: '-6.2s' }} />

      {/* Deity orbs — background, top half */}
      <div className="iris__orbit">
        {deityOrder.map((deity, i) => {
          const [t, l] = ORB_SCATTER[i] ?? [50, 50];
          const found = discovered.has(deity);
          const isActive = wish?.deity === deity && phase === 'reveal';
          return (
            <div
              key={deity}
              className={`iris__orb ${found ? 'iris__orb--found' : ''} ${isActive ? 'iris__orb--active' : ''}`}
              style={{ top: `${t}%`, left: `${l}%`, '--i': i } as React.CSSProperties}
            >
              <div className="iris__orb-icon">
                {DEITY_SVG[deity]}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rainbow ring burst + convergence flash */}
      {phase === 'tossing' && (
        <>
          <div className="iris__burst" />
          <div className="iris__flash" />
        </>
      )}

      <div className="iris__page">
        {/* Lore header */}
        <div className="iris__lore">
          <div className="iris__lore-line" />
          <p className="iris__lore-quote">
            "O Iris, goddess of the rainbow, accept my offering"
          </p>
          <div className="iris__lore-line" />
        </div>

        <div className="iris__stage">
          {/* Fountain */}
          <div className="iris__center">
            {/* Coin (above fountain) */}
            {phase !== 'reveal' && (
              <div className={`iris__coin ${phase === 'tossing' ? 'iris__coin--drop' : ''}`}>
                <div className="iris__coin-inner">
                  <svg viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.2" />
                    <circle cx="24" cy="24" r="15" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
                    <path d="M18 17l6-3 6 3M18 31l6 3 6-3" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="24" cy="24" r="6" stroke="currentColor" strokeWidth="0.7" />
                    <circle cx="24" cy="24" r="2" fill="currentColor" opacity="0.4" />
                  </svg>
                </div>
              </div>
            )}

            {/* Fountain structure */}
            <div className="iris__fountain">
              {/* Dove in flight */}
              <div className="iris__dove">
                <svg viewBox="0 0 40 32" fill="none">
                  {/* Body */}
                  <ellipse cx="20" cy="20" rx="7" ry="5" fill="currentColor" opacity="0.5" />
                  {/* Head */}
                  <circle cx="27" cy="16" r="3.5" fill="currentColor" opacity="0.5" />
                  {/* Beak */}
                  <path d="M30 16l3-0.5-3 1.5z" fill="currentColor" opacity="0.6" />
                  {/* Eye */}
                  <circle cx="28.5" cy="15.5" r="0.7" fill="currentColor" opacity="0.9" />
                  {/* Left wing up */}
                  <path d="M18 18C14 14 8 10 4 6c2 5 6 10 12 14z" fill="currentColor" opacity="0.4" />
                  <path d="M16 17C12 12 6 8 2 4" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
                  {/* Right wing up */}
                  <path d="M22 18C24 12 28 6 34 2c-4 5-8 10-10 16z" fill="currentColor" opacity="0.35" />
                  {/* Tail feathers */}
                  <path d="M13 22c-3 1-5 3-7 5 3-1 5-2 8-3z" fill="currentColor" opacity="0.35" />
                  <path d="M13 23c-2 2-4 4-5 7 2-2 4-4 6-5z" fill="currentColor" opacity="0.25" />
                  {/* Olive branch in beak */}
                  <path d="M31 16.5c2 1 4 2 6 2" stroke="#8db88a" strokeWidth="0.6" opacity="0.6" />
                  <ellipse cx="36" cy="17" rx="2" ry="1" fill="#8db88a" opacity="0.4" transform="rotate(-15 36 17)" />
                  <ellipse cx="34" cy="18.5" rx="1.5" ry="0.8" fill="#8db88a" opacity="0.35" transform="rotate(10 34 18.5)" />
                </svg>
              </div>

              {/* Water jet shooting up */}
              <div className="iris__jet">
                <div className="iris__jet-mist" />
                <div className="iris__jet-stream" />
                <div className="iris__jet-spray" />
                <div className="iris__jet-spray iris__jet-spray--2" />
                <div className="iris__jet-spray iris__jet-spray--3" />
                <div className="iris__jet-spray iris__jet-spray--4" style={{ '--sx': '10px' } as React.CSSProperties} />
                <div className="iris__jet-spray iris__jet-spray--5" style={{ '--sx': '-12px' } as React.CSSProperties} />
                <div className="iris__jet-spray iris__jet-spray--6" style={{ '--sx': '6px' } as React.CSSProperties} />
              </div>

              {/* Water jet falling down */}
              <div className="iris__jet iris__jet--fall">
                <div className="iris__jet-stream" />
                <div className="iris__jet-spray" />
                <div className="iris__jet-spray iris__jet-spray--2" />
                <div className="iris__jet-spray iris__jet-spray--3" />
              </div>

              {/* Basin with water */}
              <div className="iris__basin">
                <div className="iris__basin-rim" />
                <div className="iris__basin-body">
                  <div className="iris__water">
                    <div className="iris__water-surface" />
                    <div className="iris__water-fill" />
                    <div className="iris__water-rainbow" />
                    <div className="iris__water-shimmer" />
                  </div>
                  {/* Splash particles along rim */}
                  <div className="iris__splash">
                    <div className="iris__splash-drop" style={{ left: '12%' }} />
                    <div className="iris__splash-drop iris__splash-drop--2" />
                    <div className="iris__splash-drop iris__splash-drop--3" />
                    <div className="iris__splash-drop iris__splash-drop--4" />
                    <div className="iris__splash-drop iris__splash-drop--5" />
                    <div className="iris__splash-drop iris__splash-drop--6" />
                    <div className="iris__splash-drop iris__splash-drop--7" />
                    <div className="iris__splash-drop iris__splash-drop--8" />
                    {/* Side arcs */}
                    <div className="iris__splash-arc iris__splash-arc--left" />
                    <div className="iris__splash-arc iris__splash-arc--left-2" />
                    <div className="iris__splash-arc iris__splash-arc--right" />
                    <div className="iris__splash-arc iris__splash-arc--right-2" />
                  </div>
                  <div className="iris__basin-wave" />
                </div>
              </div>

              {/* Laurel branches flanking basin */}
              <div className="iris__laurel iris__laurel--left">
                <svg viewBox="0 0 40 80" fill="none">
                  {/* Main stem */}
                  <path d="M34 76C30 56 24 32 20 8" stroke="currentColor" strokeWidth="1" opacity="0.45" />
                  {/* Leaves — alternating left/right along stem */}
                  <ellipse cx="22" cy="12" rx="8" ry="3.5" transform="rotate(-35 22 12)" fill="currentColor" opacity="0.35" />
                  <ellipse cx="26" cy="14" rx="6" ry="2.5" transform="rotate(-45 26 14)" fill="currentColor" opacity="0.2" />
                  <ellipse cx="18" cy="20" rx="8" ry="3.5" transform="rotate(-15 18 20)" fill="currentColor" opacity="0.4" />
                  <ellipse cx="24" cy="24" rx="7" ry="3" transform="rotate(-40 24 24)" fill="currentColor" opacity="0.3" />
                  <ellipse cx="20" cy="30" rx="8" ry="3.5" transform="rotate(-25 20 30)" fill="currentColor" opacity="0.38" />
                  <ellipse cx="25" cy="34" rx="7" ry="3" transform="rotate(-42 25 34)" fill="currentColor" opacity="0.25" />
                  <ellipse cx="22" cy="40" rx="7" ry="3" transform="rotate(-20 22 40)" fill="currentColor" opacity="0.35" />
                  <ellipse cx="26" cy="44" rx="6" ry="2.5" transform="rotate(-38 26 44)" fill="currentColor" opacity="0.22" />
                  <ellipse cx="24" cy="50" rx="7" ry="3" transform="rotate(-28 24 50)" fill="currentColor" opacity="0.3" />
                  <ellipse cx="28" cy="54" rx="6" ry="2.5" transform="rotate(-35 28 54)" fill="currentColor" opacity="0.18" />
                  <ellipse cx="27" cy="62" rx="6" ry="2.5" transform="rotate(-30 27 62)" fill="currentColor" opacity="0.22" />
                  {/* Leaf veins */}
                  <path d="M18 20l-4-1M20 30l-5-0.5M22 40l-4-1" stroke="currentColor" strokeWidth="0.3" opacity="0.25" />
                </svg>
              </div>
              <div className="iris__laurel iris__laurel--right">
                <svg viewBox="0 0 40 80" fill="none">
                  <path d="M6 76C10 56 16 32 20 8" stroke="currentColor" strokeWidth="1" opacity="0.45" />
                  <ellipse cx="18" cy="12" rx="8" ry="3.5" transform="rotate(35 18 12)" fill="currentColor" opacity="0.35" />
                  <ellipse cx="14" cy="14" rx="6" ry="2.5" transform="rotate(45 14 14)" fill="currentColor" opacity="0.2" />
                  <ellipse cx="22" cy="20" rx="8" ry="3.5" transform="rotate(15 22 20)" fill="currentColor" opacity="0.4" />
                  <ellipse cx="16" cy="24" rx="7" ry="3" transform="rotate(40 16 24)" fill="currentColor" opacity="0.3" />
                  <ellipse cx="20" cy="30" rx="8" ry="3.5" transform="rotate(25 20 30)" fill="currentColor" opacity="0.38" />
                  <ellipse cx="15" cy="34" rx="7" ry="3" transform="rotate(42 15 34)" fill="currentColor" opacity="0.25" />
                  <ellipse cx="18" cy="40" rx="7" ry="3" transform="rotate(20 18 40)" fill="currentColor" opacity="0.35" />
                  <ellipse cx="14" cy="44" rx="6" ry="2.5" transform="rotate(38 14 44)" fill="currentColor" opacity="0.22" />
                  <ellipse cx="16" cy="50" rx="7" ry="3" transform="rotate(28 16 50)" fill="currentColor" opacity="0.3" />
                  <ellipse cx="12" cy="54" rx="6" ry="2.5" transform="rotate(35 12 54)" fill="currentColor" opacity="0.18" />
                  <ellipse cx="13" cy="62" rx="6" ry="2.5" transform="rotate(30 13 62)" fill="currentColor" opacity="0.22" />
                  <path d="M22 20l4-1M20 30l5-0.5M18 40l4-1" stroke="currentColor" strokeWidth="0.3" opacity="0.25" />
                </svg>
              </div>

              {/* Rose accents */}
              <div className="iris__rose iris__rose--left">
                <svg viewBox="0 0 30 40" fill="none">
                  {/* Stem */}
                  <path d="M15 18v18" stroke="#6a9a62" strokeWidth="1" opacity="0.5" />
                  {/* Leaves on stem */}
                  <path d="M15 26c-4-1-6 0-7 2 2 0 5-0.5 7-2z" fill="#8db88a" opacity="0.45" />
                  <path d="M15 30c3-2 6-1 7 0-2 1-5 1-7 0z" fill="#8db88a" opacity="0.35" />
                  {/* Outer petals */}
                  <path d="M15 10c-3-1-6 0-7 3 0 3 2 5 5 5z" fill="currentColor" opacity="0.3" />
                  <path d="M15 10c3-1 6 0 7 3 0 3-2 5-5 5z" fill="currentColor" opacity="0.35" />
                  <path d="M15 6c-2-2-5-2-6 1 0 3 3 5 6 4z" fill="currentColor" opacity="0.25" />
                  <path d="M15 6c2-2 5-2 6 1 0 3-3 5-6 4z" fill="currentColor" opacity="0.3" />
                  {/* Inner petals */}
                  <path d="M15 8c-1-2-3-2-4 0 0 2 2 4 4 3z" fill="currentColor" opacity="0.45" />
                  <path d="M15 8c1-2 3-2 4 0 0 2-2 4-4 3z" fill="currentColor" opacity="0.5" />
                  {/* Center */}
                  <circle cx="15" cy="10" r="1.5" fill="currentColor" opacity="0.4" />
                  {/* Small bud */}
                  <path d="M8 34c-1-2-1-4 1-4s2 2 1 4z" fill="currentColor" opacity="0.25" />
                  <path d="M8 34v3" stroke="#6a9a62" strokeWidth="0.6" opacity="0.35" />
                </svg>
              </div>
              <div className="iris__rose iris__rose--right">
                <svg viewBox="0 0 30 40" fill="none">
                  <path d="M15 18v18" stroke="#6a9a62" strokeWidth="1" opacity="0.5" />
                  <path d="M15 24c4-1 6 0 7 2-2 0-5-0.5-7-2z" fill="#8db88a" opacity="0.45" />
                  <path d="M15 30c-3-2-6-1-7 0 2 1 5 1 7 0z" fill="#8db88a" opacity="0.35" />
                  <path d="M15 10c-3-1-6 0-7 3 0 3 2 5 5 5z" fill="currentColor" opacity="0.35" />
                  <path d="M15 10c3-1 6 0 7 3 0 3-2 5-5 5z" fill="currentColor" opacity="0.3" />
                  <path d="M15 6c-2-2-5-2-6 1 0 3 3 5 6 4z" fill="currentColor" opacity="0.3" />
                  <path d="M15 6c2-2 5-2 6 1 0 3-3 5-6 4z" fill="currentColor" opacity="0.25" />
                  <path d="M15 8c-1-2-3-2-4 0 0 2 2 4 4 3z" fill="currentColor" opacity="0.5" />
                  <path d="M15 8c1-2 3-2 4 0 0 2-2 4-4 3z" fill="currentColor" opacity="0.45" />
                  <circle cx="15" cy="10" r="1.5" fill="currentColor" opacity="0.4" />
                  <path d="M22 32c1-2 1-4-1-4s-2 2-1 4z" fill="currentColor" opacity="0.25" />
                  <path d="M22 32v3" stroke="#6a9a62" strokeWidth="0.6" opacity="0.35" />
                </svg>
              </div>

              {/* Bubbles floating up from water */}
              <div className="iris__bubbles">
                <div className="iris__bubble" />
                <div className="iris__bubble iris__bubble--2" />
                <div className="iris__bubble iris__bubble--3" />
                <div className="iris__bubble iris__bubble--4" />
                <div className="iris__bubble iris__bubble--5" />
                <div className="iris__bubble iris__bubble--6" />
                <div className="iris__bubble iris__bubble--7" />
              </div>

              {/* Sparkle winks */}
              <div className="iris__wink iris__wink--1" />
              <div className="iris__wink iris__wink--2" />
              <div className="iris__wink iris__wink--3" />
              <div className="iris__wink iris__wink--4" />
              <div className="iris__wink iris__wink--5" />

              {/* Decorative ring */}
              <div className="iris__ring" />

              {/* Pedestal */}
              <div className="iris__pedestal">
                <div className="iris__pedestal-cap" />
                <div className="iris__pedestal-neck" />
                <div className="iris__pedestal-cap iris__pedestal-cap--bottom" />
                <div className="iris__pedestal-foot" />
              </div>

              {/* Vine clusters at the foot */}
              <div className="iris__leaves iris__leaves--left">
                <svg viewBox="0 0 36 28" fill="none">
                  <path d="M32 24C26 22 18 16 16 6" stroke="currentColor" strokeWidth="0.7" opacity="0.35" />
                  <path d="M28 22c-3 0-5-2-4-5 2 0 5 2 4 5z" fill="currentColor" opacity="0.35" />
                  <path d="M24 18c-3-1-4-3-2-5 2 0 4 2 2 5z" fill="currentColor" opacity="0.4" />
                  <path d="M20 13c-2-1-3-3-1-5 2 1 3 3 1 5z" fill="currentColor" opacity="0.35" />
                  <path d="M18 8c-2-1-2-4 0-4 1 0 2 2 0 4z" fill="currentColor" opacity="0.25" />
                  <circle cx="30" cy="20" r="1.2" fill="currentColor" opacity="0.2" />
                  <circle cx="32" cy="22" r="1" fill="currentColor" opacity="0.18" />
                </svg>
              </div>
              <div className="iris__leaves iris__leaves--right">
                <svg viewBox="0 0 36 28" fill="none">
                  <path d="M4 24C10 22 18 16 20 6" stroke="currentColor" strokeWidth="0.7" opacity="0.35" />
                  <path d="M8 22c3 0 5-2 4-5-2 0-5 2-4 5z" fill="currentColor" opacity="0.35" />
                  <path d="M12 18c3-1 4-3 2-5-2 0-4 2-2 5z" fill="currentColor" opacity="0.4" />
                  <path d="M16 13c2-1 3-3 1-5-2 1-3 3-1 5z" fill="currentColor" opacity="0.35" />
                  <path d="M18 8c2-1 2-4 0-4-1 0-2 2 0 4z" fill="currentColor" opacity="0.25" />
                  <circle cx="6" cy="20" r="1.2" fill="currentColor" opacity="0.2" />
                  <circle cx="4" cy="22" r="1" fill="currentColor" opacity="0.18" />
                </svg>
              </div>
            </div>

            {/* Ripples */}
            {phase === 'tossing' && (
              <div className="iris__ripples">
                <div className="iris__ripple" />
                <div className="iris__ripple iris__ripple--2" />
                <div className="iris__ripple iris__ripple--3" />
              </div>
            )}
          </div>

          {/* Idle + Tossing — prompt fades out via CSS, keeps layout stable */}
          {phase !== 'reveal' && (
            <div className="iris__prompt">
              <span className="iris__label">Fountain of Iris</span>
              <h1 className="iris__title">Make a Wish</h1>
              <p className="iris__sub">
                Toss a golden drachma into the rainbow mist and receive a blessing from the gods.
              </p>
              <button className="iris__btn" onClick={toss} disabled={phase === 'tossing'}>
                <span className="iris__btn-icon">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                    <circle cx="10" cy="10" r="7" />
                    <circle cx="10" cy="10" r="3" />
                  </svg>
                </span>
                Toss a Drachma
              </button>
            </div>
          )}

          {/* Reveal */}
          {phase === 'reveal' && wish && (
            <div className="iris__card">
              <div className="iris__card-accent" />
              <div className="iris__card-body">
                <div className="iris__card-icon">
                  {DEITY_SVG[wish.deity]}
                </div>
                <span className="iris__card-deity">{deityLabel}</span>
                <h2 className="iris__card-name">{wish.name}</h2>
                <div className="iris__card-rule" />
                <p className="iris__card-desc">{wish.description}</p>
                <button className="iris__btn-again" onClick={reset}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 8a6 6 0 0111.5-2.4M14 8A6 6 0 012.5 10.4" />
                    <polyline points="2 3 2 8 7 8" />
                    <polyline points="14 13 14 8 9 8" />
                  </svg>
                  Toss Again
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Flavor footer */}
        <p className="iris__flavor">
          The fountain shimmers with every color of the rainbow. Each drachma carries a prayer — and the gods always answer, though not always as you'd expect.
        </p>
      </div>
    </div>
    <Link to="/life" className="iris__back" data-tooltip="Back to Camp" data-tooltip-pos="left">
      <svg viewBox="0 0 24 24" fill="none">
        {/* Door frame */}
        <rect x="9" y="3" width="11" height="17" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        {/* Door knob */}
        <circle cx="12" cy="12.5" r="1" fill="currentColor" />
        {/* Arrow exiting door to the left */}
        <path d="M9 12H3M5.5 9.5L3 12l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
    </>
  );
}

export default IrisMessage;
