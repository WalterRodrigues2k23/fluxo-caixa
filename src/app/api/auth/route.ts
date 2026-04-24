import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'fluxo-caixa-secret-key-2024-fixo';

function sanitizeInput(str: string) {
    if (typeof str !== 'string') return str;
    return str.replace(/[<>'"]/g, '').substring(0, 500);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
            return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
        }

        const sanitizedUsername = sanitizeInput(username).substring(0, 50);
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', sanitizedUsername)
            .single();

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        if (!user) {
            return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 400 });
        }

        if (!user.password) {
            return NextResponse.json({ error: 'Conta Google não tem senha' }, { status: 400 });
        }

        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) {
            return NextResponse.json({ error: 'Senha incorreta' }, { status: 400 });
        }

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

        return NextResponse.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
    } catch (err) {
        console.error('Auth error:', err);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}