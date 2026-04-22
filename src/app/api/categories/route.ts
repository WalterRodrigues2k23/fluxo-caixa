import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
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
    if (!user) {
        return NextResponse.json({ error: 'Token requerido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    let { data: categories, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!categories || categories.length === 0) {
        const defaults = [
            { user_id: userId, type: 'income', name: 'Salário' },
            { user_id: userId, type: 'income', name: 'Freelance' },
            { user_id: userId, type: 'income', name: 'Investimento' },
            { user_id: userId, type: 'income', name: 'Outros' },
            { user_id: userId, type: 'expense', name: 'Alimentação' },
            { user_id: userId, type: 'expense', name: 'Transporte' },
            { user_id: userId, type: 'expense', name: 'Lazer' },
            { user_id: userId, type: 'expense', name: 'Contas' },
            { user_id: userId, type: 'expense', name: 'Outros' }
        ];
        
        await supabase.from('categories').insert(defaults);
        categories = defaults;
    }

    const income = categories.filter((c: any) => c.type === 'income').map((c: any) => ({ id: c.id, name: c.name }));
    const expense = categories.filter((c: any) => c.type === 'expense').map((c: any) => ({ id: c.id, name: c.name }));

    return NextResponse.json({ income, expense });
}

export async function POST(request: NextRequest) {
    const user = authenticateToken(request);
    if (!user) {
        return NextResponse.json({ error: 'Token requerido' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, type, name } = body;

    const { data: existing } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', userId)
        .eq('type', type)
        .eq('name', name)
        .single();

    if (existing) {
        return NextResponse.json({ error: 'Categoria já existe neste tipo (entrada/saída)' }, { status: 400 });
    }

    const id = uuidv4();

    const { error } = await supabase
        .from('categories')
        .insert([{ user_id: userId, type, name, id }]);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, id, name });
}