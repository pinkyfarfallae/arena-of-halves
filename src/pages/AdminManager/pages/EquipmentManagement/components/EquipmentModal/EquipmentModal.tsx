import React, { useMemo, useState } from 'react';
import { CustomEquipmentInfo } from '../../../../../../types/character';
import {
  createCustomEquipment,
  editCustomEquipment,
  CreateCustomEquipmentPayload,
  fetchAllCharacters,
} from '../../../../../../data/characters';
import Close from '../../../../../../icons/Close';
import './EquipmentModal.scss';
import { Input, TextArea } from '../../../../../../components/Form';
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
  const {user} = useAuth();

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
  React.useEffect(() => {
    if (!user) return;
    fetchAllCharacters(user).then(chars => {
      setCharacters(chars.map(c => ({
        id: c.characterId,
        name: `${c.nicknameEng} (${c.characterId})`
      })));
    });
  }, []);

  // Update categories string when selection changes
  React.useEffect(() => {
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
    <div className="equipment-modal__overlay" onClick={handleClose}>
      <div className="equipment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="equipment-modal__header">
          <h3>
            {mode === USER_MANAGEMENT_MODE.EDIT && 'Edit Custom Equipment'}
            {mode === USER_MANAGEMENT_MODE.CREATE && 'Create Custom Equipment'}
          </h3>
          <button
            className="equipment-modal__close"
            onClick={handleClose}
            aria-label="Close"
            disabled={loading}
          >
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
            />

            <Input
              label="Label (Thai)"
              placeholder="e.g., ดาบแห่งโอลิมปัส"
              value={formData.labelThai}
              onChange={(v) => setFormData(f => ({ ...f, labelThai: v }))}
              disabled={loading}
            />

            <Input
              label="Image URL"
              placeholder="Google Drive link or direct image URL"
              value={formData.imageUrl}
              onChange={(v) => setFormData(f => ({ ...f, imageUrl: v }))}
              disabled={loading}
            />

            <TextArea
              label="Description"
              placeholder="Equipment description and abilities"
              value={formData.description}
              onChange={(v) => setFormData(f => ({ ...f, description: v }))}
              disabled={loading}
              rows={4}
            />

            <div className="equipment-modal__field">
              <label className="equipment-modal__label">Equipment Categories *</label>
              <div className="equipment-modal__categories">
                {Object.entries(EQUIPMENT_CATEGORIES).map(([key, value]) => (
                  <label key={value} className="equipment-modal__category">
                    <input
                      type="checkbox"
                      checked={selectedCategories.has(value)}
                      onChange={() => toggleCategory(value)}
                      disabled={loading}
                    />
                    <span>{EQUIPMENT_CATEGORY_LABELS[value]}</span>
                  </label>
                ))}
              </div>
              {selectedCategories.size === 0 && (
                <p className="equipment-modal__hint error">Select at least one category</p>
              )}
            </div>

            <div className="equipment-modal__field">
              <label className="equipment-modal__label">Character (Optional)</label>
              <select
                className="equipment-modal__select"
                value={formData.characterId}
                onChange={(e) => setFormData(f => ({ ...f, characterId: e.target.value }))}
                disabled={loading}
              >
                <option value="">All Characters (Generic)</option>
                {characters.map(char => (
                  <option key={char.id} value={char.id}>{char.name}</option>
                ))}
              </select>
              <p className="equipment-modal__hint">
                Leave empty for generic equipment, or select a character for custom equipment
              </p>
            </div>

            <Input
              label="Price (Drachmas)"
              type="number"
              placeholder="0"
              value={formData.price.toString()}
              onChange={(v) => setFormData(f => ({ ...f, price: parseFloat(v) || 0 }))}
              disabled={loading}
            />

            <div className="equipment-modal__field">
              <label className="equipment-modal__checkbox">
                <input
                  type="checkbox"
                  checked={formData.available}
                  onChange={(e) => setFormData(f => ({ ...f, available: e.target.checked }))}
                  disabled={loading}
                />
                <span>Available for use</span>
              </label>
            </div>

            {mode === USER_MANAGEMENT_MODE.CREATE && (
              <div className="equipment-modal__preview">
                <strong>Item ID:</strong> {itemId}
              </div>
            )}

            {error && <div className="equipment-modal__error">{error}</div>}
          </div>
        </div>

        <div className="equipment-modal__footer">
          <button
            className="equipment-modal__button equipment-modal__button--secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="equipment-modal__button equipment-modal__button--primary"
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
