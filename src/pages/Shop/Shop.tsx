import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Drachma from '../../icons/Drachma';
import { ShopItem, CartItem, fetchShopItems } from './shopData';
import CheckoutModal from './components/CheckoutModal/CheckoutModal';
import ChevronLeft from './icons/ChevronLeft';
import Caduceus from './icons/Caduceus';
import Cart from './icons/Cart';
import SearchIcon from '../../icons/Search';
import Package from './icons/Package';
import InfoCircle from './icons/InfoCircle';
import WingedSandal from './icons/WingedSandal';
import Trash from './icons/Trash';
import CloseIcon from '../../icons/Close';
import Coupon from './icons/Coupon';
import './Shop.scss';

function Shop() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('camp_store_cart');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [tooltip, setTooltip] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const { user } = useAuth();

  // Save cart to localStorage
  useEffect(() => {
    localStorage.setItem('camp_store_cart', JSON.stringify(cart));
  }, [cart]);

  // Fetch items initially and poll every 5 seconds
  useEffect(() => {
    const loadItems = async () => {
      try {
        const data = await fetchShopItems();
        console.log('Shop items loaded:', data);
        setItems(data);
      } catch (error) {
        console.error('Failed to fetch shop items:', error);
      }
    };

    loadItems();

    const interval = setInterval(loadItems, 5000);

    return () => clearInterval(interval);
  }, []);

  const addToCart = useCallback((item: ShopItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.itemId === item.itemId);
      if (existing) {
        if (
          item.stock !== -1 &&
          typeof item.stock === 'number' &&
          existing.quantity >= item.stock
        ) {
          return prev;
        }
        return prev.map(i =>
          i.itemId === item.itemId
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart(prev => prev.filter(i => i.itemId !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart(prev => prev.map(i =>
      i.itemId === itemId ? { ...i, quantity } : i
    ));
  }, [removeFromCart]);

  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handlePay = () => {
    setCart([]);
    localStorage.removeItem('camp_store_cart');
    setPaySuccess(true);
  };

  // Filter items based on search query
  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const limitedItems = filteredItems.filter(i => i.stock !== -1);
  const unlimitedItems = filteredItems.filter(i => i.stock === -1);


  return (
    <div className="shop">
      {/* Compact header */}
      <header className="shop__bar">
        <Link to="/life" className="shop__bar-back">
          <ChevronLeft />
          Camp
        </Link>

        <div className="shop__bar-title">
          <Caduceus className="shop__bar-icon" />
          Hermes' Supply
        </div>

        {/* Drachma balance */}
        <div className="shop__bar-balance">
          <Drachma className="drachma--bar" />
          <span className="shop__bar-amount">{user?.currency?.toLocaleString() ?? '0'}</span>
          <span className="shop__bar-unit">drachma</span>
        </div>

        {/* Mobile cart toggle */}
        <button className="shop__bar-cart" onClick={() => setCartOpen(!cartOpen)}>
          <Cart />
          {totalItems > 0 && <span className="shop__bar-cart-count">{totalItems}</span>}
        </button>
      </header>

      {/* Main content: shelves + cart */}
      <div className="shop__body">
        {/* Scrollable shelves */}
        <main className="shop__shelves">
          <div className="shop__search-wrapper">
            <div className="shop__search">
              <SearchIcon />
              <input
                type="text"
                placeholder="Search items"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="shop__shelf-scroll">
            {/* Limited Items */}
            {limitedItems.length > 0 && (
              <section className="shop__section">
                <div className="shop__section-head">
                  <h2>Limited Edition</h2>
                  <span className="shop__section-count">{limitedItems.length} items</span>
                </div>
                <div className="shop__grid">
                  {limitedItems.map(item => (
                    <div key={item.itemId} className="item">
                      {typeof item.stock === 'number' && item.stock !== -1 && item.stock < 5 && (
                        <span className="item__badge">{item.stock} left</span>
                      )}
                      <button
                        className="item__img"
                        onClick={() => addToCart(item)}
                        disabled={item.stock === 0}
                        type="button"
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            onError={(e) => {
                              console.error(`Image failed to load: ${item.imageUrl}`);
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Package className="item__img-ph" />
                        )}
                      </button>
                      <div className="item__body">
                        <div className="item__plank" />
                        <div className="item__label">
                          {item.description && (
                            <button className="item__info"
                              onMouseEnter={(e) => setTooltip({ id: item.itemId, rect: e.currentTarget.getBoundingClientRect() })}
                              onMouseLeave={() => setTooltip(null)}
                            >
                              <InfoCircle />
                            </button>
                          )}
                          <div className="item__row">
                            <h3 className="item__name">{item.name}</h3>
                          </div>
                          <div className="item__price">{item.price.toFixed(0)} <Drachma /></div>
                          {cart.find(c => c.itemId === item.itemId) ? (
                            <div className="item__qty-control">
                              <button
                                onClick={() => updateQuantity(item.itemId, (cart.find(c => c.itemId === item.itemId)?.quantity || 1) - 1)}
                                disabled={item.stock === 0}
                              >−</button>
                              <input
                                type="number"
                                min="1"
                                max={item.stock !== -1 ? item.stock : undefined}
                                value={cart.find(c => c.itemId === item.itemId)?.quantity || 1}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  if (val > 0) updateQuantity(item.itemId, val);
                                }}
                              />
                              <button
                                onClick={() => {
                                  const current = cart.find(c => c.itemId === item.itemId)?.quantity || 1;
                                  const max = item.stock === -1 ? current + 1 : Number(item.stock);
                                  if (current < max) updateQuantity(item.itemId, current + 1);
                                }}
                                disabled={
                                  item.stock === 0 ||
                                  (
                                    typeof item.stock === 'number' &&
                                    item.stock !== -1 &&
                                    (cart.find(c => c.itemId === item.itemId)?.quantity || 0) >= item.stock
                                  )
                                }
                              >+</button>
                            </div>
                          ) : (
                            <button
                              className="item__add"
                              onClick={() => addToCart(item)}
                              disabled={item.stock === 0}
                            >
                              {item.stock === 0 ? 'Sold Out' : 'Add to Cart'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Unlimited Items */}
            {unlimitedItems.length > 0 && (
              <section className="shop__section">
                <div className="shop__section-head">
                  <h2>Always Available</h2>
                  <span className="shop__section-count">{unlimitedItems.length} items</span>
                </div>
                <div className="shop__grid">
                  {unlimitedItems.map(item => (
                    <div key={item.itemId} className="item">
                      <button
                        className="item__img"
                        onClick={() => addToCart(item)}
                        type="button"
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            onError={(e) => {
                              console.error(`Image failed to load: ${item.imageUrl}`);
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Package className="item__img-ph" />
                        )}
                      </button>
                      <div className="item__body">
                        <div className="item__plank" />
                        <div className="item__label">
                          {item.description && (
                            <button className="item__info"
                              onMouseEnter={(e) => setTooltip({ id: item.itemId, rect: e.currentTarget.getBoundingClientRect() })}
                              onMouseLeave={() => setTooltip(null)}
                            >
                              <InfoCircle />
                            </button>
                          )}
                          <div className="item__row">
                            <h3 className="item__name">{item.name}</h3>
                          </div>
                          <div className="item__price">{item.price.toFixed(0)} <Drachma /></div>
                          {cart.find(c => c.itemId === item.itemId) ? (
                            <div className="item__qty-control">
                              <button
                                onClick={() => updateQuantity(item.itemId, (cart.find(c => c.itemId === item.itemId)?.quantity || 1) - 1)}
                              >−</button>
                              <input
                                type="number"
                                min="1"
                                value={cart.find(c => c.itemId === item.itemId)?.quantity || 1}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  if (val > 0) updateQuantity(item.itemId, val);
                                }}
                              />
                              <button
                                onClick={() => {
                                  const current = cart.find(c => c.itemId === item.itemId)?.quantity || 1;
                                  updateQuantity(item.itemId, current + 1);
                                }}
                              >+</button>
                            </div>
                          ) : (
                            <button
                              className="item__add"
                              onClick={() => addToCart(item)}
                            >
                              Add to Cart
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {items.length === 0 && (
              <div className="shop__empty">
                <WingedSandal />
                <p>Loading wares</p>
              </div>
            )}
          </div>
        </main>

        {/* Cart sidebar */}
        <aside className={`shop__cart ${cartOpen ? 'shop__cart--open' : ''}`}>
          <div className="cart">
            <div className="cart__head">
              <h2 className="cart__title">
                <Cart />
                Your Basket
              </h2>
              <div className="cart__head-actions">
                {cart.length > 0 && (
                  <button className="cart__clear" onClick={() => { setCart([]); localStorage.removeItem('camp_store_cart'); }} data-tooltip="Clear basket">
                    <Trash />
                  </button>
                )}
                <button className="cart__close" onClick={() => setCartOpen(false)}>
                  <CloseIcon />
                </button>
              </div>
            </div>

            {cart.length === 0 ? (
              <p className="cart__empty">Your basket is empty</p>
            ) : (
              <>
                <div className="cart__items">
                  {cart.map(item => (
                    <div key={item.itemId} className="cart__item">
                      <div className="cart__item-top">
                        <span className="cart__item-name">{item.name}</span>
                      </div>
                      <div className="cart__item-bot">
                        <div className="cart__item-qty">
                          <button onClick={() => updateQuantity(item.itemId, item.quantity - 1)}>−</button>
                          <input
                            type="number"
                            min="1"
                            max={item.stock !== -1 && typeof item.stock === 'number' ? item.stock : undefined}
                            value={item.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              if (val > 0) updateQuantity(item.itemId, val);
                            }}
                          />
                          <button
                            onClick={() => updateQuantity(item.itemId, item.quantity + 1)}
                            disabled={item.stock !== -1 && typeof item.stock === 'number' && item.quantity >= item.stock}
                          >+</button>
                        </div>
                        <span className="cart__item-price">{(item.price * item.quantity).toFixed(0)} <Drachma /></span>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="cart__coupon-btn">
                  <Coupon />
                  Apply Coupon
                </button>

                <div className="cart__footer">
                  <div className="cart__total">
                    <span>Total ({totalItems})</span>
                    <span className="cart__total-amt">{totalPrice.toFixed(0)} <Drachma /></span>
                  </div>
                  <button className="cart__pay" onClick={() => setShowCheckout(true)}>
                    Checkout
                  </button>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Checkout modal */}
      {showCheckout && (
        <CheckoutModal
          cart={cart}
          totalPrice={totalPrice}
          paySuccess={paySuccess}
          customerName={user?.nameEng?.replace(/\s*\\n\s*/g, ' ') || 'Guest Demigod'}
          onPay={handlePay}
          onClose={() => { setShowCheckout(false); setPaySuccess(false); }}
        />
      )}

      {/* Fixed tooltip — renders outside scroll container */}
      {tooltip && (() => {
        const tipItem = items.find(i => i.itemId === tooltip.id);
        if (!tipItem?.description) return null;
        return (
          <div
            className="item__tip"
            style={{
              bottom: window.innerHeight - tooltip.rect.top + 12,
              left: tooltip.rect.left + tooltip.rect.width / 2 - 90,
            }}
          >
            <p>{tipItem.description}</p>
          </div>
        );
      })()}
    </div>
  );
}

export default Shop;
