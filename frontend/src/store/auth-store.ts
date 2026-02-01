import { create } from 'zustand';
import Cookies from 'js-cookie';

export type UserRole = 'ADMIN' | 'VENDEDOR' | 'INVENTOR';

interface User {
  id: string;  // UUID para Supabase
  username: string;
  role: UserRole;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isHydrated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isHydrated: false,
  setAuth: (user, token) => {
    Cookies.set('token', token, { expires: 1 }); // 1 day
    Cookies.set('user', JSON.stringify(user), { expires: 1 });
    set({ user, token });
  },
  logout: () => {
    Cookies.remove('token');
    Cookies.remove('user');
    set({ user: null, token: null });
  },
  hydrate: () => {
    const userCookie = Cookies.get('user');
    const tokenCookie = Cookies.get('token');
    set({
      user: userCookie ? JSON.parse(userCookie) : null,
      token: tokenCookie || null,
      isHydrated: true,
    });
  },
}));
