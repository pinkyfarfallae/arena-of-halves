import React, { useEffect, useMemo, useState } from 'react';
import { CustomEquipmentInfo } from '../../../../types/character';
import { fetchCustomEquipment, deleteCustomEquipment } from '../../../../data/characters';
import Table, { Column } from '../../../../components/Table/Table';
import ConfirmModal from '../../../../components/ConfirmModal/ConfirmModal';
import Pencil from '../../../../icons/Pencil';
import Plus from '../../../../icons/Plus';
import Search from '../../../../icons/Search';
import Trash from '../../../../icons/Trash';
import EquipmentModal from './components/EquipmentModal/EquipmentModal';
import AssignEquipmentModal from './components/AssignEquipmentModal/AssignEquipmentModal';
import { USER_MANAGEMENT_MODE } from '../../../../constants/userManagement';
import { Input } from '../../../../components/Form';
import './EquipmentManagement.scss';
import { useScreenSize } from '../../../../hooks/useScreenSize';
import { EQUIPMENT_CATEGORY_LABELS, EquipmentCategoryLabel } from '../../../../constants/equipment';

export default function EquipmentManagement() {
  const { width } = useScreenSize();

  const [equipment, setEquipment] = useState<CustomEquipmentInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedEquipment, setSelectedEquipment] = useState<CustomEquipmentInfo | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [equipmentToDelete, setEquipmentToDelete] = useState<CustomEquipmentInfo | null>(null);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [equipmentToAssign, setEquipmentToAssign] = useState<CustomEquipmentInfo | null>(null);

  useEffect(() => {
    loadEquipment();
  }, []);

  const loadEquipment = async () => {
    setLoading(true);
    try {
      const data = await fetchCustomEquipment();
      setEquipment(data);
    } catch (error) {
      console.error('Failed to load custom equipment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDone = (apiCall: Promise<boolean>) => {
    setLoading(true);

    apiCall.finally(async () => {
      await loadEquipment();
      setLoading(false);
    });

    setShowModal(false);
    setSelectedEquipment(null);
  };

  const filteredEquipment = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return equipment.filter((item) => {
      return (
        item.labelEng.toLowerCase().includes(term) ||
        item.labelThai.toLowerCase().includes(term) ||
        item.categories?.toLowerCase().includes(term) ||
        item.characterId?.toLowerCase().includes(term)
      );
    });
  }, [equipment, searchTerm]);

  const handleEdit = (item: CustomEquipmentInfo) => {
    setSelectedEquipment(item);
    setShowModal(true);
  };

  const handleDelete = (item: CustomEquipmentInfo) => {
    setEquipmentToDelete(item);
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    if (!equipmentToDelete) return;

    const success = await deleteCustomEquipment(equipmentToDelete.itemId);
    if (success) {
      await loadEquipment();
      setShowConfirmDelete(false);
      setEquipmentToDelete(null);
    } else {
      alert('Failed to delete equipment');
    }
  };

  const handleCreate = () => {
    setSelectedEquipment(null);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedEquipment(null);
  };

  const handleAssign = (item: CustomEquipmentInfo) => {
    setEquipmentToAssign(item);
    setShowAssignModal(true);
  };

  const handleAssignClose = () => {
    setShowAssignModal(false);
    setEquipmentToAssign(null);
  };

  const handleAssignDone = () => {
    // Reload equipment if needed
    loadEquipment();
  };

  const columns = useMemo<Column<CustomEquipmentInfo>[]>(() => [
    {
      key: 'labelEng' as keyof CustomEquipmentInfo & string,
      label: 'Name',
      render: (row) => {
        return (
          <div className="eq__name-cell">
            <div className="eq__avatar">
              {row.imageUrl
                ? <img src={row.imageUrl} alt="" referrerPolicy="no-referrer" />
                : <span>{(row.labelEng ?? '?')[0]?.toUpperCase()}</span>
              }
            </div>
            <div className="eq__name-text">
              <span className="eq__name-eng">{row.labelEng}</span>
              {row.labelThai && <span className="eq__name-thai">{row.labelThai}</span>}
            </div>
          </div>
        );
      },
    },
    {
      key: 'categories' as keyof CustomEquipmentInfo & string,
      label: 'Categories',
      width: width > 768 ? '200px' : 'unset',
      render: (row) => {
        const cats = row.categories?.split(',').map(c => c.trim()) || [];
        return (
          <div className="eq__categories">
            {cats.map(cat => {
              const categoryKey = cat as keyof typeof EQUIPMENT_CATEGORY_LABELS;
              return (
                <span key={cat} className={`eq__category eq__category--${cat}`}>
                  {EQUIPMENT_CATEGORY_LABELS[categoryKey] || cat}
                </span>
              );
            })}
          </div>
        );
      },
    },
    {
      key: 'characterId' as keyof CustomEquipmentInfo & string,
      label: 'Character',
      width: width > 768 ? '150px' : 'unset',
      render: (row) => (
        <span className="eq__character">
          {row.characterId || <em style={{ opacity: 0.5 }}>Generic</em>}
        </span>
      ),
    },
    {
      key: 'description' as keyof CustomEquipmentInfo & string,
      label: 'Description',
      width: width > 600 ? '300px' : 'unset',
      render: (row) => <span className="eq__description">{row.description}</span>,
    },
    {
      key: 'price' as keyof CustomEquipmentInfo & string,
      label: 'Price',
      width: '100px',
      render: (row) => <span>{row.price || 0} 🪙</span>,
    },
    {
      key: 'itemId' as keyof CustomEquipmentInfo & string,
      label: 'Actions',
      width: '160px',
      render: (row) => (
        <div className="eq__actions">
          <button
            className="eq__action-btn eq__action-btn--assign"
            onClick={() => handleAssign(row)}
            title="Assign to Player"
          >
            <Plus width={14} height={14} />
          </button>
          <button
            className="eq__action-btn eq__action-btn--edit"
            onClick={() => handleEdit(row)}
            title="Edit"
          >
            <Pencil width={16} height={16} />
          </button>
          <button
            className="eq__action-btn eq__action-btn--delete"
            onClick={() => handleDelete(row)}
            title="Delete"
          >
            <Trash width={16} height={16} />
          </button>
        </div>
      ),
    },
  ], [width]);

  return (
    <div className="eq-management">
      <div className="eq-management__header">
        <div className="eq-management__title">
          <h2>Custom Equipment Management</h2>
          <p>Create and manage custom equipment for characters</p>
        </div>

        <div className="eq-management__actions">
          <div className="eq-management__search">
            <Search width={16} height={16} />
            <Input
              placeholder="Search equipment..."
              value={searchTerm}
              onChange={setSearchTerm}
            />
          </div>

          <button
            className="eq-management__create-btn"
            onClick={handleCreate}
          >
            <Plus width={18} height={18} />
            <span>Create Equipment</span>
          </button>
        </div>
      </div>

      <div className="eq-management__content">
        {loading ? (
          <div className="eq-management__loading">Loading...</div>
        ) : (
          <Table
            rowKey={(row) => row.itemId}
            data={filteredEquipment}
            columns={columns}
          />
        )}
      </div>

      {showModal && (
        <EquipmentModal
          {...(selectedEquipment
            ? { mode: USER_MANAGEMENT_MODE.EDIT as typeof USER_MANAGEMENT_MODE.EDIT, equipment: selectedEquipment, isDev: true }
            : { mode: USER_MANAGEMENT_MODE.CREATE as typeof USER_MANAGEMENT_MODE.CREATE }
          )}
          onClose={handleModalClose}
          onDone={handleDone}
        />
      )}

      {showConfirmDelete && equipmentToDelete && (
        <ConfirmModal
          title="Delete Equipment"
          message={`Are you sure you want to delete "${equipmentToDelete.labelEng}"? This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => {
            setShowConfirmDelete(false);
            setEquipmentToDelete(null);
          }}
        />
      )}

      {showAssignModal && equipmentToAssign && (
        <AssignEquipmentModal
          equipment={equipmentToAssign}
          onClose={handleAssignClose}
          onDone={handleAssignDone}
        />
      )}
    </div>
  );
}
