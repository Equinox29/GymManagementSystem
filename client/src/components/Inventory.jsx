import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, Plus, Minus, ShoppingCart, X } from 'lucide-react';
import { inventoryAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Dialog from './Dialog';
import InventoryOverview from './InventoryOverview';

const Inventory = () => {
  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [transactionFilter, setTransactionFilter] = useState('all');
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false);
  const [loadingMoreTransactions, setLoadingMoreTransactions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [toast, setToast] = useState(null);
  const [editId, setEditId] = useState(null);
  const [mutationBusy, setMutationBusy] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Track which item form is open.
  const [restockModal, setRestockModal] = useState({ show: false, item: null, quantity: 1, notes: '' });
  const [sellModal, setSellModal] = useState({ show: false, item: null, quantity: 1 });
  const [addModal, setAddModal] = useState({
    show: false,
    name: '', category: 'supplement', quantity: 0, unitPrice: 0, reorderLevel: 5, supplier: ''
  });

  const categories = ['All', 'supplement', 'drink', 'other'];

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const [itemsResponse, transactionsResponse] = await Promise.all([
        inventoryAPI.getAll(), inventoryAPI.getTransactions({ limit: 100, ...(transactionFilter === 'all' ? {} : { type: transactionFilter }) })
      ]);
      setItems(itemsResponse.data || []);
      setTransactions(transactionsResponse.data || []);
      setHasMoreTransactions((transactionsResponse.data || []).length === 100);
      setError('');
    } catch (err) {
      console.error('Error fetching inventory', err);
      setItems([]);
      setTransactions([]);
      setHasMoreTransactions(false);
      setError(err.response?.data?.message || 'Inventory could not be loaded. Check the server connection and your access.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [transactionFilter]);

  const loadMoreTransactions = async () => {
    try {
      setLoadingMoreTransactions(true);
      const { data } = await inventoryAPI.getTransactions({
        limit: 100, offset: transactions.length,
        ...(transactionFilter === 'all' ? {} : { type: transactionFilter })
      });
      setTransactions(previous => [...previous, ...data]);
      setHasMoreTransactions(data.length === 100);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not load older transactions.', 'error');
    } finally {
      setLoadingMoreTransactions(false);
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (mutationBusy) return;
    setMutationBusy(true);
    try {
      await inventoryAPI.restock(restockModal.item._id, {
        quantity: Number(restockModal.quantity),
        notes: restockModal.notes
      });
      showToast('Successfully restocked item', 'success');
      setRestockModal({ show: false, item: null, quantity: 1, notes: '' });
      fetchInventory();
    } catch (err) {
      showToast(err.response?.data?.message || 'Error restocking item', 'error');
    } finally { setMutationBusy(false); }
  };

  const handleSellSubmit = async (e) => {
    e.preventDefault();
    if (mutationBusy) return;
    if (sellModal.quantity > sellModal.item.quantity) {
      showToast('Cannot sell more than current stock', 'error');
      return;
    }
    setMutationBusy(true);
    try {
      await inventoryAPI.sell(sellModal.item._id, {
        quantity: Number(sellModal.quantity)
      });
      showToast('Successfully sold item', 'success');
      setSellModal({ show: false, item: null, quantity: 1 });
      fetchInventory();
    } catch (err) {
      showToast(err.response?.data?.message || 'Error selling item', 'error');
    } finally { setMutationBusy(false); }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (mutationBusy) return;
    setMutationBusy(true);
    try {
      const payload = {
        name: addModal.name,
        category: addModal.category,
        quantity: Number(addModal.quantity),
        unitPrice: Number(addModal.unitPrice),
        reorderLevel: Number(addModal.reorderLevel),
        supplier: addModal.supplier
      };
      if (editId) await inventoryAPI.update(editId, payload);
      else await inventoryAPI.create(payload);
      showToast(editId ? 'Item details updated' : 'Successfully added new item', 'success');
      setAddModal({ show: false, name: '', category: 'supplement', quantity: 0, unitPrice: 0, reorderLevel: 5, supplier: '' });
      setEditId(null);
      await fetchInventory();
    } catch (err) {
      showToast(err.response?.data?.message || 'Error saving item', 'error');
    } finally { setMutationBusy(false); }
  };

  const handleRemoveItem = async (item) => {
    if (!window.confirm(`Remove “${item.name}” from active inventory? Its transaction history will be preserved.`)) return;
    try {
      const { data } = await inventoryAPI.remove(item._id);
      await fetchInventory();
      showToast(data.message || 'Item removed from active inventory.', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not remove this item.', 'error');
    }
  };

  const filteredItems = items.filter(item => {
    if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
    if (showLowStock && item.quantity > item.reorderLevel) return false;
    return `${item.name} ${item.category} ${item.supplier || ''}`.toLowerCase().includes(search.trim().toLowerCase());
  });
  const money = value => `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div className="ops-page inventory-page">
      <div className="inventory-content">
        <InventoryOverview
          items={items} filteredItems={filteredItems} loading={loading} error={error} toast={toast}
          fetchInventory={fetchInventory} isAdmin={isAdmin} search={search} setSearch={setSearch}
          categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
          showLowStock={showLowStock} setShowLowStock={setShowLowStock} categories={categories}
          onAdd={() => { setEditId(null); setAddModal({ show: true, name: '', category: 'supplement', quantity: 0, unitPrice: 0, reorderLevel: 5, supplier: '' }); }}
          onRestock={item => setRestockModal({ show: true, item, quantity: 1, notes: '' })}
          onSell={item => setSellModal({ show: true, item, quantity: 1 })}
          onEdit={item => { setEditId(item._id); setAddModal({ show: true, name: item.name, category: item.category, quantity: item.quantity, unitPrice: item.unitPrice, reorderLevel: item.reorderLevel, supplier: item.supplier || '' }); }}
          onRemove={handleRemoveItem}
        />
        <section className="sales-panel" aria-label="Inventory transaction log">
          <div className="sales-toolbar">
            <div><h2 className="text-xl font-bold text-white">Inventory transaction log</h2><p className="mt-1 text-sm text-gray-400">Sales, restocks, and removed items stay in this history.</p></div>
            <label className="flex items-center gap-2 text-sm text-gray-300">Show
              <select value={transactionFilter} onChange={event => setTransactionFilter(event.target.value)} className="rounded-lg border border-[#303030] bg-[#111111] px-3 py-2 text-gray-100">
                <option value="all">All transactions</option><option value="sale">Sales</option><option value="restock">Restocks</option><option value="archive">Removed items</option>
              </select>
            </label>
          </div>
          <div className="table-scroll"><table className="data-table min-w-[650px]"><thead><tr><th>Date and time</th><th>Item</th><th>Action</th><th className="text-right">Quantity</th><th className="text-right">Sale amount</th><th>Recorded by</th></tr></thead><tbody>
            {transactions.map(entry => <tr key={entry._id} className="border-b border-[#242424] text-gray-200"><td className="px-3 py-3 whitespace-nowrap">{new Date(entry.date).toLocaleString()}</td><td className="px-3 py-3 font-medium">{entry.itemName}{entry.isArchived ? <span className="ml-2 text-xs text-gray-500">removed</span> : null}{entry.notes && <span className="block text-xs font-normal text-gray-400">{entry.notes}</span>}</td><td className="px-3 py-3 capitalize">{entry.type === 'archive' ? 'Removed' : entry.type}</td><td className="px-3 py-3 text-right tabular-nums">{entry.quantity}</td><td className="px-3 py-3 text-right tabular-nums">{entry.type === 'sale' ? money(entry.totalAmount) : '—'}</td><td className="px-3 py-3">{entry.performedBy || 'System'}</td></tr>)}
            {transactions.length === 0 && <tr><td colSpan="6" className="px-3 py-8 text-center text-gray-400">No matching inventory transactions.</td></tr>}
          </tbody></table></div>
          {hasMoreTransactions && <div className="sales-footer"><span>Older stock movements are available.</span><button type="button" disabled={loadingMoreTransactions} onClick={loadMoreTransactions} className="btn btn-secondary">{loadingMoreTransactions ? 'Loading…' : 'Load older transactions'}</button></div>}
        </section>

        {/* Form for adding stock */}
        {restockModal.show && (
          <Dialog onClose={() => setRestockModal({ ...restockModal, show: false })} labelledBy="restock-dialog-title" className="inventory-dialog">
            <div className="bg-[#0b0b0b] rounded-2xl border border-[#242424] p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-6">
                <h2 id="restock-dialog-title" className="text-xl font-bold flex items-center gap-2 text-zinc-400"><Plus className="w-5 h-5" /> Restock Item</h2>
                <button type="button" aria-label="Close restock dialog" onClick={() => setRestockModal({ ...restockModal, show: false })} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#111111] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="bg-[#111111] border border-[#242424] rounded-xl p-4 mb-6 flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase mb-1">Item</p>
                  <p className="font-semibold text-gray-200">{restockModal.item?.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 font-bold uppercase mb-1">Current Stock</p>
                  <p className="text-xl font-black text-gray-200">{restockModal.item?.quantity}</p>
                </div>
              </div>

              <form onSubmit={handleRestockSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Quantity to Add</label>
                  <div className="flex items-center">
                    <button type="button" onClick={() => setRestockModal(p => ({...p, quantity: Math.max(1, p.quantity - 1)}))} className="px-4 py-3 bg-[#111111] border border-[#242424] rounded-l-xl text-gray-400 hover:text-white hover:bg-[#303030] transition-colors"><Minus className="w-4 h-4" /></button>
                    <input
                      type="number"
                      min="1"
                      required
                      value={restockModal.quantity}
                      onChange={e => setRestockModal({ ...restockModal, quantity: parseInt(e.target.value) || 1 })}
                      className="w-full bg-[#050505] border-y border-[#242424] text-gray-200 px-4 py-3 text-center font-bold outline-none focus:bg-[#0b0b0b]"
                    />
                    <button type="button" onClick={() => setRestockModal(p => ({...p, quantity: p.quantity + 1}))} className="px-4 py-3 bg-[#111111] border border-[#242424] rounded-r-xl text-gray-400 hover:text-white hover:bg-[#303030] transition-colors"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Notes (Optional)</label>
                  <textarea
                    value={restockModal.notes}
                    onChange={e => setRestockModal({ ...restockModal, notes: e.target.value })}
                    className="w-full bg-[#050505] border border-[#242424] text-gray-200 rounded-xl px-4 py-3 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/20 outline-none h-24 resize-none transition-all"
                    placeholder="Supplier invoice #, condition, etc."
                  ></textarea>
                </div>
                <button type="submit" disabled={mutationBusy} className="w-full py-3 bg-gradient-to-r from-zinc-500 to-zinc-600 hover:from-zinc-600 hover:to-zinc-700 text-white rounded-xl font-bold shadow-lg shadow-zinc-500/20 transition-all">
                  {mutationBusy ? 'Saving…' : 'Confirm Restock'}
                </button>
              </form>
            </div>
          </Dialog>
        )}

        {/* Form for recording a sale */}
        {sellModal.show && (
          <Dialog onClose={() => setSellModal({ ...sellModal, show: false })} labelledBy="sell-dialog-title" className="inventory-dialog">
            <div className="bg-[#0b0b0b] rounded-2xl border border-[#242424] p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-6">
                <h2 id="sell-dialog-title" className="text-xl font-bold flex items-center gap-2 text-zinc-400"><ShoppingCart className="w-5 h-5" /> Sell Item</h2>
                <button type="button" aria-label="Close sale dialog" onClick={() => setSellModal({ ...sellModal, show: false })} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#111111] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="bg-[#111111] border border-[#242424] rounded-xl p-4 mb-6 flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase mb-1">Item</p>
                  <p className="font-semibold text-gray-200">{sellModal.item?.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 font-bold uppercase mb-1">Available Stock</p>
                  <p className="text-xl font-black text-zinc-400">{sellModal.item?.quantity}</p>
                </div>
              </div>

              <form onSubmit={handleSellSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex justify-between">
                    <span>Quantity to Sell</span>
                    {sellModal.quantity >= sellModal.item?.quantity && (
                      <span className="text-amber-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Max available</span>
                    )}
                  </label>
                  <div className="flex items-center">
                    <button type="button" onClick={() => setSellModal(p => ({...p, quantity: Math.max(1, p.quantity - 1)}))} className="px-4 py-3 bg-[#111111] border border-[#242424] rounded-l-xl text-gray-400 hover:text-white hover:bg-[#303030] transition-colors"><Minus className="w-4 h-4" /></button>
                    <input
                      type="number"
                      min="1"
                      max={sellModal.item?.quantity}
                      required
                      value={sellModal.quantity}
                      onChange={e => setSellModal({ ...sellModal, quantity: parseInt(e.target.value) || 1 })}
                      className="w-full bg-[#050505] border-y border-[#242424] text-gray-200 px-4 py-3 text-center font-bold outline-none focus:bg-[#0b0b0b] focus:text-zinc-400"
                    />
                    <button type="button" disabled={sellModal.quantity >= sellModal.item?.quantity} onClick={() => setSellModal(p => ({...p, quantity: p.quantity + 1}))} className="px-4 py-3 bg-[#111111] border border-[#242424] rounded-r-xl text-gray-400 hover:text-white hover:bg-[#303030] disabled:opacity-50 disabled:hover:bg-[#111111] transition-colors"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>
                
                <div className="bg-[#111111]/50 border border-[#242424]/50 rounded-xl p-4 flex justify-between items-center">
                  <span className="text-gray-400 font-medium">Total Price:</span>
                  <span className="money-value text-2xl">₱{(sellModal.quantity * (sellModal.item?.unitPrice || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                <button type="submit" disabled={mutationBusy} className="w-full py-3 bg-gradient-to-r from-zinc-500 to-zinc-600 hover:from-zinc-600 hover:to-zinc-700 text-white rounded-xl font-bold shadow-lg shadow-zinc-500/20 transition-all">
                  {mutationBusy ? 'Saving…' : 'Confirm Sale'}
                </button>
              </form>
            </div>
          </Dialog>
        )}

        {/* Form for creating an inventory item */}
        {addModal.show && (
          <Dialog onClose={() => setAddModal({ ...addModal, show: false })} labelledBy="item-dialog-title" className="inventory-dialog inventory-dialog-wide">
            <div className="bg-[#0b0b0b] rounded-2xl border border-[#242424] p-6 max-w-2xl w-full my-8 shadow-2xl animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-6 border-b border-[#242424] pb-4">
                <h2 id="item-dialog-title" className="text-xl font-bold flex items-center gap-2"><Package className="w-5 h-5 text-zinc-400" /> {editId ? 'Edit Item' : 'Add New Item'}</h2>
                <button type="button" aria-label="Close item dialog" onClick={() => setAddModal({ ...addModal, show: false })} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#111111] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAddSubmit} className="space-y-5">
                
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Item Name</label>
                  <input required type="text" value={addModal.name} onChange={e => setAddModal({ ...addModal, name: e.target.value })} className="w-full bg-[#050505] border border-[#242424] text-gray-200 rounded-xl px-4 py-3 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/20 outline-none transition-all placeholder:text-gray-600" placeholder="e.g. Premium Whey Protein" />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Category</label>
                    <select value={addModal.category} onChange={e => setAddModal({ ...addModal, category: e.target.value })} className="w-full bg-[#050505] border border-[#242424] text-gray-200 rounded-xl px-4 py-3 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/20 outline-none transition-all">
                      {categories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Supplier</label>
                    <input type="text" value={addModal.supplier} onChange={e => setAddModal({ ...addModal, supplier: e.target.value })} className="w-full bg-[#050505] border border-[#242424] text-gray-200 rounded-xl px-4 py-3 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/20 outline-none transition-all placeholder:text-gray-600" placeholder="Optional" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 bg-[#111111]/30 p-4 rounded-xl border border-[#242424]/50">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Initial Qty</label>
                    <input required type="number" min="0" value={addModal.quantity} disabled={Boolean(editId)} onChange={e => setAddModal({ ...addModal, quantity: e.target.value })} className="w-full bg-[#050505] border border-[#242424] text-gray-200 rounded-xl px-4 py-3 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/20 outline-none transition-all disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Unit Price (₱)</label>
                    <input required type="number" min="0" step="0.01" value={addModal.unitPrice} onChange={e => setAddModal({ ...addModal, unitPrice: e.target.value })} className="w-full bg-[#050505] border border-[#242424] text-gray-200 rounded-xl px-4 py-3 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/20 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-amber-500/80 uppercase tracking-wide mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Reorder Lvl</label>
                    <input required type="number" min="0" value={addModal.reorderLevel} onChange={e => setAddModal({ ...addModal, reorderLevel: e.target.value })} className="w-full bg-[#050505] border border-[#242424] text-gray-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 outline-none transition-all" />
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={() => setAddModal({ ...addModal, show: false })} className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-[#111111] transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={mutationBusy} className="px-8 py-3 bg-gradient-to-r from-zinc-500 to-zinc-600 hover:from-zinc-600 hover:to-zinc-700 text-white rounded-xl font-bold shadow-lg shadow-zinc-500/20 transition-all">
                    {mutationBusy ? 'Saving…' : editId ? 'Save Changes' : 'Save Item'}
                  </button>
                </div>
              </form>
            </div>
          </Dialog>
        )}
      </div>
    </div>
  );
};

export default Inventory;
