'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
    id: string;
    username: string;
    name: string;
    role: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        console.log('AuthProvider: Loading from localStorage');
        const storedToken = localStorage.getItem('fc_token');
        const storedUser = localStorage.getItem('fc_user');
        
        if (storedToken && storedUser) {
            console.log('AuthProvider: Found stored user');
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
        } else {
            console.log('AuthProvider: No stored user');
        }
        setIsLoading(false);
    }, []);

    const login = (newToken: string, newUser: User) => {
        console.log('AuthProvider: login called', newUser.username);
        localStorage.setItem('fc_token', newToken);
        localStorage.setItem('fc_user', JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
    };

    const logout = () => {
        console.log('AuthProvider: logout called');
        localStorage.removeItem('fc_token');
        localStorage.removeItem('fc_user');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}