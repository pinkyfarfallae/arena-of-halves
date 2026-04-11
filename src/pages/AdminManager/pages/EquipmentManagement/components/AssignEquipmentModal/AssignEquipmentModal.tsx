import React, { useState, useEffect } from 'react';
import { CustomEquipmentInfo } from '../../../../../../types/character';
import { addCustomEquipment } from '../../../../../../services/equipment/equipmentService';
import { fetchAllCharacters } from '../../../../../../data/characters';
import Close from '../../../../../../icons/Close';
import './AssignEquipmentModal.scss';
import { useAuth } from '../../../../../../hooks/useAuth';

interface AssignEquipmentModalProps {
  equipment: CustomEquipmentInfo;
  onClose: () => void;
  onDone: () => void;
}

const AssignEquipmentModal: React.FC<AssignEquipmentModalProps> = ({
  equipment,
  onClose,
  onDone,
}) => {
  const { user } = useAuth();
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [players, setPlayers] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!user) return;

    fetchAllCharacters(user).then((chars) => {
      setPlayers(
        chars.map((c) => ({
          id: c.characterId || '',
          name: `${c.nicknameEng} (${c.characterId})`,
        }))
      );
    });
  }, [user]);

  const handleSubmit = async () => {
    if (!selectedPlayerId) {
      setError('Please select a player');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const categories = equipment.categories?.split(',').map((c) => c.trim()) || [];
      const result = await addCustomEquipment(selectedPlayerId, equipment.itemId, categories);

      if (result.success) {
        onDone();
        onClose();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('An error occurred while assigning equipment');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="assign-equipment-modal__overlay" onClick={onClose}>
      <div className="assign-equipment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="assign-equipment-modal__header">
          <h3>Assign Equipment to Player</h3>
          <button
            className="assign-equipment-modal__close"
            onClick={onClose}
            aria-label="Close"
            disabled={loading}
          >
            <Close width={18} height={18} />
          </button>
        </div>

        <div className="assign-equipment-modal__body">
          <div className="assign-equipment-modal__equipment">
            <div className="assign-equipment-modal__equipment-image">
              {equipment.imageUrl ? (
                <img src={equipment.imageUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span>{(equipment.labelEng ?? '?')[0]?.toUpperCase()}</span>
              )}
            </div>
            <div className="assign-equipment-modal__equipment-info">
              <h4>{equipment.labelEng}</h4>
              <p>{equipment.labelThai}</p>
              {equipment.description && (
                <p className="assign-equipment-modal__description">{equipment.description}</p>
              )}
            </div>
          </div>

          <div className="assign-equipment-modal__form">
            <div className="assign-equipment-modal__field">
              <label className="assign-equipment-modal__label">Select Player *</label>
              <select
                className="assign-equipment-modal__select"
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                disabled={loading}
              >
                <option value="">-- Select a player --</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="assign-equipment-modal__note">
              <strong>Note:</strong> The player must have all required equipment categories at Level
              3 before this custom equipment can be assigned.
            </div>

            {error && <div className="assign-equipment-modal__error">{error}</div>}
          </div>
        </div>

        <div className="assign-equipment-modal__footer">
          <button
            className="assign-equipment-modal__btn assign-equipment-modal__btn--cancel"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="assign-equipment-modal__btn assign-equipment-modal__btn--submit"
            onClick={handleSubmit}
            disabled={loading || !selectedPlayerId}
          >
            {loading ? 'Assigning...' : 'Assign Equipment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignEquipmentModal;
