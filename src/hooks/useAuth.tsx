import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Character, fetchCharacter } from '../data/characters';
import { GID, csvUrl } from '../constants/sheets';

interface AuthContextType {
  user: Character | null;
  isLoggedIn: boolean;
  restoring: boolean;
  login: (characterId: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (patch: Partial<Character>) => void;
}

const USER_CSV_URL = csvUrl(GID.USER);

function parseCSV(csv: string): { characterId: string; password: string }[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idIdx = headers.indexOf('characterid');
  const pwIdx = headers.indexOf('password');

  if (idIdx === -1 || pwIdx === -1) return [];

  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim());
    return { characterId: cols[idIdx], password: cols[pwIdx] };
  });
}

async function fetchUsers(): Promise<{ characterId: string; password: string }[]> {
  const res = await fetch(USER_CSV_URL);
  const text = await res.text();
  return parseCSV(text);
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_KEY = 'aoh_character';
const THEME_KEY = 'aoh_theme';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Character | null>(null);
  const [restoring, setRestoring] = useState(() => !!localStorage.getItem(AUTH_KEY));

  // Restore session on mount
  useEffect(() => {
    const saved = localStorage.getItem(AUTH_KEY);
    if (saved) {
      fetchCharacter(saved)
        .then((c) => {
          if (c) {
            setUser(c);
            localStorage.setItem(THEME_KEY, JSON.stringify(c.theme));
          } else {
            localStorage.removeItem(AUTH_KEY);
            localStorage.removeItem(THEME_KEY);
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
        setUser(character);
        return true;
      }
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(THEME_KEY);
    setUser(null);
  }, []);

  const updateUser = useCallback((patch: Partial<Character>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const value: AuthContextType = {
    user,
    isLoggedIn: user !== null,
    restoring,
    login,
    logout,
    updateUser,
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
