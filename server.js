const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const supabase = require('./supabase');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) {
    console.error('ERRO: JWT_SECRET não definido no .env');
    process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Muitas requisições. Tente novamente mais tarde.' }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Muitas tentativas de login. Tente novamente mais tarde.' }
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: { error: 'Muitas tentativas de registro. Tente novamente em 1 hora.' }
});

app.use(cors({
    origin: ['https://fluxo-caixa-w8gr.vercel.app', 'http://localhost:3000']
}));
app.use(express.json({ limit: '1mb' }));
app.use('/api/', apiLimiter);
app.use('/api/login', loginLimiter);
app.use('/api/register', registerLimiter);

app.get('/api/ping', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

function sanitizeInput(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[<>'"]/g, '').substring(0, 500);
}

function validateNumeric(val) {
    const num = parseFloat(val);
    if (isNaN(num) || !isFinite(num)) return 0;
    return Math.abs(num) > 1000000000 ? 1000000000 : num;
}

function validatePassword(password) {
    if (!password || typeof password !== 'string') return false;
    if (password.length < 8) return false;
    if (!/[A-Z]/.test(password)) return false;
    if (!/[a-z]/.test(password)) return false;
    if (!/[0-9]/.test(password)) return false;
    return true;
}

function validateUsername(username) {
    if (!username || typeof username !== 'string') return false;
    return /^[a-zA-Z0-9_]{3,30}$/.test(username.trim());
}

async function initDatabase() {
    const { error } = await supabase.from('users').select('id').limit(1);
    
    if (error && error.code === '42P01') {
        console.log('Tabelas nao existem. Crie-as no Supabase SQL Editor.');
    }
}

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Token requerido' });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.user = user;
        next();
    });
};

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Dados inválidos' });
    }
    
    const sanitizedUsername = sanitizeInput(username).substring(0, 50);
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', sanitizedUsername)
        .single();
    
    if (error || !user) return res.status(400).json({ error: 'Usuário não encontrado' });
    
    if (!user.password) return res.status(400).json({ error: 'Conta Google não tem senha' });
    
    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Senha incorreta' });
    
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
});

app.post('/api/register', async (req, res) => {
    const { username, password, name } = req.body;
    
    if (!validateUsername(username)) {
        return res.status(400).json({ error: 'Username inválido (3-30 caracteres, apenas letras, números e _)' });
    }
    
    if (!validatePassword(password)) {
        return res.status(400).json({ error: 'Senha deve ter mínimo 8 caracteres, incluindo maiúscula, minúscula e número' });
    }
    
    const { data: exists } = await supabase
        .from('users')
        .select('id')
        .eq('username', username.trim().toLowerCase())
        .single();
    
    if (exists) return res.status(400).json({ error: 'Usuário já existe' });
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    const id = uuidv4();
    
    const { data, error } = await supabase
        .from('users')
        .insert([{ id, username: username.trim().toLowerCase(), password: hashedPassword, name: name || username, role: 'user' }])
        .select()
        .single();
    
    if (error) return res.status(400).json({ error: error.message });
    
    res.json({ success: true, userId: id });
});

app.post('/api/reset-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('password')
        .eq('id', userId)
        .single();
    
    if (userError || !user) return res.status(400).json({ error: 'Usuário não encontrado' });
    
    if (!user.password) return res.status(400).json({ error: 'Conta Google não pode alterar senha' });
    
    const validPassword = bcrypt.compareSync(currentPassword, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Senha atual incorreta' });
    
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    
    const { error } = await supabase
        .from('users')
        .update({ password: hashedPassword })
        .eq('id', userId);
    
    if (error) return res.status(400).json({ error: error.message });
    
    res.json({ success: true });
});

app.get('/api/categories/:userId', authenticateToken, async (req, res) => {
    const userId = req.params.userId;
    
    let { data: categories, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId);
    
    if (error) return res.status(500).json({ error: error.message });
    
    if (!categories || categories.length === 0) {
        const defaults = [
            { id: 'cat_salario', user_id: userId, type: 'income', name: 'Salário' },
            { id: 'cat_freelance', user_id: userId, type: 'income', name: 'Freelance' },
            { id: 'cat_investimento', user_id: userId, type: 'income', name: 'Investimento' },
            { id: 'cat_outros_in', user_id: userId, type: 'income', name: 'Outros' },
            { id: 'cat_alimentacao', user_id: userId, type: 'expense', name: 'Alimentação' },
            { id: 'cat_transporte', user_id: userId, type: 'expense', name: 'Transporte' },
            { id: 'cat_lazer', user_id: userId, type: 'expense', name: 'Lazer' },
            { id: 'cat_contas', user_id: userId, type: 'expense', name: 'Contas' },
            { id: 'cat_outros_out', user_id: userId, type: 'expense', name: 'Outros' }
        ];
        
        await supabase.from('categories').insert(defaults);
        
        categories = defaults;
    }
    
    const income = categories.filter(c => c.type === 'income').map(c => ({ id: c.name.toLowerCase().replace(/[^a-z0-9]/g, '_'), name: c.name }));
    const expense = categories.filter(c => c.type === 'expense').map(c => ({ id: c.name.toLowerCase().replace(/[^a-z0-9]/g, '_'), name: c.name }));
    
    res.json({ income, expense });
});

app.post('/api/categories', authenticateToken, async (req, res) => {
    const { userId, type, name } = req.body;
    
    const { data: existing } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', userId)
        .eq('type', type)
        .eq('name', name)
        .single();
    
    if (existing) return res.status(400).json({ error: 'Categoria já existe neste tipo (entrada/saída)' });
    
    const id = uuidv4();
    
    const { error } = await supabase
        .from('categories')
        .insert([{ user_id: userId, type, name, id }]);
    
    if (error) return res.status(400).json({ error: error.message });
    
    res.json({ success: true, id, name });
});

app.put('/api/categories/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, type } = req.body;
    
    const { data: existing } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', req.user.id)
        .eq('type', type)
        .eq('name', name)
        .neq('id', id)
        .single();
    
    if (existing) return res.status(400).json({ error: 'Categoria já existe neste tipo (entrada/saída)' });
    
    const { error } = await supabase
        .from('categories')
        .update({ name })
        .eq('id', id);
    
    if (error) return res.status(400).json({ error: error.message });
    
    res.json({ success: true });
});

app.delete('/api/categories/:userId/:type/:id', authenticateToken, async (req, res) => {
    const { userId, type, id } = req.params;
    
    const { count } = await supabase
        .from('categories')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('type', type);
    
    if (count <= 1) return res.status(400).json({ error: 'Não pode excluir última categoria' });
    
    const { error } = await supabase
        .from('categories')
        .delete()
        .eq('user_id', userId)
        .eq('type', type)
        .eq('name', id);
    
    if (error) return res.status(400).json({ error: error.message });
    
    res.json({ success: true });
});

app.get('/api/transactions/:userId', authenticateToken, async (req, res) => {
    const userId = req.params.userId;
    const { startDate, endDate } = req.query;
    
    let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId);
    
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate + ' 23:59:59');
    
    const { data, error } = await query.order('date', { ascending: false });
    
    if (error) return res.status(500).json({ error: error.message });
    
    res.json(data || []);
});

app.post('/api/transactions', authenticateToken, async (req, res) => {
    const { userId, description, amount, type, category, date, obs } = req.body;
    
    if (req.user.id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado' });
    }
    
    const validTypes = ['income', 'expense'];
    if (!validTypes.includes(type)) {
        return res.status(400).json({ error: 'Tipo inválido' });
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
    
    if (error) return res.status(400).json({ error: error.message });
    
    res.json({ success: true, id: data.id });
});

app.put('/api/transactions/:id', authenticateToken, async (req, res) => {
    const { description, amount, type, category, date, obs } = req.body;
    const id = req.params.id;
    
    const { data: transaction } = await supabase
        .from('transactions')
        .select('user_id')
        .eq('id', id)
        .single();
    
    if (!transaction || (transaction.user_id !== req.user.id && req.user.role !== 'admin')) {
        return res.status(403).json({ error: 'Acesso negado' });
    }
    
    const validTypes = ['income', 'expense'];
    if (!validTypes.includes(type)) {
        return res.status(400).json({ error: 'Tipo inválido' });
    }
    
    const validAmount = validateNumeric(amount);
    const sanitizedDesc = sanitizeInput(description).substring(0, 200);
    const sanitizedCategory = sanitizeInput(category).substring(0, 30);
    const sanitizedDate = sanitizeInput(date).substring(0, 20);
    const sanitizedObs = obs ? sanitizeInput(obs).substring(0, 500) : '';
    
    const { error } = await supabase
        .from('transactions')
        .update({
            description: sanitizedDesc,
            amount: validAmount,
            type,
            category: sanitizedCategory,
            date: sanitizedDate,
            obs: sanitizedObs
        })
        .eq('id', id);
    
    if (error) return res.status(400).json({ error: error.message });
    
    res.json({ success: true });
});

app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
    const id = req.params.id;
    
    const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);
    
    if (error) return res.status(400).json({ error: error.message });
    
    res.json({ success: true });
});

app.get('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
    
    const { data, error } = await supabase
        .from('users')
        .select('id, username, name, role, created_at');
    
    if (error) return res.status(500).json({ error: error.message });
    
    res.json(data || []);
});

app.post('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
    
    const { username, password, name, role } = req.body;
    
    const { data: exists } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();
    
    if (exists) return res.status(400).json({ error: 'Usuário já existe' });
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    const id = uuidv4();
    
    const { error } = await supabase
        .from('users')
        .insert([{ id, username, password: hashedPassword, name, role }]);
    
    if (error) return res.status(400).json({ error: error.message });
    
    res.json({ success: true });
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
    if (req.user.id === req.params.id) return res.status(400).json({ error: 'Não pode excluir si mesmo' });
    
    await supabase.from('transactions').delete().eq('user_id', req.params.id);
    await supabase.from('categories').delete().eq('user_id', req.params.id);
    await supabase.from('users').delete().eq('id', req.params.id);
    
    res.json({ success: true });
});

app.use(express.static(path.join(__dirname, '..')));

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});