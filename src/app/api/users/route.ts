import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fluxo-caixa-secret-key-2024-fixo';

interface UserPayload {
    id: string;
    username: string;
    role: string;
}

function authenticateToken(request: NextRequest): UserPayload | null {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    
    if (!token) return null;
    
    try {
        return jwt.verify(token, JWT_SECRET) as UserPayload;
    } catch {
        return null;
    }
}

export async function GET(request: NextRequest) {
    const user = authenticateToken(request);
    if (!user || user.role !== 'admin') {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }
    
    const { data, error } = await supabase
        .from('users')
        .select('id, username, name, role, created_at');
    
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json(data || []);
}