import { useTranslation } from '../../../../hooks/useTranslation';
import { T } from '../../../../constants/translationKeys';
import CloseIcon from '../../../../icons/Close';
import Drachma from '../../../../icons/Drachma';
import Pencil from '../../../../icons/Pencil';
import Strawberry from '../../../LifeInCamp/components/LocationIcon/icons/Strawberry';
import Campfire from '../../../LifeInCamp/components/LocationIcon/icons/Campfire';
import Basket from '../../../LifeInCamp/components/ActionIcon/icons/Basket';
import { LANGUAGE } from '../../../../constants/language';
import './HarvestRulesModal.scss';

interface HarvestRulesModalProps {
  onClose: () => void;
}

function HarvestRulesModal({ onClose }: HarvestRulesModalProps) {
  const { t, lang } = useTranslation();

  return (
    <div className="harvest-rules-backdrop">
      <div className="harvest-rules-modal">
        {/* Decorative strawberries */}
        <div className="harvest-rules-modal__decor harvest-rules-modal__decor--tl">
          <Strawberry />
        </div>
        <div className="harvest-rules-modal__decor harvest-rules-modal__decor--tr">
          <Strawberry />
        </div>

        <div className="harvest-rules-modal__header">
          <div className="harvest-rules-modal__header-icon">
            <Basket />
          </div>
          <h3
            className="harvest-rules-modal__title"
            style={
              lang === LANGUAGE.THAI
                ? { fontFamily: "Noto Sans Thai, sans-serif", marginTop: '2px' }
                : { fontFamily: "Finger Paint", fontWeight: '600', fontStyle: 'normal', lineHeight: '1.2', letterSpacing: '-0.01em' }
            }
          >
            {t(T.HARVEST_RULES)}
          </h3>
          <button className="harvest-rules-modal__close" onClick={onClose}>
            <CloseIcon width="15" height="15" />
          </button>
        </div>
        <div className="harvest-rules-modal__content">
          {/* Reward box */}
          <div className="harvest-rules-modal__reward-box">
            อัตราค่าตอบแทน
            <span>
              10
              <Drachma className="harvest-rules-modal__drachma-icon" />
            </span>
            ต่อ 200 ตัวอักษร
          </div>

          {/* Section 1 */}
          <div className="harvest-rules-modal__section">
            <div className="harvest-rules-modal__garden-bed">
              <div className="harvest-rules-modal__bed-stake">
                <Strawberry />
              </div>
              <div className="harvest-rules-modal__bed-content">
                <p>สมาชิกค่ายสามารถคิดเนื้อหาโรลเพลย์ได้ตามอัธยาศัย ขอเพียงมีเนื้อหาที่กล่าวถึงการทำกิจกรรมภายในไร่สตรอว์เบอร์รี</p>
              </div>
            </div>
            <div className="harvest-rules-modal__sub-box">
              <p>กิจกรรมในไร่สตรอว์เบอร์รีเป็นไปได้ตั้งแต่ มาทำไร่ เดินเล่นชมไร่ เก็บสตรอว์เบอร์รี เป็นเวรยามมาเฝ้าระวังหรือบังเอิญเกิดเหตุและไปประสบเข้าพอดี</p>
            </div>
          </div>


          {/* Section 2 */}
          <div className="harvest-rules-modal__section">
            <div className="harvest-rules-modal__garden-bed">
              <div className="harvest-rules-modal__bed-stake">
                <Campfire />
              </div>
              <div className="harvest-rules-modal__bed-content">
                <p>สามารถส่งได้ทั้งโรลเพลย์เดี่ยวและโรลเพลย์กลุ่ม ไม่จำกัดจำนวนคน</p>
              </div>
            </div>
            <div className="harvest-rules-modal__sub-box">
              <p>หากโรลเพลย์แบบกลุ่ม จะได้เงินรวมกัน เช่น 50 เมนชั่น ทุกคนจะได้ 500 ดรัคมาเท่ากัน</p>
            </div>
            <div className="harvest-rules-modal__sub-box">
              <p>หากโรลเพลย์คนเดียว อัตราค่าตอบแทนจะเพิ่มขึ้นเป็น 1.5 เท่า</p>
            </div>
          </div>

          {/* Section 3 */}
          <div className="harvest-rules-modal__section">
            <div className="harvest-rules-modal__garden-bed">
              <div className="harvest-rules-modal__bed-stake">
                <Pencil />
              </div>
              <div className="harvest-rules-modal__bed-content">
                <p>การเปิดเธรดโรลเพลย์สามารถตกแต่งตามอัธยาศัย ขอเพียงติด #HBxCCss2</p>
              </div>
            </div>
          </div>

          {/* Note section */}
          <div className="harvest-rules-modal__note">
            <p>ในระหว่างการดำเนินเอยู อาจมีบางกิจกรรมหรือเควสบอร์ดที่มีการกล่าวถึงไร่สตรอว์เบอร์รี ขอให้ทุกท่านทำความเข้าใจว่ากิจกรรมอื่น ๆ จะไม่มีความเกี่ยวข้องกับระบบไร่สตรอว์เบอร์รีทั้งสิ้น</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HarvestRulesModal;
