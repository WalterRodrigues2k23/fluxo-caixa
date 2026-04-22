import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fluxo-caixa-secret-key-2024-fixo';

function sanitizeInput(str: string) {
    if (typeof str !== 'string') return str;
    return str.replace(/[<>'"]/g, '').substring(0, 500);
}

function validateNumeric(val: number) {
    const num = parseFloat(String(val));
    if (isNaN(num) || !isFinite(num)) return 0;
    return Math.abs(num) > 1000000000 ? 1000000000 : num;
}

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
    if (!user) {
        return NextResponse.json({ error: 'Token requerido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId);
    
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate + ' 23:59:59');
    
    const { data, error } = await query.order('date', { ascending: false });
    
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
    const user = authenticateToken(request);
    if (!user) {
        return NextResponse.json({ error: 'Token requerido' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, description, amount, type, category, date, obs } = body;
    
    if (user.id !== userId && user.role !== 'admin') {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }
    
    const validTypes = ['income', 'expense'];
    if (!validTypes.includes(type)) {
        return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
    }
    
    const validAmount = validateNumeric(amount);
    const sanitizedDesc = sanitizeInput(description).substring(0, 200);
    const sanitizedCategory = sanitizeInput(category).substring(0, 30);
    const sanitizedDate = sanitizeInput(date).substring(0, 20);
    const sanitizedObs = obs ? sanitizeInput(obs).substring(0, 500) : '';
    
    const { data, error } = await supabase
        .from('transactions')
        .insert([{
            user_id: userId,
            description: sanitizedDesc,
            amount: validAmount,
            type,
            category: sanitizedCategory,
            date: sanitizedDate,
            obs: sanitizedObs
        }])
        .select()
        .single();
    
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ success: true, id: data.id });
}