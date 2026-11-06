import { AlertTriangle, Edit, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const money = value => `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function InventoryOverview({
  items, filteredItems, loading, error, toast, fetchInventory, isAdmin,
  search, setSearch, categoryFilter, setCategoryFilter, showLowStock, setShowLowStock,
  categories, onAdd, onRestock, onSell, onEdit, onRemove
}) {
  const lowStock = items.filter(item => item.quantity > 0 && item.quantity <= item.reorderLevel).length;
  const outOfStock = items.filter(item => item.quantity === 0).length;
  const units = items.reduce((total, item) => total + Number(item.quantity), 0);

  return <>
    <div className="ops-page-heading">
      <div><span className="eyebrow">INVENTORY / STOCK</span><h1>Inventory</h1><p>Track available products, stock levels, and restocks.</p></div>
      <div className="heading-actions"><Link to="/inventory/sales" className="btn btn-secondary"><ShoppingCart size={16} /> View sales</Link>{isAdmin && <button className="btn btn-primary" onClick={onAdd}><Plus size={16} /> Add item</button>}</div>
    </div>
    {toast && <div className={`notice ${toast.type === 'error' ? 'error' : ''}`} role="status">{toast.message}</div>}
    {error && <div className="inline-error" role="alert"><span>{error}</span><button onClick={fetchInventory}>Retry</button></div>}

    <section className="sales-metrics" aria-label="Stock summary">
      <div><span>Active products</span><strong>{items.length}</strong></div>
      <div><span>Units in stock</span><strong>{units}</strong></div>
      <div><span>Low stock</span><strong>{lowStock}</strong></div>
      <div><span>Out of stock</span><strong>{outOfStock}</strong></div>
    </section>

    <section className="sales-panel">
      <div className="sales-toolbar"><div><h2>Products</h2><p>Stock alerts use each product’s reorder level.</p></div><div className="sales-controls">
        <label className="search-field"><Search size={16} /><input aria-label="Search inventory" placeholder="Search products" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <select aria-label="Category" className="control-select" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}>{categories.map(category => <option key={category} value={category}>{category === 'All' ? 'All categories' : category[0].toUpperCase() + category.slice(1)}</option>)}</select>
        <label className="inventory-checkbox"><input type="checkbox" checked={showLowStock} onChange={event => setShowLowStock(event.target.checked)} /> Low stock only</label>
      </div></div>
      <div className="table-scroll"><table className="data-table inventory-table"><thead><tr><th>Product</th><th>Category</th><th>Stock</th><th>Reorder at</th><th>Status</th><th>Unit price</th><th>Supplier</th><th>Actions</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="8" className="table-state">Loading products…</td></tr> : filteredItems.length === 0 ? <tr><td colSpan="8" className="table-state">{items.length ? 'No products match these filters.' : 'No products yet. Add an item to begin tracking stock.'}</td></tr> : filteredItems.map(item => {
          const stockStatus = item.quantity === 0 ? 'out' : item.quantity <= item.reorderLevel ? 'low' : 'good';
          return <tr key={item._id}><td><strong>{item.name}</strong>{!item.isSellable && <small className="cell-subtitle">Not for sale</small>}</td><td className="inventory-capitalize">{item.category}</td><td className="inventory-number">{item.quantity}</td><td className="inventory-number">{item.reorderLevel}</td><td><span className={`stock-badge ${stockStatus}`}>{stockStatus === 'out' ? 'Out of stock' : stockStatus === 'low' ? 'Low stock' : 'In stock'}</span></td><td>{money(item.unitPrice)}</td><td>{item.supplier || '—'}</td><td><div className="row-actions">
            {isAdmin && <button type="button" className="icon-button" title="Restock" aria-label={`Restock ${item.name}`} onClick={() => onRestock(item)}><Plus size={16} /></button>}
            <button type="button" className="icon-button" title={item.isSellable ? 'Record sale' : 'Not for sale'} aria-label={`Sell ${item.name}`} disabled={!item.isSellable || item.quantity === 0} onClick={() => onSell(item)}><ShoppingCart size={16} /></button>
            {isAdmin && <button type="button" className="icon-button" title="Edit" aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)}><Edit size={16} /></button>}
            {isAdmin && <button type="button" className="icon-button remove-action" title="Remove" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item)}><Trash2 size={16} /></button>}
          </div></td></tr>;
        })}
      </tbody></table></div>
      {outOfStock > 0 && <div className="card-footnote"><AlertTriangle size={15} /> {outOfStock} product{outOfStock === 1 ? '' : 's'} currently out of stock.</div>}
    </section>
  </>;
}
