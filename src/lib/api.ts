const API_URL = 'https://fluxo-caixa-backend-yh1m.onrender.com/api';

export async function apiCall(endpoint: string, options: RequestInit = {}) {
    let token = typeof window !== 'undefined' ? localStorage.getItem('fc_token') : null;
    
    if (token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                token = null;
            } else {
                const payload = JSON.parse(atob(parts[1]));
                if (!payload.iss || !payload.exp) {
                    token = null;
                }
            }
        } catch {
            token = null;
        }
        if (!token) {
            localStorage.removeItem('fc_token');
            localStorage.removeItem('fc_user');
        }
    }
    
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
    };

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });

        if (response.status === 401) {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('fc_token');
                localStorage.removeItem('fc_user');
                window.location.href = '/';
            }
            return null;
        }

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro na API');
        return data;
    } catch (err: any) {
        console.error('API Error:', err);
        throw err;
    }
}

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
}