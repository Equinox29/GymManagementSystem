import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, LayoutDashboard, Users, CreditCard, ClipboardCheck, Package, ShoppingCart, Dumbbell, LogOut, Shield, UserCog, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import CurrentAttendanceButton from './CurrentAttendanceButton';
import MemberTimeLimitAlerts from './MemberTimeLimitAlerts';

const navigation = [
  { label: 'Overview', items: [{ to: '/', title: 'Dashboard', icon: LayoutDashboard }] },
  { label: 'People', items: [{ to: '/members', title: 'Members', icon: Users }, { to: '/payments', title: 'Billing', icon: CreditCard }] },
  { label: 'Gym floor', items: [{ to: '/attendance', title: 'Check-in', icon: ClipboardCheck }, { to: '/inventory', title: 'Inventory', icon: Package }, { to: '/inventory/sales', title: 'Inventory Sales', icon: ShoppingCart }, { to: '/equipment', title: 'Equipment', icon: Dumbbell }] },
];

const pageNames = { '/': 'Dashboard', '/members': 'Members', '/payments': 'Billing', '/attendance': 'Check-in desk', '/inventory': 'Inventory', '/inventory/sales': 'Inventory Sales', '/equipment': 'Equipment' };

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = user?.role === 'admin';
  const pageTitle = pageNames[location.pathname] || 'Gym operations';

  const signOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <aside className={`app-sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Activity size={19} strokeWidth={2.6} /></div>
          <div><div className="brand-name">Triple J</div><div className="brand-caption">FITNESS CENTER</div></div>
          <button className="mobile-close icon-button" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>

        <nav className="side-nav">
          {navigation.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map(({ to, title, icon: Icon }) => (
                <NavLink key={to} to={to} end onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <Icon size={18} strokeWidth={1.8} /><span>{title}</span>{title === 'Check-in' && <span className="nav-live">LIVE</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="account-card">
            <div className={`account-avatar ${isAdmin ? 'admin' : ''}`}>{isAdmin ? <Shield size={17} /> : <UserCog size={17} />}</div>
            <div className="account-copy"><strong>{user?.username || 'Staff'}</strong><span>{isAdmin ? 'Administrator' : 'Front desk staff'}</span></div>
            <button className="icon-button signout-icon" onClick={signOut} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <main className="app-main">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="topbar-title"><span>WORKSPACE</span><strong>{pageTitle}</strong></div>
          <div className="topbar-right">
            <CurrentAttendanceButton />
            <div className="topbar-date">{new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</div>
            <div className="topbar-divider" />
            <div className="topbar-user"><span className="status-dot" /> {isAdmin ? 'ADMIN SESSION' : 'STAFF SESSION'}</div>
          </div>
        </header>
        <MemberTimeLimitAlerts />
        <div key={location.pathname} className="workspace-content page-enter"><Outlet /></div>
        <footer className="workspace-footer"><span>TRIPLE J FITNESS CENTER</span><span>MOVE WELL. RUN WELL.</span></footer>
      </main>
    </div>
  );
}
