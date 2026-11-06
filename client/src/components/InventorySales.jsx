import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, ShoppingCart, X } from 'lucide-react';
import { inventoryAPI } from '../services/api';
import Dialog from './Dialog';

const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const money = value => `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function InventorySales() {
  const [period, setPeriod] = useState('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState({ saleCount: 0, unitsSold: 0, revenue: 0, productsSold: 0 });
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saleOpen, setSaleOpen] = useState(false);
  const [saleForm, setSaleForm] = useState({ itemId: '', quantity: 1, notes: '' });
  const [saleBusy, setSaleBusy] = useState(false);
  const [saleError, setSaleError] = useState('');

  const dates = useMemo(() => {
    const now = new Date();
    if (period === 'month') return { from: localDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: localDate(now) };
    if (period === '30days') return { from: localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)), to: localDate(now) };
    if (period === 'custom') return { from, to };
    return {};
  }, [period, from, to]);

  const loadSales = useCallback(async (offset = 0) => {
    if (offset) setLoadingMore(true);
    else setLoading(true);
    try {
      const { data } = await inventoryAPI.getSales({ ...dates, search: search.trim(), limit: 25, offset });
      setSales(previous => offset ? [...previous, ...data.sales] : data.sales);
      setSummary(data.summary);
      setHasMore(data.hasMore);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Sales could not be loaded.');
      if (!offset) { setSales([]); setHasMore(false); }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [dates, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadSales(), search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadSales, search]);

  const loadItems = useCallback(async () => {
    try { const { data } = await inventoryAPI.getAll(); setItems(data); }
    catch { setItems([]); }
  }, []);
  useEffect(() => { loadItems(); }, [loadItems]);

  const sellableItems = items.filter(item => item.isSellable && item.quantity > 0);
  const selectedItem = sellableItems.find(item => String(item._id) === String(saleForm.itemId));

  const submitSale = async event => {
    event.preventDefault();
    const quantity = Number(saleForm.quantity);
    if (!selectedItem || !Number.isInteger(quantity) || quantity < 1 || quantity > selectedItem.quantity) {
      setSaleError('Choose an item and a whole-number quantity within available stock.');
      return;
    }
    setSaleBusy(true);
    setSaleError('');
    try {
      await inventoryAPI.sell(selectedItem._id, { quantity, notes: saleForm.notes.trim() });
      setSaleOpen(false);
      setSaleForm({ itemId: '', quantity: 1, notes: '' });
      setNotice(`Recorded sale of ${quantity} × ${selectedItem.name}.`);
      await Promise.all([loadSales(), loadItems()]);
    } catch (requestError) {
      setSaleError(requestError.response?.data?.message || 'The sale could not be recorded.');
    } finally { setSaleBusy(false); }
  };

  return <div className="ops-page sales-page">
    <div className="ops-page-heading">
      <div><span className="eyebrow">INVENTORY / SALES</span><h1>Inventory sales</h1><p>Review product sales and record purchases from available stock.</p></div>
      <button className="btn btn-primary" onClick={() => { setSaleError(''); setSaleOpen(true); }}><Plus size={16} /> Record sale</button>
    </div>
    {notice && <div className="notice" role="status">{notice}</div>}
    {error && <div className="inline-error" role="alert"><span>{error}</span><button onClick={() => loadSales()}>Retry</button></div>}

    <section className="sales-metrics" aria-label="Sales summary">
      <div><span>Sales revenue</span><strong>{money(summary.revenue)}</strong></div>
      <div><span>Transactions</span><strong>{summary.saleCount}</strong></div>
      <div><span>Units sold</span><strong>{summary.unitsSold}</strong></div>
      <div><span>Products sold</span><strong>{summary.productsSold}</strong></div>
    </section>

    <section className="sales-panel">
      <div className="sales-toolbar">
        <div><h2>Sale history</h2><p>Amounts use the price recorded at the time of each sale.</p></div>
        <div className="sales-controls">
          <label className="search-field"><Search size={16} /><input aria-label="Search sold items" placeholder="Search sold items" value={search} onChange={event => setSearch(event.target.value)} /></label>
          <select aria-label="Sales period" className="control-select" value={period} onChange={event => setPeriod(event.target.value)}><option value="month">This month</option><option value="30days">Last 30 days</option><option value="all">All time</option><option value="custom">Custom dates</option></select>
          {period === 'custom' && <><label className="sales-date">From<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label className="sales-date">To<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label></>}
        </div>
      </div>
      <div className="table-scroll"><table className="data-table sales-table"><thead><tr><th>Date and time</th><th>Product</th><th>Quantity</th><th>Unit price</th><th>Total</th><th>Recorded by</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="6" className="table-state">Loading sales…</td></tr> : sales.length === 0 ? <tr><td colSpan="6" className="table-state">No sales match this search or period.</td></tr> : sales.map(sale => <tr key={sale._id}><td className="sales-nowrap">{new Date(sale.date).toLocaleString()}</td><td><strong>{sale.itemName}</strong><small className="cell-subtitle">{sale.notes || sale.category}</small></td><td>{sale.quantity}</td><td>{money(sale.unitPrice)}</td><td className="sales-total">{money(sale.totalAmount)}</td><td>{sale.performedBy || 'System'}</td></tr>)}
      </tbody></table></div>
      <div className="sales-footer"><span>{summary.saleCount} transaction{summary.saleCount === 1 ? '' : 's'} in this view</span>{hasMore && <button className="btn btn-secondary" disabled={loadingMore} onClick={() => loadSales(sales.length)}>{loadingMore ? 'Loading…' : 'Load more'}</button>}</div>
    </section>

    {saleOpen && <Dialog onClose={() => { if (!saleBusy) setSaleOpen(false); }} labelledBy="sale-dialog-title" className="dialog-card sale-dialog">
      <div className="dialog-heading"><div><span className="eyebrow">INVENTORY SALE</span><h2 id="sale-dialog-title">Record sale</h2><p>Stock decreases when the sale is saved.</p></div><button className="icon-button" type="button" aria-label="Close" onClick={() => setSaleOpen(false)}><X size={18} /></button></div>
      <form className="dialog-form" onSubmit={submitSale}>
        <div className="form-grid"><label className="form-field wide">Product<select required value={saleForm.itemId} onChange={event => setSaleForm({ ...saleForm, itemId: event.target.value, quantity: 1 })}><option value="">Choose a product</option>{sellableItems.map(item => <option key={item._id} value={item._id}>{item.name} · {item.quantity} available</option>)}</select></label><label className="form-field">Quantity<input required type="number" min="1" max={selectedItem?.quantity || 1} step="1" value={saleForm.quantity} onChange={event => setSaleForm({ ...saleForm, quantity: event.target.value })} /></label><div className="sale-amount"><span>Total</span><strong>{money(Number(saleForm.quantity || 0) * Number(selectedItem?.unitPrice || 0))}</strong><small>{selectedItem ? `${selectedItem.quantity} available · ${money(selectedItem.unitPrice)} each` : 'Select a product'}</small></div><label className="form-field wide">Notes (optional)<textarea rows="2" maxLength="500" value={saleForm.notes} onChange={event => setSaleForm({ ...saleForm, notes: event.target.value })} /></label></div>
        {saleError && <div className="inline-error" role="alert">{saleError}</div>}
        {!sellableItems.length && <p className="sales-hint">No sellable items are in stock. Restock a product in Inventory first.</p>}
        <div className="dialog-actions"><button type="button" className="btn btn-secondary" onClick={() => setSaleOpen(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saleBusy || !selectedItem}>{saleBusy ? 'Saving…' : <><ShoppingCart size={16} /> Save sale</>}</button></div>
      </form>
    </Dialog>}
  </div>;
}
