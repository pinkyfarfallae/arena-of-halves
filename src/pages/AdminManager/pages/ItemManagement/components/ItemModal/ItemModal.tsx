import React, { useMemo, useState } from 'react';
import { ItemInfo } from '../../../../../../types/character';
import { createItem, editItem, CreateItemPayload, UserRecord } from '../../../../../../data/characters';
import Close from '../../../../../../icons/Close';
import './ItemModal.scss';
import { Input, TextArea } from '../../../../../../components/Form';
import { USER_MANAGEMENT_MODE } from '../../../../../../constants/userManagement';

interface CreateProps {
  mode: typeof USER_MANAGEMENT_MODE.CREATE;
  onClose: () => void;
  onDone: (apiCall: Promise<boolean>) => void;
}

interface EditProps {
  mode: typeof USER_MANAGEMENT_MODE.EDIT;
  item: ItemInfo;
  isDev: boolean;
  onClose: () => void;
  onDone: (apiCall: Promise<boolean>) => void;
}

type Props = CreateProps | EditProps;

const ItemModal: React.FC<Props> = (props) => {
  const { mode, onClose, onDone } = props;

  const item = mode === USER_MANAGEMENT_MODE.EDIT ? (props as EditProps).item : null;

  const [formData, setFormData] = useState<CreateItemPayload>({
    itemId: item?.itemId || '',
    labelEng: item?.labelEng || '',
    labelThai: item?.labelThai || '',
    imageUrl: item?.imageUrl || '',
    description: item?.description || '',
    price: item?.price || 0,
    piece: item?.piece || 'infinity',
    available: item?.available !== undefined ? item.available : true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const itemId = useMemo(() => {
    if (mode === USER_MANAGEMENT_MODE.EDIT && item) {
      return item.itemId;
    }
    return formData.labelEng
      .toLowerCase()
      .replace(/\n/g, '')
      .trim()
      .replace(/['’]/g, '')     // remove apostrophes
      .replace(/[^\w\s]/g, '')  // remove other special chars
      .replace(/\s+/g, '_');
  }, [mode, formData.labelEng]);

  const isWeapon = useMemo(() => {
    return itemId.toLowerCase().startsWith('weapon_');
  }, [itemId]);

  const canSubmit = useMemo(() => {
    const baseValid = (
      itemId.trim() &&
      formData.labelEng.trim() &&
      formData.labelThai.trim() &&
      formData.imageUrl.trim()
    );
    return baseValid;
  }, [itemId, formData, isWeapon]);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setLoading(true);
    setError('');

    try {
      let success = false;

      if (mode === USER_MANAGEMENT_MODE.CREATE) {
        const payload = { ...formData, itemId };
        success = await createItem(payload);
      } else if (mode === USER_MANAGEMENT_MODE.EDIT) {
        // For edit mode, send only changed fields
        const fields: Record<string, any> = {};
        if (formData.labelEng !== item?.labelEng) fields.labelEng = formData.labelEng;
        if (formData.labelThai !== item?.labelThai) fields.labelThai = formData.labelThai;
        if (formData.imageUrl !== item?.imageUrl) fields.imageUrl = formData.imageUrl;
        if (formData.description !== item?.description) fields.description = formData.description;
        if (formData.price !== item?.price) fields.price = formData.price.toString();
        if (formData.piece !== item?.piece) fields.piece = formData.piece.toString();
        if (formData.available !== item?.available) fields.available = formData.available.toString();

        success = await editItem(itemId, fields);
      }

      if (success) {
        handleClose();
        onDone(Promise.resolve(true));
      } else {
        // console.error('API call failed');
        setError('Failed to save item. Please try again.');
      }
    } catch (err) {
      // console.error('Error during API call:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setFormData({
      itemId: '',
      labelEng: '',
      labelThai: '',
      imageUrl: '',
      description: '',
      price: 0,
      piece: "infinity",
      available: true,
    });
  };

  return (
    <div className="item-modal__overlay">
      <div className="item-modal" onClick={(e) => e.stopPropagation()}>
        <div className="item-modal__header">
          <h3>
            {mode === USER_MANAGEMENT_MODE.EDIT && 'Edit Item'}
            {mode === USER_MANAGEMENT_MODE.CREATE && 'Create Item'}
          </h3>
          <button
            className="item-modal__close"
            onClick={handleClose}
            aria-label="Close"
            disabled={loading}
          >
            <Close width={18} height={18} />
          </button>
        </div>

        <div className="item-modal__body">
          <div className="item-modal__form">
            <Input
              key="Label (English)"
              label="Label (English)"
              placeholder="e.g., Healing Potion"
              value={formData.labelEng}
              onChange={(v) => setFormData(f => ({ ...f, labelEng: v }))}
              required
            />

            <Input
              key="Label (Thai)"
              label="Label (Thai)"
              placeholder="e.g., ยารักษา"
              value={formData.labelThai}
              onChange={(v) => setFormData(f => ({ ...f, labelThai: v }))}
              required
            />

            <TextArea
              key="Description"
              label="Description"
              placeholder="Enter item description"
              value={formData.description}
              onChange={(v) => setFormData(f => ({ ...f, description: v }))}
            />

            <Input
              key="Image URL"
              label="Image URL"
              placeholder="https://example.com/image.png"
              value={formData.imageUrl}
              onChange={(v) => setFormData(f => ({ ...f, imageUrl: v }))}
              required
            />

            {mode === USER_MANAGEMENT_MODE.CREATE && (
              <>
                <Input
                  key="Price"
                  label="Price"
                  placeholder="0"
                  type="number"
                  value={formData.price.toString()}
                  onChange={(v) => setFormData(f => ({ ...f, price: Number(v) }))}
                  required
                />

                <span className="form__label">
                  Piece<span className="form__required">*</span>
                </span>
                <div className="item-modal__checkbox-group">
                  <div className={`item-modal__checkbox-row ${formData.piece === 'infinity' ? 'item-modal__checkbox-row--selected' : ''}`}>
                    <label className="item-modal__checkbox-label">
                      <input
                        type="radio"
                        name="piece"
                        value="infinity"
                        checked={formData.piece === 'infinity'}
                        onChange={() => setFormData(f => ({ ...f, piece: 'infinity' }))}
                      />
                      Unlimited
                      <div className="item-modal__checkbox-description">
                        The item is always available in the shop.
                      </div>
                    </label>
                  </div>
                  <div className={`item-modal__checkbox-row ${formData.piece !== 'infinity' ? 'item-modal__checkbox-row--selected' : ''}`}>
                    <label className="item-modal__checkbox-label">
                      <input
                        type="radio"
                        name="piece"
                        value="finite"
                        checked={formData.piece !== 'infinity'}
                        onChange={() => setFormData(f => ({ ...f, piece: 0 }))}
                      />
                      Limited
                      <div className="item-modal__checkbox-description">
                        The item is available in limited quantities.
                      </div>
                    </label>
                    <Input
                      key="Piece"
                      label=""
                      placeholder="0"
                      type="number"
                      value={formData.piece === 'infinity' ? '' : Math.max(formData.piece, 0).toString()}
                      onChange={(v) => setFormData(f => ({ ...f, piece: Math.max(Number(v), 0) }))}
                      disabled={formData.piece === 'infinity'}
                      required={formData.piece !== 'infinity'}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="item-modal__footer">
          <button className="item-modal__cancel" onClick={handleClose} disabled={loading}>Cancel</button>
          <button className="item-modal__submit" onClick={handleSubmit} disabled={!canSubmit || loading}>
            {mode === USER_MANAGEMENT_MODE.EDIT ? (loading ? 'Saving...' : 'Save Changes') : (loading ? 'Creating...' : 'Create Item')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItemModal;
