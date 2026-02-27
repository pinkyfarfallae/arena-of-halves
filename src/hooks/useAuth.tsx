import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Character, fetchCharacter } from '../data/characters';
import { GID, csvUrl } from '../constants/sheets';
import type { RoleName } from '../types/role';
import { ROLE } from '../constants/role';

interface AuthContextType {
  user: Character | null;
  role: RoleName;
  isLoggedIn: boolean;
  restoring: boolean;
  login: (characterId: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (patch: Partial<Character>) => void;
  refreshUser: () => Promise<void>;
}

interface UserRow { characterId: string; password: string; role: RoleName }

const userCsvUrl = () => csvUrl(GID.USER);

function toRole(raw: string): RoleName {
  const r = raw.toLowerCase().trim();
  if (r === ROLE.DEVELOPER) return ROLE.DEVELOPER;
  if (r === ROLE.ADMIN) return ROLE.ADMIN;
  return ROLE.PLAYER;
}

function parseCSV(csv: string): UserRow[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idIdx = headers.indexOf('characterid');
  const pwIdx = headers.indexOf('password');
  const roleIdx = headers.indexOf('role');

  if (idIdx === -1 || pwIdx === -1) return [];

  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim());
    return {
      characterId: cols[idIdx],
      password: cols[pwIdx],
      role: roleIdx !== -1 ? toRole(cols[roleIdx] ?? '') : ROLE.PLAYER,
    };
  });
}

async function fetchUsers(): Promise<UserRow[]> {
  const res = await fetch(userCsvUrl());
  const text = await res.text();
  return parseCSV(text);
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_KEY = 'aoh_character';
const THEME_KEY = 'aoh_theme';
const ROLE_KEY = 'aoh_role';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Character | null>(null);
  const [role, setRole] = useState<RoleName>(() => {
    return (localStorage.getItem(ROLE_KEY) as RoleName) || ROLE.PLAYER;
  });
  const [restoring, setRestoring] = useState(() => !!localStorage.getItem(AUTH_KEY));

  // Restore session on mount — also re-fetch role
  useEffect(() => {
    const saved = localStorage.getItem(AUTH_KEY);
    if (saved) {
      Promise.all([fetchCharacter(saved), fetchUsers()])
        .then(([c, users]) => {
          if (c) {
            setUser(c);
            localStorage.setItem(THEME_KEY, JSON.stringify(c.theme));
            const userRow = users.find(u => u.characterId.toLowerCase() === saved.toLowerCase());
            const r = userRow?.role ?? ROLE.PLAYER;
            setRole(r);
            localStorage.setItem(ROLE_KEY, r);
          } else {
            localStorage.removeItem(AUTH_KEY);
            localStorage.removeItem(THEME_KEY);
            localStorage.removeItem(ROLE_KEY);
          }
        })
        .finally(() => setRestoring(false));
    }
  }, []);

  const login = useCallback(async (characterId: string, password: string): Promise<boolean> => {
    const users = await fetchUsers();
    const found = users.find(
      (u) => u.characterId === characterId && u.password === password
    );
    if (found) {
      const character = await fetchCharacter(found.characterId);
      if (character) {
        localStorage.setItem(AUTH_KEY, found.characterId);
        localStorage.setItem(THEME_KEY, JSON.stringify(character.theme));
        localStorage.setItem(ROLE_KEY, found.role);
        setUser(character);
        setRole(found.role);
        return true;
      }
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(THEME_KEY);
    localStorage.removeItem(ROLE_KEY);
    setUser(null);
    setRole(ROLE.PLAYER);
  }, []);

  const updateUser = useCallback((patch: Partial<Character>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const refreshUser = useCallback(async () => {
    const saved = localStorage.getItem(AUTH_KEY);
    if (saved) {
      const c = await fetchCharacter(saved);
      if (c) {
        setUser(c);
        localStorage.setItem(THEME_KEY, JSON.stringify(c.theme));
      }
    }
  }, []);

  const value: AuthContextType = {
    user,
    role,
    isLoggedIn: user !== null,
    restoring,
    login,
    logout,
    updateUser,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
