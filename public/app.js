/**
 * FLUXO DE CAIXA - Main Application
 * Backend API Integration
 */

(function() {
    'use strict';

    const API_URL = 'https://fluxo-caixa-backend-yh1m.onrender.com/api';

    const CONFIG = {
        CATEGORIES: {
            income: [],
            expense: []
        },
        CHART_COLORS: {
            income: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'],
            expense: ['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2']
        }
    };

    var state = {
        currentUser: null,
        transactions: [],
        users: [],
        charts: {
            cashflow: null,
            category: null,
            forecast: null,
            reportIncome: null,
            reportExpense: null
        },
        pagination: {
            currentPage: 1,
            perPage: 25,
            filteredTransactions: []
        },
        reportPagination: {
            income: { currentPage: 1, perPage: 20, items: [] },
            expense: { currentPage: 1, perPage: 20, items: [] }
        },
        token: null,
        initialBalance: 0,
        previousDebts: 0
    };

    async function init() {
        await checkAuth();
        bindEvents();
    }

    async function apiCall(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...(state.token && { 'Authorization': `Bearer ${state.token}` })
        };
        
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: { ...headers, ...options.headers }
        });
        
        if (response.status === 401) {
            logout();
            return null;
        }
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro na API');
        return data;
    }

    async function checkAuth() {
        var storedToken = localStorage.getItem('fc_token');
        var storedUser = localStorage.getItem('fc_user');
        var urlParams = new URLSearchParams(window.location.search);
        
        if (urlParams.has('google_token')) {
            var googleToken = urlParams.get('google_token');
            var googleUser = JSON.parse(decodeURIComponent(urlParams.get('google_user')));
            
            state.token = googleToken;
            state.currentUser = googleUser;
            localStorage.setItem('fc_token', googleToken);
            localStorage.setItem('fc_user', JSON.stringify(googleUser));
            
            window.history.replaceState({}, document.title, '/');
            
            await loadCategories();
            await loadTransactions();
            showApp();
        } else if (storedToken && storedUser) {
            state.token = storedToken;
            state.currentUser = JSON.parse(storedUser);
            await loadCategories();
            await loadTransactions();
            showApp();
        }
        
        if (urlParams.has('error')) {
            showToast('Erro no login: ' + urlParams.get('error'), 'error');
        }
    }

    function showApp() {
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('app-screen').classList.add('active');
        updateUserUI();
        navigateTo('dashboard');
        renderDashboard();
    }

    function updateUserUI() {
        var userNameEl = document.getElementById('user-name');
        if (userNameEl) userNameEl.textContent = state.currentUser.name;
        
        var adminBtn = document.getElementById('admin-btn');
        if (adminBtn) {
            adminBtn.style.display = state.currentUser.role === 'admin' ? 'flex' : 'none';
        }
    }

    function logout() {
        localStorage.removeItem('fc_token');
        localStorage.removeItem('fc_user');
        state.token = null;
        state.currentUser = null;
        state.transactions = [];
        CONFIG.CATEGORIES = { income: [], expense: [] };
        
        document.getElementById('auth-screen').classList.add('active');
        document.getElementById('app-screen').classList.remove('active');
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
    }

function bindEvents() {
        function on(id, event, handler) {
            var el = document.getElementById(id);
            if (el) el.addEventListener(event, handler);
        }
        
        on('dashboard-month', 'change', renderDashboard);
        on('dashboard-year', 'change', renderDashboard);
        on('view-all-transactions', 'click', function() { navigateTo('transactions'); });
        on('add-transaction-btn', 'click', function() { openTransactionModal(); });
        on('add-transaction-btn-dashboard', 'click', function() { openTransactionModal(); });
        on('transaction-form', 'submit', async function(e) { e.preventDefault(); await saveTransaction(); });
        on('trans-type', 'change', updateCategoryOptions);
        on('close-modal', 'click', closeTransactionModal);
        on('cancel-transaction', 'click', closeTransactionModal);
        on('confirm-delete', 'click', confirmDelete);
        on('cancel-delete', 'click', cancelDelete);
        on('search-input', 'input', renderTransactions);
        on('filter-month', 'change', renderTransactions);
        on('filter-year', 'change', renderTransactions);
        on('filter-type', 'change', renderTransactions);
        on('filter-category', 'change', renderTransactions);
        on('clear-filters', 'click', function() {
            document.getElementById('search-input').value = '';
            document.getElementById('filter-month').value = '';
            document.getElementById('filter-year').value = '';
            document.getElementById('filter-type').value = '';
            document.getElementById('filter-category').value = '';
            renderTransactions();
        });
        
        on('admin-btn', 'click', function() { navigateTo('admin'); });
        on('user-btn', 'click', function(e) { 
            e.stopPropagation();
            document.getElementById('user-dropdown').classList.toggle('hidden'); 
        });
        
        document.addEventListener('click', function(e) {
            var dropdown = document.getElementById('user-dropdown');
            var userBtn = document.getElementById('user-btn');
            if (dropdown && !dropdown.contains(e.target) && !userBtn.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
        on('per-page', 'change', function(e) { App.changePerPage(e.target.value); });
        on('prev-page', 'click', function() { if (state.pagination.currentPage > 1) App.goToPage(state.pagination.currentPage - 1); });
        on('next-page', 'click', function() {
            const totalPages = Math.ceil(state.pagination.filteredTransactions.length / state.pagination.perPage);
            if (state.pagination.currentPage < totalPages) {
                App.goToPage(state.pagination.currentPage + 1);
            }
        });
        
        document.getElementById('report-month').addEventListener('change', renderReports);
        
        document.getElementById('export-xlsx').addEventListener('click', exportXLSX);
        
        document.getElementById('income-per-page').addEventListener('change', function(e) {
            App.changeReportPerPage('income', e.target.value);
        });
        
        document.getElementById('expense-per-page').addEventListener('change', function(e) {
            App.changeReportPerPage('expense', e.target.value);
        });
        
        document.getElementById('income-first').addEventListener('click', function() { App.goToReportPage('income', 1); });
        document.getElementById('income-prev').addEventListener('click', function() { 
            if (state.reportPagination.income.currentPage > 1) 
                App.goToReportPage('income', state.reportPagination.income.currentPage - 1); 
        });
        document.getElementById('income-next').addEventListener('click', function() { 
            const total = Math.ceil(state.reportPagination.income.items.length / state.reportPagination.income.perPage);
            if (state.reportPagination.income.currentPage < total) 
                App.goToReportPage('income', state.reportPagination.income.currentPage + 1); 
        });
        document.getElementById('income-last').addEventListener('click', function() { 
            const total = Math.ceil(state.reportPagination.income.items.length / state.reportPagination.income.perPage);
            App.goToReportPage('income', total); 
        });
        
        document.getElementById('expense-first').addEventListener('click', function() { App.goToReportPage('expense', 1); });
        document.getElementById('expense-prev').addEventListener('click', function() { 
            if (state.reportPagination.expense.currentPage > 1) 
                App.goToReportPage('expense', state.reportPagination.expense.currentPage - 1); 
        });
        document.getElementById('expense-next').addEventListener('click', function() { 
            const total = Math.ceil(state.reportPagination.expense.items.length / state.reportPagination.expense.perPage);
            if (state.reportPagination.expense.currentPage < total) 
                App.goToReportPage('expense', state.reportPagination.expense.currentPage + 1); 
        });
        document.getElementById('expense-last').addEventListener('click', function() { 
            const total = Math.ceil(state.reportPagination.expense.items.length / state.reportPagination.expense.perPage);
            App.goToReportPage('expense', total); 
        });

        on('add-user-btn', 'click', openUserModal);
        on('close-user-modal', 'click', closeUserModal);
        on('cancel-user', 'click', closeUserModal);
        on('user-form', 'submit', saveUser);
        on('backup-btn', 'click', makeBackup);
        on('save-initial-data', 'click', saveInitialData);
        on('add-category-btn', 'click', function() { openCategoryModal(); });
        
        on('menu-toggle', 'click', function(e) {
            e.stopPropagation();
            var sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.toggle('open');
        });
        on('sidebar-overlay', 'click', function() {
            var sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('open');
        });
        
        document.querySelectorAll('.nav-item').forEach(function(btn) {
            btn.addEventListener('click', function() {
                navigateTo(btn.dataset.view);
            });
        });
        
        loadInitialData();
        
        var userModalOverlay = document.querySelector('#user-modal .modal-overlay');
        if (userModalOverlay) userModalOverlay.addEventListener('click', closeUserModal);
        
        on('edit-category-btn', 'click', function() {
            const select = document.getElementById('trans-category');
            if (select && select.value) {
                openCategoryModal(select.value);
            } else {
                showToast('Selecione uma categoria para editar', 'warning');
            }
        });
        
        on('delete-category-btn', 'click', function() {
            const select = document.getElementById('trans-category');
            const type = document.getElementById('trans-type').value;
            if (select && select.value) {
                if (confirm('Excluir esta categoria?')) {
                    deleteCategoryFromModal(select.value, type);
                }
            } else {
                showToast('Selecione uma categoria para excluir', 'warning');
            }
        });
        
        on('close-category-modal', 'click', closeCategoryModal);
        
        on('login-btn', 'click', async function() {
            var usernameEl = document.getElementById('login-username');
            var passwordEl = document.getElementById('login-password');
            var username = usernameEl ? usernameEl.value : '';
            var password = passwordEl ? passwordEl.value : '';
            
            if (!username || !password) {
                showAuthError('Preencha usuário e senha');
                return;
            }
            
            document.getElementById('login-form').classList.add('hidden');
            
            try {
                var data = await apiCall('/login', {
                    method: 'POST',
                    body: JSON.stringify({ username: username, password: password })
                });
                
                state.token = data.token;
                state.currentUser = data.user;
                localStorage.setItem('fc_token', data.token);
                localStorage.setItem('fc_user', JSON.stringify(data.user));
                
                await loadCategories();
                await loadTransactions();
                showApp();
            } catch (err) {
                document.getElementById('login-form').classList.remove('hidden');
                showAuthError(err.message);
            }
        });
        
        on('login-password', 'keypress', function(e) { if (e.key === 'Enter') document.getElementById('login-btn').click(); });
        on('google-login-btn', 'click', async function() {
            try {
                const data = await apiCall('/auth/google');
                if (data && data.authUrl) {
                    window.location.href = data.authUrl;
                } else if (data && data.error) {
                    showToast(data.error, 'error');
                } else {
                    showToast('Google OAuth não configurado no servidor', 'warning');
                }
            } catch (err) {
                showToast('Erro ao conectar com Google', 'error');
            }
        });
        on('register-btn', 'click', async function() {
            var usernameEl = document.getElementById('register-username');
            var passwordEl = document.getElementById('register-password');
            var confirmEl = document.getElementById('register-confirm');
            var username = usernameEl ? usernameEl.value : '';
            var password = passwordEl ? passwordEl.value : '';
            var confirm = confirmEl ? confirmEl.value : '';
            
            if (!username || !password) {
                showAuthError('Preencha usuário e senha');
                return;
            }
            if (password !== confirm) {
                showAuthError('Senhas não coincidem');
                return;
            }
            
            try {
                await apiCall('/register', {
                    method: 'POST',
                    body: JSON.stringify({ username: username, password: password, name: username })
                });
                showToast('Conta criada! Faça login.', 'success');
                document.getElementById('register-btn').click();
            } catch (err) {
                showAuthError(err.message);
            }
        });
        
        on('register-confirm', 'keypress', function(e) { if (e.key === 'Enter') document.getElementById('register-btn').click(); });
        on('show-register', 'click', function(e) {
            e.preventDefault();
            document.getElementById('login-form').classList.add('hidden');
            document.getElementById('register-form').classList.remove('hidden');
            document.getElementById('auth-error').classList.add('hidden');
        });
        on('show-login', 'click', function(e) {
            e.preventDefault();
            document.getElementById('register-form').classList.add('hidden');
            document.getElementById('login-form').classList.remove('hidden');
            document.getElementById('auth-error').classList.add('hidden');
        });
        
        document.querySelectorAll('.toggle-password').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var target = document.getElementById(btn.dataset.target);
                if (target) {
                    target.type = target.type === 'password' ? 'text' : 'password';
                }
            });
        });
        
        var transModalOverlay = document.querySelector('#transaction-modal .modal-overlay');
        if (transModalOverlay) transModalOverlay.addEventListener('click', closeTransactionModal);
        
        var deleteModalOverlay = document.querySelector('#delete-modal .modal-overlay');
        if (deleteModalOverlay) deleteModalOverlay.addEventListener('click', cancelDelete);
        document.getElementById('cancel-category').addEventListener('click', closeCategoryModal);
        document.querySelector('#category-modal .modal-overlay').addEventListener('click', closeCategoryModal);
        document.getElementById('category-form').addEventListener('submit', saveCategory);

        document.addEventListener('click', function(e) {
            if (!e.target.closest('.user-menu')) {
                document.getElementById('user-dropdown').classList.add('hidden');
            }
        });
    }

    async function loadCategories() {
        try {
            var data = await apiCall('/categories/' + state.currentUser.id);
            if (data) {
                CONFIG.CATEGORIES = data;
                populateCategorySelects();
            }
        } catch (err) {
            console.error('Erro ao carregar categorias:', err);
            showToast('Erro ao carregar categorias. Faça login novamente.', 'error');
        }
    }

    async function loadTransactions() {
        console.log('Loading transactions for user:', state.currentUser.id);
        try {
            var data = await apiCall('/transactions/' + state.currentUser.id);
            console.log('Transactions loaded:', data);
            if (data && data.length > 0) {
                state.transactions = data.map(function(t) {
                    return Object.assign({}, t, { date: new Date(t.date).getTime() });
                });
                localStorage.setItem('fc_transactions_backup', JSON.stringify(state.transactions));
                console.log('State transactions:', state.transactions.length);
            } else {
                loadTransactionsFromBackup();
            }
        } catch (err) {
            console.error('Erro ao carregar transações:', err);
            loadTransactionsFromBackup();
        }
    }

    function loadTransactionsFromBackup() {
        var backup = localStorage.getItem('fc_transactions_backup');
        if (backup) {
            var parsed = JSON.parse(backup);
            if (parsed && parsed.length > 0) {
                state.transactions = parsed;
                console.log('Loaded', parsed.length, 'transactions from localStorage backup');
            }
        }
    }

    function populateCategorySelects() {
        var filterCategory = document.getElementById('filter-category');
        filterCategory.innerHTML = '<option value="">Todas</option>';
        
        [].concat(CONFIG.CATEGORIES.income, CONFIG.CATEGORIES.expense).forEach(function(c) {
            filterCategory.innerHTML += '<option value="' + c.name + '">' + c.name + '</option>';
        });
    }
    
    function populateYearFilter() {
        var yearSelect = document.getElementById('filter-year');
        if (!yearSelect) return;
        
        var years = {};
        state.transactions.forEach(function(t) {
            var y = new Date(t.date).getFullYear();
            years[y] = true;
        });
        
        var sortedYears = Object.keys(years).sort().reverse();
        yearSelect.innerHTML = '<option value="">Todos os anos</option>';
        sortedYears.forEach(function(y) {
            yearSelect.innerHTML += '<option value="' + y + '">' + y + '</option>';
        });
    }

    function updateCategoryOptions() {
        const type = document.getElementById('trans-type').value;
        const select = document.getElementById('trans-category');
        
        select.innerHTML = '';
        
        const categories = CONFIG.CATEGORIES[type] || [];
        
        categories.forEach(c => {
            select.innerHTML += `<option value="${c.name}">${c.name}</option>`;
        });
    }

    function showAuthError(message) {
        const errorEl = document.getElementById('auth-error');
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }

    function showToast(message, type) {
        type = type || 'info';
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.innerHTML = 
            '<span class="toast-message">' + message + '</span>' +
            '<button class="toast-close" onclick="this.parentElement.remove()">' +
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                    '<line x1="18" y1="6" x2="6" y2="18"/>' +
                    '<line x1="6" y1="6" x2="18" y2="18"/>' +
                '</svg>' +
            '</button>';
        
        container.appendChild(toast);
        
        setTimeout(function() {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 4000);
    }

    function navigateTo(view) {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
        });
        
        document.getElementById('view-' + view).classList.add('active');
        
        document.getElementById('sidebar').classList.remove('open');
        
        switch(view) {
            case 'dashboard':
                var now = new Date();
                document.getElementById('dashboard-month').value = String(now.getMonth() + 1).padStart(2, '0');
                renderDashboard();
                break;
            case 'transactions': 
                populateYearFilter();
                renderTransactions(); 
                break;
            case 'forecast': renderForecast(); break;
            case 'reports': renderReports(); break;
            case 'admin': renderAdmin(); break;
        }
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
    }

function renderDashboard() {
        if (!document.getElementById('dashboard-year').options.length) {
            populateDashboardYearSelect();
        }
        
        var month = parseInt(document.getElementById('dashboard-month').value);
        var year = parseInt(document.getElementById('dashboard-year').value);
        
        if (!year) {
            var now = new Date();
            year = now.getFullYear();
            document.getElementById('dashboard-year').value = year;
        }
        
        var startDate = new Date(year, month - 1, 1).getTime();
        var endDate = new Date(year, month, 0, 23, 59, 59).getTime();
        
        var periodTransactions = state.transactions.filter(function(t) { return t.date >= startDate && t.date <= endDate; });
        
        var income = periodTransactions.filter(function(t) { return t.type === 'income'; }).reduce(function(sum, t) { return sum + t.amount; }, 0);
        var expense = periodTransactions.filter(function(t) { return t.type === 'expense'; }).reduce(function(sum, t) { return sum + t.amount; }, 0);
        
        var totalIncome = state.initialBalance + income;
        var totalExpense = state.previousDebts + expense;
        var balance = totalIncome - totalExpense;
        
        document.getElementById('kpi-income').textContent = formatCurrency(totalIncome);
        document.getElementById('kpi-expense').textContent = formatCurrency(totalExpense);
        document.getElementById('kpi-balance').textContent = formatCurrency(balance);
        
        document.getElementById('kpi-expense').style.color = 'var(--accent-danger)';
        document.getElementById('kpi-balance').style.color = balance >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)';
        
        renderCashflowChart(startDate, endDate);
        renderCategoryChart(startDate, endDate);
        renderBalanceChart(startDate, endDate);
        renderIndicatorChart(startDate, endDate);
        renderRecentTransactions();
        renderForecast();
    }

    function renderRecentTransactions() {
        var listEl = document.getElementById('recent-transactions-list');
        if (!listEl) return;
        
        var recent = state.transactions.slice(0, 5);
        
        if (recent.length === 0) {
            listEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">Nenhuma transação</p>';
            return;
        }
        
        listEl.innerHTML = recent.map(function(t) {
            var allCats = [].concat(CONFIG.CATEGORIES.income, CONFIG.CATEGORIES.expense);
            var catName = t.category;
            
            return '<div class="recent-item">' +
                '<div class="recent-info">' +
                    '<span class="recent-desc">' + t.description + '</span>' +
                    '<span class="recent-cat">' + catName + '</span>' +
                '</div>' +
                '<span class="recent-amount ' + t.type + '">' + (t.type === 'income' ? '+' : '-') + formatCurrency(t.amount) + '</span>' +
            '</div>';
        }).join('');
    }

    function populateDashboardYearSelect() {
        var yearSelect = document.getElementById('dashboard-year');
        if (!yearSelect) return;
        
        var years = {};
        state.transactions.forEach(function(t) {
            var y = new Date(t.date).getFullYear();
            years[y] = true;
        });
        
        var now = new Date();
        years[now.getFullYear()] = true;
        
        var sortedYears = Object.keys(years).sort().reverse();
        var currentYear = yearSelect.value || now.getFullYear().toString();
        
        yearSelect.innerHTML = '';
        sortedYears.forEach(function(y) {
            yearSelect.innerHTML += '<option value="' + y + '">' + y + '</option>';
        });
        
        if (sortedYears.indexOf(currentYear) >= 0) {
            yearSelect.value = currentYear;
        }
    }

    function renderBalanceChart(startDate, endDate) {
        var ctx = document.getElementById('balance-chart');
        if (!ctx) return;
        
        var periodSelect = document.getElementById('balance-period');
        var periodType = periodSelect ? periodSelect.value : 'month';
        
        var start = new Date(startDate);
        var end = new Date(endDate);
        var labels = [];
        var balanceData = [];
        var runningBalance = 0;
        
        if (periodType === 'month') {
            var current = new Date(start.getFullYear(), start.getMonth(), 1);
            while (current <= end) {
                var dayNum = current.getDate();
                labels.push(dayNum);
                
                var dayTransactions = state.transactions.filter(function(t) {
                    var tDate = new Date(t.date);
                    return tDate.getFullYear() === current.getFullYear() && 
                           tDate.getMonth() === current.getMonth() && 
                           tDate.getDate() === dayNum;
                });
                
                var dayIncome = dayTransactions.filter(function(t) { return t.type === 'income'; }).reduce(function(s, t) { return s + t.amount; }, 0);
                var dayExpense = dayTransactions.filter(function(t) { return t.type === 'expense'; }).reduce(function(s, t) { return s + t.amount; }, 0);
                runningBalance += dayIncome - dayExpense;
                balanceData.push(runningBalance);
                
                current.setDate(current.getDate() + 1);
            }
        } else {
            var current = new Date(start.getFullYear(), start.getMonth(), 1);
            while (current <= end) {
                var monthName = current.toLocaleDateString('pt-BR', { month: 'short' });
                labels.push(monthName);
                
                var monthTransactions = state.transactions.filter(function(t) {
                    var tDate = new Date(t.date);
                    return tDate.getFullYear() === current.getFullYear() && tDate.getMonth() === current.getMonth();
                });
                
                var monthIncome = monthTransactions.filter(function(t) { return t.type === 'income'; }).reduce(function(s, t) { return s + t.amount; }, 0);
                var monthExpense = monthTransactions.filter(function(t) { return t.type === 'expense'; }).reduce(function(s, t) { return s + t.amount; }, 0);
                runningBalance += monthIncome - monthExpense;
                balanceData.push(runningBalance);
                
                current.setMonth(current.getMonth() + 1);
            }
        }
        
        if (state.charts.balance) state.charts.balance.destroy();
        
        state.charts.balance = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Saldo Acumulado',
                    data: balanceData,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    fill: true,
                    tension: 0.3
}]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: '#e5e7eb' }, ticks: { callback: function(v) { return 'R$ ' + v; } } }
                }
            }
        });
    }

    function renderIndicatorChart(startDate, endDate) {
        var ctx = document.getElementById('indicator-chart');
        var legendEl = document.getElementById('indicator-legend');
        if (!ctx) return;
        
        var periodTransactions = state.transactions.filter(function(t) { return t.date >= startDate && t.date <= endDate; });
        
        var totalIncome = periodTransactions.filter(function(t) { return t.type === 'income'; }).reduce(function(s, t) { return s + t.amount; }, 0);
        var totalExpense = periodTransactions.filter(function(t) { return t.type === 'expense'; }).reduce(function(s, t) { return s + t.amount; }, 0);
        var netBalance = totalIncome - totalExpense;
        var total = totalIncome + totalExpense;
        
        if (state.charts.indicator) state.charts.indicator.destroy();
        
        if (total === 0) {
            state.charts.indicator = new Chart(ctx, {
                type: 'doughnut',
                data: { labels: ['Sem dados'], datasets: [{ data: [1], backgroundColor: ['#374151'] }] },
                options: { cutout: '70%', plugins: { legend: { display: false } } }
            });
            legendEl.innerHTML = '<span style="color:var(--text-muted)">Nenhuma transação no período</span>';
            return;
        }
        
        state.charts.indicator = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Entradas', 'Saídas'],
                datasets: [{ data: [totalIncome, totalExpense], backgroundColor: ['#10b981', '#ef4444'], borderWidth: 0 }]
            },
            options: {
                cutout: '70%',
                plugins: { legend: { display: false } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            var val = context.raw;
                            var pct = ((val / total) * 100).toFixed(1);
                            return context.label + ': R$ ' + val.toLocaleString('pt-BR') + ' (' + pct + '%)';
                        }
                    }
                }
            }
        });
        
        var incomePct = total > 0 ? (totalIncome / total * 100) : 0;
        var expensePct = total > 0 ? (totalExpense / total * 100) : 0;
        var healthScore = total > 0 ? Math.round((netBalance >= 0 ? 50 + incomePct * 0.5 : 50 - expensePct * 0.5)) : 50;
        var scoreColor = healthScore >= 70 ? '#10b981' : healthScore >= 40 ? '#f59e0b' : '#ef4444';
        var scoreLabel = healthScore >= 70 ? 'Excelente' : healthScore >= 50 ? 'Bom' : healthScore >= 30 ? 'Atenção' : 'Crítico';
        
        legendEl.innerHTML =
            '<div class="indicator-row">' +
                '<span class="indicator-row-label">Total de Entradas</span>' +
                '<span class="indicator-row-value income">R$ ' + totalIncome.toLocaleString('pt-BR') + '</span>' +
                '<div class="indicator-row-bar"><div class="indicator-row-bar-fill income" style="width:' + incomePct + '%"></div></div>' +
            '</div>' +
            '<div class="indicator-row">' +
                '<span class="indicator-row-label">Total de Saídas</span>' +
                '<span class="indicator-row-value expense">R$ ' + totalExpense.toLocaleString('pt-BR') + '</span>' +
                '<div class="indicator-row-bar"><div class="indicator-row-bar-fill expense" style="width:' + expensePct + '%"></div></div>' +
            '</div>' +
            '<div class="indicator-row">' +
                '<span class="indicator-row-label">Saldo Líquido</span>' +
                '<span class="indicator-row-value ' + (netBalance >= 0 ? 'income' : 'expense') + '">R$ ' + netBalance.toLocaleString('pt-BR') + '</span>' +
            '</div>' +
            '<div class="indicator-score">' +
                '<span class="indicator-score-label">Saúde:</span>' +
                '<span class="indicator-score-value" style="color:' + scoreColor + '">' + healthScore + '/100</span>' +
                '<span style="font-size:12px;color:' + scoreColor + '">' + scoreLabel + '</span>' +
            '</div>';
    }

    function renderCashflowChart(startDate, endDate) {
        var ctx = document.getElementById('cashflow-chart').getContext('2d');
        
        var dailyData = {};
        var start = new Date(startDate);
        var end = new Date(endDate);
        var dayCount = Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));
        
        for (var i = 0; i < dayCount; i++) {
            var date = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
            var dateKey = date.toISOString().split('T')[0];
            dailyData[dateKey] = { income: 0, expense: 0 };
        }
        
        state.transactions.filter(function(t) { return t.date >= startDate && t.date <= endDate; }).forEach(function(t) {
            var dateKey = new Date(t.date).toISOString().split('T')[0];
            if (dailyData[dateKey]) {
                if (t.type === 'income') dailyData[dateKey].income += t.amount;
                else dailyData[dateKey].expense += t.amount;
            }
        });
        
        var labels = Object.keys(dailyData).map(function(d) {
            var date = new Date(d);
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        });
        
        var incomeData = Object.values(dailyData).map(function(d) { return d.income; });
        var expenseData = Object.values(dailyData).map(function(d) { return d.expense; });
        
        if (state.charts.cashflow) state.charts.cashflow.destroy();
        
        state.charts.cashflow = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Entradas', data: incomeData, backgroundColor: '#10b981', borderRadius: 4 },
                    { label: 'Saídas', data: expenseData, backgroundColor: '#ef4444', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true, position: 'top' } },
                scales: {
                    x: { stacked: false, grid: { display: false } },
                    y: { stacked: false, grid: { color: '#e5e7eb' }, ticks: { callback: function(v) { return 'R$ ' + v; } } }
                }
            }
        });
    }

    function renderCategoryChart(startDate, endDate) {
        var ctx = document.getElementById('category-chart').getContext('2d');
        
        var periodTransactions = state.transactions.filter(function(t) { return t.date >= startDate && t.date <= endDate; });
        
        var incomeByCat = {};
        var expenseByCat = {};
        
        periodTransactions.filter(function(t) { return t.type === 'income'; }).forEach(function(t) {
            incomeByCat[t.category] = (incomeByCat[t.category] || 0) + t.amount;
        });
        
        periodTransactions.filter(function(t) { return t.type === 'expense'; }).forEach(function(t) {
            expenseByCat[t.category] = (expenseByCat[t.category] || 0) + t.amount;
        });
        
        var catKeys = Object.keys(incomeByCat).concat(Object.keys(expenseByCat));
        var allCatIds = [...new Set(catKeys)];
        var allCats = [].concat(CONFIG.CATEGORIES.income || [], CONFIG.CATEGORIES.expense || []);
        
        if (state.charts.category) state.charts.category.destroy();
        
        state.charts.category = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: allCatIds.map(function(catId) {
                    return catId;
                }),
                datasets: [
                    { label: 'Entradas', data: allCatIds.map(function(catId) { return incomeByCat[catId] || 0; }), backgroundColor: '#10b981' },
                    { label: 'Saídas', data: allCatIds.map(function(catId) { return expenseByCat[catId] || 0; }), backgroundColor: '#ef4444' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: '#e5e7eb' }, ticks: { callback: function(v) { return 'R$ ' + v; } } }
                }
            }
        });
    }

    function renderForecast() {
        renderForecastValues();
        renderForecastChart();
    }

    function renderForecastValues() {
        const transactions = state.transactions;
        
        const income30 = transactions.filter(function(t) { return t.type === 'income'; }).reduce(function(s, t) { return s + t.amount; }, 0) / (transactions.length || 1) * 30;
        const expense30 = transactions.filter(function(t) { return t.type === 'expense'; }).reduce(function(s, t) { return s + t.amount; }, 0) / (transactions.length || 1) * 30;
        
        const income90 = income30 * 3;
        const expense90 = expense30 * 3;
        
        document.getElementById('forecast-30').textContent = formatCurrency(income30 - expense30);
        document.getElementById('forecast-90').textContent = formatCurrency(income90 - expense90);
        
        document.getElementById('forecast-30-trend').innerHTML = income30 - expense30 >= 0 ? '<span style="color:#10b981">↑ Positivo</span>' : '<span style="color:#ef4444">↓ Negativo</span>';
    }

    function renderForecastChart() {
        const ctx = document.getElementById('forecast-chart').getContext('2d');
        
        const transactions = state.transactions;
        
        const dailyData = [];
        let runningBalance = transactions.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
        
        for (let i = 30; i >= -30; i--) {
            const date = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().split('T')[0];
            
            const dayTransactions = transactions.filter(t => new Date(t.date).toISOString().split('T')[0] === dateStr);
            
            const dayIncome = dayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
            const dayExpense = dayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
            
            if (i < 0) {
                const avgDaily = transactions.length > 0 ? (transactions.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0) / transactions.length) : 0;
                runningBalance += avgDaily;
            } else {
                runningBalance += dayIncome - dayExpense;
            }
            
            dailyData.push({
                date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                balance: runningBalance,
                isForecast: i < 0
            });
        }
        
        if (state.charts.forecast) state.charts.forecast.destroy();
        
        state.charts.forecast = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dailyData.map(d => d.date),
                datasets: [{
                    label: 'Saldo Projetado',
                    data: dailyData.map(d => d.balance),
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: '#e5e7eb' }, ticks: { callback: v => 'R$ ' + v } }
                }
            }
        });
    }

function renderTransactions() {
        var filters = getTransactionFilters();
        var filtered = state.transactions.filter(function(t) {
            var d = new Date(t.date);
            var searchMatch = !filters.search || t.description.toLowerCase().includes(filters.search.toLowerCase()) || t.category.toLowerCase().includes(filters.search.toLowerCase());
            var monthMatch = !filters.month || d.getMonth() + 1 === parseInt(filters.month);
            var yearMatch = !filters.year || d.getFullYear() === parseInt(filters.year);
            var typeMatch = !filters.type || t.type === filters.type;
            var catMatch = !filters.category || t.category === filters.category;
            return searchMatch && monthMatch && yearMatch && typeMatch && catMatch;
        });
        
        filtered.sort(function(a, b) { return b.date - a.date; });
        
        state.pagination.filteredTransactions = filtered;
        state.pagination.currentPage = 1;
        
        renderTransactionTable();
    }

    function getTransactionFilters() {
        return {
            search: document.getElementById('search-input').value,
            month: document.getElementById('filter-month').value,
            year: document.getElementById('filter-year').value,
            type: document.getElementById('filter-type').value,
            category: document.getElementById('filter-category').value
        };
    }

    function renderTransactionTable() {
        const tbody = document.getElementById('transactions-table-body');
        const empty = document.getElementById('table-empty');
        const container = document.querySelector('.pagination-container');
        
        const { currentPage, perPage, filteredTransactions } = state.pagination;
        const start = (currentPage - 1) * perPage;
        const end = start + perPage;
        const pageTransactions = filteredTransactions.slice(start, end);
        const totalPages = Math.ceil(filteredTransactions.length / perPage);
        
        renderTransactionsKPIs(filteredTransactions);
        
        if (filteredTransactions.length === 0) {
            tbody.innerHTML = '';
            empty.classList.remove('hidden');
            container.classList.add('hidden');
            return;
        }
        
        empty.classList.add('hidden');
        container.classList.remove('hidden');
        
        tbody.innerHTML = pageTransactions.map(t => {
            var allCats = [].concat(CONFIG.CATEGORIES.income, CONFIG.CATEGORIES.expense);
            var catName = t.category;
            
            return `<tr>
                <td>${new Date(t.date).toLocaleDateString('pt-BR')}</td>
                <td>${t.description}</td>
                <td>${catName}</td>
                <td><span class="type-badge ${t.type}">${t.type === 'income' ? 'Entrada' : 'Saída'}</span></td>
                <td class="${t.type === 'income' ? 'income' : 'expense'}">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn edit" onclick="App.editTransaction('${t.id}')" title="Editar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="action-btn delete" onclick="App.deleteTransaction('${t.id}')" title="Excluir">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');
        
        updatePagination(start, end, filteredTransactions.length, currentPage, totalPages);
        
        renderTransactionsKPIs(filteredTransactions);
    }

    function renderTransactionsKPIs(filtered) {
        var transactions = filtered || state.transactions;
        var income = transactions.filter(function(t) { return t.type === 'income'; }).reduce(function(sum, t) { return sum + t.amount; }, 0);
        var expense = transactions.filter(function(t) { return t.type === 'expense'; }).reduce(function(sum, t) { return sum + t.amount; }, 0);
        var balance = state.initialBalance + income - expense - state.previousDebts;
        
        var incomeEl = document.getElementById('kpi-income-trans');
        var expenseEl = document.getElementById('kpi-expense-trans');
        var balanceEl = document.getElementById('kpi-balance-trans');
        
        if (incomeEl) incomeEl.textContent = formatCurrency(income);
        if (expenseEl) { expenseEl.textContent = formatCurrency(expense); expenseEl.style.color = 'var(--accent-danger)'; }
        if (balanceEl) { balanceEl.textContent = formatCurrency(balance); balanceEl.style.color = balance >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'; }
    }

    function updatePagination(start, end, total, currentPage, totalPages) {
        document.getElementById('pagination-start').textContent = start + 1;
        document.getElementById('pagination-end').textContent = Math.min(end, total);
        document.getElementById('pagination-total').textContent = total;
        
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const numbersContainer = document.getElementById('pagination-numbers');
        
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages || totalPages === 0;
        
        let pages = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentPage <= 4) pages = [1, 2, 3, 4, 5, '...', totalPages];
            else if (currentPage >= totalPages - 3) pages = [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
            else pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
        }
        
        numbersContainer.innerHTML = pages.map(p => {
            if (p === '...') return '<span class="page-ellipsis">...</span>';
            return `<button class="page-number ${p === currentPage ? 'active' : ''}" onclick="App.goToPage(${p})">${p}</button>`;
        }).join('');
    }

    function openTransactionModal(transaction = null) {
        const modal = document.getElementById('transaction-modal');
        const form = document.getElementById('transaction-form');
        
        document.getElementById('modal-title').textContent = transaction ? 'Editar Transação' : 'Nova Transação';
        
        if (transaction) {
            document.getElementById('transaction-id').value = transaction.id;
            document.getElementById('trans-description').value = transaction.description;
            document.getElementById('trans-amount').value = transaction.amount;
            document.getElementById('trans-type').value = transaction.type;
            document.getElementById('trans-category').value = transaction.category;
            document.getElementById('trans-date').value = new Date(transaction.date).toISOString().split('T')[0];
            document.getElementById('trans-obs').value = transaction.obs || '';
        } else {
            form.reset();
            document.getElementById('transaction-id').value = '';
            document.getElementById('trans-date').value = new Date().toISOString().split('T')[0];
        }
        
        updateCategoryOptions();
        modal.classList.remove('hidden');
    }

    function closeTransactionModal() {
        document.getElementById('transaction-modal').classList.add('hidden');
        document.getElementById('transaction-form').reset();
    }

    async function saveTransaction() {
        var id = document.getElementById('transaction-id').value;
        var data = {
            userId: state.currentUser.id,
            description: document.getElementById('trans-description').value,
            amount: parseFloat(document.getElementById('trans-amount').value),
            type: document.getElementById('trans-type').value,
            category: document.getElementById('trans-category').value,
            date: document.getElementById('trans-date').value,
            obs: document.getElementById('trans-obs').value
        };
        
        try {
            if (id) {
                await apiCall('/transactions/' + id, { method: 'PUT', body: JSON.stringify(data) });
                var idx = state.transactions.findIndex(function(t) { return t.id == id; });
                if (idx !== -1) state.transactions[idx] = Object.assign({}, state.transactions[idx], data, { date: new Date(data.date).getTime() });
                localStorage.setItem('fc_transactions_backup', JSON.stringify(state.transactions));
                showToast('Transação atualizada!', 'success');
            } else {
                var result = await apiCall('/transactions', { method: 'POST', body: JSON.stringify(data) });
                state.transactions.unshift(Object.assign({}, data, { id: result.id, date: new Date(data.date).getTime() }));
                localStorage.setItem('fc_transactions_backup', JSON.stringify(state.transactions));
                showToast('Transação adicionada!', 'success');
            }
            
            closeTransactionModal();
            renderDashboard();
            if (document.getElementById('view-transactions').classList.contains('active')) {
                renderTransactionsKPIs();
                renderTransactions();
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    window.App = {
        editTransaction: function(id) {
            const transaction = state.transactions.find(t => t.id == id);
            if (transaction) openTransactionModal(transaction);
        },
        
        deleteTransaction: function(id) {
            window.pendingDeleteId = id;
            document.getElementById('delete-modal').classList.remove('hidden');
        },
        
        goToPage: function(page) {
            state.pagination.currentPage = page;
            renderTransactionTable();
        },
        
        changePerPage: function(perPage) {
            state.pagination.perPage = parseInt(perPage);
            state.pagination.currentPage = 1;
            renderTransactionTable();
            renderTransactionsKPIs(state.pagination.filteredTransactions);
        },
        
        goToReportPage: function(type, page) {
            state.reportPagination[type].currentPage = page;
            if (type === 'income') renderIncomeDetailTable();
            else renderExpenseDetailTable();
        },
        
        changeReportPerPage: function(type, perPage) {
            state.reportPagination[type].perPage = parseInt(perPage);
            state.reportPagination[type].currentPage = 1;
            if (type === 'income') renderIncomeDetailTable();
            else renderExpenseDetailTable();
        }
    };

    async function confirmDelete() {
        const id = window.pendingDeleteId;
        if (!id) return;
        
        try {
            await apiCall(`/transactions/${id}`, { method: 'DELETE' });
            state.transactions = state.transactions.filter(t => t.id != id);
            showToast('Transação excluída', 'success');
            renderDashboard();
            if (document.getElementById('view-transactions').classList.contains('active')) {
                renderTransactionsKPIs();
                renderTransactions();
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
        
        cancelDelete();
    }

    function cancelDelete() {
        window.pendingDeleteId = null;
        document.getElementById('delete-modal').classList.add('hidden');
    }

    function populateReportMonthSelect() {
        const select = document.getElementById('report-month');
        const monthMap = {};
        
        state.transactions.forEach(function(t) {
            var d = new Date(t.date);
            var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            if (!monthMap[key]) {
                monthMap[key] = new Date(d.getFullYear(), d.getMonth(), 1);
            }
        });
        
        var sorted = Object.keys(monthMap).sort().reverse();
        
        if (sorted.length === 0) {
            var now = new Date();
            sorted.push(now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'));
            monthMap[sorted[0]] = now;
        }
        
        select.innerHTML = sorted.map(function(key) {
            var d = monthMap[key];
            var label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            return '<option value="' + key + '">' + label + '</option>';
        }).join('');
    }

    function renderReports() {
        const select = document.getElementById('report-month');
        if (!select.options.length) {
            populateReportMonthSelect();
        }
        const selectedMonth = document.getElementById('report-month').value;
        renderReportSummary(selectedMonth);
        renderReportDetails(selectedMonth);
    }

    function renderReportSummary(monthStr) {
        const [year, month] = monthStr.split('-').map(Number);
        const startOfMonth = new Date(year, month - 1, 1).getTime();
        const endOfMonth = new Date(year, month, 0, 23, 59, 59).getTime();
        
        const monthTransactions = state.transactions.filter(t => t.date >= startOfMonth && t.date <= endOfMonth);
        
        const income = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expense = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const balance = income - expense;
        
        document.getElementById('report-summary').innerHTML = 
            '<div class="summary-item"><span class="summary-label">Entradas</span><span class="summary-value" style="color:#10b981">' + formatCurrency(income) + '</span></div>' +
            '<div class="summary-item"><span class="summary-label">Saídas</span><span class="summary-value" style="color:#ef4444">' + formatCurrency(expense) + '</span></div>' +
            '<div class="summary-item"><span class="summary-label">Saldo Acumulado</span><span class="summary-value" style="color:' + (balance >= 0 ? '#10b981' : '#ef4444') + '">' + formatCurrency(balance) + '</span></div>' +
            '<div class="summary-item"><span class="summary-label">Transações</span><span class="summary-value">' + monthTransactions.length + '</span></div>';
    }

    function renderReportCharts(monthStr) {
        const [year, month] = monthStr.split('-').map(Number);
        const startOfMonth = new Date(year, month - 1, 1).getTime();
        const endOfMonth = new Date(year, month, 0, 23, 59, 59).getTime();
        
        const monthTransactions = state.transactions.filter(t => t.date >= startOfMonth && t.date <= endOfMonth);
        
        const incomeByCat = {};
        monthTransactions.filter(t => t.type === 'income').forEach(t => { incomeByCat[t.category] = (incomeByCat[t.category] || 0) + t.amount; });
        
        const expenseByCat = {};
        monthTransactions.filter(t => t.type === 'expense').forEach(t => { expenseByCat[t.category] = (expenseByCat[t.category] || 0) + t.amount; });
        
        renderDonutChart('report-income-chart', incomeByCat, 'income');
        renderDonutChart('report-expense-chart', expenseByCat, 'expense');
    }

    function renderDonutChart(canvasId, data, type) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        
        const labels = Object.keys(data).map(cat => cat);
        
        const values = Object.values(data);
        
        const chartKey = type === 'income' ? 'reportIncome' : 'reportExpense';
        if (state.charts[chartKey]) state.charts[chartKey].destroy();
        
        state.charts[chartKey] = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: labels, datasets: [{ data: values, backgroundColor: CONFIG.CHART_COLORS[type] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'right' } } }
        });
    }

    function renderReportDetails(monthStr) {
        const [year, month] = monthStr.split('-').map(Number);
        const startOfMonth = new Date(year, month - 1, 1).getTime();
        const endOfMonth = new Date(year, month, 0, 23, 59, 59).getTime();
        
        const monthTransactions = state.transactions.filter(t => t.date >= startOfMonth && t.date <= endOfMonth).sort((a, b) => b.date - a.date);
        
        const incomeItems = monthTransactions.filter(t => t.type === 'income');
        const expenseItems = monthTransactions.filter(t => t.type === 'expense');
        
        state.reportPagination.income.items = incomeItems;
        state.reportPagination.income.currentPage = 1;
        state.reportPagination.expense.items = expenseItems;
        state.reportPagination.expense.currentPage = 1;
        
        renderIncomeDetailTable();
        renderExpenseDetailTable();
    }

function renderIncomeDetailTable() {
        var tbody = document.getElementById('income-detail-body');
        var pagination = state.reportPagination.income;
        var totalPages = Math.ceil(pagination.items.length / pagination.perPage);
        var start = (pagination.currentPage - 1) * pagination.perPage;
        var end = Math.min(start + pagination.perPage, pagination.items.length);
        var pageItems = pagination.items.slice(start, end);
        
        var totalIncome = pagination.items.reduce(function(sum, t) { return sum + t.amount; }, 0);
        var labelEl = document.getElementById('income-total-label');
        if (labelEl) labelEl.textContent = '(Total: ' + formatCurrency(totalIncome) + ')';
        
        if (pagination.items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">Nenhuma entrada neste mês</td></tr>';
        } else {
            tbody.innerHTML = pageItems.map(function(t) {
                return '<tr>' +
                    '<td>' + new Date(t.date).toLocaleDateString('pt-BR') + '</td>' +
                    '<td>' + t.description + '</td>' +
                    '<td>' + t.category + '</td>' +
                    '<td class="income">+' + formatCurrency(t.amount) + '</td>' +
                '</tr>';
            }).join('');
        }
        
        document.getElementById('income-start').textContent = pagination.items.length > 0 ? start + 1 : 0;
        document.getElementById('income-end').textContent = end;
        document.getElementById('income-total').textContent = pagination.items.length;
        
        updateReportPagination('income', pagination.currentPage, totalPages, pagination.items.length);
    }

    function renderExpenseDetailTable() {
        var tbody = document.getElementById('expense-detail-body');
        var pagination = state.reportPagination.expense;
        var totalPages = Math.ceil(pagination.items.length / pagination.perPage);
        var start = (pagination.currentPage - 1) * pagination.perPage;
        var end = Math.min(start + pagination.perPage, pagination.items.length);
        var pageItems = pagination.items.slice(start, end);
        
        var totalExpense = pagination.items.reduce(function(sum, t) { return sum + t.amount; }, 0);
        var labelEl = document.getElementById('expense-total-label');
        if (labelEl) labelEl.textContent = '(Total: ' + formatCurrency(totalExpense) + ')';
        if (labelEl) labelEl.classList.add('expense');
        
        if (pagination.items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">Nenhuma saída neste mês</td></tr>';
        } else {
            tbody.innerHTML = pageItems.map(function(t) {
                return '<tr>' +
                    '<td>' + new Date(t.date).toLocaleDateString('pt-BR') + '</td>' +
                    '<td>' + t.description + '</td>' +
                    '<td>' + t.category + '</td>' +
                    '<td class="expense">-' + formatCurrency(t.amount) + '</td>' +
                '</tr>';
            }).join('');
        }
        
        document.getElementById('expense-start').textContent = pagination.items.length > 0 ? start + 1 : 0;
        document.getElementById('expense-end').textContent = end;
        document.getElementById('expense-total').textContent = pagination.items.length;
        
        updateReportPagination('expense', pagination.currentPage, totalPages, pagination.items.length);
    }

    function updateReportPagination(type, currentPage, totalPages, total) {
        const prefix = type;
        document.getElementById(prefix + '-first').disabled = currentPage === 1;
        document.getElementById(prefix + '-prev').disabled = currentPage === 1;
        document.getElementById(prefix + '-next').disabled = currentPage === totalPages || total === 0;
        document.getElementById(prefix + '-last').disabled = currentPage === totalPages || total === 0;
        
        const numbersContainer = document.getElementById(prefix + '-numbers');
        let pages = [];
        
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentPage <= 4) pages = [1, 2, 3, 4, 5, '...', totalPages];
            else if (currentPage >= totalPages - 3) pages = [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
            else pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
        }
        
        numbersContainer.innerHTML = pages.map(p => {
            if (p === '...') return '<span class="page-ellipsis">...</span>';
            return `<button class="page-number ${p === currentPage ? 'active' : ''}" onclick="App.goToReportPage('${type}', ${p})">${p}</button>`;
        }).join('');
    }

    function renderAdmin() {
        if (state.currentUser.role !== 'admin') {
            navigateTo('dashboard');
            return;
        }
        
        document.getElementById('total-transactions').textContent = state.transactions.length;
        
        const lastBackup = localStorage.getItem('fc_last_backup');
        document.getElementById('last-backup').textContent = lastBackup ? new Date(parseInt(lastBackup)).toLocaleString('pt-BR') : '-';
        
        renderUsersList();
        renderCategoriesList();
    }

    function renderUsersList() {
        const container = document.getElementById('users-list');
        
        container.innerHTML = state.users.map(u => 
            `<div class="user-item">
                <div class="user-info">
                    <div class="user-item-avatar">${u.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="user-item-name">${u.name}</div>
                        <div class="user-item-role">@${u.username} • ${u.role}</div>
                    </div>
                </div>
                ${u.id !== state.currentUser.id ? `<button class="btn-text btn-danger" onclick="App.deleteUser(${u.id})">Excluir</button>` : ''}
            </div>`
        ).join('');
    }

    function renderCategoriesList() {
        const incomeContainer = document.getElementById('income-categories');
        const expenseContainer = document.getElementById('expense-categories');
        
        incomeContainer.innerHTML = CONFIG.CATEGORIES.income.map(c => 
`<div class="category-tag income">${c.name} <button onclick="App.deleteCategory('${c.name}', 'income')" title="Excluir">×</button></div>`

            `<div class="category-tag expense">${c.name} <button onclick="App.deleteCategory('${c.name}', 'expense')" title="Excluir">×</button></div>`
        ).join('');
    }

    function addCategory(type) {
        var name = prompt('Digite o nome da nova categoria:');
        if (!name || !name.trim()) return;
        
        var id = name.toLowerCase().replace(/\s+/g, '_').substring(0, 20);
        
        if (CONFIG.CATEGORIES[type].some(function(c) { return c.id === id; })) {
            showToast('Categoria já existe', 'error');
            return;
        }
        
        apiCall('/categories', { method: 'POST', body: JSON.stringify({ userId: state.currentUser.id, type: type, name: name.trim() }) })
            .then(function() {
                CONFIG.CATEGORIES[type].push({ id: id, name: name.trim() });
                renderCategoriesList();
                populateCategorySelects();
                showToast('Categoria adicionada!', 'success');
            })
            .catch(function(err) { showToast(err.message, 'error'); });
    }

    window.App.addCategory = addCategory;

    async function deleteCategory(categoryId, type) {
        if (!confirm('Excluir esta categoria?')) return;
        
        try {
            await apiCall(`/categories/${state.currentUser.id}/${type}/${categoryId}`, { method: 'DELETE' });
            CONFIG.CATEGORIES[type] = CONFIG.CATEGORIES[type].filter(c => c.id !== categoryId);
            renderCategoriesList();
            populateCategorySelects();
            showToast('Categoria excluída', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    window.App.deleteCategory = deleteCategory;

    function openCategoryModal(editCategoryId = null) {
        const modal = document.getElementById('category-modal');
        const form = document.getElementById('category-form');
        const typeSelect = document.getElementById('category-type');
        const nameInput = document.getElementById('category-name');
        const titleEl = document.getElementById('category-modal-title');
        
        const currentType = document.getElementById('trans-type').value;
        
        if (editCategoryId) {
            titleEl.textContent = 'Editar Categoria';
            let foundType = null;
            let foundCat = null;
            
            for (const type of ['income', 'expense']) {
                const cat = CONFIG.CATEGORIES[type].find(c => c.id === editCategoryId);
                if (cat) { foundType = type; foundCat = cat; break; }
            }
            
            if (foundCat) {
                typeSelect.value = foundType;
                nameInput.value = foundCat.name;
                form.dataset.editId = editCategoryId;
            }
        } else {
            titleEl.textContent = 'Nova Categoria';
            typeSelect.value = currentType;
            nameInput.value = '';
            form.dataset.editId = '';
        }
        
        modal.classList.remove('hidden');
    }

    function closeCategoryModal() {
        document.getElementById('category-modal').classList.add('hidden');
        document.getElementById('category-form').reset();
    }

    async function saveCategory(e) {
        e.preventDefault();
        
        const form = document.getElementById('category-form');
        const editId = form.dataset.editId;
        const type = document.getElementById('category-type').value;
        const name = document.getElementById('category-name').value.trim();
        
        if (!name) {
            showToast('Nome da categoria é obrigatório', 'error');
            return;
        }
        
        const existingInType = CONFIG.CATEGORIES[type].find(c => c.name.toLowerCase() === name.toLowerCase());
        if (existingInType && existingInType.id !== editId) {
            showToast('Categoria já existe neste tipo (entrada/saída)', 'error');
            return;
        }
        
        if (editId) {
            try {
                await apiCall('/categories/' + editId, { method: 'PUT', body: JSON.stringify({ name: name, type: type }) });
                showToast('Categoria atualizada!', 'success');
            } catch (err) {
                showToast(err.message, 'error');
                return;
            }
        } else {
            try {
                await apiCall('/categories', { method: 'POST', body: JSON.stringify({ userId: state.currentUser.id, type: type, name: name }) });
                showToast('Categoria adicionada!', 'success');
            } catch (err) {
                showToast(err.message, 'error');
                return;
            }
        }
        
        closeCategoryModal();
        await loadCategories();
    }

    async function deleteCategoryFromModal(categoryId, type) {
        if (CONFIG.CATEGORIES[type].length <= 1) {
            showToast('Não é possível excluir a última categoria', 'error');
            return;
        }
        
        try {
            await apiCall(`/categories/${state.currentUser.id}/${type}/${categoryId}`, { method: 'DELETE' });
            CONFIG.CATEGORIES[type] = CONFIG.CATEGORIES[type].filter(c => c.id !== categoryId);
            updateCategoryOptions();
            populateCategorySelects();
            showToast('Categoria excluída', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    function openUserModal() {
        document.getElementById('user-modal').classList.remove('hidden');
    }

    function closeUserModal() {
        document.getElementById('user-modal').classList.add('hidden');
        document.getElementById('user-form').reset();
    }

    async function saveUser(e) {
        e.preventDefault();
        
        const data = {
            username: document.getElementById('new-user-username').value,
            password: document.getElementById('new-user-password').value,
            name: document.getElementById('new-user-name').value,
            role: document.getElementById('new-user-role').value
        };
        
        try {
            await apiCall('/users', { method: 'POST', body: JSON.stringify(data) });
            showToast('Usuário criado!', 'success');
            closeUserModal();
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    window.App.deleteUser = async function(userId) {
        if (!confirm('Excluir usuário?')) return;
        
        try {
            await apiCall(`/users/${userId}`, { method: 'DELETE' });
            showToast('Usuário excluído', 'success');
            renderUsersList();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    function loadInitialData() {
        state.initialBalance = parseFloat(localStorage.getItem('fc_initial_balance')) || 0;
        state.previousDebts = parseFloat(localStorage.getItem('fc_previous_debts')) || 0;
        document.getElementById('initial-balance').value = state.initialBalance || '';
        document.getElementById('previous-debts').value = state.previousDebts || '';
    }

    function saveInitialData() {
        var balance = parseFloat(document.getElementById('initial-balance').value) || 0;
        var debts = parseFloat(document.getElementById('previous-debts').value) || 0;
        
        localStorage.setItem('fc_initial_balance', balance.toString());
        localStorage.setItem('fc_previous_debts', debts.toString());
        
        state.initialBalance = balance;
        state.previousDebts = debts;
        
        showToast('Dados salvos!', 'success');
        renderDashboard();
    }

    function makeBackup() {
        const data = { transactions: state.transactions, categories: CONFIG.CATEGORIES, exportDate: Date.now() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'fluxo-caixa-backup-' + new Date().toISOString().split('T')[0] + '.json';
        link.click();
        
        localStorage.setItem('fc_last_backup', Date.now().toString());
        renderAdmin();
        showToast('Backup exportado!', 'success');
    }

    function exportXLSX() {
        const month = document.getElementById('report-month').value;
        const [year, m] = month.split('-').map(Number);
        const startOfMonth = new Date(year, m - 1, 1).getTime();
        const endOfMonth = new Date(year, m, 0, 23, 59, 59).getTime();
        
        const monthTransactions = state.transactions.filter(t => t.date >= startOfMonth && t.date <= endOfMonth).sort((a, b) => a.date - b.date);
        
        let xls = '<table border="1"><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor</th><th>Observações</th></tr>';
        
        monthTransactions.forEach(t => {
            var allCats = [].concat(CONFIG.CATEGORIES.income, CONFIG.CATEGORIES.expense);
            var catName = t.category;
            xls += `<tr><td>${new Date(t.date).toLocaleDateString('pt-BR')}</td><td>${t.description}</td><td>${catName}</td><td>${t.type === 'income' ? 'Entrada' : 'Saída'}</td><td>${t.amount}</td><td>${t.obs || ''}</td></tr>`;
        });
        
        xls += '</table>';
        
        const blob = new Blob([xls], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'fluxo-caixa-' + month + '.xls';
        link.click();
        
        showToast('Exportado com sucesso!', 'success');
    }

    document.addEventListener('DOMContentLoaded', init);
})();