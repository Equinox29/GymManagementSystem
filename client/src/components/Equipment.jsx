import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CalendarDays, Check, CheckCircle2, Clock3, Dumbbell, Edit3, Plus, RefreshCw, Search, ShieldCheck, Trash2, Wrench, X } from 'lucide-react';
import { equipmentAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Dialog from './Dialog';

const emptyEquipment = { name: '', category: '', brand: '', location: '', purchaseDate: '', condition: 'operational' };
const statuses = [
  { value: 'operational', label: 'Operational' }, { value: 'needs_inspection', label: 'Inspection' },
  { value: 'under_maintenance', label: 'In service' }, { value: 'out_of_order', label: 'Out of order' }
];
const labelFor = value => statuses.find(item => item.value === value)?.label || value?.replaceAll('_', ' ') || 'Unknown';
const recentLog = item => [...(item.maintenanceLogs || [])].sort((a, b) => new Date(b.date) - new Date(a.date))[0];

export default function Equipment() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [notice, setNotice] = useState(null);
  const [equipmentModal, setEquipmentModal] = useState(null);
  const [form, setForm] = useState(emptyEquipment);
  const [saving, setSaving] = useState(false);
  const [ticketItem, setTicketItem] = useState(null);
  const [ticketForm, setTicketForm] = useState({ type: 'inspection', priority: 'medium', description: '' });
  const [ticketSaving, setTicketSaving] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await equipmentAPI.getAll();
      setItems(Array.isArray(data) ? data : []);
      setError('');
    } catch (requestError) {
      setItems([]);
      setError(requestError.response?.data?.message || 'Equipment could not be loaded. Check the server connection and your access.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => items.filter(item => {
    const matchesStatus = filter === 'all' || item.condition === filter;
    const haystack = `${item.name} ${item.category} ${item.brand} ${item.location}`.toLowerCase();
    return matchesStatus && haystack.includes(search.toLowerCase());
  }), [items, filter, search]);

  const counts = useMemo(() => ({
    total: items.length,
    operational: items.filter(item => item.condition === 'operational').length,
    attention: items.filter(item => ['needs_inspection', 'out_of_order'].includes(item.condition)).length,
    open: items.reduce((sum, item) => sum + (item.maintenanceLogs || []).filter(log => log.status !== 'resolved').length, 0)
  }), [items]);

  const notify = (message, type = 'success') => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 3200);
  };

  const openCreate = () => { setForm(emptyEquipment); setEquipmentModal({ mode: 'create', id: null }); };
  const openEdit = item => {
    setForm({ ...emptyEquipment, ...item, purchaseDate: item.purchaseDate ? new Date(item.purchaseDate).toISOString().slice(0, 10) : '' });
    setEquipmentModal({ mode: 'edit', id: item._id });
  };

  const saveEquipment = async event => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, purchaseDate: form.purchaseDate || undefined };
      if (equipmentModal.mode === 'edit') await equipmentAPI.update(equipmentModal.id, payload);
      else await equipmentAPI.create(payload);
      setEquipmentModal(null);
      await load();
      notify(equipmentModal.mode === 'edit' ? 'Equipment details updated.' : 'Equipment added to the floor.');
    } catch (requestError) {
      notify(requestError.response?.data?.message || 'Unable to save equipment.', 'error');
    } finally { setSaving(false); }
  };

  const removeEquipment = async item => {
    if (!window.confirm(`Remove “${item.name}” from the active equipment register? Maintenance history will be preserved. Equipment with open tickets must be resolved first.`)) return;
    try {
      const { data } = await equipmentAPI.remove(item._id);
      await load();
      notify(data.message || 'Equipment removed from the active register.');
    } catch (requestError) {
      notify(requestError.response?.data?.message || 'Unable to remove equipment.', 'error');
    }
  };

  const submitTicket = async event => {
    event.preventDefault();
    if (!ticketItem) return;
    setTicketSaving(true);
    try {
      const { data } = await equipmentAPI.addMaintenance(ticketItem._id, ticketForm);
      setItems(current => current.map(item => item._id === data._id ? data : item));
      setTicketItem(data);
      setTicketForm({ type: 'inspection', priority: 'medium', description: '' });
      notify('Maintenance ticket submitted.');
    } catch (requestError) {
      notify(requestError.response?.data?.message || 'Unable to submit ticket.', 'error');
    } finally { setTicketSaving(false); }
  };

  const resolveTicket = async ticket => {
    if (!ticketItem) return;
    setResolvingId(ticket._id);
    try {
      const { data } = await equipmentAPI.updateMaintenance(ticketItem._id, ticket._id, { status: 'resolved' });
      setItems(current => current.map(item => item._id === data._id ? data : item));
      setTicketItem(data);
      notify('Ticket marked as resolved.');
    } catch (requestError) {
      notify(requestError.response?.data?.message || 'Unable to update ticket.', 'error');
    } finally { setResolvingId(null); }
  };

  return (
    <div className="ops-page">
      <div className="ops-page-heading">
        <div><div className="eyebrow"><span className="status-dot" /> FACILITY MANAGEMENT</div><h1>Equipment <em>Management</em></h1><p>Keep every station ready for the next set.</p></div>
        <div className="heading-actions"><button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh</button>{isAdmin && <button className="btn btn-primary" onClick={openCreate}><Plus size={17} /> Add equipment</button>}</div>
      </div>

      {notice && <div className={`notice ${notice.type}`} role="status">{notice.message}</div>}

      <section className="metric-strip equipment-metrics">
        <div className="metric-tile"><span>REGISTERED ASSETS</span><strong>{counts.total.toString().padStart(2, '0')}</strong><small>Across the floor</small><div className="metric-icon"><Activity size={18} /></div></div>
        <div className="metric-tile"><span>READY TO TRAIN</span><strong>{counts.operational.toString().padStart(2, '0')}</strong><small>Operational today</small><div className="metric-icon green"><CheckCircle2 size={18} /></div></div>
        <div className="metric-tile"><span>NEEDS ATTENTION</span><strong>{counts.attention.toString().padStart(2, '0')}</strong><small>Inspect or service</small><div className="metric-icon amber"><AlertTriangle size={18} /></div></div>
        <div className="metric-tile"><span>OPEN TICKETS</span><strong>{counts.open.toString().padStart(2, '0')}</strong><small>Maintenance queue</small><div className="metric-icon blue"><Wrench size={18} /></div></div>
      </section>

      <section className="ops-card equipment-card">
        <div className="list-toolbar"><div><span className="eyebrow">FLOOR REGISTER</span><h2>Asset List <span>{items.length}</span></h2></div><div className="toolbar-controls"><label className="search-field"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search Equipment" /></label><select className="control-select" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All conditions</option>{statuses.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select></div></div>
        {error && <div className="inline-error"><AlertTriangle size={17} /><span>{error}</span><button onClick={load}>Retry</button></div>}
        <div className="table-scroll"><table className="data-table equipment-table"><thead><tr><th>EQUIPMENT</th><th>TYPE / BRAND</th><th>LOCATION</th><th>CONDITION</th><th>LAST SERVICE</th><th> </th></tr></thead><tbody>
          {loading ? <tr><td colSpan="6" className="table-state"><RefreshCw className="spin" /> Loading floor register…</td></tr>
            : filtered.length === 0 ? <tr><td colSpan="6" className="table-state">{error ? 'Equipment could not be loaded.' : search || filter !== 'all' ? 'No equipment matches these filters.' : 'No equipment has been added yet.'}</td></tr>
            : filtered.map(item => {
              const log = recentLog(item);
              const statusClass = item.condition === 'operational' ? 'good' : item.condition === 'needs_inspection' ? 'attention' : item.condition === 'out_of_order' ? 'danger' : 'working';
              return <tr key={item._id}><td><div className="asset-name"><div className="asset-symbol"><Dumbbell size={17} /></div><div><strong>{item.name}</strong><small>ASSET · {item._id.slice(-6).toUpperCase()}</small></div></div></td><td><strong>{item.category || 'General'}</strong><small className="cell-subtitle">{item.brand || 'Unbranded'}</small></td><td>{item.location || '—'}</td><td><span className={`condition-pill ${statusClass}`}><i />{labelFor(item.condition)}</span></td><td><span className="service-date">{log ? new Date(log.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'No service record'}</span><small className="cell-subtitle">{log?.description || '—'}</small></td><td><div className="row-actions"><button className="btn btn-small btn-secondary" onClick={() => { setTicketItem(item); setTicketForm({ type: 'inspection', priority: 'medium', description: '' }); }}><Wrench size={14} /> Tickets {(item.maintenanceLogs || []).filter(ticket => ticket.status !== 'resolved').length || ''}</button>{isAdmin && <><button className="icon-button edit-action" onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`} title="Edit equipment"><Edit3 size={16} /></button><button className="icon-button remove-action" onClick={() => removeEquipment(item)} aria-label={`Remove ${item.name}`} title="Remove equipment"><Trash2 size={16} /></button></>}</div></td></tr>;
            })}
        </tbody></table></div>
        <div className="card-footnote"><ShieldCheck size={15} /> Staff can report and resolve maintenance tickets. Admins manage equipment records.</div>
      </section>

      {equipmentModal && <Dialog onClose={() => setEquipmentModal(null)} className="dialog-card" labelledBy="equipment-dialog-title"><div className="dialog-heading"><div><span className="eyebrow">ASSET REGISTER</span><h2 id="equipment-dialog-title">{equipmentModal.mode === 'edit' ? 'Edit Equipment' : 'Add Equipment'}</h2></div><button className="icon-button" onClick={() => setEquipmentModal(null)} aria-label="Close"><X size={18} /></button></div><form onSubmit={saveEquipment} className="dialog-form"><div className="form-grid"><label className="form-field wide">Name<input required maxLength="100" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label className="form-field">Category<input required value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Cardio" /></label><label className="form-field">Brand<input value={form.brand || ''} onChange={e => setForm({ ...form, brand: e.target.value })} /></label><label className="form-field">Location<input value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Main floor" /></label><label className="form-field">Purchase date<input type="date" value={form.purchaseDate || ''} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} /></label><label className="form-field wide">Condition<select value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })}>{statuses.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label></div><div className="dialog-actions"><button type="button" className="btn btn-secondary" onClick={() => setEquipmentModal(null)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save equipment'}</button></div></form></Dialog>}

      {ticketItem && <Dialog onClose={() => setTicketItem(null)} className="dialog-card ticket-dialog" labelledBy="ticket-dialog-title"><div className="dialog-heading"><div><span className="eyebrow">MAINTENANCE QUEUE</span><h2 id="ticket-dialog-title">{ticketItem.name}</h2><p>{ticketItem.location || ticketItem.category || 'Club floor'}</p></div><button className="icon-button" onClick={() => setTicketItem(null)} aria-label="Close"><X size={18} /></button></div><div className="ticket-list">{ticketItem.maintenanceLogs?.length ? [...ticketItem.maintenanceLogs].sort((a, b) => new Date(b.date) - new Date(a.date)).map(ticket => <article className="ticket-row" key={ticket._id}><div className="ticket-mark"><Wrench size={16} /></div><div className="ticket-copy"><div className="ticket-meta"><strong>{ticket.type || 'Maintenance'}</strong><span className={`ticket-state ${ticket.status}`}>{ticket.status?.replaceAll('_', ' ')}</span></div><p>{ticket.description}</p><small><CalendarDays size={13} /> {new Date(ticket.date).toLocaleDateString()} <span>·</span> {ticket.priority} priority <span>·</span> {ticket.performedBy || 'Staff'}</small>{ticket.status !== 'resolved' && <button type="button" className="resolve-button" disabled={Boolean(resolvingId)} onClick={() => resolveTicket(ticket)}><Check size={14} /> {resolvingId === ticket._id ? 'Resolving…' : 'Mark resolved'}</button>}</div></article>) : <div className="ticket-empty"><Wrench size={20} /><strong>No maintenance history</strong><span>Log a service note below when something needs attention.</span></div>}</div><form onSubmit={submitTicket} className="ticket-form"><div className="ticket-form-title"><span className="eyebrow">NEW SERVICE NOTE</span><span>Submitted by {user?.username}</span></div><div className="form-grid"><label className="form-field">Ticket type<select value={ticketForm.type} onChange={e => setTicketForm({ ...ticketForm, type: e.target.value })}><option value="inspection">Inspection</option><option value="repair">Repair</option><option value="routine">Routine check</option></select></label><label className="form-field">Priority<select value={ticketForm.priority} onChange={e => setTicketForm({ ...ticketForm, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><label className="form-field wide">What needs attention?<textarea required maxLength="1000" rows="3" value={ticketForm.description} onChange={e => setTicketForm({ ...ticketForm, description: e.target.value })} placeholder="Describe the issue or service needed…" /></label></div><div className="dialog-actions"><button type="submit" className="btn btn-primary" disabled={ticketSaving}>{ticketSaving ? 'Submitting…' : 'Submit maintenance ticket'}</button></div></form></Dialog>}
    </div>
  );
}
