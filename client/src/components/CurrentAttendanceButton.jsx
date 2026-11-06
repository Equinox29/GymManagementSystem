import { useCallback, useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, RefreshCw } from 'lucide-react';
import { attendanceAPI } from '../services/api';

export default function CurrentAttendanceButton() {
  const [activeVisit, setActiveVisit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const { data } = await attendanceAPI.getMyVisit();
      setActiveVisit(data.activeVisit || null);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Status unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  const toggle = async () => {
    setBusy(true);
    setError('');
    try {
      if (activeVisit) await attendanceAPI.checkOutMyself();
      else await attendanceAPI.checkInMyself();
      await refresh();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update check-in status');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="current-attendance">
      <button type="button" onClick={toggle} disabled={loading || busy} className={`current-attendance-button ${activeVisit ? 'is-in' : ''}`} title={error || undefined}>
        {loading || busy ? <RefreshCw size={15} className="spin" /> : activeVisit ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
        <span>{loading ? 'Loading…' : busy ? 'Updating…' : activeVisit ? 'Check out' : 'Check in'}</span>
        <i className={activeVisit ? 'active' : ''} />
      </button>
      {error && <span className="attendance-control-error" role="status">{error}</span>}
    </div>
  );
}
