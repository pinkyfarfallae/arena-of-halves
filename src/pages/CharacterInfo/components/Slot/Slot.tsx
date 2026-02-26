import './Slot.scss';

export default function Slot({ name, icon, quantity, imageUrl, tier }: {
  name?: string; icon: string; quantity?: number; imageUrl?: string; tier?: string;
}) {
  const tierCls = tier ? `wslot--${tier.toLowerCase()}` : '';
  return (
    <div className={`wslot ${!name ? 'wslot--empty' : ''} ${name ? tierCls : ''}`}>
      <div className="wslot__frame">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="wslot__img" referrerPolicy="no-referrer" />
        ) : (
          <span className="wslot__icon">{name ? icon : '+'}</span>
        )}
        {quantity != null && quantity > 0 && <span className="wslot__qty">{quantity}</span>}
        {name && tier && <span className="wslot__tier">{tier}</span>}
      </div>
      <span className="wslot__name">{name || 'Empty'}</span>
    </div>
  );
}
