import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
}

interface AuthProviderProps {
  children: ReactNode;
}

interface AuthResponse {
  success: boolean;
  message?: string;
  user?: User;
  authenticated?: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async (): Promise<void> => {
    try {
      const response = await axios.get<AuthResponse>('/auth_status');
      if (response.data.authenticated && response.data.user) {
        setUser(response.data.user);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const formData = new FormData();
      formData.append('email', email);
      formData.append('password', password);
      
      const response = await axios.post<AuthResponse>('/login', formData);
      if (response.data.success) {
        await checkAuthStatus();
        return { success: true };
      }
      return { success: false, message: response.data.message };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        return { success: false, message: error.response.data.message };
      }
      return { success: false, message: 'Login failed' };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await axios.post('/logout');
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const contextValue: AuthContextType = {
    user,
    loading,
    isAuthenticated,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
