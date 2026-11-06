import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('gym_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    api.get('/auth/me')
      .then(({ data }) => {
        const userData = { ...data, id: data._id || data.id };
        setUser(userData);
        localStorage.setItem('gym_user', JSON.stringify(userData));
      })
      .catch(() => {
        localStorage.removeItem('gym_token');
        localStorage.removeItem('gym_user');
        delete api.defaults.headers.common['Authorization'];
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const saveSession = ({ token, user: userData }) => {
    localStorage.setItem('gym_token', token);
    localStorage.setItem('gym_user', JSON.stringify(userData));
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
    return userData;
  };

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    return saveSession(data);
  };

  const registerMember = async (email, inviteCode, password) => {
    const { data } = await api.post('/auth/register-member', { email, inviteCode, password });
    return saveSession(data);
  };

  const logout = () => {
    localStorage.removeItem('gym_token');
    localStorage.removeItem('gym_user');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, registerMember, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
