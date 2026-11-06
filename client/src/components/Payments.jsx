import { useState, useEffect } from 'react';
import { paymentsAPI, membersAPI, plansAPI, equipmentPlansAPI, equipmentSubscriptionsAPI } from '../services/api';
import { Plus, X, CreditCard, ArrowDownRight, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Dialog from './Dialog';

export default function Payments() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [payments, setPayments] = useState([]);
  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [equipmentPlans, setEquipmentPlans] = useState([]);
  const [equipmentSubscriptions, setEquipmentSubscriptions] = useState([]);
  const [planEditor, setPlanEditor] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ memberId: '', membershipPlanId: '', gymPlanId: '', amount: '', paymentMethod: 'cash', notes: '' });
  const [planStatus, setPlanStatus] = useState(null);
  const [planStatusBusy, setPlanStatusBusy] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [receiptNotice, setReceiptNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!isModalOpen || !formData.memberId) { setPlanStatus(null); return; }
    let cancelled = false;
    setPlanStatusBusy(true);
    paymentsAPI.getPlanStatus(formData.memberId)
      .then(({ data }) => { if (!cancelled) { setPlanStatus(data); setPaymentError(''); } })
      .catch(err => { if (!cancelled) setPaymentError(err.response?.data?.message || 'Could not load current plans.'); })
      .finally(() => { if (!cancelled) setPlanStatusBusy(false); });
    return () => { cancelled = true; };
  }, [isModalOpen, formData.memberId]);

  useEffect(() => {
    if (!isModalOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [isModalOpen]);

  const fetchData = async () => {
    try {
      const [payRes, memRes, planRes, equipmentPlanRes, subscriptionsRes] = await Promise.all([
        paymentsAPI.getAll(),
        membersAPI.getAll(),
        plansAPI.getAll(),
        equipmentPlansAPI.getAll(),
        equipmentSubscriptionsAPI.getAll()
      ]);
      setPayments(payRes.data);
      setMembers(memRes.data);
      setPlans(planRes.data);
      setEquipmentPlans(equipmentPlanRes.data);
      setEquipmentSubscriptions(subscriptionsRes.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Billing data could not be loaded. Check the API and retry.');
    }
  };

  const selectPlan = (field, id) => {
    const next = { ...formData, [field]: id };
    const account = plans.find(plan => String(plan._id) === String(next.membershipPlanId));
    const gym = equipmentPlans.find(plan => String(plan._id) === String(next.gymPlanId));
    next.amount = account || gym ? (Number(account?.price || 0) + Number(gym?.price || 0)).toFixed(2) : '';
    setFormData(next);
  };

  const handleCreatePayment = async (e) => {
    e.preventDefault();
    try {
      setPaymentBusy(true);
      setPaymentError('');
      const { data } = await paymentsAPI.checkout(formData);
      setReceiptNotice(`Payment recorded under ${data.receiptNumber}. ${data.purchaseType === 'bundle' ? 'Both plans were added.' : 'Plan was added.'}`);
      setError('');
      setIsModalOpen(false);
      setFormData({ memberId: '', membershipPlanId: '', gymPlanId: '', amount: '', paymentMethod: 'cash', notes: '' });
      await fetchData();
    } catch (err) {
      setPaymentError(err.response?.data?.message || 'Payment could not be processed. Review the details and retry.');
    } finally {
      setPaymentBusy(false);
    }
  };

  const openPlanEditor = (plan, type) => setPlanEditor({
    id: plan._id, mode: 'edit', type, name: plan.name, duration: plan.duration,
    durationUnit: plan.durationUnit || 'month', price: plan.price
  });

  const openPlanCreator = (type) => setPlanEditor({
    mode: 'create', type,
    name: type === 'membership' ? 'Account Membership' : '',
    duration: type === 'membership' ? 12 : 1,
    durationUnit: 'month',
    price: type === 'membership' ? 500 : ''
  });

  const savePlan = async (event) => {
    event.preventDefault();
    try {
      if (!Number.isFinite(Number(planEditor.price)) || Number(planEditor.price) <= 0) {
        setError('Plan price must be greater than ₱0.');
        return;
      }
      const body = planEditor.type === 'membership'
        ? { name: planEditor.name, duration: Number(planEditor.duration), price: Number(planEditor.price), type: 'account_membership' }
        : { name: planEditor.name, duration: Number(planEditor.duration), durationUnit: planEditor.durationUnit, price: Number(planEditor.price) };
      if (planEditor.type === 'membership') {
        if (planEditor.mode === 'create') await plansAPI.create(body);
        else await plansAPI.update(planEditor.id, body);
      } else if (planEditor.mode === 'create') await equipmentPlansAPI.create(body);
      else await equipmentPlansAPI.update(planEditor.id, body);
      setPlanEditor(null);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Plan settings could not be saved.');
    }
  };

  const deletePlan = async (plan, type) => {
    if (!window.confirm(`Delete the ${plan.name} plan from new sales? Existing purchases will keep their history.`)) return;
    try {
      if (type === 'membership') await plansAPI.remove(plan._id);
      else await equipmentPlansAPI.remove(plan._id);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Plan could not be deleted.');
    }
  };

  const handleRefund = async (payment) => {
    if (!window.confirm(`Refund receipt ${payment.receiptNumber || ''}?`)) return;
    try {
      await paymentsAPI.refund(payment._id);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Refund could not be processed. Refresh and retry.');
    }
  };

  // Calculate totals from the loaded payment records.
  const totalCollected = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const pendingCount = payments.filter(p => p.status === 'pending').length;
  const refundedCount = payments.filter(p => p.status === 'refunded').length;

  return (
    <div className="ops-page payments-page page-enter">
      
      {/* Page title and payment controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-extrabold text-[#f5f5f5]">{isAdmin ? 'Payments & Billing' : 'Plan Sales'}</h1>
          </div>
          <p className="text-gray-400 text-sm">{isAdmin ? 'Review transactions, monitor revenue, and manage refunds.' : 'Enroll members in a plan and record their payment at the front desk.'}</p>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-zinc-500 to-zinc-600 hover:from-zinc-400 hover:to-zinc-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-zinc-500/20"
        >
          <Plus className="w-5 h-5" /> {isAdmin ? 'New Payment' : 'New Plan Sale'}
        </button>
      </div>

      {error && <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"><span>{error}</span><button onClick={fetchData} className="shrink-0 font-semibold text-zinc-300">Retry</button></div>}
      {receiptNotice && <div role="status" className="rounded-xl border border-zinc-500/30 bg-zinc-500/10 p-4 text-sm text-zinc-200">{receiptNotice}</div>}

      <section className="plan-overview" aria-label="Account membership and gym gatepass plans">
        <div><span className="eyebrow">PLAN CATALOG</span><h2>Plans & Pricing</h2><p>Account membership is required for account setup. Daily, monthly, or yearly plans grant gym entry.</p>{isAdmin && <div className="mt-3 flex flex-wrap gap-2"><button className="btn btn-secondary" onClick={() => openPlanCreator('membership')}><Plus size={14} /> Add Account Plan</button><button className="btn btn-secondary" onClick={() => openPlanCreator('equipment')}><Plus size={14} /> Add Gym Plan</button></div>}</div>
        <div className="plan-overview-grid">
          {[...plans.map(plan => ({ ...plan, kind: 'membership', durationLabel: `${plan.duration} month${plan.duration === 1 ? '' : 's'}` })), ...equipmentPlans.map(plan => ({ ...plan, kind: 'equipment', durationLabel: `${plan.duration} ${plan.durationUnit}${plan.duration === 1 ? '' : 's'}` }))].map(plan => <article className="plan-overview-card" key={`${plan.kind}-${plan._id}`}><div className="plan-overview-info"><span>{plan.kind === 'membership' ? 'Account Creation' : 'Gym Entry Plan'}</span><strong>{plan.name}</strong><small>{plan.durationLabel} · ₱{Number(plan.price).toLocaleString('en-PH')}</small></div>{isAdmin && <div className="plan-overview-actions"><button className="btn btn-secondary" onClick={() => openPlanEditor(plan, plan.kind)}>Edit</button><button className="btn btn-danger" onClick={() => deletePlan(plan, plan.kind)} aria-label={`Delete ${plan.name}`} title="Remove this plan from new sales"><Trash2 size={14} /> Delete</button></div>}</article>)}
        </div>
      </section>

      <section className="ops-card equipment-access-list"><div className="list-toolbar"><div><span className="eyebrow">GYM GATEPASSES</span><h2>Member Gym Entry Access</h2></div><span className="text-sm text-gray-400">{equipmentSubscriptions.filter(subscription => subscription.status === 'active' && new Date(subscription.startDate) <= new Date() && new Date(subscription.endDate) > new Date()).length} active</span></div><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Member</th><th>Gatepass</th><th>Start date</th><th>Valid through</th><th>Status</th></tr></thead><tbody>{equipmentSubscriptions.slice(0, 8).map(subscription => { const scheduled = subscription.status === 'active' && new Date(subscription.startDate) > new Date(); const active = subscription.status === 'active' && new Date(subscription.startDate) <= new Date() && new Date(subscription.endDate) > new Date(); return <tr key={subscription._id}><td>{subscription.memberId ? `${subscription.memberId.firstName} ${subscription.memberId.lastName}` : 'Member unavailable'}</td><td>{subscription.planId?.name || 'Gym Gatepass'}</td><td>{new Date(subscription.startDate).toLocaleDateString()}</td><td>{new Date(subscription.endDate).toLocaleDateString()}</td><td><span className={`subscription-status ${active ? 'active' : 'expired'}`}>{active ? 'Active' : scheduled ? 'Scheduled' : subscription.status || 'Expired'}</span></td></tr>; })}{equipmentSubscriptions.length === 0 && <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-400">No gatepasses yet.</td></tr>}</tbody></table></div></section>

      {!isAdmin && <div className="permission-note"><ShieldCheck size={17} /><span>Staff can process authorized sales and view transaction history, but cannot edit or refund existing records. Revenue totals are administrator-only.</span></div>}

      {/* Payment totals and counts */}
      {isAdmin && <section className="metric-strip payment-metrics" aria-label="Payment summary">
        <div className="metric-tile"><span>PLAN PAYMENTS COLLECTED</span><strong>₱{totalCollected.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><small>Completed payments</small></div>
        <div className="metric-tile"><span>PENDING PAYMENTS</span><strong>{pendingCount}</strong><small>Awaiting clearance</small></div>
        <div className="metric-tile"><span>REFUNDED</span><strong>{refundedCount}</strong><small>Returned payments</small></div>
      </section>}

      {/* Payment history */}
      <div className="bg-[#0b0b0b] rounded-2xl border border-[#242424] shadow-xl overflow-hidden">
        <div className="p-6 border-b border-[#242424] flex justify-between items-center bg-[#0b0b0b]">
          <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-gray-400" /> Transaction History
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#111111] text-xs font-semibold tracking-wide text-gray-500 uppercase border-b border-[#242424]">
                <th className="px-6 py-4">Receipt #</th>
                <th className="px-6 py-4">Member</th>
                <th className="px-6 py-4">Purchase</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Method</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Status</th>
                {isAdmin && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#242424]">
              {payments.length === 0 ? (
                <tr><td colSpan={isAdmin ? 8 : 7} className="px-6 py-12 text-center text-gray-500">No payments found</td></tr>
              ) : (
                payments.map((payment, idx) => (
                  <tr key={idx} className="hover:bg-zinc-900/10 transition-colors table-row-hover group">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-gray-400 bg-[#111111] px-2 py-1 rounded border border-[#242424]">
                        {payment.receiptNumber || `#RCPT-${idx+1}`}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-200">{payment.memberId?.firstName} {payment.memberId?.lastName}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300"><div>{payment.purchaseType === 'bundle' ? 'Account + Gym Plan' : payment.purchaseType === 'equipment' ? 'Gym Gatepass' : 'Account Membership'}</div><small className="text-gray-400">{[payment.planId?.name, payment.equipmentPlanId?.name].filter(Boolean).join(' + ')}</small></td>
                    <td className="px-6 py-4">
                      <span className="money-value">₱{Number(payment.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="uppercase text-xs font-semibold tracking-wider text-gray-400 bg-gray-800/50 px-2.5 py-1 rounded-md border border-gray-700/50">
                        {payment.paymentMethod}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        payment.status === 'completed' ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' : 
                        payment.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        payment.status === 'refunded' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          payment.status === 'completed' ? 'bg-zinc-400' : 
                          payment.status === 'pending' ? 'bg-amber-400' :
                          payment.status === 'refunded' ? 'bg-rose-400' : 'bg-gray-400'
                        }`}></span>
                        {payment.status || 'completed'}
                      </span>
                    </td>
                    {isAdmin && <td className="px-6 py-4 text-right">
                      {payment.status !== 'refunded' && (
                        <button onClick={() => handleRefund(payment)} className="text-xs font-medium px-3 py-1.5 rounded border border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                          Refund
                        </button>
                      )}
                    </td>}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form for recording a payment */}
      {isModalOpen && <Dialog onClose={() => { if (!paymentBusy) setIsModalOpen(false); }} labelledBy="payment-form-title" className="long-form-dialog payment-form-dialog">
          <div className="w-full relative z-10 flex min-h-0 flex-col overflow-hidden">
            
            <div className="flex shrink-0 justify-between items-center p-5 border-b border-[#242424]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-500/10 rounded-lg">
                  <CreditCard className="w-5 h-5 text-zinc-400" />
                </div>
                <h2 id="payment-form-title" className="text-xl font-bold text-gray-100">Record Plan Payment</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#111111] transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleCreatePayment} className="min-h-0 overflow-y-auto p-5 space-y-5">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">Select Member</label>
                <div className="relative">
                  <select required value={formData.memberId} onChange={e => { setFormData({...formData, memberId: e.target.value}); setPlanStatus(null); }} className="w-full appearance-none bg-[#111111] border border-[#303030] text-gray-100 px-4 py-3 rounded-xl focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 outline-none transition-all cursor-pointer">
                    <option value="" disabled>-- Choose Member --</option>
                    {members.filter(m => m.status === 'active').map(m => (
                      <option key={m._id} value={m._id}>{m.firstName} {m.lastName}</option>
                    ))}
                  </select>
                  <ArrowDownRight className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
              </div>
              
              {formData.memberId && <section className="rounded-xl border border-[#2a2a2a] bg-[#121212] p-4" aria-label="Current member plans">
                <h3 className="mb-3 text-base font-bold text-gray-100">Current and scheduled plans</h3>
                {planStatusBusy ? <p className="text-sm text-gray-300">Loading plan status…</p> : planStatus ? <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['Account membership', planStatus.accountPlans],
                    ['Gym access', planStatus.gymPlans]
                  ].map(([label, entries]) => <div key={label} className="rounded-lg border border-[#303030] bg-[#0b0b0b] p-3">
                    <strong className="text-sm text-zinc-200">{label}</strong>
                    {entries.length ? entries.map(entry => <p key={entry._id} className="mt-2 text-sm text-gray-200"><span className={entry.state === 'current' ? 'text-zinc-300' : 'text-amber-300'}>{entry.state === 'current' ? 'Current' : 'Scheduled'}</span> · {entry.planName}<br /><span className="text-gray-400">{new Date(entry.startDate).toLocaleDateString()} – {new Date(entry.endDate).toLocaleDateString()}</span></p>) : <p className="mt-2 text-sm text-gray-400">No current plan</p>}
                  </div>)}
                </div> : <p className="text-sm text-gray-400">Select a member to see existing plans.</p>}
              </section>}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-gray-200">Account membership (optional)
                  <select value={formData.membershipPlanId} onChange={event => selectPlan('membershipPlanId', event.target.value)} className="w-full bg-[#111111] border border-[#303030] text-gray-100 px-4 py-3 rounded-xl">
                    <option value="">No account membership</option>
                    {plans.map(plan => <option key={plan._id} value={plan._id}>{plan.name} · ₱{Number(plan.price).toLocaleString('en-PH')}</option>)}
                  </select>
                  <span className="text-sm font-normal text-gray-400">Needed for member portal access.</span>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-gray-200">Gym plan (optional)
                  <select value={formData.gymPlanId} onChange={event => selectPlan('gymPlanId', event.target.value)} className="w-full bg-[#111111] border border-[#303030] text-gray-100 px-4 py-3 rounded-xl">
                    <option value="">No gym plan</option>
                    {equipmentPlans.map(plan => <option key={plan._id} value={plan._id}>{plan.name} · {plan.duration} {plan.durationUnit} · ₱{Number(plan.price).toLocaleString('en-PH')}</option>)}
                  </select>
                  <span className="text-sm font-normal text-gray-400">Needed for gym entry.</span>
                </label>
              </div>
              <p className="text-sm text-gray-300">Choose either plan or both. A renewal starts after the member’s existing term ends.</p>
              
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-300">{isAdmin ? 'Total payment (admin may adjust)' : 'Total plan price'}</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#f5f5f5]">₱</span>
                    <input type="number" min="0.01" step="0.01" required readOnly={!isAdmin} value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className={`w-full bg-[#111111] border border-[#303030] text-[#f5f5f5] pl-8 pr-4 py-3 rounded-xl focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 outline-none transition-all font-bold tabular-nums ${!isAdmin ? 'cursor-not-allowed' : ''}`} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-300">Payment Method</label>
                  <div className="relative">
                    <select value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})} className="w-full appearance-none bg-[#111111] border border-[#303030] text-gray-100 px-4 py-3 rounded-xl focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 outline-none transition-all cursor-pointer">
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="gcash">GCash</option>
                      <option value="bank_transfer">Bank Transfer</option>
                    </select>
                    <ArrowDownRight className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  </div>
                </div>
              </div>

              <label className="grid gap-2 text-sm font-medium text-gray-300">Notes (optional)
                <textarea rows="2" value={formData.notes} onChange={event => setFormData({ ...formData, notes: event.target.value })} className="w-full rounded-xl border border-[#303030] bg-[#111111] px-4 py-3 text-gray-100" />
              </label>
              {paymentError && <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{paymentError}</div>}

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-[#242424]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl font-semibold text-gray-300 hover:bg-[#111111] transition-colors">Cancel</button>
                <button type="submit" disabled={paymentBusy || !formData.memberId || (!formData.membershipPlanId && !formData.gymPlanId)} className="bg-gradient-to-r from-zinc-500 to-zinc-600 hover:from-zinc-400 hover:to-zinc-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-zinc-500/20 flex items-center gap-2 whitespace-nowrap">
                  <CreditCard className="w-4 h-4" /> {paymentBusy ? 'Processing…' : 'Record payment'}
                </button>
              </div>
            </form>
          </div>
      </Dialog>}

      {planEditor && <Dialog onClose={() => setPlanEditor(null)} labelledBy="plan-dialog-title" className="inventory-dialog"><form onSubmit={savePlan} className="plan-editor-dialog"><div className="flex items-start justify-between gap-4"><div><span className="eyebrow">Admin Settings</span><h2 id="plan-dialog-title">{planEditor.mode === 'create' ? 'Create' : 'Edit'} {planEditor.type === 'membership' ? 'Account Membership' : 'Gym'} Plan</h2></div><button type="button" className="icon-button" onClick={() => setPlanEditor(null)} aria-label="Close dialog" title="Close"><X size={18} /></button></div><label>Plan Name<input required value={planEditor.name} onChange={e => setPlanEditor({ ...planEditor, name: e.target.value })} /></label><div className="plan-editor-grid"><label>Duration<input type="number" required min="1" max="120" value={planEditor.duration} onChange={e => setPlanEditor({ ...planEditor, duration: e.target.value })} /></label>{planEditor.type === 'membership' ? <label>Duration Unit<input value="Months" disabled /></label> : <label>Duration Unit<select value={planEditor.durationUnit} onChange={e => setPlanEditor({ ...planEditor, durationUnit: e.target.value })}><option value="day">Days</option><option value="month">Months</option><option value="year">Years</option></select></label>}<label>Price (₱)<input type="number" required min="0.01" step="0.01" value={planEditor.price} onChange={e => setPlanEditor({ ...planEditor, price: e.target.value })} /></label></div><div className="flex justify-end gap-2"><button type="button" className="btn btn-secondary" onClick={() => setPlanEditor(null)}>Cancel</button><button className="btn btn-primary" type="submit">{planEditor.mode === 'create' ? 'Create Plan' : 'Save Changes'}</button></div></form></Dialog>}
    </div>
  );
}
