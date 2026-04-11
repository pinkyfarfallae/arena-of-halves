import React, { useEffect, useMemo, useState } from 'react';
import { Character, CustomEquipmentInfo } from '../../../../types/character';
import { fetchCustomEquipment, deleteCustomEquipment, fetchAllCharacters } from '../../../../data/characters';
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
import { useScreenSize } from '../../../../hooks/useScreenSize';
import { EQUIPMENT_CATEGORY_LABELS, EquipmentCategoryLabel } from '../../../../constants/equipment';
import { useAuth } from '../../../../hooks/useAuth';
import './EquipmentManagement.scss';
import Drachma from '../../../../icons/Drachma';

export default function EquipmentManagement() {
  const { user } = useAuth();
  const { width } = useScreenSize();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [equipment, setEquipment] = useState<CustomEquipmentInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

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
    if (!user) return;
    setLoading(true);
    try {
      Promise.all([fetchCustomEquipment(), fetchAllCharacters(user)]).then(([data, characters]) => {
        setEquipment(data);
        setCharacters(characters);
      });
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
    const term = search.toLowerCase();
    return equipment.filter((item) => {
      return (
        item.labelEng.toLowerCase().includes(term) ||
        item.labelThai.toLowerCase().includes(term) ||
        item.categories?.toLowerCase().includes(term) ||
        item.characterId?.toLowerCase().includes(term)
      );
    });
  }, [equipment, search]);

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
      label: 'Customer',
      width: width > 768 ? '150px' : 'unset',
      render: (row) => (
        <span className="eq__character">
          {characters.find(char => char.characterId === row.characterId)?.nicknameEng || row.characterId || '-'}
        </span>
      ),
    },
    {
      key: 'description' as keyof CustomEquipmentInfo & string,
      label: 'Description',
      width: width > 600 ? '300px' : 'unset',
      render: (row) => <span className="eq__description">{row.description || "-"}</span>,
    },
    {
      key: 'price' as keyof CustomEquipmentInfo & string,
      label: 'Price',
      width: '100px',
      render: (row) => <span className="eq__price">{row.price || 0} <Drachma /></span>,
    },
  ], [width]);

  const tableActions = [
    {
      label: () => <Pencil width={14} height={14} />,
      onClick: handleEdit,
    },
    {
      label: () => <Trash width={14} height={14} />,
      onClick: handleDelete,
    },
  ];

  return (
    <div className="eq-management">
      <div className="eq-management__header">
        <div>
          <h2 className="eq-management__title">Custom Equipment</h2>
          <p className="eq-management__desc">{filteredEquipment.length} equipment{filteredEquipment.length === 1 ? '' : 's'}</p>
        </div>

        <button className="eq-management__create-btn" onClick={() => setShowModal(true)}>
          <Plus width={14} height={14} />
          Create Equipment
        </button>
      </div>

      <div className="eq-management__toolbar">
        <div className="eq-management__search">
          <Search width={14} height={14} className="eq-management__search-icon" />
          <input
            className="eq-management__search-input"
            type="text"
            placeholder="Search by name or ID"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Table
        rowKey={(row) => row.itemId}
        data={filteredEquipment}
        columns={columns}
        actions={tableActions}
        loading={loading}
      />

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
