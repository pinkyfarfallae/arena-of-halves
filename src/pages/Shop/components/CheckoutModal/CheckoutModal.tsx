import { Link } from 'react-router-dom';
import Drachma from '../../../../icons/Drachma';
import { CartItem } from '../../../../types/shop';
import Close from '../../../../icons/Close';
import './CheckoutModal.scss';
import { PRICE_UNIT } from '../../../../constants/priceUnit';

interface CheckoutModalProps {
  cart: CartItem[];
  drachmaTotal: number;
  giftCardTotal: number;
  paySuccess: boolean;
  paying?: boolean;
  customerName: string;
  onPay: () => void;
  onClose: () => void;
}

function CheckoutModal({ cart, drachmaTotal, giftCardTotal, paySuccess, paying, customerName, onPay, onClose }: CheckoutModalProps) {
  return (
    <div className="checkout__overlay">
      <div className="checkout">
        <button className="checkout__close" onClick={onClose} disabled={paying}>
          <Close />
        </button>

        {paySuccess ? (
          <div className="checkout__success">
            {/* Falling coins */}
            <div className="checkout__coins">
              {Array.from({ length: 12 }).map((_, i) => (
                <Drachma key={i} className="checkout__coin" />
              ))}
            </div>
            <Drachma className="checkout__success-icon" />
            <h2 className="checkout__success-title">Thank you!</h2>
            <p className="checkout__success-msg">Have a nice day in Camp Half-Blood</p>
            <Link to="/life" className="checkout__success-btn">Back to Camp</Link>
          </div>
        ) : (
          <>
            <h1 className="checkout__title">Order Summary</h1>

            <div className="checkout__customer">
              <span className="checkout__customer-label">Customer</span>
              <span className="checkout__customer-name">{customerName}</span>
            </div>

            <div className="checkout__items-head">
              <span>Item</span>
              <span>Qty</span>
              <span>Price</span>
            </div>
            <div className="checkout__items">
              {cart.map(item => (
                <div key={item.itemId} className="checkout__item">
                  <span className="checkout__item-name">{item.name}</span>
                  <span className="checkout__item-qty">{item.quantity}</span>
                  <span className="checkout__item-price" style={{ fontSize: item.priceUnit === PRICE_UNIT.NPC_GIFT_CARD ? '0.7rem' : undefined }}>
                    {(item.price * item.quantity).toFixed(0)} {item.priceUnit === PRICE_UNIT.NPC_GIFT_CARD ? 'Gift Card' : <Drachma />}
                  </span>
                </div>
              ))}
            </div>

            <div className="checkout__total">
              <span>Total</span>
              <span className="checkout__total-amount">{drachmaTotal.toFixed(0)} <Drachma /></span>
            </div>
            {giftCardTotal > 0 && (
              <div className="checkout__total">
                <span>Total Gift Card</span>
                <span
                  className="checkout__total-amount"
                  style={{ fontSize: PRICE_UNIT.NPC_GIFT_CARD === PRICE_UNIT.NPC_GIFT_CARD ? '0.8rem' : undefined }}
                >
                  {giftCardTotal.toFixed(0)} {PRICE_UNIT.NPC_GIFT_CARD === PRICE_UNIT.NPC_GIFT_CARD ? 'Gift Card' : <Drachma />}
                </span>
              </div>
            )}

            <button className="checkout__pay" onClick={onPay} disabled={paying}>
              {paying ? 'Processing...' : 'Complete Payment'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default CheckoutModal;
