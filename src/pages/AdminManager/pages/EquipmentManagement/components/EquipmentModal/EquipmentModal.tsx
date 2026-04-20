import React, { useMemo, useState, useEffect } from 'react';
import { CustomEquipmentInfo } from '../../../../../../types/character';
import {
  createCustomEquipment,
  editCustomEquipment,
  CreateCustomEquipmentPayload,
  fetchAllCharacters,
} from '../../../../../../data/characters';
import Close from '../../../../../../icons/Close';
import './EquipmentModal.scss';
import { Dropdown, Input, TextArea } from '../../../../../../components/Form';
import { USER_MANAGEMENT_MODE } from '../../../../../../constants/userManagement';
import { EQUIPMENT_CATEGORIES, EQUIPMENT_CATEGORY_LABELS } from '../../../../../../constants/equipment';
import { useAuth } from '../../../../../../hooks/useAuth';

interface CreateProps {
  mode: typeof USER_MANAGEMENT_MODE.CREATE;
  onClose: () => void;
  onDone: (apiCall: Promise<boolean>) => void;
}

interface EditProps {
  mode: typeof USER_MANAGEMENT_MODE.EDIT;
  equipment: CustomEquipmentInfo;
  isDev: boolean;
  onClose: () => void;
  onDone: (apiCall: Promise<boolean>) => void;
}

type Props = CreateProps | EditProps;

const EquipmentModal: React.FC<Props> = (props) => {
  const { mode, onClose, onDone } = props;
  const { user } = useAuth();

  const equipment = mode === USER_MANAGEMENT_MODE.EDIT ? (props as EditProps).equipment : null;

  const [formData, setFormData] = useState<CreateCustomEquipmentPayload>({
    itemId: equipment?.itemId || '',
    labelEng: equipment?.labelEng || '',
    labelThai: equipment?.labelThai || '',
    imageUrl: equipment?.imageUrl || '',
    description: equipment?.description || '',
    categories: equipment?.categories || '',
    characterId: equipment?.characterId || '',
    price: equipment?.price || 0,
    available: equipment?.available !== undefined ? equipment.available : true,
  });

  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(equipment?.categories?.split(',').map(c => c.trim()) || [])
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [characters, setCharacters] = useState<Array<{ id: string; name: string }>>([]);

  // Load characters for the dropdown
  useEffect(() => {
    if (!user) return;
    fetchAllCharacters(user).then(chars => {
      setCharacters(chars.map(c => ({
        id: c.characterId,
        name: `${c.nicknameEng} (${c.characterId})`
      })));
    });
  }, [user]);

  // Update categories string when selection changes
  useEffect(() => {
    setFormData(f => ({
      ...f,
      categories: Array.from(selectedCategories).join(',')
    }));
  }, [selectedCategories]);

  const itemId = useMemo(() => {
    if (mode === USER_MANAGEMENT_MODE.EDIT && equipment) {
      return equipment.itemId;
    }
    return 'custom_' + (formData.labelEng
      .toLowerCase()
      .replace(/\n/g, '')
      .trim()
      .replace(/['']/g, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '_'));
  }, [mode, formData.labelEng, equipment]);

  const canSubmit = useMemo(() => {
    return (
      itemId.trim() &&
      formData.labelEng.trim() &&
      formData.labelThai.trim() &&
      formData.imageUrl.trim() &&
      formData.characterId?.trim() &&
      selectedCategories.size > 0
    );
  }, [itemId, formData, selectedCategories]);

  const toggleCategory = (category: string) => {
    const newSet = new Set(selectedCategories);
    if (newSet.has(category)) {
      newSet.delete(category);
    } else {
      newSet.add(category);
    }
    setSelectedCategories(newSet);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setLoading(true);
    setError('');

    try {
      let success = false;

      if (mode === USER_MANAGEMENT_MODE.CREATE) {
        const payload = { ...formData, itemId };
        success = await createCustomEquipment(payload);
      } else if (mode === USER_MANAGEMENT_MODE.EDIT) {
        const fields: Record<string, any> = {};
        if (formData.labelEng !== equipment?.labelEng) fields.labelEng = formData.labelEng;
        if (formData.labelThai !== equipment?.labelThai) fields.labelThai = formData.labelThai;
        if (formData.imageUrl !== equipment?.imageUrl) fields.imageUrl = formData.imageUrl;
        if (formData.description !== equipment?.description) fields.description = formData.description;
        if (formData.categories !== equipment?.categories) fields.categories = formData.categories;
        if (formData.characterId !== equipment?.characterId) fields.characterId = formData.characterId;
        if (formData.price !== equipment?.price) fields.price = formData.price.toString();
        if (formData.available !== equipment?.available) fields.available = formData.available.toString();

        success = await editCustomEquipment(itemId, fields);
      }

      if (success) {
        handleClose();
        onDone(Promise.resolve(true));
      } else {
        setError('Failed to save equipment. Please try again.');
      }
    } catch (err) {
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
      categories: '',
      characterId: '',
      price: 0,
      available: true,
    });
    setSelectedCategories(new Set());
  };

  return (
    <div className="equipment-modal__overlay">
      <div className="equipment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="equipment-modal__header">
          <h3>
            {mode === USER_MANAGEMENT_MODE.EDIT ? <>Edit <b>{equipment?.labelEng}</b></> : 'Create Equipment'}
          </h3>
          <button className="equipment-modal__close" onClick={onClose}>
            <Close width={18} height={18} />
          </button>
        </div>

        <div className="equipment-modal__body">
          <div className="equipment-modal__form">
            <Input
              label="Label (English)"
              placeholder="e.g., Sword of Olympus"
              value={formData.labelEng}
              onChange={(v) => setFormData(f => ({ ...f, labelEng: v }))}
              disabled={loading}
              required
            />

            <Input
              label="Label (Thai)"
              placeholder="e.g., ดาบแห่งโอลิมปัส"
              value={formData.labelThai}
              onChange={(v) => setFormData(f => ({ ...f, labelThai: v }))}
              disabled={loading}
              required
            />

            <Input
              label="Image URL"
              placeholder="Google Drive link or direct image URL"
              value={formData.imageUrl}
              onChange={(v) => setFormData(f => ({ ...f, imageUrl: v }))}
              disabled={loading}
              required
            />

            <TextArea
              label="Description"
              placeholder="Equipment description and abilities"
              value={formData.description}
              onChange={(v) => setFormData(f => ({ ...f, description: v }))}
              disabled={loading}
              rows={4}
            />

            <div className="form__field">
              <label className="form__label">Equipment Categories <span className="form__required">*</span></label>
              <div className="equipment-modal__categories">
                {Object.entries(EQUIPMENT_CATEGORIES).map(([key, value]) => (
                  <div 
                    key={key} 
                    className={`equipment-modal__category ${value} ${selectedCategories.has(value) ? 'selected' : ''}`}
                    onClick={() => toggleCategory(value)}
                    >
                    {EQUIPMENT_CATEGORY_LABELS[value]}
                  </div>
                ))}
              </div>
            </div>

            <Dropdown
              label="Customer"
              options={characters.map(c => ({ value: c.id, label: c.name }))}
              value={formData.characterId || ''}
              onChange={(v) => setFormData(f => ({ ...f, characterId: v }))}
              placeholder="Select a customer"
              disabled={loading}
              required
            />

            <Input
              label="Price (Drachmas)"
              type="number"
              placeholder="0"
              value={formData.price.toString()}
              onChange={(v) => setFormData(f => ({ ...f, price: parseFloat(v) || 0 }))}
              disabled={loading}
            />
          </div>
        </div>

        <div className="equipment-modal__footer">
          <button
            className="equipment-modal__cancel"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="equipment-modal__submit"
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
          >
            {loading ? 'Saving...' : mode === USER_MANAGEMENT_MODE.CREATE ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EquipmentModal;
