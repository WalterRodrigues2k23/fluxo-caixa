import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { username, password, name } = body;

    const { data: exists } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

    if (exists) {
        return NextResponse.json({ error: 'Usuário já existe' }, { status: 400 });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const id = uuidv4();

    const { data, error } = await supabase
        .from('users')
        .insert([{ id, username, password: hashedPassword, name, role: 'user' }])
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, userId: id });
}