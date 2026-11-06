import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, Check, Clock3, LogOut, RefreshCw, ShieldCheck, Timer, UserRound, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { memberPortalAPI } from '../services/api';

const dateTime = (value) => value ? new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
const duration = (start, finish) => {
  if (!start) return '—';
  const minutes = Math.max(0, Math.floor(((finish ? new Date(finish) : new Date()) - new Date(start)) / 60000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};
const WARNING_WINDOW_MS = 15 * 60 * 1000;

export default function MemberPortal() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [suspensionPopup, setSuspensionPopup] = useState(false);
  const [suspensionNoticeBusy, setSuspensionNoticeBusy] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      setError('');
      const { data } = await memberPortalAPI.getProfile();
      setProfile(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load your member profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const clock = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    window.addEventListener('focus', load);
    return () => {
      window.clearInterval(clock);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  useEffect(() => {
    const refresh = window.setInterval(load, 10_000);
    return () => window.clearInterval(refresh);
  }, [load]);

  useEffect(() => {
    if (profile?.suspensionNoticePending) setSuspensionPopup(true);
  }, [profile?.suspensionNoticePending]);

  const acknowledgeSuspension = async () => {
    setSuspensionNoticeBusy(true);
    try {
      await memberPortalAPI.acknowledgeSuspensionNotice();
      setSuspensionPopup(false);
      setProfile(current => current ? { ...current, suspensionNoticePending: false } : current);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not confirm the suspension notice. Please try again.');
    } finally {
      setSuspensionNoticeBusy(false);
    }
  };

  const attendanceAction = async () => {
    setBusy(true);
    setNotice('');
    setError('');
    try {
      if (profile?.activeVisit) await memberPortalAPI.checkOut();
      else await memberPortalAPI.checkIn();
      setNotice(profile?.activeVisit ? 'You are checked out. Have a great day.' : 'You are checked in. Have a great workout.');
      await load();
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'That attendance action could not be completed.';
      await load();
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const member = profile?.member;
  const eligible = Boolean(profile?.gatepass && member?.status === 'active');
  const visitLimitMinutes = profile?.activeVisit?.visitLimitMinutes || profile?.visitLimitMinutes || 120;
  const visitLimitMs = visitLimitMinutes * 60 * 1000;
  const remainingMs = profile?.activeVisit
    ? new Date(profile.activeVisit.checkIn).getTime() + visitLimitMs - currentTime
    : null;
  const dailyVisitUsed = Boolean(profile?.todayVisit && !profile?.activeVisit);
  const membershipStatus = member?.status === 'suspended' ? 'Suspended' : member?.status === 'inactive' ? 'Inactive' : profile?.membership ? 'Account paid' : 'Not recorded';
  const gatepassStatus = profile?.gatepass ? 'Active gatepass' : 'No active gatepass';

  return (
    <div className="member-portal">
      {suspensionPopup && profile?.member?.status === 'suspended' && <div className="suspension-notice-backdrop"><section className="suspension-notice-dialog" role="alertdialog" aria-modal="true" aria-labelledby="suspension-notice-title" aria-describedby="suspension-notice-description"><button type="button" className="suspension-notice-close" onClick={acknowledgeSuspension} disabled={suspensionNoticeBusy} aria-label="Acknowledge suspension notice"><X size={18} /></button><div className="suspension-notice-icon"><AlertTriangle size={23} /></div><span className="eyebrow">ACCOUNT NOTICE</span><h2 id="suspension-notice-title">Membership Suspended</h2><p id="suspension-notice-description">Your account has been temporarily suspended. Check-in access is paused while this suspension is in effect.</p>{profile.member.suspensionUntil && <div className="suspension-notice-time"><Clock3 size={16} /><span>Suspended Until <strong>{new Date(profile.member.suspensionUntil).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</strong></span></div>}<button type="button" className="suspension-notice-ack" onClick={acknowledgeSuspension} disabled={suspensionNoticeBusy}>{suspensionNoticeBusy ? 'Saving…' : 'I Understand'}</button></section></div>}
      <header className="portal-topbar">
        <div className="brand-lockup"><div className="brand-mark"><Activity size={19} /></div><div><div className="brand-name">Triple J</div><div className="brand-caption">FITNESS CENTER · MEMBER SPACE</div></div></div>
        <div className="portal-top-actions"><span className="portal-secure"><ShieldCheck size={15} /> YOUR PRIVATE MEMBER SPACE</span><button className="portal-logout" onClick={() => { logout(); window.location.assign('/login'); }}><LogOut size={16} /> Sign out</button></div>
      </header>

      <main className="portal-content">
        {loading ? <div className="portal-loading"><RefreshCw className="spin" /> Loading your club space…</div> : !profile ? (
          <div className="portal-panel portal-error"><h1>We Could Not Find Your Profile</h1><p>{error}</p><button className="btn btn-secondary" onClick={load}>Try again</button></div>
        ) : <>
          <section className="portal-welcome">
            <div><div className="eyebrow"><span className="status-dot" /> MEMBER CHECK-IN</div><h1>Good To See You,<br /><em>{member.firstName}.</em></h1><p>Your account membership and gym gatepass, all in one place.</p></div>
            <div className="portal-member-id"><span>MEMBER SINCE</span><strong>{new Date(member.joinDate).toLocaleDateString([], { month: 'long', year: 'numeric' })}</strong><small>#{member._id.slice(-6).toUpperCase()}</small></div>
          </section>

          {(error || notice) && <div className={`portal-message ${error ? 'error' : 'success'}`} role="status">{error || notice}</div>}
          {profile.activeVisit && remainingMs <= 0 && <div className="portal-message warning" role="alert"><AlertTriangle size={16} /> You are {duration(currentTime + remainingMs, currentTime)} over your visit limit. Your check-in remains active until you or staff check out. Staff have been notified.</div>}
          {profile.activeVisit && remainingMs > 0 && remainingMs <= WARNING_WINDOW_MS && <div className="portal-message warning" role="alert"><AlertTriangle size={16} /> You have {duration(currentTime, currentTime + remainingMs)} before your visit limit. Please check out when you leave.</div>}

          <section className="portal-grid">
            <article className="portal-checkin-card">
              <div className="checkin-card-top"><span className="eyebrow">TODAY AT TRIPLE J</span><span className={`member-state ${profile.activeVisit ? 'checked-in' : ''}`}><i />{profile.activeVisit ? 'IN THE CLUB' : eligible ? 'READY WHEN YOU ARE' : member.status === 'suspended' ? 'ACCOUNT SUSPENDED' : member.status === 'inactive' ? 'ACCOUNT INACTIVE' : 'GATEPASS REQUIRED'}</span></div>
              <div className="checkin-status-art"><div className={`orbit-ring ${profile.activeVisit ? 'orbit-active' : ''}`}><div className="orbit-core"><Activity size={38} /></div><span className="orbit-dot dot-a" /><span className="orbit-dot dot-b" /></div></div>
              <div className="checkin-card-copy"><h2>{profile.activeVisit ? 'You’re In' : dailyVisitUsed ? 'Visit Complete' : 'Ready to Move?'}</h2><p>{profile.activeVisit ? `Checked in at ${dateTime(profile.activeVisit.checkIn)}. Your visit limit is ${profile.activeVisit.visitLimitMinutes || 120} minutes. Check out when you leave.` : member.status === 'suspended' ? `Your account is suspended${member.suspensionUntil ? ` until ${new Date(member.suspensionUntil).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : ''}. Check-in will be available after the suspension ends.` : member.status === 'inactive' ? 'Your account is inactive. Contact the front desk for attendance help.' : dailyVisitUsed ? 'You have used your one check-in for today. You can check in again tomorrow.' : eligible ? `Tap once when you arrive. You may check in once per day, for up to ${profile.visitLimitMinutes || 120} minutes.` : 'Purchase an active daily, monthly, or yearly gatepass at the front desk to check in.'}</p></div>
              <button className={`checkin-cta ${profile.activeVisit ? 'checkout' : ''}`} disabled={busy || (!profile.activeVisit && (member.status !== 'active' || !eligible || dailyVisitUsed))} onClick={attendanceAction}>
                {busy ? <RefreshCw size={18} className="spin" /> : profile.activeVisit ? <ArrowDownRight size={19} /> : <ArrowUpRight size={19} />}
                {busy ? 'Updating visit…' : profile.activeVisit ? 'Check out' : dailyVisitUsed ? 'Daily limit reached' : 'Check in'}
              </button>
              {profile.activeVisit && <div className="live-duration"><span className="live-pulse" /> {remainingMs <= 0 ? 'TIME OVER LIMIT' : 'TIME LEFT'} <strong>{remainingMs <= 0 ? duration(currentTime + remainingMs, currentTime) : duration(currentTime, currentTime + remainingMs)}</strong></div>}
            </article>

            <div className="portal-side-stack">
              <article className="portal-panel membership-card">
                <div className="portal-card-heading"><div><span className="eyebrow">ACCOUNT MEMBERSHIP</span><h2>{profile.membership?.planId?.name || 'Account Payment'}</h2></div><div className="plan-symbol"><Activity size={19} /></div></div>
                <div className="membership-lines"><div><span>STATUS</span><strong className={member.status === 'suspended' ? 'suspended' : profile.membership ? 'good' : 'muted'}><i /> {membershipStatus}</strong></div><div><span>VALID THROUGH</span><strong>{profile.membership ? new Date(profile.membership.endDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Contact the front desk'}</strong></div></div>
                {profile.membership?.planId?.features?.length > 0 && <div className="membership-features">{profile.membership.planId.features.slice(0, 3).map(feature => <span key={feature}><Check size={13} /> {feature}</span>)}</div>}
                <div className="membership-equipment-access"><span>GYM GATEPASS · {gatepassStatus.toUpperCase()}</span><strong>{profile.gatepass?.planId?.name || 'No active gatepass'}</strong><small>{profile.gatepass ? `Gym entry through ${new Date(profile.gatepass.endDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Ask the front desk about daily, monthly, or yearly access.'}</small></div>
              </article>

              <article className="portal-panel visit-card">
                <div className="portal-card-heading"><div><span className="eyebrow">YOUR RECENT VISITS</span><h2>Showing Up Adds Up</h2></div><div className="visit-count"><strong>{profile.recentAttendance.length}</strong><span>RECENT</span></div></div>
                {profile.recentAttendance.length ? <div className="visit-list">{profile.recentAttendance.map(visit => <div className="visit-row" key={visit._id}><div className="visit-icon"><CalendarDays size={15} /></div><div className="visit-copy"><strong>{new Date(visit.checkIn).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</strong><span>Check in: {dateTime(visit.checkIn)}</span><span>Check out: {visit.checkOut ? dateTime(visit.checkOut) : 'Still in the gym'}</span></div><div className="visit-length"><Timer size={14} /> {duration(visit.checkIn, visit.checkOut)}</div></div>)}</div> : <p className="visit-empty"><Clock3 size={16} /> Your first visit is waiting.</p>}
              </article>
            </div>
          </section>
          <div className="portal-footnote"><UserRound size={15} /> Need help with your account or membership? The front desk is happy to help.</div>
        </>}
      </main>
    </div>
  );
}
