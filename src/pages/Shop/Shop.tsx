import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { T } from '../../constants/translationKeys';
import Drachma from '../../icons/Drachma';
import { ShopItem, CartItem, fetchShopItems } from './shopData';
import CheckoutModal from './components/CheckoutModal/CheckoutModal';
import ChevronLeft from '../../icons/ChevronLeft';
import Caduceus from './icons/Caduceus';
import Cart from './icons/Cart';
import SearchIcon from '../../icons/Search';
import Package from './icons/Package';
import InfoCircle from './icons/InfoCircle';
import WingedSandal from './icons/WingedSandal';
import Trash from './icons/Trash';
import Close from '../../icons/Close';
import Coupon from './icons/Coupon';
import { LANGUAGE } from '../../constants/language';
import { LOCAL_STORAGE_KEYS } from '../../constants/localStorage';
import { giveItem } from '../../services/bag/bagService';
import { updateCharacterDrachma } from '../../services/character/currencyService';
import { BAG_ITEM_TYPES } from '../../constants/bag';
import { fetchItemInfo } from '../../data/characters';
import './Shop.scss';

function Shop() {
  const { t, lang } = useTranslation();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.CAMP_STORE_CART);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const { user, refreshUser } = useAuth();
  const [tooltip, setTooltip] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cartOpen, setCartOpen] = useState(false);

  // Save cart to localStorage
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.CAMP_STORE_CART, JSON.stringify(cart));
  }, [cart]);

  // Fetch items initially and poll every 5 seconds
  useEffect(() => {
    const loadItems = async () => {
      try {
        setLoading(true);
        const data = await fetchItemInfo();

        const availableItem = data.filter(i => !!i.available);

        const shopItems: ShopItem[] = availableItem.map(i => ({
          itemId: i.itemId,
          name: i.labelEng,
          description: i.description ?? '',
          price: i.price ?? 0,
          stock:
            i.piece === 'infinity'
              ? 'infinity'
              : typeof i.piece === 'number'
                ? i.piece
                : 0,
          imageUrl: i.imageUrl,
          category: i.tier || 'Uncategorized',
        }));

        setItems(shopItems);
      } catch (error) { } finally {
        setLoading(false);
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

  const handlePay = async () => {
    if (!user?.characterId || processing) return;

    // Check if user has enough drachma
    if ((user.currency ?? 0) < totalPrice) {
      alert('Insufficient drachma! You need ' + totalPrice + ' but only have ' + (user.currency ?? 0));
      return;
    }

    setProcessing(true);

    try {
      // Deduct drachma
      const drachmaResult = await updateCharacterDrachma(user.characterId, -totalPrice);

      if (!drachmaResult.success) {
        alert('Failed to process payment: ' + (drachmaResult.error || 'Unknown error'));
        setProcessing(false);
        return;
      }

      // Add items to bag
      for (const item of cart) {
        // Determine item type from itemId prefix
        const type = item.itemId.startsWith('weapon_') ? BAG_ITEM_TYPES.WEAPON : BAG_ITEM_TYPES.ITEM;

        const result = await giveItem(user.characterId, item.itemId, item.quantity, type);

        if (!result.success) {
          // console.error(`Failed to add ${item.itemId} to bag:`, result.error);
          // Continue with other items even if one fails
        }
      }

      // Refresh user data to update currency display
      await refreshUser();

      // Clear cart and show success
      setCart([]);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.CAMP_STORE_CART);
      setPaySuccess(true);
    } catch (error) {
      // console.error('Error processing payment:', error);
      alert('An error occurred during checkout. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    return items.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  const limitedItems = filteredItems.filter(i => i.stock !== -1);
  const unlimitedItems = filteredItems.filter(i => i.stock === -1);

  return (
    <div className="shop">
      {/* Compact header */}
      <header className="shop__bar">
        <Link to="/life" className="shop__bar-back">
          <ChevronLeft />
          {t(T.CAMP)}
        </Link>

        <div className="shop__bar-title">
          <Caduceus className="shop__bar-icon" />
          {t(T.HERMES_SUPPLY)}
        </div>

        {/* Drachma balance */}
        <div className="shop__bar-balance">
          <Drachma className="drachma--bar" />
          <span className="shop__bar-amount">{user?.currency?.toLocaleString() ?? '0'}</span>
          <span className="shop__bar-unit">{t(T.DRACHMA).toLowerCase()}</span>
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
                placeholder={t(T.SEARCH_ITEMS)}
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
                  <h2>{t(T.LIMITED_EDITION)}</h2>
                  <span className="shop__section-count">{limitedItems.length} {t(T.ITEMS)}</span>
                </div>
                <div className="shop__grid">
                  {limitedItems.map(item => (
                    <div key={item.itemId} className="item">
                      {typeof item.stock === 'number' && item.stock !== -1 && item.stock < 5 && (
                        <span className="item__badge">{lang === LANGUAGE.THAI ? `${t(T.LEFT)} ${item.stock}` : `${item.stock} ${t(T.LEFT)}`}</span>
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
                            <h3 className="item__name">{item.name.replace(/\\n/g, '\n')}</h3>
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
                                value={cart.find(c => c.itemId === item.itemId)?.quantity || 0}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  if (val > 0) updateQuantity(item.itemId, val);
                                }}
                              />
                              <button
                                onClick={() => {
                                  const current = cart.find(c => c.itemId === item.itemId)?.quantity || 1;
                                  const max = item.stock === 'infinity' ? null : Number(item.stock);
                                  if (max === null || current < max) updateQuantity(item.itemId, current + 1);
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
                              {item.stock === 0 ? t(T.SOLD_OUT) : t(T.ADD_TO_CART)}
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
                  <h2>{t(T.ALWAYS_AVAILABLE)}</h2>
                  <span className="shop__section-count">{unlimitedItems.length} {t(T.ITEMS)}</span>
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
                                onClick={() => {
                                  const current = cart.find(c => c.itemId === item.itemId)?.quantity ?? 0;
                                  updateQuantity(item.itemId, current - 1);
                                }}
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={cart.find(c => c.itemId === item.itemId)?.quantity || 1}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  const max = item.stock === 'infinity' ? null : Number(item.stock);
                                  if (val > 0 && (max === null || val <= max)) updateQuantity(item.itemId, val);
                                }}
                              />
                              <button
                                onClick={() => {
                                  const current = cart.find(c => c.itemId === item.itemId)?.quantity ?? 0;
                                  const max = item.stock === 'infinity' ? null : Number(item.stock);
                                  if (max === null || current < max) updateQuantity(item.itemId, current + 1);
                                }}
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              className="item__add"
                              onClick={() => addToCart(item)}
                            >
                              {t(T.ADD_TO_CART)}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {items.length === 0 && !loading && (
              <div className="shop__empty">
                <WingedSandal />
                <p>{t(T.NO_WARES_AVAILABLE)}</p>
              </div>
            )}

            {loading && items.length === 0 && (
              <div className="shop__empty">
                <WingedSandal />
                <p>{t(T.LOADING_WARES)}</p>
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
                {t(T.YOUR_BASKET)}
              </h2>
              <div className="cart__head-actions">
                {cart.length > 0 && (
                  <button className="cart__clear" onClick={() => { setCart([]); localStorage.removeItem('camp_store_cart'); }} data-tooltip={t(T.CLEAR_BASKET)}>
                    <Trash />
                  </button>
                )}
                <button className="cart__close" onClick={() => setCartOpen(false)}>
                  <Close />
                </button>
              </div>
            </div>

            {cart.length === 0 ? (
              <p className="cart__empty">{t(T.EMPTY_CART)}</p>
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
                            onClick={() => {
                              const cartItem = cart.find(c => c.itemId === item.itemId);
                              const current = cartItem?.quantity ?? 0;
                              if (item.stock === 'infinity') {
                                updateQuantity(item.itemId, current + 1);
                                return;
                              }

                              if (typeof item.stock === 'number' && current < item.stock) {
                                updateQuantity(item.itemId, current + 1);
                              }
                            }}
                            disabled={
                              item.stock === 0 ||
                              (
                                typeof item.stock === 'number' &&
                                item.stock !== -1 &&
                                (cart.find(c => c.itemId === item.itemId)?.quantity ?? 0) >= item.stock
                              )
                            }
                          >
                            +
                          </button>
                        </div>
                        <span className="cart__item-price">{(item.price * item.quantity).toFixed(0)} <Drachma /></span>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="cart__coupon-btn">
                  <Coupon />
                  {t(T.APPLY_COUPON)}
                </button>

                <div className="cart__footer">
                  <div className="cart__total">
                    <span>{t(T.TOTAL)} ({totalItems})</span>
                    <span className="cart__total-amt">{totalPrice.toFixed(0)} <Drachma /></span>
                  </div>
                  <button className="cart__pay" onClick={() => setShowCheckout(true)}>
                    {t(T.CHECKOUT)}
                  </button>
                </div>
              </>
            )}
          </div>
        </aside>
      </div >

      {/* Checkout modal */}
      {
        showCheckout && (
          <CheckoutModal
            cart={cart}
            totalPrice={totalPrice}
            paySuccess={paySuccess}
            paying={processing}
            customerName={user?.nameEng?.replace(/\s*\\n\s*/g, ' ') || 'Guest Demigod'}
            onPay={handlePay}
            onClose={() => { setShowCheckout(false); setPaySuccess(false); }}
          />
        )
      }

      {/* Fixed tooltip — renders outside scroll container */}
      {
        tooltip && (() => {
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
        })()
      }
    </div >
  );
}

export default Shop;
