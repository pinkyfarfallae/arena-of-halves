import React, { useEffect, useMemo, useState } from 'react';
import { ItemInfo } from '../../../../types/character';
import { fetchItemInfo, deleteItem, editItem } from '../../../../data/characters';
import Table, { Column } from '../../../../components/Table/Table';
import ConfirmModal from '../../../../components/ConfirmModal/ConfirmModal';
import Pencil from '../../../../icons/Pencil';
import Plus from '../../../../icons/Plus';
import Search from '../../../../icons/Search';
import ItemModal from './components/ItemModal/ItemModal';
import { USER_MANAGEMENT_MODE } from '../../../../constants/userManagement';
import { Input } from '../../../../components/Form';
import Save from './icons/Save';
import Close from '../../../../icons/Close';
import { useScreenSize } from '../../../../hooks/useScreenSize';
import './ItemManagement.scss';

export default function ItemManagement() {
  const { width } = useScreenSize();

  const [items, setItems] = useState<ItemInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedItem, setSelectedItem] = useState<ItemInfo | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ItemInfo | null>(null);

  const [editingPriceRowId, setEditingPriceRowId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>('');
  const [isSavingPrice, setIsSavingPrice] = useState(false);

  const [editingPieceRowId, setEditingPieceRowId] = useState<string | null>(null);
  const [editingPiece, setEditingPiece] = useState<string>('');
  const [isSavingPiece, setIsSavingPiece] = useState(false);

  const [savingRowId, setSavingRowId] = useState<string | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const itemData = await fetchItemInfo();
      setItems(itemData);
    } catch (error) {
      // console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDone = (apiCall: Promise<boolean>) => {
    setLoading(true);

    apiCall.finally(async () => {
      await loadItems();
      setLoading(false);
    });

    setShowModal(false);
    setSelectedItem(null);
  };

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return items.filter((item) => {
      return (
        item.labelEng.toLowerCase().includes(term) ||
        item.labelThai.toLowerCase().includes(term)
      );
    });
  }, [items, searchTerm]);

  const handleView = (item: ItemInfo) => {
    setSelectedItem(item);
    setShowModal(true);
  };

  const handleEdit = (item: ItemInfo) => {
    setSelectedItem(item);
    setShowModal(true);
    setShowModal(true);
  };

  const handleDelete = (item: ItemInfo) => {
    setItemToDelete(item);
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    const success = await deleteItem(itemToDelete.itemId);
    if (success) {
      await loadItems();
      setShowConfirmDelete(false);
      setItemToDelete(null);
    } else {
      alert('Failed to delete item');
    }
  };

  const handleCreate = () => {
    setSelectedItem(null);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedItem(null);
  };

  const columns = useMemo<Column<ItemInfo>[]>(() => [
    {
      key: 'labelEng' as keyof ItemInfo & string,
      label: 'Name',
      render: (row) => {
        return (
          <div className="item__nick-cell">
            <div className="item__avatar">
              {row.imageUrl
                ? <img src={row.imageUrl} alt="" referrerPolicy="no-referrer" />
                : <span>{(row.labelEng ?? row.labelEng ?? '?')[0]?.toUpperCase()}</span>
              }
            </div>
            <div className="item__nick-text">
              <span className="item__nick-eng">{row.labelEng}</span>
              {row.labelThai && <span className="item__nick-thai">{row.labelThai}</span>}
            </div>
          </div>
        );
      },
    },
    {
      key: 'description' as keyof ItemInfo & string,
      label: 'Description',
      width: width > 600 ? "400px" : "unset",
      render: (row) => <span className="item__description">{row.description}</span>,
    },
    {
      key: 'price' as keyof ItemInfo & string,
      label: 'Price',
      width: "180px",
      render: (row) => {
        const isEditing = editingPriceRowId === row.itemId;

        if (isSavingPrice && isEditing) {
          return <span className="item__saving">Saving...</span>;
        }

        if (isEditing) {
          return (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Input
                type="number"
                value={editingPrice}
                className="item__price-input"
                onChange={(v) => setEditingPrice(v)}
              />

              {/* Save */}
              <button
                onClick={async () => {
                  const newPrice = Number(editingPrice);

                  if (newPrice !== row.price) {
                    setIsSavingPrice(true);
                    await editItem(row.itemId, { price: newPrice });
                    setItems(prev =>
                      prev.map(item =>
                        item.itemId === row.itemId
                          ? { ...item, price: newPrice }
                          : item
                      )
                    );
                    setIsSavingPrice(false);
                  }

                  setEditingPriceRowId(null);
                }}
                className="item__save-btn"
              >
                <Save />
              </button>

              {/* Cancel */}
              <button
                onClick={async () => {
                  setEditingPriceRowId(null);
                  setEditingPrice('');
                }}
                className="item__cancel-btn"
              >
                <Close />
              </button>
            </div>
          );
        }

        return (
          <span
            style={{ cursor: 'pointer' }}
            className="form__input item__price-display"
            onClick={() => {
              setEditingPriceRowId(row.itemId);
              setEditingPrice(row.price?.toString() || '');
            }}
          >
            {row.price}
          </span>
        );
      },
    },
    {
      key: 'piece' as keyof ItemInfo & string,
      label: 'Piece',
      width: "180px",
      render: (row) => {
        const isEditing = editingPieceRowId === row.itemId;

        if (isSavingPiece && isEditing) {
          return <span className="item__saving">Saving...</span>;
        }

        if (isEditing) {
          return (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Input
                type="text"
                value={editingPiece}
                className="item__price-input"
                onChange={(v) => setEditingPiece(v)}
              />

              {/* Save */}
              <button
                onClick={async () => {
                  const newPiece = editingPiece;

                  if (newPiece !== row.piece) {
                    setIsSavingPiece(true);
                    await editItem(row.itemId, { piece: newPiece });
                    setItems(prev =>
                      prev.map(item =>
                        item.itemId === row.itemId
                          ? {
                            ...item,
                            piece:
                              newPiece === 'infinity'
                                ? 'infinity'
                                : Math.max(Number(newPiece), 0),
                          }
                          : item
                      )
                    );
                    setIsSavingPiece(false);
                  }

                  setEditingPieceRowId(null);
                }}
                className="item__save-btn"
              >
                <Save />
              </button>

              {/* Cancel */}
              <button
                onClick={async () => {
                  setEditingPieceRowId(null);
                  setEditingPiece('');
                }}
                className="item__cancel-btn"
              >
                <Close />
              </button>
            </div>
          );
        }

        return (
          <span
            style={{ cursor: 'pointer' }}
            className="form__input item__price-display"
            onClick={() => {
              setEditingPieceRowId(row.itemId);
              setEditingPiece(row.piece?.toString() || '');
            }}
          >
            {row.piece}
          </span>
        );
      }
    },
    {
      key: 'available' as keyof ItemInfo & string,
      label: 'Available',
      width: "140px",
      style: { minWidth: '140px' },
      render: (row) => {
        const isLoading = savingRowId === row.itemId;

        return (
          <label className="item__switch">
            <input
              type="checkbox"
              checked={!!row.available}
              disabled={isLoading}
              onChange={async (e) => {
                const newValue = e.target.checked;

                setSavingRowId(row.itemId);

                setItems(prev =>
                  prev.map(item =>
                    item.itemId === row.itemId
                      ? { ...item, available: newValue }
                      : item
                  )
                );

                editItem(row.itemId, { available: newValue });
                setSavingRowId(null);
              }}
            />
            <span className="item__slider" />
            <span className="item__saving--switch">
              {isLoading ? 'Saving...' : (row.available ? 'Available' : 'Unavailable')}
            </span>
          </label>
        );
      },
    }
  ], [editingPriceRowId, editingPrice, filteredItems, isSavingPrice, editingPieceRowId, editingPiece, isSavingPiece]);

  const tableActions = [
    {
      label: () => <Pencil width={14} height={14} />,
      onClick: (row: ItemInfo) => {
        handleEdit(row);
      },
    },
  ];

  return (
    <div className="item-management">
      <div className="item-management-header">
        <div>
          <h2 className="item-management-title">Item Management</h2>
          <p className="item-management-desc">{items.length} items available</p>
        </div>
        <button className="admin__create-btn" onClick={handleCreate}>
          <Plus width={14} height={14} />
          Create Item
        </button>
      </div>

      <div className="item__toolbar">
        <div className="item__search">
          <Search width={14} height={14} className="item__search-icon" />
          <input
            className="item__search-input"
            type="text"
            placeholder="Search by name"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Table
        columns={columns}
        data={filteredItems}
        rowKey={(row) => row.itemId}
        actions={tableActions}
        loading={loading}
      />

      {showModal && selectedItem && (
        <ItemModal
          mode={USER_MANAGEMENT_MODE.EDIT}
          item={selectedItem}
          isDev={false}
          onClose={handleModalClose}
          onDone={handleDone}
        />
      )}

      {showModal && !selectedItem && (
        <ItemModal
          mode={USER_MANAGEMENT_MODE.CREATE}
          onClose={handleModalClose}
          onDone={handleDone}
        />
      )}

      {showConfirmDelete && (
        <ConfirmModal
          title="Delete Item"
          message={`Are you sure you want to delete item "${itemToDelete?.labelEng}"?`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onCancel={() => {
            setShowConfirmDelete(false);
            setItemToDelete(null);
          }}
        />
      )}
    </div>
  );
};