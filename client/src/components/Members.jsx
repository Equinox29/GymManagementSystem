import { useState, useEffect } from 'react';
import { membersAPI, plansAPI, membershipsAPI } from '../services/api';
import { Search, X, Plus, Users, UserPlus, Edit, ChevronDown, Mail, Phone, Calendar, ShieldCheck, Copy, PauseCircle, Timer, RotateCcw, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import MemberInviteQr from './MemberInviteQr';
import Dialog from './Dialog';

export default function Members() {
  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [paidAccountMembershipIds, setPaidAccountMembershipIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [billingFilter, setBillingFilter] = useState('priority');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', age: '', email: '', phone: '', emergencyContact: '' });
  const [inviteInfo, setInviteInfo] = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [suspensionForm, setSuspensionForm] = useState({ durationHours: 24, reason: '' });
  const [loadError, setLoadError] = useState('');
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchMembers();
    fetchPlans();
    fetchMemberships();
    const refresh = window.setInterval(() => { fetchMembers(); fetchMemberships(); }, 60_000);
    return () => window.clearInterval(refresh);
  }, []);

  useEffect(() => {
    if (!isModalOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [isModalOpen]);

  const fetchMembers = async () => {
    try { const res = await membersAPI.getAll(); setMembers(res.data); setLoadError(''); }
    catch (err) { setLoadError(err.response?.data?.message || 'Members could not be loaded. Check the API and retry.'); }
  };
  const fetchPlans = async () => {
    try { const res = await plansAPI.getAll(); setPlans(res.data); }
    catch (err) { setLoadError(err.response?.data?.message || 'Membership plans could not be loaded.'); }
  };
  const fetchMemberships = async () => {
    try {
      const { data } = await membershipsAPI.getAll();
      const now = Date.now();
      setPaidAccountMembershipIds(new Set(data.filter(item => ['active', 'expiring_soon'].includes(item.status) && new Date(item.startDate) <= now && new Date(item.endDate) >= now).map(item => item.memberId?._id).filter(id => id != null).map(String)));
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Membership payments could not be checked.');
    }
  };

  const issueInvite = async (member) => {
    try {
      const { data } = await membersAPI.createPortalInvite(member._id);
      setInviteInfo({ member, ...data });
      await fetchMembers();
    } catch (err) {
      window.alert(err.response?.data?.message || 'Could not create a member invitation.');
    }
  };

  const suspendMember = async (event) => {
    event.preventDefault();
    try {
      await membersAPI.suspend(suspendTarget._id, suspensionForm);
      setSuspendTarget(null);
      setSuspensionForm({ durationHours: 24, reason: '' });
      await fetchMembers();
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not suspend this member.');
    }
  };

  const reactivateMember = async (member) => {
    try { await membersAPI.clearSuspension(member._id); await fetchMembers(); }
    catch (err) { setLoadError(err.response?.data?.message || 'Could not clear this suspension.'); }
  };
  const removeMember = async (member) => {
    if (!window.confirm(`Remove ${member.firstName} ${member.lastName} from the member directory? Their portal login will stop working, but payment and visit history will be kept.`)) return;
    try { await membersAPI.remove(member._id); await fetchMembers(); }
    catch (err) { setLoadError(err.response?.data?.message || 'Could not remove this member.'); }
  };

  const handleSaveMember = async (e) => {
    e.preventDefault();
    try {
      if (selectedMember) {
        await membersAPI.update(selectedMember._id, formData);
      } else {
        await membersAPI.create(formData);
      }
      setIsModalOpen(false);
      setSelectedMember(null);
      fetchMembers();
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Member could not be saved. Review the details and retry.');
    }
  };

  const getInitials = (first, last) => {
    return `${first?.charAt(0) || ''}${last?.charAt(0) || ''}`.toUpperCase();
  };

  const billingGroup = member => member.hasActiveInvite ? 'invited' :
    !paidAccountMembershipIds.has(String(member._id)) ? 'needs_payment' : 'ready';
  const visibleMembers = members.filter(member => {
    const matchesSearch = `${member.firstName} ${member.lastName} ${member.email || ''} ${member.phone || ''}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (statusFilter === 'all' || member.status === statusFilter) &&
      (billingFilter === 'priority' || billingGroup(member) === billingFilter);
  }).sort((a, b) => {
    const rank = { invited: 0, needs_payment: 1, ready: 2 };
    return rank[billingGroup(a)] - rank[billingGroup(b)] ||
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
  });

  return (
    <div className="ops-page members-page page-enter">

      {loadError && <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"><span>{loadError}</span><button onClick={fetchMembers} className="shrink-0 font-semibold text-zinc-300">Retry</button></div>}
      
      {/* Page title, member search and add button */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-extrabold text-[#f5f5f5]">Members</h1>
            <span className="bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 px-3 py-1 rounded-full text-sm font-semibold">
              {members.length} Total
            </span>
          </div>
          <p className="text-gray-400 text-sm">Manage your gym members, memberships, and contact details. After an account membership is paid, select Generate invite in that member's row.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 basis-full md:basis-auto md:w-72 group">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-zinc-400 transition-colors" />
            <input 
              type="text" 
              placeholder="Search members..."
              value={search}
              onChange={event => setSearch(event.target.value)}
              className="w-full bg-[#0b0b0b] border border-[#242424] text-gray-200 pl-11 pr-4 py-2.5 rounded-xl focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 outline-none transition-all shadow-sm focus:shadow-[0_0_15px_rgba(16,185,129,0.15)]"
            />
          </div>
          
          <div className="relative">
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="appearance-none bg-[#0b0b0b] border border-[#242424] text-gray-300 pl-4 pr-10 py-2.5 rounded-xl outline-none focus:border-zinc-500 hover:border-gray-600 transition-colors cursor-pointer">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="inactive">Inactive</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
          <div className="relative">
            <select aria-label="Billing priority" value={billingFilter} onChange={event => setBillingFilter(event.target.value)} className="appearance-none bg-[#0b0b0b] border border-[#242424] text-gray-300 pl-4 pr-10 py-2.5 rounded-xl outline-none focus:border-zinc-500 cursor-pointer">
              <option value="priority">Invite → unpaid → ready</option>
              <option value="invited">Active invite</option>
              <option value="needs_payment">Needs account payment</option>
              <option value="ready">Paid / ready</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>

          <button 
            onClick={() => { setFormData({}); setSelectedMember(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-gradient-to-r from-zinc-500 to-zinc-600 hover:from-zinc-400 hover:to-zinc-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-zinc-500/20"
          >
            <Plus className="w-5 h-5" /> Add Member
          </button>
        </div>
      </div>

      {/* Member list */}
      <div className="bg-[#0b0b0b] rounded-2xl border border-[#242424] shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#111111] text-xs font-semibold tracking-wide text-gray-500 uppercase border-b border-[#242424]">
                <th className="px-6 py-4">Member</th>
                <th className="px-6 py-4">Contact Details</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Join Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#242424]">
              {visibleMembers.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">No members found</td></tr>
              ) : (
                visibleMembers.map(member => (
                  <tr key={member._id} className="hover:bg-zinc-900/10 transition-colors table-row-hover group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-gray-200 font-bold border border-gray-600 shadow-sm">
                          {getInitials(member.firstName, member.lastName)}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-100">{member.firstName} {member.lastName}</div>
                          <div className="text-xs text-gray-500">Age: {member.age}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <Mail className="w-3.5 h-3.5 text-gray-500" /> {member.email}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <Phone className="w-3.5 h-3.5 text-gray-500" /> {member.phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="grid justify-items-start gap-1"><span className={`member-status-pill ${member.status === 'active' ? 'is-active' : member.status === 'suspended' ? 'is-suspended' : 'is-inactive'}`}><i className="member-status-dot" />{member.status || 'inactive'}</span><small className="text-xs text-gray-300">{billingGroup(member) === 'invited' ? 'Invite active' : billingGroup(member) === 'needs_payment' ? 'Needs account payment' : 'Account paid'}</small>{member.status === 'suspended' && member.suspensionUntil && <small className="member-suspension-expiry">Until {new Date(member.suspensionUntil).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small>}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        {member.joinDate ? new Date(member.joinDate).toLocaleDateString() : '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => { setSelectedMember(member); setFormData(member); setIsModalOpen(true); }} 
                          className="p-2 rounded-lg text-gray-400 hover:text-zinc-400 hover:bg-zinc-500/10 transition-colors"
                          title="Edit Member"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {isAdmin && member.status === 'active' && <button onClick={() => { setSuspendTarget(member); setSuspensionForm({ durationHours: 24, reason: '' }); }} className="p-2 rounded-lg text-gray-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors" title="Set timed suspension" aria-label={`Suspend ${member.firstName}`}><PauseCircle className="w-4 h-4" /></button>}
                        {isAdmin && member.status === 'suspended' && <button onClick={() => reactivateMember(member)} className="p-2 rounded-lg text-gray-400 hover:text-zinc-300 hover:bg-zinc-500/10 transition-colors" title="End suspension and reactivate" aria-label={`Reactivate ${member.firstName}`}><RotateCcw className="w-4 h-4" /></button>}
                        {!member.userId && member.status === 'active' && paidAccountMembershipIds.has(String(member._id)) && <button onClick={() => issueInvite(member)} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-500/30 bg-zinc-500/10 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-500/20 transition-colors" title="Generate a member portal invitation" aria-label={`Generate invite for ${member.firstName}`}><ShieldCheck className="w-4 h-4" />{member.hasActiveInvite ? 'Regenerate invite' : 'Generate invite'}</button>}
                        {!member.userId && member.status === 'active' && !paidAccountMembershipIds.has(String(member._id)) && <span className="text-xs text-gray-500" title="Record an account membership payment before issuing the account invitation">Account membership needed</span>}
                        {member.userId && <span className="text-xs text-gray-500">Portal active</span>}
                        {isAdmin && <button onClick={() => removeMember(member)} className="p-2 rounded-lg text-gray-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors" title="Remove member and revoke portal access" aria-label={`Remove ${member.firstName} ${member.lastName}`}><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form for adding or editing a member */}
      {isModalOpen && <Dialog onClose={() => setIsModalOpen(false)} labelledBy="member-form-title" className="long-form-dialog member-form-dialog">
          <div className="w-full relative z-10 flex min-h-0 flex-col overflow-hidden">
            
            <div className="flex shrink-0 justify-between items-center p-6 border-b border-[#242424]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-500/10 rounded-lg">
                  {selectedMember ? <Edit className="w-5 h-5 text-zinc-400" /> : <UserPlus className="w-5 h-5 text-zinc-400" />}
                </div>
                <h2 id="member-form-title" className="text-xl font-bold text-gray-100">{selectedMember ? 'Edit Member Details' : 'Register New Member'}</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#111111] transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleSaveMember} className="min-h-0 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">First Name</label>
                  <input type="text" value={formData.firstName || ''} onChange={e => setFormData({...formData, firstName: e.target.value})} required className="w-full bg-[#111111] border border-[#303030] text-gray-100 px-4 py-2.5 rounded-xl focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 outline-none transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">Last Name</label>
                  <input type="text" value={formData.lastName || ''} onChange={e => setFormData({...formData, lastName: e.target.value})} required className="w-full bg-[#111111] border border-[#303030] text-gray-100 px-4 py-2.5 rounded-xl focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 outline-none transition-all" />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-5">
                <div className="col-span-2 space-y-1">
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">Email Address</label>
                  <input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} required className="w-full bg-[#111111] border border-[#303030] text-gray-100 px-4 py-2.5 rounded-xl focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 outline-none transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">Age</label>
                  <input type="number" min="1" value={formData.age || ''} onChange={e => setFormData({...formData, age: e.target.value})} required className="w-full bg-[#111111] border border-[#303030] text-gray-100 px-4 py-2.5 rounded-xl focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 outline-none transition-all" />
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">Phone Number</label>
                <input type="text" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} required className="w-full bg-[#111111] border border-[#303030] text-gray-100 px-4 py-2.5 rounded-xl focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 outline-none transition-all" />
              </div>

              <div className="space-y-1">
                <label htmlFor="emergency-contact" className="block text-xs font-medium text-gray-400 uppercase tracking-wide">Emergency Contact (optional)</label>
                <input id="emergency-contact" type="text" maxLength="190" placeholder="Contact name and phone number" value={formData.emergencyContact || ''} onChange={e => setFormData({ ...formData, emergencyContact: e.target.value })} className="w-full bg-[#111111] border border-[#303030] text-gray-100 px-4 py-2.5 rounded-xl focus:border-zinc-500 outline-none" />
              </div>
              {isAdmin && <div className="space-y-1"><label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">Account Status</label><select value={formData.status === 'inactive' ? 'inactive' : 'active'} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full bg-[#111111] border border-[#303030] text-gray-100 px-4 py-2.5 rounded-xl focus:border-zinc-500 outline-none"><option value="active">Active</option><option value="inactive">Inactive</option></select><small className="text-gray-400">Use the timed suspension action to suspend a member.</small></div>}

              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[#242424]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl font-semibold text-gray-300 hover:bg-[#111111] transition-colors">Cancel</button>
                <button type="submit" className="bg-gradient-to-r from-zinc-500 to-zinc-600 hover:from-zinc-400 hover:to-zinc-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-zinc-500/20">
                  {selectedMember ? 'Save Changes' : 'Register Member'}
                </button>
              </div>
            </form>
          </div>
      </Dialog>}

      {inviteInfo && <Dialog onClose={() => setInviteInfo(null)} labelledBy="invite-dialog-title" className="inventory-dialog"><div className="relative z-10 w-full max-w-md rounded-2xl border border-[#2a2a2a] bg-[#0d0d0d] p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><div className="mb-2 flex items-center gap-2 text-zinc-300"><ShieldCheck size={18} /><span className="text-xs font-bold uppercase tracking-widest">Member portal</span></div><h2 id="invite-dialog-title" className="text-xl font-bold text-white">One-Time Invitation</h2><p className="mt-1 text-sm text-gray-400">For {inviteInfo.member.firstName} {inviteInfo.member.lastName}. It expires after 30 minutes.</p></div><button className="text-gray-400 hover:text-white" onClick={() => setInviteInfo(null)}><X size={18} /></button></div><div className="member-invite-share"><MemberInviteQr email={inviteInfo.member.email} inviteCode={inviteInfo.inviteCode} /><div><strong>Scan to set up member access</strong><span>The member can scan this from the login screen. Their email and invite code will fill automatically.</span></div></div><div className="rounded-xl border border-[#292929] bg-[#090909] p-4"><div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500">Or share the invitation code</div><code className="block break-all text-sm leading-6 text-zinc-200">{inviteInfo.inviteCode}</code></div><button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#f5f5f5] py-3 text-sm font-bold text-[#101010]" onClick={async () => { await navigator.clipboard.writeText(inviteInfo.inviteCode); }}><Copy size={15} /> Copy invitation code</button></div></Dialog>}
      {suspendTarget && <Dialog onClose={() => setSuspendTarget(null)} labelledBy="suspend-dialog-title" className="inventory-dialog"><form onSubmit={suspendMember} className="relative z-10 w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#0d0d0d] p-6 shadow-2xl"><div className="mb-5 flex items-start gap-3"><Timer className="mt-1 text-amber-300" /><div><h2 id="suspend-dialog-title" className="text-xl font-bold text-white">Timed Suspension</h2><p className="mt-1 text-sm text-gray-400">{suspendTarget.firstName} {suspendTarget.lastName} will be automatically reactivated when this period ends.</p></div></div><label className="mb-4 block text-sm text-gray-300">Duration (hours)<input className="mt-2 w-full rounded-xl border border-[#303030] bg-[#121212] px-4 py-3 text-white" type="number" min="1" max="720" required value={suspensionForm.durationHours} onChange={e => setSuspensionForm({ ...suspensionForm, durationHours: e.target.value })} /></label><label className="mb-6 block text-sm text-gray-300">Reason (optional)<textarea className="mt-2 w-full rounded-xl border border-[#303030] bg-[#121212] px-4 py-3 text-white" maxLength="500" rows="3" value={suspensionForm.reason} onChange={e => setSuspensionForm({ ...suspensionForm, reason: e.target.value })} /></label><div className="flex justify-end gap-2"><button type="button" className="btn btn-secondary" onClick={() => setSuspendTarget(null)}>Cancel</button><button type="submit" className="btn btn-primary">Suspend Member</button></div></form></Dialog>}
    </div>
  );
}
