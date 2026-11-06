import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { attendanceAPI } from '../services/api';

export default function MemberTimeLimitAlerts() {
  const [alerts, setAlerts] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const { data } = await attendanceAPI.getTimeLimitAlerts();
      setAlerts(data || []);
    } catch {
      // Let the attendance page show errors instead of showing repeated alerts here.
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  if (!alerts.length) return null;
  const names = alerts.map(visit => `${visit.memberId?.firstName || 'Member'} ${visit.memberId?.lastName || ''}`.trim());

  return (
    <div className="team-time-limit-alert" role="status">
      <AlertTriangle size={17} />
      <div><strong>Member visit limit exceeded</strong><span>{names.join(', ')} need attendance review. Visits are never checked out automatically.</span><a href="/attendance">Review attendance</a></div>
    </div>
  );
}
