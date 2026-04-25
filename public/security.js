/**
 * SECURITY MODULE - Fluxo de Caixa
 * XSS Protection, Hashing, Rate Limiting, Data Integrity
 */

const Security = (function() {
    'use strict';

    const SALT_LENGTH = 16;
    const ITERATIONS = 100000;
    const MAX_LOGIN_ATTEMPTS = 5;
    const LOCKOUT_DURATION = 5 * 60 * 1000;

    let loginAttempts = {};
    let sessionToken = null;
    let tokenExpiry = null;

    function generateSalt() {
        const array = new Uint8Array(SALT_LENGTH);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    async function hashPassword(password, salt) {
        const encoder = new TextEncoder();
        const passwordKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveBits']
        );
        
        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: encoder.encode(salt),
                iterations: ITERATIONS,
                hash: 'SHA-256'
            },
            passwordKey,
            256
        );

        const hashArray = Array.from(new Uint8Array(derivedBits));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function verifyPassword(password, salt, storedHash) {
        const computedHash = await hashPassword(password, salt);
        return computedHash === storedHash;
    }

    function generateSessionToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    function sanitize(str) {
        if (typeof str !== 'string') return '';
        
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function sanitizeHTML(html) {
        const allowedTags = ['b', 'i', 'em', 'strong', 'a', 'code', 'pre'];
        const div = document.createElement('div');
        div.textContent = html;
        
        const scripts = div.querySelectorAll('script, style');
        scripts.forEach(el => el.remove());
        
        return div.textContent;
    }

    function validateInput(value, type) {
        if (!value || typeof value !== 'string') return false;
        
        const patterns = {
            username: /^[a-zA-Z0-9_]{3,20}$/,
            name: /^[\p{L}\s]{2,100}$/u,
            description: /^[\p{L}\p{N}\s.,\-_!?]{1,200}$/u,
            amount: /^\d{1,12}(\.\d{1,2})?$/
        };

        if (patterns[type]) {
            return patterns[type].test(value.trim());
        }
        return true;
    }

    function checkRateLimit(username) {
        const now = Date.now();
        
        if (!loginAttempts[username]) {
            loginAttempts[username] = {
                attempts: 0,
                lockoutUntil: null
            };
        }

        const userAttempts = loginAttempts[username];

        if (userAttempts.lockoutUntil && now < userAttempts.lockoutUntil) {
            const remainingTime = Math.ceil((userAttempts.lockoutUntil - now) / 1000);
            return {
                blocked: true,
                message: `Conta bloqueada. Tente novamente em ${remainingTime} segundos.`
            };
        }

        if (userAttempts.lockoutUntil && now >= userAttempts.lockoutUntil) {
            userAttempts.attempts = 0;
            userAttempts.lockoutUntil = null;
        }

        return { blocked: false };
    }

    function recordFailedAttempt(username) {
        if (!loginAttempts[username]) {
            loginAttempts[username] = { attempts: 0, lockoutUntil: null };
        }

        loginAttempts[username].attempts++;

        if (loginAttempts[username].attempts >= MAX_LOGIN_ATTEMPTS) {
            loginAttempts[username].lockoutUntil = Date.now() + LOCKOUT_DURATION;
            return {
                locked: true,
                message: 'Máximo de tentativas excedido. Conta bloqueada por 5 minutos.'
            };
        }

        const remaining = MAX_LOGIN_ATTEMPTS - loginAttempts[username].attempts;
        return {
            locked: false,
            remaining: remaining,
            message: `Senha incorreta. Restam ${remaining} tentativas.`
        };
    }

    function clearLoginAttempts(username) {
        if (loginAttempts[username]) {
            delete loginAttempts[username];
        }
    }

    function createSession(userId) {
        sessionToken = generateSessionToken();
        tokenExpiry = Date.now() + (24 * 60 * 60 * 1000);
        
        const session = {
            token: sessionToken,
            userId: userId,
            createdAt: Date.now(),
            expiresAt: tokenExpiry
        };

        localStorage.setItem('session', JSON.stringify(session));
        return session;
    }

    function validateSession() {
        try {
            const sessionData = localStorage.getItem('session');
            if (!sessionData) return null;

            const session = JSON.parse(sessionData);
            
            if (Date.now() > session.expiresAt) {
                destroySession();
                return null;
            }

            return session;
        } catch (e) {
            return null;
        }
    }

    function destroySession() {
        sessionToken = null;
        tokenExpiry = null;
        localStorage.removeItem('session');
    }

    function generateChecksum(data) {
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    function verifyIntegrity(data, checksum) {
        return generateChecksum(data) === checksum;
    }

    function addIntegrityCheck(data) {
        return {
            ...data,
            _checksum: generateChecksum(data)
        };
    }

    function validateData(data) {
        if (!data || typeof data !== 'object') return false;
        
        const { _checksum, ...dataWithoutChecksum } = data;
        return verifyIntegrity(dataWithoutChecksum, _checksum);
    }

    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function validateDateRange(start, end) {
        if (!start || !end) return true;
        
        const startDate = new Date(start);
        const endDate = new Date(end);
        
        return startDate <= endDate;
    }

    function formatCurrency(amount) {
        const num = parseFloat(amount);
        if (isNaN(num)) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(num);
    }

    function parseCurrency(str) {
        const cleaned = str.replace(/[^\d.,]/g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    }

    function validateAmount(amount) {
        const num = parseFloat(amount);
        return !isNaN(num) && num > 0 && num <= 999999999.99;
    }

    function getCSRFToken() {
        let token = sessionStorage.getItem('csrf_token');
        if (!token) {
            const array = new Uint8Array(16);
            crypto.getRandomValues(array);
            token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
            sessionStorage.setItem('csrf_token', token);
        }
        return token;
    }

    function validateCSRFToken(token) {
        const stored = sessionStorage.getItem('csrf_token');
        return token === stored;
    }

    const SecureStorage = {
        set(key, value) {
            try {
                const data = JSON.stringify(value);
                localStorage.setItem(key, data);
                return true;
            } catch (e) {
                console.error('Storage error:', e);
                return false;
            }
        },
        
        get(key) {
            try {
                const data = localStorage.getItem(key);
                return data ? JSON.parse(data) : null;
            } catch (e) {
                console.error('Storage read error:', e);
                return null;
            }
        },
        
        remove(key) {
            localStorage.removeItem(key);
        }
    };

    return {
        hashPassword,
        verifyPassword,
        generateSalt,
        sanitize,
        sanitizeHTML,
        validateInput,
        checkRateLimit,
        recordFailedAttempt,
        clearLoginAttempts,
        createSession,
        validateSession,
        destroySession,
        generateChecksum,
        verifyIntegrity,
        addIntegrityCheck,
        validateData,
        escapeRegex,
        validateDateRange,
        formatCurrency,
        parseCurrency,
        validateAmount,
        getCSRFToken,
        validateCSRFToken,
        SecureStorage
    };
})();

window.Security = Security;