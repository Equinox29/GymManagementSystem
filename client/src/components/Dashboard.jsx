import { useState, useEffect } from 'react';
import { AlertTriangle, UserPlus, Receipt, Clock, CheckCircle, ArrowRight, Dumbbell, PackagePlus, ShoppingCart, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [stats, setStats] = useState({
    activeMembers: 0, todayCheckIns: 0, lowStockItems: [], monthlyRevenue: 0,
    monthlyPlanRevenue: 0, monthlyInventoryRevenue: 0,
    recentPayments: [], expiringMemberships: []
  });
  const [loadError, setLoadError] = useState('');

  const loadStats = () => {
    dashboardAPI.getStats()
      .then(res => { setStats(res.data); setLoadError(''); })
      .catch(err => setLoadError(err.response?.data?.message || 'Dashboard data could not be loaded. Check the API and retry.'));
  };

  useEffect(() => { loadStats(); }, []);

  return (
    <div className="dashboard-page ops-page">
      <div className="ops-page-heading"><div><span className="eyebrow">OVERVIEW</span><h1>Dashboard</h1><p>Today’s gym activity, sales, and stock at a glance.</p></div></div>

      {loadError && <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"><span>{loadError}</span><button onClick={loadStats} className="shrink-0 font-semibold text-zinc-300">Retry</button></div>}
      
      {/* Live totals from the dashboard API */}
      <section className="metric-strip dashboard-metrics" aria-label="Gym overview">
        <div className="metric-tile"><span>TOTAL MEMBERS</span><strong>{stats.totalMembers || 0}</strong><small>Registered profiles</small></div>
        <div className="metric-tile"><span>ACTIVE MEMBERS</span><strong>{stats.activeMembers || 0}</strong><small>Currently active</small></div>
        <div className="metric-tile"><span>TODAY’S CHECK-INS</span><strong>{stats.todayCheckIns || 0}</strong><small>Visits started today</small></div>
        <div className="metric-tile"><span>LOW STOCK</span><strong>{stats.lowStockItems?.length || 0}</strong><small>At or below reorder level</small></div>
        <div className="metric-tile"><span>MONTHLY REVENUE</span><strong>{isAdmin ? `₱${Number(stats.monthlyRevenue || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}` : '—'}</strong><small>{isAdmin ? `Plans ₱${Number(stats.monthlyPlanRevenue || 0).toLocaleString('en-PH')} · Inventory ₱${Number(stats.monthlyInventoryRevenue || 0).toLocaleString('en-PH')}` : 'Admin access only'}</small></div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shortcuts to common tasks */}
        <section className="quick-actions-card">
          <div className="quick-actions-heading">
            <div>
              <span className="quick-actions-kicker"><Clock size={13} /> FRONT DESK TOOLS</span>
              <h2>Quick Actions</h2>
              <p>Keep the club moving with fewer steps.</p>
            </div>
            <span className="quick-actions-mark"><Dumbbell size={18} /></span>
          </div>
          <button onClick={() => navigate('/attendance')} className="quick-action-featured">
            <span className="quick-action-icon"><CheckCircle size={19} /></span>
            <span className="quick-action-copy"><strong>Check In a Member</strong><small>Find a member and start today's visit</small></span>
            <ArrowRight size={17} />
          </button>
          <div className="quick-action-grid">
            <button onClick={() => navigate('/members')} className="quick-action-tile">
              <span className="quick-action-tile-icon member"><UserPlus size={17} /></span>
              <strong>New Member</strong><small>Create a profile</small><ArrowRight size={15} />
            </button>
            <button onClick={() => navigate('/payments')} className="quick-action-tile">
              <span className="quick-action-tile-icon billing"><Receipt size={17} /></span>
              <strong>Membership Sale</strong><small>Start a plan and record payment</small><ArrowRight size={15} />
            </button>
            <button onClick={() => navigate('/inventory')} className="quick-action-tile quick-action-inventory">
              <span className="quick-action-tile-icon supply"><PackagePlus size={17} /></span>
              <strong>Inventory</strong><small>Review supplies and stock</small><ArrowRight size={15} />
            </button>
            <button onClick={() => navigate('/inventory/sales')} className="quick-action-tile quick-action-inventory">
              <span className="quick-action-tile-icon supply"><ShoppingCart size={17} /></span>
              <strong>Inventory Sales</strong><small>Record and review product sales</small><ArrowRight size={15} />
            </button>
          </div>
        </section>

        {/* Latest payments */}
        {isAdmin ? <div className="recent-payments-card lg:col-span-2 bg-[#0b0b0b] rounded-2xl border border-[#242424] overflow-hidden flex flex-col">
          <div className="p-6 border-b border-[#242424] flex justify-between items-center bg-[#0b0b0b]">
            <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-gray-400" /> Recent Payments
            </h2>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-semibold tracking-wide text-gray-500 uppercase border-b border-[#242424] bg-[#111111]">
                  <th className="px-6 py-4">Member</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242424]">
                {stats.recentPayments.length === 0 ? (
                  <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">No recent payments</td></tr>
                ) : (
                  stats.recentPayments.map((p, i) => (
                    <tr key={i} className="hover:bg-[#111111]/50 transition-colors table-row-hover">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-200">{p.memberId?.firstName} {p.memberId?.lastName}</div>
                      </td>
                      <td className="px-6 py-4"><span className="money-value">₱{Number(p.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></td>
                      <td className="px-6 py-4 capitalize text-gray-400 text-sm">{p.paymentMethod}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${p.status === 'completed' ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'completed' ? 'bg-zinc-400' : 'bg-amber-400'}`}></span>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div> : <section className="role-scope-card lg:col-span-2"><div className="role-scope-icon"><ShieldCheck size={19} /></div><div><span className="eyebrow">STAFF ACCESS</span><h2>Front Desk Operations</h2><p>You can manage member contact details, sell memberships and stocked products, check members in or out, and report or resolve equipment issues.</p><small>Admin-only: dashboard revenue and payment history, refunds, plan prices and discounts, member status changes, inventory pricing and restocking, and equipment record edits.</small></div></section>}
      </div>

      {/* Memberships ending in the next seven days */}
      {stats.expiringMemberships.length > 0 && (
        <section className="ops-card expiring-memberships" aria-label="Expiring memberships">
          <div className="list-toolbar"><div><span className="eyebrow">REVIEW SOON</span><h2><AlertTriangle size={17} /> Expiring Memberships</h2></div><span className="text-sm text-gray-400">Next 7 days</span></div>
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Member</th><th>Plan</th><th>Expires</th></tr></thead><tbody>
            {stats.expiringMemberships.map((m, i) => <tr key={i}><td><strong>{m.memberId?.firstName} {m.memberId?.lastName}</strong></td><td>{m.planId?.name}</td><td><span className="condition-pill attention">{new Date(m.endDate).toLocaleDateString()}</span></td></tr>)}
          </tbody></table></div>
        </section>
      )}
    </div>
  );
}
