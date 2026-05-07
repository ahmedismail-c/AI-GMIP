/**
 * STOCKPULSE - Professional Multi-Market Dashboard
 * Saudi Arabia | Egypt | UAE Stock Market Intelligence
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbwZnE3JOvs30tZMpGnJjbFbygZ2ScZeCNFyOW2M1RjemqZn50hWUvsVxcpOy_vhs2iX/exec',
    REFRESH_INTERVAL: 60000, // 60 seconds
    MARKETS: {
        sa: { name: 'Saudi Arabia', flag: '🇸🇦', code: 'TASI', currency: 'SAR', color: '#3b82f6' },
        eg: { name: 'Egypt', flag: '🇪🇬', code: 'EGX30', currency: 'EGP', color: '#8b5cf6' },
        ae: { name: 'UAE', flag: '🇦🇪', code: 'ADX', currency: 'AED', color: '#ec4899' }
    },
    COLUMNS: [
        { key: 'code', name: 'Symbol', width: '8%', sortable: true },
        { key: 'name', name: 'Company', width: '22%', sortable: true },
        { key: 'price', name: 'Price', width: '10%', sortable: true, format: (v) => parseFloat(v).toFixed(2) },
        { key: 'change', name: 'Chg', width: '8%', sortable: true, format: (v) => parseFloat(v).toFixed(2) },
        { key: 'change_percent', name: 'Chg %', width: '8%', sortable: true, format: (v) => v },
        { key: 'volume', name: 'Volume', width: '12%', sortable: true, format: (v) => parseInt(v).toLocaleString() },
        { key: 'turnover', name: 'Turnover', width: '12%', sortable: true, format: (v) => parseFloat(v).toLocaleString(undefined, { maximumFractionDigits: 0 }) },
        { key: 'high', name: 'High', width: '8%', sortable: true, format: (v) => parseFloat(v).toFixed(2) },
        { key: 'low', name: 'Low', width: '8%', sortable: true, format: (v) => parseFloat(v).toFixed(2) }
    ]
};

// ============================================
// GLOBAL STATE
// ============================================

let AppState = {
    allData: null,
    currentMarket: 'sa',
    sortColumn: 'price',
    sortDirection: 'desc',
    searchTerm: '',
    charts: {
        volume: null,
        price: null
    },
    isLoading: false,
    lastUpdate: null
};

// ============================================
// DOM ELEMENTS
// ============================================

const DOM = {
    loadingOverlay: document.getElementById('loadingOverlay'),
    themeToggle: document.getElementById('themeToggle'),
    refreshBtn: document.getElementById('refreshBtn'),
    marketTicker: document.getElementById('marketTicker'),
    marketSelector: document.getElementById('marketSelector'),
    searchInput: document.getElementById('searchInput'),
    lastUpdateText: document.getElementById('lastUpdateText'),
    currentMarketName: document.getElementById('currentMarketName'),
    
    // Metrics
    totalStocks: document.getElementById('totalStocks'),
    avgPrice: document.getElementById('avgPrice'),
    gainers: document.getElementById('gainers'),
    losers: document.getElementById('losers'),
    maxPrice: document.getElementById('maxPrice'),
    totalVolume: document.getElementById('totalVolume'),
    
    // Market stats
    saStats: document.getElementById('saStats'),
    egStats: document.getElementById('egStats'),
    aeStats: document.getElementById('aeStats'),
    
    // Movers
    topGainersList: document.getElementById('topGainersList'),
    topLosersList: document.getElementById('topLosersList'),
    gainersCount: document.getElementById('gainersCount'),
    losersCount: document.getElementById('losersCount'),
    
    // Table
    tableHeader: document.getElementById('tableHeader'),
    tableBody: document.getElementById('tableBody')
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showLoading() {
    AppState.isLoading = true;
    if (DOM.loadingOverlay) {
        DOM.loadingOverlay.classList.remove('hide');
    }
}

function hideLoading() {
    AppState.isLoading = false;
    if (DOM.loadingOverlay) {
        setTimeout(() => {
            DOM.loadingOverlay.classList.add('hide');
        }, 300);
    }
}

function formatNumber(num, decimals = 0) {
    if (num === undefined || num === null) return '—';
    return Number(num).toLocaleString(undefined, { 
        minimumFractionDigits: decimals, 
        maximumFractionDigits: decimals 
    });
}

function getChangeClass(changePercent) {
    const percent = parseFloat(String(changePercent).replace('%', ''));
    if (percent > 0) return 'positive';
    if (percent < 0) return 'negative';
    return '';
}

function getChangeArrow(changePercent) {
    const percent = parseFloat(String(changePercent).replace('%', ''));
    if (percent > 0) return '▲';
    if (percent < 0) return '▼';
    return '';
}

// ============================================
// THEME MANAGEMENT
// ============================================

function initTheme() {
    const savedTheme = localStorage.getItem('stockpulse-theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        updateThemeIcon(true);
    } else {
        document.documentElement.removeAttribute('data-theme');
        updateThemeIcon(false);
    }
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('stockpulse-theme', 'light');
        updateThemeIcon(false);
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('stockpulse-theme', 'dark');
        updateThemeIcon(true);
    }
}

function updateThemeIcon(isDark) {
    if (DOM.themeToggle) {
        DOM.themeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }
}

// ============================================
// MARKET TICKER
// ============================================

function renderMarketTicker() {
    if (!AppState.allData?.markets) return;
    
    const tickerHtml = `
        <div class="ticker-items">
            ${Object.entries(AppState.allData.markets).map(([code, market]) => {
                const stats = market.stats || {};
                const config = CONFIG.MARKETS[code];
                const isActive = AppState.currentMarket === code;
                const avgChange = stats.avgChange || 0;
                const changeClass = avgChange >= 0 ? 'positive' : 'negative';
                return `
                    <div class="ticker-item ${isActive ? 'active' : ''}" data-market="${code}">
                        <span class="ticker-symbol">${config?.flag || ''} ${config?.code || code.toUpperCase()}</span>
                        <span class="ticker-price">${stats.avgPrice || 0}</span>
                        <span class="ticker-change ${changeClass}">
                            ${avgChange >= 0 ? '+' : ''}${avgChange}%
                        </span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    DOM.marketTicker.innerHTML = tickerHtml;
    
    // Add click handlers
    document.querySelectorAll('.ticker-item').forEach(item => {
        item.addEventListener('click', () => {
            const market = item.dataset.market;
            if (market) switchMarket(market);
        });
    });
}

// ============================================
// MARKET SELECTOR
// ============================================

function renderMarketSelector() {
    const cards = document.querySelectorAll('.market-card');
    cards.forEach(card => {
        const market = card.dataset.market;
        if (market === AppState.currentMarket) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });
}

function switchMarket(marketCode) {
    AppState.currentMarket = marketCode;
    renderMarketTicker();
    renderMarketSelector();
    updateMetricsDashboard();
    updateTopMovers();
    updateCharts();
    renderTable();
    
    if (DOM.currentMarketName) {
        DOM.currentMarketName.textContent = CONFIG.MARKETS[marketCode]?.name || marketCode.toUpperCase();
    }
}

// ============================================
// METRICS DASHBOARD
// ============================================

function updateMetricsDashboard() {
    const market = AppState.allData?.markets[AppState.currentMarket];
    if (!market?.stats) return;
    
    const stats = market.stats;
    const currency = CONFIG.MARKETS[AppState.currentMarket]?.currency || 'SAR';
    
    if (DOM.totalStocks) DOM.totalStocks.textContent = formatNumber(stats.totalStocks);
    if (DOM.avgPrice) DOM.avgPrice.textContent = `${stats.avgPrice || 0} ${currency}`;
    if (DOM.gainers) {
        DOM.gainers.textContent = stats.gainers || 0;
        DOM.gainers.className = `metric-value ${stats.gainers > 0 ? 'trend-up-text' : ''}`;
    }
    if (DOM.losers) {
        DOM.losers.textContent = stats.losers || 0;
        DOM.losers.className = `metric-value ${stats.losers > 0 ? 'trend-down-text' : ''}`;
    }
    if (DOM.maxPrice) DOM.maxPrice.textContent = `${stats.maxPrice || 0} ${currency}`;
    if (DOM.totalVolume) DOM.totalVolume.textContent = formatNumber(stats.totalVolume);
}

function updateMarketStatsBadges() {
    if (!AppState.allData?.markets) return;
    
    for (const [code, market] of Object.entries(AppState.allData.markets)) {
        const stats = market.stats;
        const element = DOM[`${code}Stats`];
        if (element && stats) {
            element.innerHTML = `${stats.totalStocks || 0} stocks • ▲${stats.gainers || 0} ▼${stats.losers || 0}`;
        }
    }
}

// ============================================
// TOP MOVERS
// ============================================

function updateTopMovers() {
    const market = AppState.allData?.markets[AppState.currentMarket];
    if (!market?.stocks) return;
    
    const stocks = [...market.stocks];
    stocks.forEach(s => {
        const changeVal = parseFloat(String(s.change_percent).replace('%', ''));
        s.change_num = isNaN(changeVal) ? 0 : changeVal;
    });
    
    stocks.sort((a, b) => b.change_num - a.change_num);
    const gainers = stocks.filter(s => s.change_num > 0).slice(0, 5);
    const losers = stocks.filter(s => s.change_num < 0).slice(-5).reverse();
    
    if (DOM.gainersCount) DOM.gainersCount.textContent = gainers.length;
    if (DOM.losersCount) DOM.losersCount.textContent = losers.length;
    
    const gainersHtml = gainers.map(s => `
        <div class="mover-row">
            <div class="mover-info">
                <div class="mover-name">${s.name}</div>
                <div class="mover-code">${s.code}</div>
            </div>
            <div class="mover-price">${parseFloat(s.price).toFixed(2)}</div>
            <div class="mover-change positive">+${s.change_percent}</div>
        </div>
    `).join('');
    
    const losersHtml = losers.map(s => `
        <div class="mover-row">
            <div class="mover-info">
                <div class="mover-name">${s.name}</div>
                <div class="mover-code">${s.code}</div>
            </div>
            <div class="mover-price">${parseFloat(s.price).toFixed(2)}</div>
            <div class="mover-change negative">${s.change_percent}</div>
        </div>
    `).join('');
    
    if (DOM.topGainersList) DOM.topGainersList.innerHTML = gainersHtml || '<div class="loading-row">No gainers</div>';
    if (DOM.topLosersList) DOM.topLosersList.innerHTML = losersHtml || '<div class="loading-row">No losers</div>';
}

// ============================================
// CHARTS
// ============================================

function updateCharts() {
    if (!AppState.allData?.markets) return;
    
    // Volume Chart (Multi-Market)
    const marketNames = [];
    const volumes = [];
    const colors = [];
    
    for (const [code, market] of Object.entries(AppState.allData.markets)) {
        marketNames.push(CONFIG.MARKETS[code]?.code || code.toUpperCase());
        volumes.push(market.stats?.totalVolume || 0);
        colors.push(CONFIG.MARKETS[code]?.color || '#3b82f6');
    }
    
    const volumeCtx = document.getElementById('volumeChart')?.getContext('2d');
    if (volumeCtx) {
        if (AppState.charts.volume) AppState.charts.volume.destroy();
        AppState.charts.volume = new Chart(volumeCtx, {
            type: 'bar',
            data: {
                labels: marketNames,
                datasets: [{
                    label: 'Trading Volume',
                    data: volumes,
                    backgroundColor: colors,
                    borderRadius: 8,
                    barPercentage: 0.6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.raw.toLocaleString()} shares` } }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }
    
    // Price Chart (Top 10 by current market)
    const market = AppState.allData?.markets[AppState.currentMarket];
    if (market?.stocks) {
        const top10 = [...market.stocks]
            .sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
            .slice(0, 10);
        
        const priceCtx = document.getElementById('priceChart')?.getContext('2d');
        if (priceCtx) {
            if (AppState.charts.price) AppState.charts.price.destroy();
            AppState.charts.price = new Chart(priceCtx, {
                type: 'bar',
                data: {
                    labels: top10.map(s => s.name.length > 12 ? s.name.substring(0, 10) + '…' : s.name),
                    datasets: [{
                        label: `Price (${CONFIG.MARKETS[AppState.currentMarket]?.currency || 'SAR'})`,
                        data: top10.map(s => parseFloat(s.price)),
                        backgroundColor: CONFIG.MARKETS[AppState.currentMarket]?.color || '#3b82f6',
                        borderRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        tooltip: { callbacks: { label: (ctx) => `${ctx.raw.toFixed(2)}` } }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }
                    }
                }
            });
        }
    }
}

// ============================================
// STOCKS TABLE
// ============================================

function getCurrentStocks() {
    return AppState.allData?.markets[AppState.currentMarket]?.stocks || [];
}

function sortAndFilterStocks() {
    let stocks = getCurrentStocks();
    
    // Filter
    if (AppState.searchTerm) {
        stocks = stocks.filter(s => 
            String(s.name).toLowerCase().includes(AppState.searchTerm) || 
            String(s.code).toLowerCase().includes(AppState.searchTerm)
        );
    }
    
    // Sort
    stocks.sort((a, b) => {
        let aVal = a[AppState.sortColumn];
        let bVal = b[AppState.sortColumn];
        
        if (AppState.sortColumn === 'price' || AppState.sortColumn === 'change' || 
            AppState.sortColumn === 'volume' || AppState.sortColumn === 'turnover') {
            aVal = parseFloat(aVal) || 0;
            bVal = parseFloat(bVal) || 0;
        } else if (AppState.sortColumn === 'change_percent') {
            aVal = parseFloat(String(aVal).replace('%', '')) || 0;
            bVal = parseFloat(String(bVal).replace('%', '')) || 0;
        }
        
        return AppState.sortDirection === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });
    
    return stocks;
}

function renderTable() {
    const stocks = sortAndFilterStocks();
    
    if (!stocks.length) {
        if (DOM.tableBody) DOM.tableBody.innerHTML = '<tr><td colspan="9" class="loading-state">No stocks available</td></tr>';
        return;
    }
    
    // Render Header
    const headerHtml = `
        <tr>
            ${CONFIG.COLUMNS.map(col => `
                <th onclick="window.sortByColumn('${col.key}')" style="width: ${col.width}">
                    ${col.name} 
                    ${AppState.sortColumn === col.key ? (AppState.sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                </th>
            `).join('')}
        </tr>
    `;
    if (DOM.tableHeader) DOM.tableHeader.innerHTML = headerHtml;
    
    // Render Body
    const bodyHtml = stocks.map(stock => {
        const changePercent = parseFloat(String(stock.change_percent).replace('%', ''));
        const changeClass = changePercent > 0 ? 'positive' : (changePercent < 0 ? 'negative' : '');
        const arrow = changePercent > 0 ? '▲' : (changePercent < 0 ? '▼' : '');
        
        return `
            <tr>
                ${CONFIG.COLUMNS.map(col => {
                    let value = stock[col.key];
                    if (col.format) value = col.format(value);
                    if (col.key === 'change_percent') value = `${arrow} ${value}`;
                    const className = (col.key === 'change' || col.key === 'change_percent') ? changeClass : '';
                    return `<td class="${className}">${value || '-'}</td>`;
                }).join('')}
            </tr>
        `;
    }).join('');
    
    if (DOM.tableBody) DOM.tableBody.innerHTML = bodyHtml;
}

function sortByColumn(column) {
    if (AppState.sortColumn === column) {
        AppState.sortDirection = AppState.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        AppState.sortColumn = column;
        AppState.sortDirection = 'desc';
    }
    renderTable();
}

// Make sortByColumn available globally
window.sortByColumn = sortByColumn;

// ============================================
// DATA FETCHING
// ============================================

async function fetchMarketData() {
    showLoading();
    
    try {
        const response = await fetch(CONFIG.API_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        AppState.allData = data;
        AppState.lastUpdate = new Date();
        
        if (DOM.lastUpdateText) {
            DOM.lastUpdateText.textContent = `Last Update: ${AppState.lastUpdate.toLocaleTimeString()}`;
        }
        
        // Update all UI components
        renderMarketTicker();
        updateMarketStatsBadges();
        updateMetricsDashboard();
        updateTopMovers();
        updateCharts();
        renderTable();
        
    } catch (error) {
        console.error('Fetch error:', error);
        if (DOM.tableBody) {
            DOM.tableBody.innerHTML = `<tr><td colspan="9" class="loading-state" style="color:#ef4444;">
                <i class="fas fa-exclamation-circle"></i> Error: ${error.message}<br>
                <small>Please check API URL or network connection</small>
            </td></tr>`;
        }
    } finally {
        hideLoading();
    }
}

// ============================================
// EVENT HANDLERS
// ============================================

function refreshData() {
    fetchMarketData();
}

function handleSearch() {
    if (DOM.searchInput) {
        AppState.searchTerm = DOM.searchInput.value.toLowerCase();
        renderTable();
    }
}

// ============================================
// INITIALIZATION
// ============================================

function initEventListeners() {
    // Theme toggle
    if (DOM.themeToggle) {
        DOM.themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Refresh button
    if (DOM.refreshBtn) {
        DOM.refreshBtn.addEventListener('click', refreshData);
    }
    
    // Search input
    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('input', handleSearch);
    }
    
    // Market selector cards
    const marketCards = document.querySelectorAll('.market-card');
    marketCards.forEach(card => {
        card.addEventListener('click', () => {
            const market = card.dataset.market;
            if (market) switchMarket(market);
        });
    });
}

async function init() {
    initTheme();
    initEventListeners();
    await fetchMarketData();
    
    // Auto-refresh
    setInterval(fetchMarketData, CONFIG.REFRESH_INTERVAL);
}

// Start the application
init();
