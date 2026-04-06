import { useState, useCallback, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchWishes, WISHES_FALLBACK, saveIrisWish, fetchTodayIrisWishes, fetchTodayIrisWish } from '../../data/wishes';
import { DEITY_SVG, toDeityKey } from '../../data/deities';
import { useAuth } from '../../hooks/useAuth';
import type { Wish } from '../../types/wish';
import Drachma from '../../icons/Drachma';
import FountainIllustration from './components/FountainIllustration/FountainIllustration';
import CoinCircle from './icons/CoinCircle';
import Refresh from './icons/Refresh';
import DoorExit from './icons/DoorExit';
import { Phase, ORB_SCATTER, IRIS_PHASE } from './constants/iris';
import { applyWishEffect } from '../../services/irisWish/applyWishesEffect';
import './IrisMessage.scss';

interface Props {
  retossable?: boolean;
  embedded?: boolean;
  isAdmin?: boolean;
}

function IrisMessage({ retossable = false, embedded = false, isAdmin = false }: Props) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>(IRIS_PHASE.IDLE);
  const [wish, setWish] = useState<Wish | null>(null);
  const [discovered, setDiscovered] = useState<Set<string>>(new Set());
  const [wishes, setWishes] = useState<Wish[]>(WISHES_FALLBACK);
  const [loading, setLoading] = useState(true);

  const [userTodayWish, setUserTodayWish] = useState<Wish | null>(null);

  useEffect(() => {

    let isMounted = true;

    const loadData = async () => {
      try {
        const fetchedWishes = await fetchWishes().catch(() => WISHES_FALLBACK);

        if (!isMounted) return;
        setWishes(fetchedWishes);

        if (isAdmin) {
          setDiscovered(new Set());
          return;
        }

        const [todayWishes, userWish] = await Promise.all([
          fetchTodayIrisWishes().catch(() => [] as Wish[]),
          fetchTodayIrisWish(user?.characterId || ''),
        ]);

        if (!isMounted) return;

        const matchedWish = userWish
          ? fetchedWishes.find(w => w.deity === userWish.deity) || null
          : null;

        setUserTodayWish(matchedWish);

        const allDeities = new Set([
          ...todayWishes.map(w => w.deity),
          ...(userWish ? [userWish.deity] : []),
        ]);

        setDiscovered(allDeities);

        if (userWish) {
          const matched = fetchedWishes.find(w => w.deity === userWish.deity);
          if (matched) {
            setWish(matched);
            setPhase(IRIS_PHASE.REVEAL);
          }
        }

      } catch (err) {
        console.error('Failed to load wishes:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [user?.characterId, isAdmin]);

  const deityOrder = wishes.map(w => w.deity).slice(0, ORB_SCATTER.length);

  const toss = useCallback(() => {
    if (phase === IRIS_PHASE.TOSSING) return;

    if (!isAdmin && userTodayWish) return;

    const pick = wishes[Math.floor(Math.random() * wishes.length)];
    
    setWish(pick);
    setPhase(IRIS_PHASE.TOSSING);

    if (!isAdmin && user?.characterId) {
      saveIrisWish(user.characterId, pick.deity).catch((err) => {
        console.error('Failed to save Iris wish:', err);
      });
    }

    setTimeout(() => {
      setPhase(IRIS_PHASE.REVEAL);

      if (!isAdmin) {
        setDiscovered(prev => new Set(prev).add(pick.deity));
        applyWishEffect(pick, user?.characterId || '');
      }
    }, 2200);
  }, [phase, wishes, user?.characterId, isAdmin, userTodayWish]);

  const reset = useCallback(() => {
    setPhase(IRIS_PHASE.IDLE);
    setWish(null);
  }, []);

  const deityLabel = useMemo(() => wish?.deity ?? '', [wish]);

  return (
    <>
      <div className={`iris iris--${phase}${embedded ? ' iris--embedded' : ''}`}>
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
            const isActive = wish?.deity === deity && phase === IRIS_PHASE.REVEAL;
            return (
              <div
                key={deity}
                className={`iris__orb ${found ? 'iris__orb--found' : ''} ${isActive ? 'iris__orb--active' : ''}`}
                style={{ top: `${t}%`, left: `${l}%`, '--i': i } as React.CSSProperties}
              >
                <div className="iris__orb-icon">
                  {(() => { const k = toDeityKey(deity); return k ? DEITY_SVG[k] : null; })()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rainbow ring burst + convergence flash */}
        {phase === IRIS_PHASE.TOSSING && (
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
              {phase !== IRIS_PHASE.REVEAL && (
                <div className={`iris__coin ${phase === IRIS_PHASE.TOSSING ? 'iris__coin--drop' : ''}`}>
                  <div className="iris__coin-inner">
                    <Drachma />
                  </div>
                </div>
              )}

              {/* Fountain structure */}
              <FountainIllustration />

              {/* Ripples */}
              {phase === IRIS_PHASE.TOSSING && (
                <div className="iris__ripples">
                  <div className="iris__ripple" />
                  <div className="iris__ripple iris__ripple--2" />
                  <div className="iris__ripple iris__ripple--3" />
                </div>
              )}
            </div>

            {/* Idle + Tossing — prompt fades out via CSS, keeps layout stable */}
            {phase !== IRIS_PHASE.REVEAL && (
              <div className="iris__prompt">
                <span className="iris__label">Fountain of Iris</span>
                <h1 className="iris__title">Make a Wish</h1>
                <p className="iris__sub">
                  Toss a golden drachma into the rainbow mist and receive a blessing from the gods.
                </p>
                <button
                  className={`iris__btn ${loading ? 'iris__btn--loading' : ''}`}
                  onClick={toss}
                  disabled={phase === IRIS_PHASE.TOSSING}
                >
                  <span className="iris__btn-icon">
                    <CoinCircle />
                  </span>
                  {loading ? 'Recognizing You...' : 'Toss a Drachma'}
                </button>
              </div>
            )}

            {/* Reveal — Tarot card */}
            {phase === IRIS_PHASE.REVEAL && wish && (
              <div className="iris__card" data-deity={wish.deity.toLowerCase()}>
                <div className="iris__card-glow" />
                <div className="iris__card-frame">
                  <div className="iris__card-inner">
                    <div className="iris__card-icon">
                      {(() => { const k = toDeityKey(wish.deity); return k ? DEITY_SVG[k] : null; })()}
                    </div>
                    <div className="iris__card-deity">
                      <span className="iris__card-diamond">◆</span>
                      {deityLabel}
                      <span className="iris__card-diamond">◆</span>
                    </div>
                    <h2 className="iris__card-name">{wish.name}</h2>
                    <div className="iris__card-divider" />
                    <p className="iris__card-desc">{wish.description.replace(/\\n/g, '\n')}</p>
                    {retossable && (
                      <button className="iris__btn-again" onClick={reset}>
                        <Refresh />
                        Toss Again
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Flavor footer */}
          <p className="iris__flavor">
            The fountain shimmers with every color of the rainbow. Each drachma carries a prayer — and the gods always answer, though not always as you'd expect.
          </p>
        </div>

        {/* Back button */}
        {!embedded && (
          <Link to="/life" className="iris__back" data-tooltip="Back to Camp" data-tooltip-pos="left">
            <DoorExit />
          </Link>
        )}
      </div>
    </>
  );
}

export default IrisMessage;
