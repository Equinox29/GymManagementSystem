import React, { useState, useEffect, useRef } from 'react';
import { Search, CheckCircle, Clock, LogOut, RefreshCw, AlertTriangle, ClipboardCheck, UserCheck, Users, ArrowRight } from 'lucide-react';
import { attendanceAPI, membersAPI } from '../services/api';
import { settingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Attendance = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [members, setMembers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [overstayAlerts, setOverstayAlerts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [visitLimitMinutes, setVisitLimitMinutes] = useState(120);
  const [defaultVisitLimit, setDefaultVisitLimit] = useState(120);
  const [maxCapacity, setMaxCapacity] = useState(50);
  const [configuredCapacity, setConfiguredCapacity] = useState(50);
  const [currentlyIn, setCurrentlyIn] = useState(0);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const notifiedLimitVisits = useRef(new Set());

  const searchRef = useRef(null);

  const fetchAttendance = async () => {
    try {
      const res = await attendanceAPI.getToday();
      const rows = res.data || [];
      setAttendance(rows);
      const { data: alerts } = await attendanceAPI.getTimeLimitAlerts();
      setOverstayAlerts(alerts);
      alerts.forEach(record => {
        if (notifiedLimitVisits.current.has(record._id)) return;
        notifiedLimitVisits.current.add(record._id);
        const name = record.memberId ? `${record.memberId.firstName} ${record.memberId.lastName}` : 'A member';
        showToast(`${name} is over the visit limit and still checked in.`, 'warning');
      });
      const { data } = await settingsAPI.getAttendance();
      setCurrentlyIn(data.currentlyIn);
      setConfiguredCapacity(data.maxCapacity);
    } catch (err) {
      console.error('Error fetching attendance', err);
      setAttendance([]);
      setError(err.response?.data?.message || 'Could not load today’s check-ins.');
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await membersAPI.getAll();
      setMembers(res.data || []);
    } catch (err) {
      console.error('Error fetching members', err);
      setMembers([]);
      setError(err.response?.data?.message || 'Could not load the member directory.');
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchAttendance(), fetchMembers(), settingsAPI.getAttendance().then(({ data }) => {
      const limit = Number(data.memberVisitLimitMinutes) || 120;
      setDefaultVisitLimit(limit);
      setVisitLimitMinutes(limit);
      setMaxCapacity(Number(data.maxCapacity) || 50);
      setConfiguredCapacity(Number(data.maxCapacity) || 50);
      setCurrentlyIn(Number(data.currentlyIn) || 0);
    }).catch(err => setError(err.response?.data?.message || 'Could not load visit limit settings.'))]);
    setLoading(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAttendance();
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadData();
    const dataInterval = setInterval(() => {
      fetchAttendance();
    }, 30000);
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(timeInterval);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCheckIn = async (member) => {
    try {
      if (member.status !== 'active') {
        showToast('Only active members can check in.', 'error');
        return;
      }
      await attendanceAPI.checkIn({ memberId: member._id, visitLimitMinutes: Number(visitLimitMinutes) });
      showToast(`Successfully checked in ${member.firstName} ${member.lastName}`, 'success');
      setSearchQuery('');
      setShowDropdown(false);
      fetchAttendance();
    } catch (err) {
      console.error('Check-in error', err);
      showToast(err.response?.data?.message || 'Check-in failed.', 'error');
    }
  };

  const saveDefaultLimit = async () => {
    setSettingsBusy(true);
    try {
      const { data } = await settingsAPI.updateAttendance({ memberVisitLimitMinutes: Number(defaultVisitLimit), maxCapacity: Number(maxCapacity) });
      setDefaultVisitLimit(data.memberVisitLimitMinutes);
      setVisitLimitMinutes(data.memberVisitLimitMinutes);
      setMaxCapacity(data.maxCapacity);
      setConfiguredCapacity(data.maxCapacity);
      showToast('Attendance settings saved.', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not save the default visit limit.', 'error');
    } finally { setSettingsBusy(false); }
  };

  const handleCheckOut = async (attendanceId) => {
    try {
      await attendanceAPI.checkOut(attendanceId);
      showToast('Checked out successfully', 'success');
      fetchAttendance();
    } catch (err) {
      console.error('Check-out error', err);
      showToast(err.response?.data?.message || 'Check-out failed.', 'error');
    }
  };

  const reviewOverstay = async (visit, action) => {
    let durationHours;
    if (action === 'suspend') {
      durationHours = Number(window.prompt(`Suspend ${visit.memberId.firstName} ${visit.memberId.lastName} for how many hours? (1–720)`, '24'));
      if (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > 720) return;
    } else if (!window.confirm('Dismiss this overstay alert without a suspension?')) return;
    try {
      await attendanceAPI.reviewTimeLimitAlert(visit._id, { action, durationHours, reason: 'Exceeded gym visit time limit' });
      showToast(action === 'suspend' ? 'Member suspended. Alert reviewed.' : 'Alert reviewed.', 'success');
      await fetchAttendance();
      await fetchMembers();
    } catch (err) { showToast(err.response?.data?.message || 'Could not review this overstay.', 'error'); }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const formatTime = (dateString) => {
    if (!dateString) return '--:--';
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (checkIn, checkOut) => {
    const start = new Date(checkIn);
    const end = checkOut ? new Date(checkOut) : new Date();
    const diffMins = Math.floor((end - start) / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const filteredMembers = members.filter(m => 
    `${m.firstName} ${m.lastName} ${m._id || ''} ${m._id?.slice(-6) || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const checkedOutCount = attendance.filter(a => a.checkOut).length;
  const totalToday = attendance.filter(record => new Date(record.checkIn).toDateString() === currentTime.toDateString()).length;

  const todayStr = new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());
  const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (loading) {
    return <div className="p-8 text-gray-400 flex items-center justify-center min-h-[50vh] bg-[#050505]"><RefreshCw className="animate-spin w-8 h-8 text-zinc-500" /></div>;
  }

  return (
    <div className="attendance-page ops-page font-sans">
      <div className="attendance-page-inner">
        
        {/* Page title and attendance filters */}
        <div className="attendance-page-header flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[#f5f5f5] mb-1">Attendance Tracker</h1>
              <div className="flex items-center gap-3 text-sm font-medium">
                <span className="text-zinc-400/90">{todayStr}</span>
                <span className="w-1 h-1 rounded-full bg-[#242424]"></span>
                <span className="text-gray-400 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {timeStr}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-[#0b0b0b] border border-[#242424] hover:bg-[#111111] hover:border-gray-600 rounded-xl transition-all duration-200 text-sm font-medium shadow-lg"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-zinc-400' : 'text-gray-400'}`} />
            Refresh
          </button>
        </div>

        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 transition-all animate-in fade-in slide-in-from-top-5 ${toast.type === 'success' ? 'bg-[#0b0b0b] border-zinc-500/30 text-zinc-400' : toast.type === 'warning' ? 'bg-[#0b0b0b] border-amber-500/30 text-amber-300' : 'bg-[#0b0b0b] border-rose-500/30 text-rose-400'}`}>
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5 " /> : <AlertTriangle className="w-5 h-5 " />}
            <span className="font-medium text-sm">{toast.message}</span>
          </div>
        )}

        {error && <div className="notice error" role="alert"><AlertTriangle size={16} /><span>{error}</span></div>}

        {overstayAlerts.length > 0 && <div className="attendance-limit-alert" role="status"><AlertTriangle size={18} /><div><strong>Member visit limit exceeded — review needed</strong>{overstayAlerts.map(visit => <div key={visit._id} className="flex flex-wrap items-center gap-2 py-1"><span>{visit.memberId.firstName} {visit.memberId.lastName} · {visit.checkOut ? 'checked out' : 'still checked in'} · limit {visit.visitLimitMinutes} min</span>{isAdmin && <><button type="button" className="btn btn-secondary" onClick={() => reviewOverstay(visit, 'suspend')}>Suspend</button><button type="button" className="btn btn-secondary" onClick={() => reviewOverstay(visit, 'dismiss')}>Dismiss</button></>}</div>)}</div></div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Find a member and check them in */}
          <div className="lg:col-span-2">
            <div className="attendance-checkin-card bg-[#111111] border border-[#242424] rounded-2xl p-6 relative z-10 overflow-visible" ref={searchRef}>
              <h2 className="text-xl font-semibold mb-1 flex items-center gap-2"><UserCheck className="w-5 h-5 text-zinc-400" /> Front Desk Check-In</h2>
              <p className="text-sm text-gray-400 mb-5">Search the roster to check in a member. Each member can check in once per day.</p>
              <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-[#292929] bg-[#101010] p-4">
                <label className="grid gap-1.5 text-sm text-gray-300">Visit limit for this check-in
                  <div className="flex items-center gap-2"><input type="number" min="15" max="480" step="15" value={visitLimitMinutes} onChange={event => setVisitLimitMinutes(event.target.value)} className="w-28 rounded-lg border border-[#303030] bg-[#090909] px-3 py-2 text-base text-gray-100" /><span className="text-gray-400">minutes</span></div>
                </label>
                {isAdmin && <label className="grid gap-1.5 text-sm text-gray-300">Default for member self check-in
                  <div className="flex items-center gap-2"><input type="number" min="15" max="480" step="15" value={defaultVisitLimit} onChange={event => setDefaultVisitLimit(event.target.value)} className="w-28 rounded-lg border border-[#303030] bg-[#090909] px-3 py-2 text-base text-gray-100" /><span className="text-gray-400">minutes</span></div>
                </label>}
                {isAdmin && <label className="grid gap-1.5 text-sm text-gray-300">Maximum people in gym
                  <div className="flex items-center gap-2"><input type="number" min="1" max="10000" value={maxCapacity} onChange={event => setMaxCapacity(event.target.value)} className="w-28 rounded-lg border border-[#303030] bg-[#090909] px-3 py-2 text-base text-gray-100" /><span className="text-gray-400">people</span><button type="button" disabled={settingsBusy} onClick={saveDefaultLimit} className="btn btn-secondary">{settingsBusy ? 'Saving…' : 'Save settings'}</button></div>
                </label>}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-zinc-500/50" />
                </div>
                <input
                  type="text"
                  className="w-full bg-[#0b0b0b] border border-[#242424] text-gray-200 rounded-xl pl-12 pr-4 py-3.5 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/20 transition-all outline-none shadow-inner"
                  placeholder="Find a member by name or ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                />
              </div>

              {showDropdown && searchQuery && (
                <div className="absolute left-6 right-6 mt-3 bg-[#0b0b0b] border border-[#242424] rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] max-h-64 overflow-y-auto z-20">
                  {filteredMembers.length > 0 ? (
                    filteredMembers.map(member => {
                      const todayVisit = attendance.find(record => String(record.memberId?._id) === String(member._id));
                      const stillHere = Boolean(todayVisit && !todayVisit.checkOut);
                      const alreadyVisited = Boolean(todayVisit);
                      return <div key={member._id} className="flex items-center justify-between p-4 border-b border-[#242424] hover:bg-[#111111] transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#242424] flex items-center justify-center text-sm font-bold text-gray-300">
                            {getInitials(member.firstName, member.lastName)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-200 group-hover:text-zinc-400 transition-colors">{member.firstName} {member.lastName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-500 font-mono">ID: {member._id.slice(-6)}</span>
                              <div className="flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${member.status === 'active' ? 'bg-zinc-500 shadow-[0_0_5px_#a1a1aa]' : 'bg-rose-500'}`}></span>
                                <span className={`text-[10px] font-medium uppercase tracking-wider ${member.status === 'active' ? 'text-zinc-400' : 'text-rose-400'}`}>
                                  {member.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleCheckIn(member)}
                          disabled={member.status !== 'active' || alreadyVisited}
                          className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg ${member.status === 'active' && !alreadyVisited ? 'bg-gradient-to-r from-zinc-500 to-zinc-600 hover:from-zinc-600 hover:to-zinc-700 text-white shadow-zinc-500/20' : 'bg-[#242424] text-gray-500 cursor-not-allowed shadow-none'}`}
                        >
                          {stillHere ? 'Already in' : alreadyVisited ? 'Done today' : 'Check In'}
                        </button>
                      </div>
                    })
                  ) : (
                    <div className="p-6 text-center flex flex-col items-center justify-center text-gray-500">
                      <Search className="w-8 h-8 mb-2 opacity-20" />
                      <p>No members found matching "{searchQuery}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Attendance totals */}
          <div className="attendance-side-metrics" aria-label="Today's attendance summary">
            <div><span>CURRENTLY IN</span><strong>{currentlyIn} / {configuredCapacity}</strong><small>{Math.max(0, configuredCapacity - currentlyIn)} spaces available</small></div>
            <div><span>CHECKED OUT</span><strong>{checkedOutCount}</strong><small>Visits completed today</small></div>
            <div><span>TOTAL TODAY</span><strong>{totalToday}</strong><small>All visits started today</small></div>
          </div>
        </div>

        {/* Today's check-in and checkout records */}
        <div className="attendance-history bg-[#0b0b0b] border border-[#242424] rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-[#242424] flex justify-between items-center bg-[#0b0b0b]">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Clock className="w-5 h-5 text-gray-400" /> Today’s Activity and Open Visits</h3>
            <span className="px-3 py-1 rounded-full bg-[#111111] border border-[#242424] text-xs font-medium text-gray-400">
              {attendance.length} entries
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#050505]/50 text-gray-400 border-b border-[#242424]">
                <tr>
                  <th className="px-6 py-4 font-semibold">Member</th>
                  <th className="px-6 py-4 font-semibold">Check In</th>
                  <th className="px-6 py-4 font-semibold">Status / Check Out</th>
                  <th className="px-6 py-4 font-semibold">Duration</th>
                  <th className="px-6 py-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242424]">
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-500 space-y-3">
                        <Users className="w-8 h-8 opacity-20" />
                        <p>No check-ins today yet.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  attendance.map(record => {
                    const isStillHere = !record.checkOut;
                    return (
                      <tr key={record._id} className="hover:bg-[#111111]/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isStillHere ? 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30' : 'bg-[#242424] text-gray-400 border border-[#303030]'}`}>
                              {record.memberId ? getInitials(record.memberId.firstName, record.memberId.lastName) : getInitials(record.userId?.username, '')}
                            </div>
                            <span className="font-semibold text-gray-200 group-hover:text-white transition-colors">
                              {record.memberId ? `${record.memberId.firstName} ${record.memberId.lastName}` : `${record.userId?.username || 'Staff'} · staff`}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-gray-300">
                            <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                            <span className="font-mono text-xs">{formatTime(record.checkIn)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {isStillHere ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-500/10 border border-zinc-500/20 rounded-full text-xs font-medium text-zinc-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse shadow-[0_0_5px_#a1a1aa]"></span>
                              Still Here
                            </span>
                          ) : (
                            <div className="flex items-center gap-2 text-gray-400">
                              <LogOut className="w-3.5 h-3.5 text-zinc-400" />
                              <span className="font-mono text-xs">{formatTime(record.checkOut)}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-400">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 opacity-50" />
                            {formatDuration(record.checkIn, record.checkOut)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isStillHere && (
                            <button 
                              onClick={() => handleCheckOut(record._id)}
                              className="px-4 py-1.5 border border-amber-500/50 text-amber-500 hover:bg-zinc-500 hover:border-zinc-500 hover:text-white rounded-xl text-xs font-bold transition-all duration-300 shadow-[0_0_10px_rgba(245,158,11,0.1)] hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                            >
                              Check Out
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Attendance;
