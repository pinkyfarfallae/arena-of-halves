import Dove from './icons/Dove';
import LaurelLeft from './icons/LaurelLeft';
import LaurelRight from './icons/LaurelRight';
import RoseLeft from './icons/RoseLeft';
import RoseRight from './icons/RoseRight';
import VineLeft from './icons/VineLeft';
import VineRight from './icons/VineRight';
import './FountainIllustration.scss';

export default function FountainIllustration() {
  return (
    <div className="iris__fountain">
      {/* Dove in flight */}
      <div className="iris__dove">
        <Dove />
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
        <LaurelLeft />
      </div>
      <div className="iris__laurel iris__laurel--right">
        <LaurelRight />
      </div>

      {/* Rose accents */}
      <div className="iris__rose iris__rose--left">
        <RoseLeft />
      </div>
      <div className="iris__rose iris__rose--right">
        <RoseRight />
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
        <VineLeft />
      </div>
      <div className="iris__leaves iris__leaves--right">
        <VineRight />
      </div>
    </div>
  );
}
