import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, Camera, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import MemberInviteScanner from './MemberInviteScanner';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [identity, setIdentity] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const { user, login, registerMember } = useAuth();
  const navigate = useNavigate();

  const handleInviteScan = useCallback((rawValue) => {
    const separator = rawValue.lastIndexOf('|');
    const scannedCode = separator >= 0 ? rawValue.slice(separator + 1) : rawValue;
    const scannedEmail = separator >= 0 ? rawValue.slice(0, separator) : '';
    if (!/^[a-f\d]{48}$/i.test(scannedCode)) {
      setError('That QR code is not a valid member invitation.');
      setSuccessNotice('');
      setScannerOpen(false);
      return;
    }
    setInviteCode(scannedCode);
    if (scannedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(scannedEmail)) setIdentity(scannedEmail);
    setError('');
    setSuccessNotice('Invitation scanned. Set a password to finish creating your account.');
    setScannerOpen(false);
  }, []);

  useEffect(() => {
    if (user) navigate(user.role === 'member' ? '/portal' : '/', { replace: true });
  }, [user, navigate]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessNotice('');
    setBusy(true);
    try {
      const signedIn = mode === 'login'
        ? await login(identity, password)
        : await registerMember(identity, inviteCode, password);
      navigate(signedIn.role === 'member' ? '/portal' : '/', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'We could not sign you in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="quick-auth-screen">
      <div className="quick-auth-glow" />
      <div className="quick-auth-card">
        <div className="quick-auth-brand"><div className="brand-mark"><Activity size={20} strokeWidth={2.6} /></div><div><div className="brand-name">Triple J</div><div className="brand-caption">FITNESS CENTER</div></div></div>
        <div className="quick-auth-kicker"><span className="status-dot" /> SECURE CLUB ACCESS</div>
        <h1>{mode === 'login' ? 'Welcome Back' : 'Create Your Account'}</h1>
        <p className="quick-auth-subtitle">{mode === 'login' ? 'Use your account to continue to Triple J Fitness Center.' : 'Set up your member account with the code from the front desk.'}</p>

        <form onSubmit={submit} className="quick-auth-form">
          <label htmlFor="quick-identity">{mode === 'login' ? 'USERNAME OR EMAIL' : 'EMAIL ADDRESS'}</label>
          <div className="quick-auth-input"><Mail size={17} /><input id="quick-identity" type={mode === 'login' ? 'text' : 'email'} autoComplete="username" placeholder={mode === 'login' ? 'Username or email address' : 'you@example.com'} value={identity} onChange={e => setIdentity(e.target.value)} required /></div>
          {mode === 'register' && <><div className="quick-auth-scan-heading"><label htmlFor="quick-invite">ONE-TIME INVITATION CODE</label><button type="button" className="quick-auth-scan-button" onClick={() => { setError(''); setSuccessNotice(''); setScannerOpen(true); }}><Camera size={14} /> Scan QR</button></div><div className="quick-auth-input"><ShieldCheck size={17} /><input id="quick-invite" type="text" autoComplete="one-time-code" placeholder="Code from the front desk" value={inviteCode} onChange={e => { setInviteCode(e.target.value); setSuccessNotice(''); }} required /></div></>}
          <div className="quick-auth-password-label"><label htmlFor="quick-password">PASSWORD</label>{mode === 'register' && <span>8 characters minimum</span>}</div>
          <div className="quick-auth-input"><LockKeyhole size={17} /><input id="quick-password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} minLength={mode === 'register' ? 8 : undefined} required /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
          {error && <div className="quick-auth-error" role="alert">{error}</div>}
          {successNotice && <div className="quick-auth-success" role="status">{successNotice}</div>}
          <button className="quick-auth-submit" type="submit" disabled={busy}>{busy ? 'Signing you in…' : mode === 'login' ? 'Sign in' : 'Create member login'}<ArrowRight size={17} /></button>
        </form>

        <div className="quick-auth-switch">{mode === 'login' ? 'Need to set up member access?' : 'Already have an account?'} <button type="button" onClick={() => { setError(''); setSuccessNotice(''); setMode(mode === 'login' ? 'register' : 'login'); }}>{mode === 'login' ? 'Use an invite code' : 'Sign in'}</button></div>
        {mode === 'register' && <div className="quick-auth-note"><UserRound size={16} /> Invitation codes are single-use and expire in 30 minutes.</div>}
        <div className="quick-auth-footer">After signing in, you will see the tools available to your account.</div>
      </div>
      {scannerOpen && <MemberInviteScanner onScan={handleInviteScan} onClose={() => setScannerOpen(false)} />}
    </div>
  );
}
