'use client';

import { useState, useEffect } from 'react';
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
    date: string;
    obs?: string;
}

interface Category {
    id: string;
    name: string;
}

export default function Home() {
    const { user, token, login, logout, isLoading } = useAuth();
    const [view, setView] = useState<'auth' | 'dashboard' | 'transactions' | 'reports'>('auth');
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [authError, setAuthError] = useState('');
    
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [registerName, setRegisterName] = useState('');
    const [registerUsername, setRegisterUsername] = useState('');
    const [registerPassword, setRegisterPassword] = useState('');
    const [registerConfirm, setRegisterConfirm] = useState('');
    
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<{ income: Category[]; expense: Category[] }>({ income: [], expense: [] });
    const [initialBalance, setInitialBalance] = useState(0);
    
    const [transType, setTransType] = useState<'income' | 'expense'>('expense');
    const [transDescription, setTransDescription] = useState('');
    const [transAmount, setTransAmount] = useState('');
    const [transCategory, setTransCategory] = useState('');
    const [transDate, setTransDate] = useState(new Date().toISOString().split('T')[0]);
    const [transObs, setTransObs] = useState('');
    const [transId, setTransId] = useState('');
    const [showModal, setShowModal] = useState(false);
    
    const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

    useEffect(() => {
        if (!isLoading && user) {
            setView('dashboard');
            loadData();
        }
    }, [user, isLoading]);

    const showToast = (message: string, type: string = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const loadData = async () => {
        if (!token || !user) return;
        try {
            const [catsData, transData] = await Promise.all([
                apiCall(`/categories?userId=${user.id}`),
                apiCall(`/transactions?userId=${user.id}`),
            ]);
            if (catsData) setCategories(catsData);
            if (transData) setTransactions(transData);
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError('');
        try {
            const data = await apiCall('/auth', {
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
            closeModal();
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

    const openEditModal = (t: Transaction) => {
        setTransId(t.id);
        setTransType(t.type);
        setTransDescription(t.description);
        setTransAmount(String(t.amount));
        setTransCategory(t.category);
        setTransDate(t.date.split('T')[0]);
        setTransObs(t.obs || '');
        setShowModal(true);
    };

    const openNewModal = () => {
        setTransId('');
        setTransType('expense');
        setTransDescription('');
        setTransAmount('');
        setTransCategory('');
        setTransDate(new Date().toISOString().split('T')[0]);
        setTransObs('');
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setTransId('');
    };

    const handleTransTypeChange = (type: 'income' | 'expense') => {
        setTransType(type);
        setTransCategory('');
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('pt-BR');
    };

    if (isLoading) {
        return <div style={{ padding: 40, textAlign: 'center' }}>Carregando...</div>;
    }

    if (!user) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: 20, background: 'var(--bg-secondary)' }}>
                <div style={{ width: '100%', maxWidth: 420, padding: 40, background: 'var(--card-bg)', borderRadius: 20, boxShadow: 'var(--shadow-lg)' }}>
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: 8, background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Fluxo de Caixa</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>Controle suas finanças</p>
                    </div>

                    {authMode === 'login' ? (
                        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Usuário</label>
                                <input type="text" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} required placeholder="Digite seu usuário" />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Senha</label>
                                <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required placeholder="Digite sua senha" />
                            </div>
                            {authError && <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid var(--accent-danger)', borderRadius: 6, padding: 12, color: 'var(--accent-danger)', fontSize: '0.875rem', textAlign: 'center' }}>{authError}</div>}
                            <button type="submit" className="btn-primary">Entrar</button>
                            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                Não tem conta? <button type="button" style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', fontWeight: 500 }} onClick={() => { setAuthMode('register'); setAuthError(''); }}>Cadastre-se</button>
                            </p>
                        </form>
                    ) : (
                        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Nome</label>
                                <input type="text" value={registerName} onChange={(e) => setRegisterName(e.target.value)} required placeholder="Seu nome" />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Usuário</label>
                                <input type="text" value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)} required placeholder="Escolha um usuário" />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Senha</label>
                                <input type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} required placeholder="Mínimo 6 caracteres" />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Confirmar Senha</label>
                                <input type="password" value={registerConfirm} onChange={(e) => setRegisterConfirm(e.target.value)} required placeholder="Repita a senha" />
                            </div>
                            {authError && <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid var(--accent-danger)', borderRadius: 6, padding: 12, color: 'var(--accent-danger)', fontSize: '0.875rem', textAlign: 'center' }}>{authError}</div>}
                            <button type="submit" className="btn-primary">Cadastrar</button>
                            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                Já tem conta? <button type="button" style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', fontWeight: 500 }} onClick={() => { setAuthMode('login'); setAuthError(''); }}>Entrar</button>
                            </p>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    const incomeCategories = transType === 'income' ? categories.income : categories.expense;

    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const periodTransactions = transactions.filter((t) => t.date >= new Date(thirtyDaysAgo).toISOString());
    const periodIncome = periodTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const periodExpense = periodTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const balance = initialBalance + periodIncome - periodExpense;

    const chartData = {
        labels: ['Entradas', 'Saídas'],
        datasets: [
            {
                label: 'Valor',
                data: [periodIncome, periodExpense],
                backgroundColor: ['#10b981', '#ef4444'],
            },
        ],
    };

    const recentTransactions = transactions.slice(0, 5);

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)' }}>
            <nav style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Fluxo de Caixa</h2>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setView('dashboard')} style={{ background: view === 'dashboard' ? 'var(--bg-tertiary)' : 'transparent', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', color: view === 'dashboard' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Dashboard</button>
                        <button onClick={() => setView('transactions')} style={{ background: view === 'transactions' ? 'var(--bg-tertiary)' : 'transparent', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', color: view === 'transactions' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Transações</button>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{user.name}</span>
                    <button onClick={logout} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>Sair</button>
                </div>
            </nav>

            <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
                {view === 'dashboard' && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                            <div className="card">
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 4 }}>Saldo Inicial</p>
                                <input type="number" value={initialBalance} onChange={(e) => setInitialBalance(parseFloat(e.target.value) || 0)} style={{ width: '100%', marginTop: 8 }} placeholder="Saldo inicial" />
                            </div>
                            <div className="card">
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 4 }}>Entradas (30 dias)</p>
                                <p style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--accent-success)' }}>{formatCurrency(periodIncome)}</p>
                            </div>
                            <div className="card">
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 4 }}>Saídas (30 dias)</p>
                                <p style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--accent-danger)' }}>{formatCurrency(periodExpense)}</p>
                            </div>
                        </div>

                        <div className="card" style={{ marginBottom: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Balanço</h3>
                                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: balance >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>{formatCurrency(balance)}</p>
                            </div>
                            <div style={{ height: 200 }}>
                                <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
                            </div>
                        </div>

                        <div className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Transações Recentes</h3>
                                <button onClick={openNewModal} className="btn-primary" style={{ padding: '10px 16px', fontSize: '0.875rem' }}>+ Nova Transação</button>
                            </div>
                            {recentTransactions.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Nenhuma transação</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {recentTransactions.map((t) => (
                                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                                            <div>
                                                <p style={{ fontWeight: 500 }}>{t.description}</p>
                                                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{t.category} • {formatDate(t.date)}</p>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                                <span style={{ fontWeight: 600, color: t.type === 'income' ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                                                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                                </span>
                                                <button onClick={() => openEditModal(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>✏️</button>
                                                <button onClick={() => handleDeleteTransaction(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-danger)' }}>🗑️</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {view === 'transactions' && (
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Todas as Transações</h3>
                            <button onClick={openNewModal} className="btn-primary" style={{ padding: '10px 16px', fontSize: '0.875rem' }}>+ Nova Transação</button>
                        </div>
                        {transactions.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Nenhuma transação</p>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <th style={{ textAlign: 'left', padding: 12, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Data</th>
                                        <th style={{ textAlign: 'left', padding: 12, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Descrição</th>
                                        <th style={{ textAlign: 'left', padding: 12, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Categoria</th>
                                        <th style={{ textAlign: 'left', padding: 12, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Tipo</th>
                                        <th style={{ textAlign: 'right', padding: 12, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Valor</th>
                                        <th style={{ textAlign: 'center', padding: 12, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((t) => (
                                        <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: 12 }}>{formatDate(t.date)}</td>
                                            <td style={{ padding: 12 }}>{t.description}</td>
                                            <td style={{ padding: 12 }}>{t.category}</td>
                                            <td style={{ padding: 12 }}><span style={{ padding: '4px 8px', borderRadius: 4, fontSize: '0.75rem', background: t.type === 'income' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: t.type === 'income' ? 'var(--accent-success)' : 'var(--accent-danger)' }}>{t.type === 'income' ? 'Entrada' : 'Saída'}</span></td>
                                            <td style={{ padding: 12, textAlign: 'right', fontWeight: 600, color: t.type === 'income' ? 'var(--accent-success)' : 'var(--accent-danger)' }}>{t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}</td>
                                            <td style={{ padding: 12, textAlign: 'center' }}>
                                                <button onClick={() => openEditModal(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', marginRight: 8 }}>✏️</button>
                                                <button onClick={() => handleDeleteTransaction(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-danger)' }}>🗑️</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </main>

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="card" style={{ width: '100%', maxWidth: 480, margin: 20 }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 20 }}>{transId ? 'Editar Transação' : 'Nova Transação'}</h3>
                        <form onSubmit={handleSaveTransaction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 8 }}>Tipo</label>
                                <select value={transType} onChange={(e) => handleTransTypeChange(e.target.value as 'income' | 'expense')}>
                                    <option value="income">Entrada</option>
                                    <option value="expense">Saída</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 8 }}>Descrição</label>
                                <input type="text" value={transDescription} onChange={(e) => setTransDescription(e.target.value)} required placeholder="Descrição" />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 8 }}>Valor</label>
                                <input type="number" step="0.01" value={transAmount} onChange={(e) => setTransAmount(e.target.value)} required placeholder="0.00" />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 8 }}>Categoria</label>
                                <select value={transCategory} onChange={(e) => setTransCategory(e.target.value)} required>
                                    <option value="">Selecione</option>
                                    {incomeCategories.map((c) => (
                                        <option key={c.id} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 8 }}>Data</label>
                                <input type="date" value={transDate} onChange={(e) => setTransDate(e.target.value)} required />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 8 }}>Observação</label>
                                <textarea value={transObs} onChange={(e) => setTransObs(e.target.value)} placeholder="Opcional" style={{ resize: 'vertical', minHeight: 60 }} />
                            </div>
                            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                                <button type="button" onClick={closeModal} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {toast && (
                <div style={{ position: 'fixed', bottom: 24, right: 24, background: toast.type === 'error' ? 'var(--accent-danger)' : 'var(--accent-success)', color: 'white', padding: '12px 20px', borderRadius: 8, boxShadow: 'var(--shadow-lg)', zIndex: 2000 }}>
                    {toast.message}
                </div>
            )}
        </div>
    );
}