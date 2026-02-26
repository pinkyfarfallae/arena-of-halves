import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Drachma from '../../components/icons/Drachma';
import './Shop.scss';

interface ShopItem {
  itemId: string;
  name: string;
  price: number;
  stock: number | "infinity";
  category: string;
  description: string;
  imageUrl: string;
}

interface CartItem extends ShopItem {
  quantity: number;
}

const SHEET_ID = '1P3gaozLPryFY8itFVx7YzBTrFfdSn2tllTKJIMXVWOA';
const SHOP_GID = '819284917';
const SHOP_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHOP_GID}`;

function parseCSV(csv: string): ShopItem[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse CSV properly - handle quoted fields
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
  const idIdx = headers.indexOf('productid');
  const nameIdx = headers.indexOf('product name');
  const priceIdx = headers.indexOf('price');
  const stockIdx = headers.indexOf('piece');
  const descIdx = headers.indexOf('description');
  const imageIdx = headers.indexOf('image url');

  if (idIdx === -1 || nameIdx === -1 || priceIdx === -1 || stockIdx === -1) return [];

  return lines.slice(1).map((line) => {
    const cols = parseCSVLine(line);
    const stockValue = cols[stockIdx]?.toLowerCase();
    const isUnlimited = stockValue === 'infinity' || stockValue === 'unlimited';

    // Process image URL - convert Google Drive URLs to direct view URLs
    let imageUrl = cols[imageIdx] || '';
    if (imageUrl && imageUrl.includes('drive.google.com')) {
      // Remove query parameters from URL
      imageUrl = imageUrl.split('?')[0];
      // Extract file ID from Google Drive URL (supports /d/ID format)
      const fileIdMatch = imageUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (fileIdMatch && fileIdMatch[1]) {
        const fileId = fileIdMatch[1];
        // Use CORS proxy to bypass Google Drive CORS restrictions
        // Properly encode the Google Drive export URL for the proxy
        const driveUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
        const encodedUrl = encodeURIComponent(driveUrl);
        imageUrl = `https://images.weserv.nl/?url=${encodedUrl}&w=300&h=300&fit=cover`;
        console.log(`Converted image URL: ${fileId} -> ${imageUrl}`);
      }
    }

    return {
      itemId: cols[idIdx] || '',
      name: cols[nameIdx] || '',
      price: parseFloat(cols[priceIdx]) || 0,
      stock: isUnlimited ? -1 : parseInt(cols[stockIdx]) || 0,
      category: isUnlimited ? 'General' : 'Limited',
      description: cols[descIdx] || '',
      imageUrl,
    };
  }).filter(item => item.itemId);
}

async function fetchShopItems(): Promise<ShopItem[]> {
  const res = await fetch(SHOP_CSV_URL);
  const text = await res.text();
  return parseCSV(text);
}

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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Camp
        </Link>

        <div className="shop__bar-title">
          {/* Caduceus icon */}
          <svg className="shop__bar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="2" x2="12" y2="22" />
            <path d="M8 5c-3 0-5 1.5-5 3.5S5 12 8 12c3 0 4-1.5 4-3.5" />
            <path d="M16 5c3 0 5 1.5 5 3.5S19 12 16 12c-3 0-4-1.5-4-3.5" />
            <path d="M9 12c-2.5 0-4 1.2-4 3s1.5 3 4 3c2.5 0 3-1.2 3-3" />
            <path d="M15 12c2.5 0 4 1.2 4 3s-1.5 3-4 3c-2.5 0-3-1.2-3-3" />
            <circle cx="9" cy="2.5" r="1.5" fill="currentColor" strokeWidth="0" />
            <circle cx="15" cy="2.5" r="1.5" fill="currentColor" strokeWidth="0" />
          </svg>
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
          </svg>
          {totalItems > 0 && <span className="shop__bar-cart-count">{totalItems}</span>}
        </button>
      </header>

      {/* Main content: shelves + cart */}
      <div className="shop__body">
        {/* Scrollable shelves */}
        <main className="shop__shelves">
          <div className="shop__search-wrapper">
            <div className="shop__search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
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
                          <svg className="item__img-ph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                            <line x1="12" y1="22.08" x2="12" y2="12" />
                          </svg>
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
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                              </svg>
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
                          <svg className="item__img-ph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                            <line x1="12" y1="22.08" x2="12" y2="12" />
                          </svg>
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
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                              </svg>
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
                {/* Winged sandal */}
                <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 22c2-1 6-2 10-2s8 1 12 3" />
                  <path d="M8 20c1-3 3-5 6-6s6 0 8 2" />
                  <path d="M5 24l1-4M9 24l0.5-3" />
                  <path d="M22 16c1-3 0-6-1-8" opacity="0.5" />
                  <path d="M24 15c2-2 3-5 2-7" opacity="0.5" />
                  <path d="M20 17c0-3-1-6-3-8" opacity="0.5" />
                </svg>
                <p>Loading wares...</p>
              </div>
            )}
          </div>
        </main>

        {/* Cart sidebar */}
        <aside className={`shop__cart ${cartOpen ? 'shop__cart--open' : ''}`}>
          <div className="cart">
            <div className="cart__head">
              <h2 className="cart__title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
                </svg>
                Your Basket
              </h2>
              <div className="cart__head-actions">
                {cart.length > 0 && (
                  <button className="cart__clear" onClick={() => { setCart([]); localStorage.removeItem('camp_store_cart'); }} data-tooltip="Clear basket">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                  </button>
                )}
                <button className="cart__close" onClick={() => setCartOpen(false)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
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
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 9a3 3 0 013-3h14a3 3 0 013 3v0a3 3 0 01-3 3v0a3 3 0 013 3v0a3 3 0 01-3 3H5a3 3 0 01-3-3v0a3 3 0 013-3v0a3 3 0 01-3-3z" />
                    <line x1="9" y1="6" x2="9" y2="18" strokeDasharray="2 2" />
                  </svg>
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
        <div className="checkout__overlay" onClick={() => { setShowCheckout(false); setPaySuccess(false); }}>
          <div className="checkout" onClick={(e) => e.stopPropagation()}>
            <button className="checkout__close" onClick={() => { setShowCheckout(false); setPaySuccess(false); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
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
                  <span className="checkout__customer-name">{user?.nameEng || 'Guest Demigod'}</span>
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
                      <span className="checkout__item-price">{(item.price * item.quantity).toFixed(0)} <Drachma /></span>
                    </div>
                  ))}
                </div>

                <div className="checkout__total">
                  <span>Total</span>
                  <span className="checkout__total-amount">{totalPrice.toFixed(0)} <Drachma /></span>
                </div>

                <button className="checkout__pay" onClick={handlePay}>
                  Complete Payment
                </button>
              </>
            )}
          </div>
        </div>
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
