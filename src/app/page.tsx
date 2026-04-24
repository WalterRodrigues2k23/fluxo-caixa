'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { apiCall, formatCurrency } from '@/lib/api';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);

interface Transaction {
    id: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    date: number;
    obs?: string;
}

interface Category {
    id: string;
    name: string;
}

export default function Home() {
    const { user, token, login, logout, isLoading } = useAuth();
    const [view, setView] = useState('dashboard');
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [authError, setAuthError] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [registerName, setRegisterName] = useState('');
    const [registerUsername, setRegisterUsername] = useState('');
    const [registerPassword, setRegisterPassword] = useState('');
    const [registerConfirm, setRegisterConfirm] = useState('');
    const [showPassword, setShowPassword] = useState({ login: false, register: false, confirm: false });
    
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<{ income: Category[]; expense: Category[] }>({ income: [], expense: [] });
    const [initialBalance, setInitialBalance] = useState(0);
    
    const [transType, setTransType] = useState<'income' | 'expense'>('income');
    const [transDescription, setTransDescription] = useState('');
    const [transAmount, setTransAmount] = useState('');
    const [transCategory, setTransCategory] = useState('');
    const [transDate, setTransDate] = useState(new Date().toISOString().split('T')[0]);
    const [transObs, setTransObs] = useState('');
    const [transId, setTransId] = useState('');
    const [showTransModal, setShowTransModal] = useState(false);
    
    const [dashboardMonth, setDashboardMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
    const [dashboardYear, setDashboardYear] = useState(String(new Date().getFullYear()));
    const [dashboardYears, setDashboardYears] = useState<string[]>([]);
    
    const [filterSearch, setFilterSearch] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(25);
    
    const cashflowChartRef = useRef<ChartJS | null>(null);
    const balanceChartRef = useRef<ChartJS | null>(null);
    const categoryChartRef = useRef<ChartJS | null>(null);
    const indicatorChartRef = useRef<ChartJS | null>(null);

    useEffect(() => {
        if (!isLoading && user) {
            loadData();
        }
    }, [user, isLoading]);

    useEffect(() => {
        if (user && transactions.length > 0) {
            const years = [...new Set(transactions.map(t => new Date(t.date).getFullYear().toString()))];
            setDashboardYears([...years].sort((a, b) => Number(b) - Number(a)));
        }
    }, [user, transactions]);

    const showToast = (message: string, type: string = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const loadData = async () => {
        if (!token || !user) return;
        try {
            const catsData = await apiCall(`/categories/${user.id}`);
            if (catsData) setCategories(catsData);
            
            const transData = await apiCall(`/transactions/${user.id}?startDate=2000-01-01`);
            if (transData) {
                setTransactions(transData.map((t: any) => ({ ...t, date: new Date(t.date).getTime() })));
            }
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError('');
        try {
            const data = await apiCall('/login', {
                method: 'POST',
                body: JSON.stringify({ username: loginUsername, password: loginPassword }),
            });
            login(data.token, data.user);
        } catch (err: any) {
            setAuthError(err.message);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError('');
        if (registerPassword !== registerConfirm) {
            setAuthError('As senhas não coincidem');
            return;
        }
        if (registerPassword.length < 6) {
            setAuthError('Senha deve ter pelo menos 6 caracteres');
            return;
        }
        try {
            await apiCall('/register', {
                method: 'POST',
                body: JSON.stringify({ username: registerUsername, password: registerPassword, name: registerName }),
            });
            showToast('Conta criada! Faça login.');
            setAuthMode('login');
        } catch (err: any) {
            setAuthError(err.message);
        }
    };

    const handleLogout = () => {
        logout();
        setView('dashboard');
        setShowUserDropdown(false);
    };

    const handleSaveTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = {
                userId: user!.id,
                description: transDescription,
                amount: parseFloat(transAmount),
                type: transType,
                category: transCategory,
                date: transDate,
                obs: transObs,
            };
            if (transId) {
                await apiCall(`/transactions/${transId}`, { method: 'PUT', body: JSON.stringify(data) });
                showToast('Transação atualizada!');
            } else {
                await apiCall('/transactions', { method: 'POST', body: JSON.stringify(data) });
                showToast('Transação adicionada!');
            }
            setShowTransModal(false);
            loadData();
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    const handleDeleteTransaction = async (id: string) => {
        if (!confirm('Excluir esta transação?')) return;
        try {
            await apiCall(`/transactions/${id}`, { method: 'DELETE' });
            showToast('Transação excluída');
            loadData();
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    const openNewModal = () => {
        setTransId('');
        setTransType('income');
        setTransDescription('');
        setTransAmount('');
        setTransCategory('');
        setTransDate(new Date().toISOString().split('T')[0]);
        setTransObs('');
        setShowTransModal(true);
    };

    const openEditModal = (t: Transaction) => {
        setTransId(t.id);
        setTransType(t.type);
        setTransDescription(t.description);
        setTransAmount(String(t.amount));
        setTransCategory(t.category);
        setTransDate(new Date(t.date).toISOString().split('T')[0]);
        setTransObs(t.obs || '');
        setShowTransModal(true);
    };

    const formatDate = (date: number) => {
        return new Date(date).toLocaleDateString('pt-BR');
    };

    const navigateTo = (v: string) => {
        setView(v);
        setSidebarOpen(false);
        if (v === 'transactions') {
            setCurrentPage(1);
        }
    };

    if (isLoading) {
        return (
            <div className="app-container">
                <div id="auth-screen" className="screen active" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                    <div className="loading-overlay">
                        <div className="spinner"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="app-container">
                <div id="auth-screen" className="screen active">
                    <div className="auth-container glass-card">
                        <div className="auth-header">
                            <div className="logo">
                                <svg width="64" height="64" viewBox="0 0 48 48" fill="none">
                                    <circle cx="24" cy="24" r="20" stroke="url(#gradient)" strokeWidth="2"/>
                                    <path d="M16 24L22 30L32 18" stroke="url(#gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    <defs>
                                        <linearGradient id="gradient" x1="0" y1="0" x2="48" y2="48">
                                            <stop offset="0%" stopColor="#00d9ff"/>
                                            <stop offset="100%" stopColor="#a855f7"/>
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                            <h1>Fluxo de Caixa</h1>
                            <p className="subtitle">Gerencie suas finanças com estilo</p>
                        </div>

                        {authMode === 'login' ? (
                            <form className="auth-form" onSubmit={handleLogin}>
                                <div className="form-group">
                                    <label htmlFor="login-username">Usuário</label>
                                    <input type="text" id="login-username" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} required placeholder="Digite seu usuário" />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="login-password">Senha</label>
                                    <div className="password-input">
                                        <input type={showPassword.login ? 'text' : 'password'} id="login-password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required placeholder="Digite sua senha" />
                                        <button type="button" className="toggle-password" onClick={() => setShowPassword(p => ({ ...p, login: !p.login }))}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                                <circle cx="12" cy="12" r="3"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                {authError && <div className="error-message">{authError}</div>}
                                <button type="submit" className="btn-primary">Entrar</button>
                                <div className="divider"><span>ou</span></div>
                                <p className="auth-switch">Não tem conta? <a href="#" onClick={(e) => { e.preventDefault(); setAuthMode('register'); setAuthError(''); }}>Cadastrar</a></p>
                            </form>
                        ) : (
                            <form className="auth-form" onSubmit={handleRegister}>
                                <div className="form-group">
                                    <label htmlFor="register-name">Nome Completo</label>
                                    <input type="text" id="register-name" value={registerName} onChange={(e) => setRegisterName(e.target.value)} required placeholder="Seu nome" />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="register-username">Usuário</label>
                                    <input type="text" id="register-username" value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)} required placeholder="Escolha um usuário" />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="register-password">Senha</label>
                                    <div className="password-input">
                                        <input type={showPassword.register ? 'text' : 'password'} id="register-password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} required placeholder="Mínimo 6 caracteres" />
                                        <button type="button" className="toggle-password" onClick={() => setShowPassword(p => ({ ...p, register: !p.register }))}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                                <circle cx="12" cy="12" r="3"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="register-confirm">Confirmar Senha</label>
                                    <div className="password-input">
                                        <input type={showPassword.confirm ? 'text' : 'password'} id="register-confirm" value={registerConfirm} onChange={(e) => setRegisterConfirm(e.target.value)} required placeholder="Repita a senha" />
                                        <button type="button" className="toggle-password" onClick={() => setShowPassword(p => ({ ...p, confirm: !p.confirm }))}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                                <circle cx="12" cy="12" r="3"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                {authError && <div className="error-message">{authError}</div>}
                                <button type="submit" className="btn-primary">Cadastrar</button>
                                <p className="auth-switch">Já tem conta? <a href="#" onClick={(e) => { e.preventDefault(); setAuthMode('login'); setAuthError(''); }}>Entrar</a></p>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    const startDate = new Date(parseInt(dashboardYear), parseInt(dashboardMonth) - 1, 1).getTime();
    const endDate = new Date(parseInt(dashboardYear), parseInt(dashboardMonth), 0, 23, 59, 59).getTime();
    
    const periodTransactions = transactions.filter(t => t.date >= startDate && t.date <= endDate);
    const totalIncome = periodTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = periodTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const balance = initialBalance + totalIncome - totalExpense;

    const filteredTransactions = transactions.filter(t => {
        const d = new Date(t.date);
        const searchMatch = !filterSearch || t.description.toLowerCase().includes(filterSearch.toLowerCase()) || t.category.toLowerCase().includes(filterSearch.toLowerCase());
        const monthMatch = !filterMonth || d.getMonth() + 1 === parseInt(filterMonth);
        const yearMatch = !filterYear || d.getFullYear() === parseInt(filterYear);
        const typeMatch = !filterType || t.type === filterType;
        const catMatch = !filterCategory || t.category === filterCategory;
        return searchMatch && monthMatch && yearMatch && typeMatch && catMatch;
    }).sort((a, b) => b.date - a.date);

    const totalPages = Math.ceil(filteredTransactions.length / perPage);
    const pageTransactions = filteredTransactions.slice((currentPage - 1) * perPage, currentPage * perPage);

    const cashflowData = {
        labels: Object.keys(
            Array.from({ length: Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000)) }, (_, i) => {
                const d = new Date(startDate + i * 24 * 60 * 60 * 1000);
                return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            })
        ),
        datasets: [
            {
                label: 'Entradas',
                data: Array.from({ length: Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000)) }, (_, i) => {
                    const dayStart = startDate + i * 24 * 60 * 60 * 1000;
                    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
                    return periodTransactions.filter(t => t.date >= dayStart && t.date < dayEnd && t.type === 'income').reduce((s, t) => s + t.amount, 0);
                }),
                backgroundColor: '#10b981',
                borderRadius: 4,
            },
            {
                label: 'Saídas',
                data: Array.from({ length: Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000)) }, (_, i) => {
                    const dayStart = startDate + i * 24 * 60 * 60 * 1000;
                    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
                    return periodTransactions.filter(t => t.date >= dayStart && t.date < dayEnd && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
                }),
                backgroundColor: '#ef4444',
                borderRadius: 4,
            },
        ],
    };

    const categoryData = {
        labels: [...new Set(periodTransactions.map(t => t.category))],
        datasets: [
            {
                label: 'Entradas',
                data: [...new Set(periodTransactions.map(t => t.category))].map(cat => 
                    periodTransactions.filter(t => t.category === cat && t.type === 'income').reduce((s, t) => s + t.amount, 0)
                ),
                backgroundColor: '#10b981',
            },
            {
                label: 'Saídas',
                data: [...new Set(periodTransactions.map(t => t.category))].map(cat => 
                    periodTransactions.filter(t => t.category === cat && t.type === 'expense').reduce((s, t) => s + t.amount, 0)
                ),
                backgroundColor: '#ef4444',
            },
        ],
    };

    const incomeCategories = transType === 'income' ? categories.income : categories.expense;

    return (
        <div className="app-container">
            <div id="app-screen" className="screen active">
                <header className="app-header glass-card">
                    <div className="header-left">
                        <button className="icon-btn" id="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="3" y1="6" x2="21" y2="6"/>
                                <line x1="3" y1="12" x2="21" y2="12"/>
                                <line x1="3" y1="18" x2="21" y2="18"/>
                            </svg>
                        </button>
                        <h1 className="app-title">Fluxo de Caixa Ideal</h1>
                    </div>
                    <div className="header-right">
                        <div className="user-menu">
                            <button className="user-btn" onClick={() => setShowUserDropdown(!showUserDropdown)}>
                                <div className="user-avatar">{user.name?.charAt(0).toUpperCase()}</div>
                                <span>{user.name}</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="6 9 12 15 18 9"/>
                                </svg>
                            </button>
                            <div className={`user-dropdown glass-card ${showUserDropdown ? '' : 'hidden'}`}>
                                <button className="dropdown-item" onClick={handleLogout}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                                        <polyline points="16 17 21 12 16 7"/>
                                        <line x1="21" y1="12" x2="9" y2="12"/>
                                    </svg>
                                    Sair
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                <aside id="sidebar" className={`sidebar glass-card ${sidebarOpen ? 'open' : ''}`}>
                    <nav className="sidebar-nav">
                        <button className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => navigateTo('dashboard')}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="7" height="7"/>
                                <rect x="14" y="3" width="7" height="7"/>
                                <rect x="14" y="14" width="7" height="7"/>
                                <rect x="3" y="14" width="7" height="7"/>
                            </svg>
                            <span>Dashboard</span>
                        </button>
                        <button className={`nav-item ${view === 'transactions' ? 'active' : ''}`} onClick={() => navigateTo('transactions')}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="1" x2="12" y2="23"/>
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                            </svg>
                            <span>Transações</span>
                        </button>
                    </nav>
                </aside>
                <div className={`sidebar-overlay ${sidebarOpen ? '' : ''}`} onClick={() => setSidebarOpen(false)} />

                <main className="main-content">
                    {view === 'dashboard' && (
                        <div id="view-dashboard" className="view active">
                            <div className="view-header">
                                <h2>Visão Geral</h2>
                                <div className="date-range">
                                    <button className="btn-primary" onClick={openNewModal}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="12" y1="5" x2="12" y2="19"/>
                                            <line x1="5" y1="12" x2="19" y2="12"/>
                                        </svg>
                                        Nova Transação
                                    </button>
                                    <select className="glass-select" value={dashboardMonth} onChange={(e) => setDashboardMonth(e.target.value)}>
                                        {monthNames.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
                                    </select>
                                    <select className="glass-select" value={dashboardYear} onChange={(e) => setDashboardYear(e.target.value)}>
                                        {dashboardYears.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="kpi-grid">
                                <div className="kpi-card glass-card">
                                    <div className="kpi-icon income">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="12" y1="19" x2="12" y2="5"/>
                                            <polyline points="5 12 12 5 19 12"/>
                                        </svg>
                                    </div>
                                    <div className="kpi-content">
                                        <span className="kpi-label">Entradas</span>
                                        <span className="kpi-value" style={{ color: 'var(--accent-success)' }}>{formatCurrency(totalIncome)}</span>
                                    </div>
                                </div>
                                <div className="kpi-card glass-card">
                                    <div className="kpi-icon expense">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="12" y1="5" x2="12" y2="19"/>
                                            <polyline points="19 12 12 19 5 12"/>
                                        </svg>
                                    </div>
                                    <div className="kpi-content">
                                        <span className="kpi-label">Saídas</span>
                                        <span className="kpi-value" style={{ color: 'var(--accent-danger)' }}>{formatCurrency(totalExpense)}</span>
                                    </div>
                                </div>
                                <div className="kpi-card glass-card">
                                    <div className="kpi-icon balance">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10"/>
                                            <line x1="12" y1="8" x2="12" y2="12"/>
                                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                                        </svg>
                                    </div>
                                    <div className="kpi-content">
                                        <span className="kpi-label">Saldo Atual</span>
                                        <span className="kpi-value" style={{ color: balance >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>{formatCurrency(balance)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="charts-grid">
                                <div className="chart-card glass-card">
                                    <h3>Fluxo de Caixa</h3>
                                    <Bar data={cashflowData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top' as const } }, scales: { y: { ticks: { callback: (v) => 'R$ ' + v } } } }} />
                                </div>
                                <div className="chart-card glass-card">
                                    <h3>Por Categoria</h3>
                                    <Bar data={categoryData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (v) => 'R$ ' + v } } } }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {view === 'transactions' && (
                        <div id="view-transactions" className="view active">
                            <div className="view-header">
                                <h2>Transações</h2>
                                <button className="btn-primary" onClick={openNewModal}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="12" y1="5" x2="12" y2="19"/>
                                        <line x1="5" y1="12" x2="19" y2="12"/>
                                    </svg>
                                    Nova Transação
                                </button>
                            </div>

                            <div className="filters-bar glass-card">
                                <div className="search-box">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="11" cy="11" r="8"/>
                                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                    </svg>
                                    <input type="text" placeholder="Buscar transações..." value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} />
                                </div>
                                <div className="filter-group">
                                    <select className="glass-select" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
                                        <option value="">Todos os meses</option>
                                        {monthNames.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
                                    </select>
                                    <select className="glass-select" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                                        <option value="">Todos os anos</option>
                                        {[...new Set(transactions.map(t => new Date(t.date).getFullYear()))].sort((a, b) => b - a).map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                    <select className="glass-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                                        <option value="">Todos os tipos</option>
                                        <option value="income">Entrada</option>
                                        <option value="expense">Saída</option>
                                    </select>
                                </div>
                            </div>

                            <div className="transactions-table glass-card">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Data</th>
                                            <th>Descrição</th>
                                            <th>Categoria</th>
                                            <th>Tipo</th>
                                            <th>Valor</th>
                                            <th>Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageTransactions.length === 0 ? (
                                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Nenhuma transação encontrada</td></tr>
                                        ) : (
                                            pageTransactions.map(t => (
                                                <tr key={t.id}>
                                                    <td>{formatDate(t.date)}</td>
                                                    <td>{t.description}</td>
                                                    <td>{t.category}</td>
                                                    <td><span className={`type-badge ${t.type}`}>{t.type === 'income' ? 'Entrada' : 'Saída'}</span></td>
                                                    <td className={t.type} style={{ color: t.type === 'income' ? 'var(--accent-success)' : 'var(--accent-danger)', fontWeight: 600 }}>
                                                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                                    </td>
                                                    <td>
                                                        <div className="action-btns">
                                                            <button className="action-btn" onClick={() => openEditModal(t)} title="Editar">
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                                </svg>
                                                            </button>
                                                            <button className="action-btn delete" onClick={() => handleDeleteTransaction(t.id)} title="Excluir">
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <polyline points="3 6 5 6 21 6"/>
                                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                                <div className="pagination-container">
                                    <div className="pagination-info">
                                        Mostrando {((currentPage - 1) * perPage) + 1}-{Math.min(currentPage * perPage, filteredTransactions.length)} de {filteredTransactions.length} transações
                                    </div>
                                    <div className="pagination-controls">
                                        <div className="pagination-per-page">
                                            <label>Por página:</label>
                                            <select className="glass-select" value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                                                <option value="10">10</option>
                                                <option value="25">25</option>
                                                <option value="50">50</option>
                                                <option value="100">100</option>
                                            </select>
                                        </div>
                                        <div className="pagination-pages">
                                            <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                                            </button>
                                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                let page = i + 1;
                                                if (totalPages > 5) {
                                                    if (currentPage > 3) page = currentPage - 2 + i;
                                                    if (currentPage > totalPages - 2) page = totalPages - 4 + i;
                                                }
                                                return <button key={i} className={`page-number ${page === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(page)}>{page}</button>;
                                            })}
                                            <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {showTransModal && (
                <div className="modal">
                    <div className="modal-overlay" onClick={() => setShowTransModal(false)} />
                    <div className="modal-content glass-card">
                        <div className="modal-header">
                            <h3>{transId ? 'Editar Transação' : 'Nova Transação'}</h3>
                            <button className="modal-close" onClick={() => setShowTransModal(false)}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"/>
                                    <line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                            </button>
                        </div>
                        <form id="transaction-form" onSubmit={handleSaveTransaction}>
                            <input type="hidden" value={transId} />
                            <div className="form-group">
                                <label htmlFor="trans-description">Descrição</label>
                                <input type="text" id="trans-description" value={transDescription} onChange={(e) => setTransDescription(e.target.value)} required placeholder="Ex: Venda de produto" />
                            </div>
                            <div className="form-group">
                                <label htmlFor="trans-amount">Valor</label>
                                <input type="number" id="trans-amount" value={transAmount} onChange={(e) => setTransAmount(e.target.value)} required min="0.01" step="0.01" placeholder="0,00" />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="trans-type">Tipo</label>
                                    <select id="trans-type" value={transType} onChange={(e) => { setTransType(e.target.value as 'income' | 'expense'); setTransCategory(''); }}>
                                        <option value="income">Entrada</option>
                                        <option value="expense">Saída</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="trans-category">Categoria</label>
                                    <select id="trans-category" value={transCategory} onChange={(e) => setTransCategory(e.target.value)} required>
                                        <option value="">Selecione</option>
                                        {incomeCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="trans-date">Data</label>
                                <input type="date" id="trans-date" value={transDate} onChange={(e) => setTransDate(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label htmlFor="trans-obs">Observações (opcional)</label>
                                <textarea id="trans-obs" value={transObs} onChange={(e) => setTransObs(e.target.value)} rows={2} placeholder="Adicione observações..." />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowTransModal(false)}>Cancelar</button>
                                <button type="submit" className="btn-primary">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div id="toast-container">
                {toast && (
                    <div className={`toast ${toast.type}`}>
                        <span className="toast-message">{toast.message}</span>
                        <button className="toast-close" onClick={() => setToast(null)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}