// Supabase client instance
let supabaseClient;


// State Management
let currentSection = 'inicio';
let cachedData = {
    miembros: [],
    padrinos: [],
    status: [],
    lookupTables: {}
};

// DOM Elements
const sectionTitle = document.getElementById('section-title');
const sectionDescription = document.getElementById('section-description');
const contentArea = document.getElementById('content-area');
const statsSummary = document.getElementById('stats-summary');
const navItems = document.querySelectorAll('.nav-item');

// Login Elements
const loginOverlay = document.getElementById('login-overlay');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const appContainer = document.getElementById('app-container');
const logoutBtn = document.getElementById('logout-btn');
const currentUserSpan = document.getElementById('current-username');

// Initialize App
async function init() {
    setupNavigation();
    setupAuth();

    if (checkAuth()) {
        await loadSection(currentSection);
        updateStatsBadge();
    }
}

// --- AUTH LOGIC ---
function checkAuth() {
    const session = localStorage.getItem('rmm_session');
    if (session) {
        const user = JSON.parse(session);
        showApp(user.usuario);
        return true;
    }
    showLogin();
    return false;
}

function showApp(username) {
    loginOverlay.classList.add('hidden');
    appContainer.classList.remove('hidden');
    currentUserSpan.textContent = username;
    lucide.createIcons();
}

function showLogin() {
    appContainer.classList.add('hidden');
    loginOverlay.classList.remove('hidden');
    lucide.createIcons();
}

function setupAuth() {
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            const submitBtn = loginForm.querySelector('button');

            submitBtn.disabled = true;
            submitBtn.textContent = 'Verificando...';
            loginError.classList.add('hidden');

            try {
                const { data, error } = await supabaseClient
                    .from('usuarios')
                    .select('*')
                    .eq('usuario', username)
                    .eq('password', password)
                    .single();

                if (error || !data) {
                    throw new Error('Credenciales inválidas');
                }

                localStorage.setItem('rmm_session', JSON.stringify({
                    usuario: data.usuario,
                    loginTime: new Date().toISOString()
                }));

                showApp(data.usuario);
                await loadSection(currentSection);
                updateStatsBadge();
            } catch (err) {
                console.error("Login error:", err);
                loginError.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Iniciar Sesión';
            }
        };
    }

    if (logoutBtn) {
        logoutBtn.onclick = () => {
            localStorage.removeItem('rmm_session');
            showLogin();
        };
    }
}

// Navigation Logic
function setupNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            currentSection = item.dataset.section;
            loadSection(currentSection);
        });
    });
}

// Section Loading Hub
async function loadSection(section) {
    showLoading();

    switch (section) {
        case 'inicio':
            await renderDashboard();
            break;
        case 'miembros':
            await renderMiembros();
            break;
        case 'padrinos':
            await renderPadrinos();
            break;
        case 'status':
            await renderStatus();
            break;
        case 'reportes':
            await renderReportes();
            break;
    }
}

// (Utility functions showLoading and updateStatsBadge moved to utils.js)


// --- DASHBOARD SECTION ---
async function renderDashboard() {
    sectionTitle.textContent = 'Panel de Inicio';
    sectionDescription.textContent = 'Resumen estadístico del padrón de miembros.';

    contentArea.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p>Calculando estadísticas...</p></div>`;

    try {
        // Fetch data for statistics
        const [miembrosRes, sexoRes, dlRes, dfRes] = await Promise.all([
            supabaseClient.from('miembros').select('sexo, dl, df'),
            supabaseClient.from('sexo').select('*'),
            supabaseClient.from('dl').select('*'),
            supabaseClient.from('df').select('*')
        ]);

        if (miembrosRes.error) throw miembrosRes.error;

        const data = miembrosRes.data;
        const total = data.length;

        // Breakdowns
        const stats = {
            sexo: {},
            dl: {},
            df: {}
        };

        const sexoMap = {};
        sexoRes.data?.forEach(s => sexoMap[s.sexid] = s.sexo);

        const dlMap = {};
        dlRes.data?.forEach(d => dlMap[d.dlid] = d.dl);

        const dfMap = {};
        dfRes.data?.forEach(d => dfMap[d.dfid] = d.df);

        data.forEach(m => {
            // Sexo
            const sName = sexoMap[m.sexo] || 'Sin especificar';
            stats.sexo[sName] = (stats.sexo[sName] || 0) + 1;
            // DL
            const dlLabel = dlMap[m.dl] || m.dl || 'Sin DL';
            stats.dl[dlLabel] = (stats.dl[dlLabel] || 0) + 1;
            // DF
            const dfLabel = dfMap[m.df] || m.df || 'Sin DF';
            stats.df[dfLabel] = (stats.df[dfLabel] || 0) + 1;
        });

        const dashboardHtml = `
            <div class="dashboard-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px;">
                <!-- Total Miembros -->
                <div class="card metric-card" style="border-left: 5px solid #4f46e5;">
                    <div class="report-header">
                        <i data-lucide="users" style="color: #4f46e5; background: rgba(79, 70, 229, 0.1);"></i>
                        <div>
                            <p class="metric-label">Total Miembros</p>
                            <h2 class="metric-value" style="color: #1e1b4b; font-size: 2.5rem; margin: 5px 0;">${total.toLocaleString()}</h2>
                        </div>
                    </div>
                </div>

                <!-- Por Sexo -->
                <div class="card metric-card" style="border-left: 5px solid #ec4899;">
                    <div class="report-header" style="margin-bottom: 15px;">
                        <i data-lucide="user-plus" style="color: #ec4899; background: rgba(236, 72, 153, 0.1);"></i>
                        <div>
                            <p class="metric-label">Distribución por Sexo</p>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${Object.entries(stats.sexo).map(([key, val]) => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px dashed #eee;">
                                <span style="font-size: 0.9rem; font-weight: 500;">${key}</span>
                                <span class="status-badge-inline" style="background: #fdf2f8; color: #be185d;">${val}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Por Distrito Local -->
                <div class="card metric-card" style="border-left: 5px solid #f59e0b;">
                    <div class="report-header" style="margin-bottom: 15px;">
                        <i data-lucide="map-pin" style="color: #f59e0b; background: rgba(245, 158, 11, 0.1);"></i>
                        <div>
                            <p class="metric-label">Por Distrito Local (DL)</p>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        ${Object.entries(stats.dl).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([key, val]) => `
                            <div style="display: flex; flex-direction: column; background: #fffbeb; padding: 8px; border-radius: 8px;">
                                <span style="font-size: 0.75rem; color: #92400e; text-transform: uppercase; font-weight: 700;">${key.startsWith('DL') ? key : 'DL ' + key}</span>
                                <span style="font-size: 1.1rem; font-weight: 700; color: #451a03;">${val}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Por Distrito Federal -->
                <div class="card metric-card" style="border-left: 5px solid #10b981;">
                    <div class="report-header" style="margin-bottom: 15px;">
                        <i data-lucide="globe" style="color: #10b981; background: rgba(16, 185, 129, 0.1);"></i>
                        <div>
                            <p class="metric-label">Por Distrito Federal (DF)</p>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        ${Object.entries(stats.df).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([key, val]) => `
                            <div style="display: flex; flex-direction: column; background: #ecfdf5; padding: 8px; border-radius: 8px;">
                                <span style="font-size: 0.75rem; color: #065f46; text-transform: uppercase; font-weight: 700;">${key.startsWith('DF') ? key : 'DF ' + key}</span>
                                <span style="font-size: 1.1rem; font-weight: 700; color: #064e3b;">${val}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        contentArea.innerHTML = dashboardHtml;
        lucide.createIcons();

    } catch (err) {
        console.error("Dashboard error:", err);
        contentArea.innerHTML = `<div class="card">Error al cargar estadísticas: ${err.message}</div>`;
    }
}

// --- MIEMBROS SECTION ---
async function renderMiembros() {
    sectionTitle.textContent = 'Miembros';
    sectionDescription.textContent = 'Lista completa de miembros registrados.';

    // Fetch lookup data first
    const [
        { data: statusList },
        { data: sexList },
        { data: padrinosList },
        { data: gruposList }
    ] = await Promise.all([
        supabaseClient.from('status').select('*'),
        supabaseClient.from('sexo').select('*'),
        supabaseClient.from('padrinos').select('*'),
        supabaseClient.from('grupos').select('*')
    ]);
    const statusMap = {};
    statusList?.forEach(s => statusMap[s.idst] = s.status);
    const sexMap = {};
    sexList?.forEach(s => sexMap[s.sexid] = s.sexo);
    const padrinosMap = {};
    padrinosList?.forEach(p => padrinosMap[p.padrinoid] = p.padrino);
    const gruposMap = {};
    gruposList?.forEach(g => gruposMap[g.grupoid] = g.grupo);

    // Batched fetching to overcome Supabase 1000 limit
    let allData = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;

    contentArea.innerHTML = `<div class="card" id="loading-message">Cargando registros... <span id="load-count">0</span></div>`;
    const loadCountSpan = document.getElementById('load-count');

    try {
        while (hasMore) {
            const { data, error } = await supabaseClient
                .from('miembros')
                .select('*')
                .order('id', { ascending: false })
                .range(from, from + limit - 1);

            if (error) throw error;

            allData = [...allData, ...data];
            loadCountSpan.textContent = allData.length;

            if (data.length < limit) {
                hasMore = false;
            } else {
                from += limit;
            }
        }
    } catch (err) {
        contentArea.innerHTML = `<div class="card">Error al cargar miembros: ${err.message}</div>`;
        return;
    }

    if (allData.length === 0) {
        contentArea.innerHTML = `<div class="card">
            <h3>No se encontraron registros</h3>
            <p>La conexión fue exitosa, pero no se recibieron datos.</p>
        </div>`;
        return;
    }

    cachedData.miembros = allData;

    sectionDescription.textContent = `Gestión y control de la lista de miembros registrados (${allData.length} registros).`;

    const html = `
        <div class="controls-row">
            <div class="search-box">
                <i data-lucide="search"></i>
                <input type="text" id="miembros-search" placeholder="Buscar por nombre, apellidos, INE o colonia...">
            </div>
            <div style="display: flex; gap: 12px;">
                <button class="btn btn-primary" onclick="addMiembro()">
                    <i data-lucide="plus" style="width: 18px;"></i> Nuevo Miembro
                </button>
                <button class="btn btn-secondary" onclick="window.print()">
                    <i data-lucide="printer" style="width: 18px;"></i> Imprimir
                </button>
            </div>
        </div>
        <div class="card table-container">
            <table>
                <thead>
                    <tr>
                        <th style="width: 80px;">Acciones</th>
                        <th>Nombre Completo</th>
                        <th>Calle</th>
                        <th>Número</th>
                        <th>Colonia</th>
                        <th>C.P.</th>
                        <th>Celular</th>
                        <th>Email</th>
                        <th>Sección</th>
                        <th>Mes</th>
                        <th>Padrino</th>
                        <th>Status</th>
                        <th>Sexo</th>
                    </tr>
                </thead>
                <tbody id="miembros-table-body">
                    ${allData.slice(0, 50).map(m => `
                        <tr>
                            <td>
                                <div class="action-buttons-cell">
                                    <button class="btn-icon" title="Editar" onclick="editMiembro('${m.id}')"><i data-lucide="square-pen" style="width: 16px;"></i></button>
                                    <button class="btn-icon btn-delete" title="Borrar" onclick="deleteMiembro('${m.id}')"><i data-lucide="trash-2" style="width: 16px;"></i></button>
                                </div>
                            </td>
                            <td style="font-weight: 500;">${m.nombre_completo || (m.nombres + ' ' + m.paterno + ' ' + m.materno)}</td>
                            <td>${m.calle || '-'}</td>
                            <td>${m.num || '-'}</td>
                            <td>${m.colonia || '-'}</td>
                            <td>${m.cp || '-'}</td>
                            <td>${m.celular || '-'}</td>
                            <td>${m.email || '-'}</td>
                            <td>${m.seccion || '-'}</td>
                            <td>${m.mes || '-'}</td>
                            <td>${padrinosMap[m.padrino] || m.padrino || '-'}</td>
                            <td><span class="status-badge-inline">${statusMap[m.status] || m.status || '-'}</span></td>
                            <td><span class="status-badge-inline" style="background-color: #f3f4f6; color: #1f2937;">${sexMap[m.sexo] || m.sexo || '-'}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    contentArea.innerHTML = html;
    lucide.createIcons();

    // Add search listener
    document.getElementById('miembros-search').addEventListener('input', (e) => {
        const normalize = (str) => {
            if (!str) return "";
            return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        };
        const terms = e.target.value.split(/\s+/).map(normalize).filter(t => t !== '');

        const filtered = cachedData.miembros.filter(m => {
            const statusName = statusMap[m.status] || '';
            const sexName = sexMap[m.sexo] || '';
            const padrinoName = padrinosMap[m.padrino] || '';
            const grupoName = gruposMap[m.grupo] || '';
            const rawData = `${m.nombres || ''} ${m.paterno || ''} ${m.materno || ''} ${m.nombre_completo || ''} ${m.ine || ''} ${m.colonia || ''} ${m.calle || ''} ${m.seccion || ''} ${padrinoName} ${grupoName} ${m.mes || ''} ${statusName} ${sexName} ${m.celular || ''}`;
            const rowData = normalize(rawData);
            return terms.every(term => rowData.includes(term));
        });
        updateMiembrosTable(filtered, statusMap, sexMap, padrinosMap, gruposMap);
    });
}

function updateMiembrosTable(data, statusMap, sexMap, padrinosMap, gruposMap) {
    const tbody = document.getElementById('miembros-table-body');
    if (!tbody) return;

    // Limits the rendered result for better performance, but searches against the whole set.
    const displayData = data.slice(0, 100);

    tbody.innerHTML = displayData.map(m => `
        <tr>
            <td>
                <div class="action-buttons-cell">
                    <button class="btn-icon" title="Editar" onclick="editMiembro('${m.id}')"><i data-lucide="square-pen" style="width: 16px;"></i></button>
                    <button class="btn-icon btn-delete" title="Borrar" onclick="deleteMiembro('${m.id}')"><i data-lucide="trash-2" style="width: 16px;"></i></button>
                </div>
            </td>
            <td style="font-weight: 500;">${m.nombre_completo || (m.nombres + ' ' + m.paterno + ' ' + m.materno)}</td>
            <td>${m.calle || '-'}</td>
            <td>${m.num || '-'}</td>
            <td>${m.colonia || '-'}</td>
            <td>${m.cp || '-'}</td>
            <td>${m.celular || '-'}</td>
            <td>${m.email || '-'}</td>
            <td>${m.seccion || '-'}</td>
            <td>${m.mes || '-'}</td>
            <td>${padrinosMap[m.padrino] || m.padrino || '-'}</td>
            <td><span class="status-badge-inline">${statusMap[m.status] || m.status || '-'}</span></td>
            <td><span class="status-badge-inline" style="background-color: #f3f4f6; color: #1f2937;">${sexMap[m.sexo] || m.sexo || '-'}</span></td>
        </tr>
        `).join('');
    lucide.createIcons();
}

// --- PADRINOS SECTION ---
async function renderPadrinos() {
    sectionTitle.textContent = 'Padrinos';
    sectionDescription.textContent = 'Lista de todos los padrinos registrados.';

    const { data, error } = await supabaseClient
        .from('padrinos')
        .select('*')
        .order('padrino', { ascending: true });

    if (error) {
        contentArea.innerHTML = `<div class="card"> Error: ${error.message}</div>`;
        return;
    }

    cachedData.padrinos = data;

    contentArea.innerHTML = `
        <div class="controls-row">
            <div class="search-box">
                <i data-lucide="search"></i>
                <input type="text" id="padrinos-search" placeholder="Buscar padrino por nombre...">
            </div>
            <div style="display: flex; gap: 12px; margin-left: auto;">
                <button class="btn btn-primary" onclick="addPadrino()">
                    <i data-lucide="plus" style="width: 18px;"></i> Nuevo Padrino
                </button>
            </div>
        </div>
        <div class="card table-container">
            <table>
                <thead>
                    <tr>
                        <th style="width: 80px;">Acciones</th>
                        <th>Nombre del Padrino</th>
                    </tr>
                </thead>
                <tbody id="padrinos-table-body">
                    ${data.map(p => `
                        <tr>
                            <td>
                                <div class="action-buttons-cell">
                                    <button class="btn-icon" title="Editar" onclick="editPadrino('${p.padrinoid}')"><i data-lucide="square-pen" style="width: 16px;"></i></button>
                                    <button class="btn-icon btn-delete" title="Borrar" onclick="deletePadrino('${p.padrinoid}')"><i data-lucide="trash-2" style="width: 16px;"></i></button>
                                </div>
                            </td>
                            <td>${p.padrino}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        `;
    lucide.createIcons();

    // Add search listener
    document.getElementById('padrinos-search').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const filtered = cachedData.padrinos.filter(p =>
            (p.padrino || "").toLowerCase().includes(term)
        );
        updatePadrinosTable(filtered);
    });
}

function updatePadrinosTable(data) {
    const tbody = document.getElementById('padrinos-table-body');
    if (!tbody) return;

    tbody.innerHTML = data.map(p => `
        <tr>
            <td>
                <div class="action-buttons-cell">
                    <button class="btn-icon" title="Editar" onclick="editPadrino('${p.padrinoid}')"><i data-lucide="square-pen" style="width: 16px;"></i></button>
                    <button class="btn-icon btn-delete" title="Borrar" onclick="deletePadrino('${p.padrinoid}')"><i data-lucide="trash-2" style="width: 16px;"></i></button>
                </div>
            </td>
            <td>${p.padrino}</td>
        </tr>
    `).join('');
    lucide.createIcons();
}

// --- STATUS SECTION ---
async function renderStatus() {
    sectionTitle.textContent = 'Status';
    sectionDescription.textContent = 'Catálogo de estados configurados.';

    const { data, error } = await supabaseClient
        .from('status')
        .select('*')
        .order('idst', { ascending: true });

    if (error) {
        contentArea.innerHTML = `<div class="card"> Error: ${error.message}</div>`;
        return;
    }

    contentArea.innerHTML = `
        <div class="controls-row">
            <div style="display: flex; gap: 12px; margin-left: auto;">
                <button class="btn btn-primary" onclick="addStatus()">
                    <i data-lucide="plus" style="width: 18px;"></i> Nuevo Status
                </button>
            </div>
        </div>
        <div class="card table-container">
            <table>
                <thead>
                    <tr>
                        <th style="width: 80px;">Acciones</th>
                        <th>Descripción del Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(s => `
                        <tr>
                            <td>
                                <div class="action-buttons-cell">
                                    <button class="btn-icon" title="Editar" onclick="editStatus('${s.idst}')"><i data-lucide="square-pen" style="width: 16px;"></i></button>
                                    <button class="btn-icon btn-delete" title="Borrar" onclick="deleteStatus('${s.idst}')"><i data-lucide="trash-2" style="width: 16px;"></i></button>
                                </div>
                            </td>
                            <td>${s.status}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        `;
    lucide.createIcons();
}

// --- REPORTES SECTION ---
async function renderReportes() {
    sectionTitle.textContent = 'Generador de Reportes';
    sectionDescription.textContent = 'Exporta listas personalizadas filtrando por distintos criterios, directo a Excel (CSV) o PDF.';

    // Fetch all lookup data needed
    const [padrinosRes, statusRes, dlRes, dfRes, miembrosRes] = await Promise.all([
        supabaseClient.from('padrinos').select('*').order('padrino'),
        supabaseClient.from('status').select('*').order('status'),
        supabaseClient.from('dl').select('*').order('dl'),
        supabaseClient.from('df').select('*').order('df'),
        supabaseClient.from('miembros').select('seccion, colonia')
    ]);

    const distinctSecciones = [...new Set(miembrosRes.data?.map(m => m.seccion).filter(Boolean))].sort((a, b) => a - b);
    const distinctColonias = [...new Set(miembrosRes.data?.map(m => m.colonia).filter(Boolean))].sort();

    const reportHtml = `
    <div class="reports-grid">
        <!-- Por Padrino -->
        <div class="card report-card">
            <div class="report-header">
                <i data-lucide="handshake" class="icon-padrino"></i>
                <div>
                    <h4>Por Padrino</h4>
                    <p>Selecciona un Padrino de la lista.</p>
                </div>
            </div>
            <select id="report-val-padrino">
                <option value="">-- Elige un Padrino --</option>
                ${padrinosRes.data?.map(p => `<option value="${p.padrinoid}">${p.padrino}</option>`).join('')}
            </select>
            <div class="report-actions">
                <button class="btn btn-export btn-csv" onclick="exportReport('padrino', 'csv')">
                    <i data-lucide="file-spreadsheet"></i> CSV
                </button>
                <button class="btn btn-export btn-pdf" onclick="exportReport('padrino', 'pdf')">
                    <i data-lucide="file-text"></i> PDF
                </button>
            </div>
        </div>

        <!-- Por Estatus -->
        <div class="card report-card">
            <div class="report-header">
                <i data-lucide="tag" class="icon-status"></i>
                <div>
                    <h4>Por Estatus</h4>
                    <p>Selecciona un tipo de estatus.</p>
                </div>
            </div>
            <select id="report-val-status">
                <option value="">-- Elige un Estatus --</option>
                ${statusRes.data?.map(s => `<option value="${s.idst}">${s.status}</option>`).join('')}
            </select>
            <div class="report-actions">
                <button class="btn btn-export btn-csv" onclick="exportReport('status', 'csv')">
                    <i data-lucide="file-spreadsheet"></i> CSV
                </button>
                <button class="btn btn-export btn-pdf" onclick="exportReport('status', 'pdf')">
                    <i data-lucide="file-text"></i> PDF
                </button>
            </div>
        </div>

        <!-- Por Seccion -->
        <div class="card report-card">
            <div class="report-header">
                <i data-lucide="users" class="icon-seccion"></i>
                <div>
                    <h4>Por Sección</h4>
                    <p>Selecciona el número de sección.</p>
                </div>
            </div>
            <select id="report-val-seccion">
                <option value="">-- Elige una Sección --</option>
                ${distinctSecciones.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
            <div class="report-actions">
                <button class="btn btn-export btn-csv" onclick="exportReport('seccion', 'csv')">
                    <i data-lucide="file-spreadsheet"></i> CSV
                </button>
                <button class="btn btn-export btn-pdf" onclick="exportReport('seccion', 'pdf')">
                    <i data-lucide="file-text"></i> PDF
                </button>
            </div>
        </div>

        <!-- Por Colonia -->
        <div class="card report-card">
            <div class="report-header">
                <i data-lucide="home" class="icon-colonia"></i>
                <div>
                    <h4>Por Colonia</h4>
                    <p>Filtra por colonia de residencia.</p>
                </div>
            </div>
            <select id="report-val-colonia">
                <option value="">-- Elige una Colonia --</option>
                ${distinctColonias.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
            <div class="report-actions">
                <button class="btn btn-export btn-csv" onclick="exportReport('colonia', 'csv')">
                    <i data-lucide="file-spreadsheet"></i> CSV
                </button>
                <button class="btn btn-export btn-pdf" onclick="exportReport('colonia', 'pdf')">
                    <i data-lucide="file-text"></i> PDF
                </button>
            </div>
        </div>

        <!-- Por D. Local -->
        <div class="card report-card">
            <div class="report-header">
                <i data-lucide="map-pin" class="icon-dl"></i>
                <div>
                    <h4>Por D. Local (DL)</h4>
                    <p>Lista de miembros por Distrito Local.</p>
                </div>
            </div>
            <select id="report-local-val-dl"> <!-- Name changed to avoid collision if necessary, but using type/val pattern -->
                <option value="">-- Elige un D.L. --</option>
                ${dlRes.data?.map(d => `<option value="${d.dl}">${d.dl}</option>`).join('')}
            </select>
            <div class="report-actions">
                <button class="btn btn-export btn-csv" onclick="exportReport('dl', 'csv')">
                    <i data-lucide="file-spreadsheet"></i> CSV
                </button>
                <button class="btn btn-export btn-pdf" onclick="exportReport('dl', 'pdf')">
                    <i data-lucide="file-text"></i> PDF
                </button>
            </div>
        </div>

        <!-- Por D. Federal -->
        <div class="card report-card">
            <div class="report-header">
                <i data-lucide="map" class="icon-df"></i>
                <div>
                    <h4>Por D. Federal (DF)</h4>
                    <p>Lista de miembros por Distrito Federal.</p>
                </div>
            </div>
            <select id="report-federal-val-df">
                <option value="">-- Elige un D.F. --</option>
                ${dfRes.data?.map(d => `<option value="${d.df}">${d.df}</option>`).join('')}
            </select>
            <div class="report-actions">
                <button class="btn btn-export btn-csv" onclick="exportReport('df', 'csv')">
                    <i data-lucide="file-spreadsheet"></i> CSV
                </button>
                <button class="btn btn-export btn-pdf" onclick="exportReport('df', 'pdf')">
                    <i data-lucide="file-text"></i> PDF
                </button>
            </div>
        </div>

        <!-- REPORTE PERSONALIZADO (GENERAL) -->
        <div class="card report-card full-width" style="grid-column: 1 / -1;">
            <div class="report-header">
                <i data-lucide="settings" class="icon-custom" style="color: #6366f1;"></i>
                <div>
                    <h4>Reporte General (Personalizado)</h4>
                    <p>Selecciona los campos que deseas incluir en el reporte de todos los miembros.</p>
                </div>
            </div>
            <div class="custom-fields-select-actions" style="margin-bottom: 10px; display: flex; gap: 15px;">
                <button type="button" class="btn-link" onclick="toggleAllReportFields(true)" style="background: none; border: none; color: #4f46e5; cursor: pointer; padding: 0; font-size: 0.875rem; text-decoration: underline;">Seleccionar Todos</button>
                <button type="button" class="btn-link" onclick="toggleAllReportFields(false)" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 0; font-size: 0.875rem; text-decoration: underline;">Deseleccionar Todos</button>
            </div>
            <div class="custom-fields-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin: 15px 0; padding: 15px; background: #f8fafc; border-radius: 8px;">
                <label style="display: flex; gap: 8px; cursor: pointer;"><input type="checkbox" name="custom-field" value="nombres" checked> Nombres</label>
                <label style="display: flex; gap: 8px; cursor: pointer;"><input type="checkbox" name="custom-field" value="paterno" checked> Apellido Paterno</label>
                <label style="display: flex; gap: 8px; cursor: pointer;"><input type="checkbox" name="custom-field" value="materno" checked> Apellido Materno</label>
                <label style="display: flex; gap: 8px; cursor: pointer;"><input type="checkbox" name="custom-field" value="nombre_completo"> Nombre Completo</label>
                <label style="display: flex; gap: 8px; cursor: pointer;"><input type="checkbox" name="custom-field" value="sexo" checked> Sexo</label>
                <label style="display: flex; gap: 8px; cursor: pointer;"><input type="checkbox" name="custom-field" value="ine" checked> INE</label>
                <label style="display: flex; gap: 8px; cursor: pointer;"><input type="checkbox" name="custom-field" value="celular" checked> Celular</label>
                <label style="display: flex; gap: 8px; cursor: pointer;"><input type="checkbox" name="custom-field" value="colonia" checked> Colonia</label>
                <label style="display: flex; gap: 8px; cursor: pointer;"><input type="checkbox" name="custom-field" value="seccion" checked> Sección</label>
                <label style="display: flex; gap: 8px; cursor: pointer;"><input type="checkbox" name="custom-field" value="calle"> Calle</label>
                <label style="display: flex; gap: 8px; cursor: pointer;"><input type="checkbox" name="custom-field" value="num"> Número</label>
                <label style="display: flex; gap: 8px; cursor: pointer;"><input type="checkbox" name="custom-field" value="status"> Estatus</label>
                <label style="display: flex; gap: 8px; cursor: pointer;"><input type="checkbox" name="custom-field" value="padrino"> Padrino</label>
                <label style="display: flex; gap: 8px; cursor: pointer;"><input type="checkbox" name="custom-field" value="email"> Email</label>
                <label style="display: flex; gap: 8px; cursor: pointer;"><input type="checkbox" name="custom-field" value="fecha_afiliacion"> Fecha Afiliación</label>
            </div>
            <div class="report-actions" style="justify-content: flex-end;">
                <button class="btn btn-export btn-csv" onclick="exportReport('miembros_custom', 'csv')">
                    <i data-lucide="file-spreadsheet"></i> Exportar CSV
                </button>
                <button class="btn btn-export btn-pdf" onclick="exportReport('miembros_custom', 'pdf')">
                    <i data-lucide="file-text"></i> Vista Previa (PDF)
                </button>
            </div>
        </div>
    </div>
    `;

    contentArea.innerHTML = reportHtml;
    lucide.createIcons();
}

window.toggleAllReportFields = function (checked) {
    const checkboxes = document.querySelectorAll('input[name="custom-field"]');
    checkboxes.forEach(cb => cb.checked = checked);
}

window.exportReport = async function (type, format) {
    let elementId = `report-val-${type}`;
    if (type === 'dl') elementId = 'report-local-val-dl';
    if (type === 'df') elementId = 'report-federal-val-df';

    let value = null;
    let label = "General";

    if (type !== 'miembros_custom') {
        const valElement = document.getElementById(elementId);
        value = valElement.value;
        if (!value) return alert("Por favor selecciona un valor para el reporte.");
        label = valElement.options[valElement.selectedIndex].text;
    }

    // Selected fields for custom report or defaults for others
    let selectedFields = [];
    const fieldMapping = {
        'id': 'ID',
        'nombres': 'Nombre',
        'paterno': 'Apellido Paterno',
        'materno': 'Apellido Materno',
        'nombre_completo': 'Nombre Completo',
        'calle': 'Calle',
        'num': 'Num',
        'colonia': 'Colonia',
        'cp': 'CP',
        'seccion': 'Sección',
        'status': 'Status',
        'padrino': 'Padrino',
        'sexo': 'Sexo',
        'celular': 'Celular',
        'email': 'Email',
        'ine': 'INE',
        'fecha_afiliacion': 'Fecha Afiliación'
    };

    if (type === 'miembros_custom') {
        const checkboxes = document.querySelectorAll('input[name="custom-field"]:checked');
        selectedFields = Array.from(checkboxes).map(cb => cb.value);
        if (selectedFields.length === 0) return alert("Selecciona al menos un campo para exportar.");
    } else {
        // Default fields for standard reports
        selectedFields = ['nombre_completo', 'ine', 'colonia', 'calle', 'num', 'seccion', 'status', 'padrino', 'celular'];
    }

    // Fetch lookups for names
    const [statusRes, padrinosRes, sexoRes] = await Promise.all([
        supabaseClient.from('status').select('*'),
        supabaseClient.from('padrinos').select('*'),
        supabaseClient.from('sexo').select('*')
    ]);
    const statusMap = {};
    statusRes.data?.forEach(s => statusMap[s.idst] = s.status);
    const padrinosMap = {};
    padrinosRes.data?.forEach(p => padrinosMap[p.padrinoid] = p.padrino);
    const sexoMap = {};
    sexoRes.data?.forEach(s => sexoMap[s.idsexo] = s.sexo);

    let query = supabaseClient.from('miembros').select('*');
    if (type === 'status') query = query.eq(type, value);
    else if (type === 'colonia') query = query.eq('colonia', value);
    else if (type === 'padrino') query = query.eq('padrino', value);
    else if (type === 'miembros_custom') { /* no filter, fetch all */ }
    else query = query.eq(type, value);

    const { data, error } = await query;

    if (error) return alert("Error al obtener datos: " + error.message);
    if (!data || data.length === 0) return alert("No se encontraron registros.");

    if (format === 'csv') {
        const csv = generateCSV(data, statusMap, padrinosMap, selectedFields, fieldMapping);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `reporte_${type}_${label}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        // PDF Simulation using Print Window
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>Reporte Miembros - ${label}</title>
                <style>
                    @page { size: landscape; margin: 10mm; }
                    body { font-family: sans-serif; padding: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10px; }
                    th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                    th { background-color: #f2f2f2; font-weight: bold; }
                    h2 { color: #333; margin-bottom: 5px; }
                    p { font-size: 12px; margin: 2px 0; }
                </style>
            </head>
            <body>
                <h2>Reporte de Miembros</h2>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <div>
                        <p><b>Reporte:</b> ${type === 'miembros_custom' ? 'General' : label}</p>
                        <p><b>Total registros:</b> ${data.length}</p>
                    </div>
                    <p><b>Fecha:</b> ${new Date().toLocaleDateString()}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            ${selectedFields.map(f => `<th>${fieldMapping[f]}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(m => `
                            <tr>
                                ${selectedFields.map(f => {
            let val = m[f];
            if (f === 'nombre_completo' && !val) val = (m.nombres + ' ' + m.paterno + ' ' + m.materno);
            if (f === 'status') val = statusMap[m[f]] || m[f];
            if (f === 'padrino') val = padrinosMap[m[f]] || m[f];
            if (f === 'sexo') val = sexoMap[m[f]] || m[f];
            if (f === 'calle' && m['num']) val = (m.calle || '') + ' ' + (m.num || '');
            return `<td>${val || '-'}</td>`;
        }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <script>
                    window.onload = function() { window.print(); window.close(); };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
}

// (Utility function generateCSV moved to utils.js)


function renderReportTable(data, statusMap) {
    let existingTable = document.getElementById('report-detail-table');
    if (existingTable) existingTable.remove();

    const tableDiv = document.createElement('div');
    tableDiv.id = 'report-detail-table';
    tableDiv.className = 'card mt-4';
    tableDiv.innerHTML = `
        < h3 style = "margin-bottom: 16px;" > Detalle del Reporte(Top 500)</h3 >
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th style="width: 80px;">Acciones</th>
                            <th>Nombre</th>
                            <th>Status</th>
                            <th>Sección</th>
                            <th>Colonia</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(m => `
                    <tr>
                        <td>
                            <div class="action-buttons-cell">
                                <button class="btn-icon" title="Ver" onclick="viewReportItem('${m.id}')"><i data-lucide="eye" style="width: 16px;"></i></button>
                            </div>
                        </td>
                        <td>${m.nombre_completo || (m.nombres + ' ' + m.paterno)}</td>
                        <td>${statusMap[m.status] || m.status || '-'}</td>
                        <td>${m.seccion || '-'}</td>
                        <td>${m.colonia || '-'}</td>
                    </tr>
                `).join('')}
                    </tbody>
                </table>
            </div>
    `;
    contentArea.appendChild(tableDiv);
    lucide.createIcons();
}

function renderReportChart(data, statusMap) {
    const ctx = document.getElementById('reportChart').getContext('2d');

    // Group by status for the chart
    const groups = data.reduce((acc, current) => {
        const statusName = statusMap[current.status] || current.status || 'Sin Status';
        acc[statusName] = (acc[statusName] || 0) + 1;
        return acc;
    }, {});

    if (window.myChart) window.myChart.destroy();

    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(groups),
            datasets: [{
                label: 'Miembros por Status',
                data: Object.values(groups),
                backgroundColor: 'rgba(79, 70, 229, 0.6)',
                borderColor: 'rgb(79, 70, 229)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// --- MODAL LOGIC ---
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const editForm = document.getElementById('edit-form');
const closeModalBtn = document.getElementById('close-modal');
const cancelBtn = document.getElementById('cancel-btn');
const saveBtn = document.getElementById('save-btn');

let currentEditingType = null;
let currentEditingId = null;

function openModal(title, contentHtml, type, id) {
    modalTitle.textContent = title;
    editForm.innerHTML = contentHtml;
    editForm.setAttribute('novalidate', ''); // Remove browser-level mandatory requirements
    currentEditingType = type;
    currentEditingId = id;
    modalOverlay.classList.remove('hidden');
    lucide.createIcons();
}

function closeModal() {
    modalOverlay.classList.add('hidden');
    editForm.innerHTML = '';
    currentEditingType = null;
    currentEditingId = null;
}

closeModalBtn.onclick = closeModal;
cancelBtn.onclick = closeModal;
modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) closeModal();
};

saveBtn.onclick = async () => {
    console.log("Saving record...", { type: currentEditingType, id: currentEditingId });
    const formData = new FormData(editForm);
    const updates = {};
    formData.forEach((value, key) => {
        // Broad sanitization: Convert any empty string to null. 
        // This effectively makes all fields optional from the database's perspective 
        // and avoids "bigint" or other type conversion errors for empty inputs.
        if (value === "") {
            updates[key] = null;
        } else {
            updates[key] = value;
        }
    });

    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    try {
        let result;

        if (currentEditingType === 'miembro') {
            if (currentEditingId) {
                console.log("Updating miembro ID:", currentEditingId);
                result = await supabaseClient.from('miembros').update(updates).eq('id', currentEditingId);
            } else {
                console.log("Inserting new miembro");
                result = await supabaseClient.from('miembros').insert([updates]);
            }
        } else if (currentEditingType === 'padrino') {
            if (currentEditingId) {
                result = await supabaseClient.from('padrinos').update(updates).eq('padrinoid', currentEditingId);
            } else {
                result = await supabaseClient.from('padrinos').insert([updates]);
            }
        } else if (currentEditingType === 'status') {
            if (currentEditingId) {
                result = await supabaseClient.from('status').update(updates).eq('idst', currentEditingId);
            } else {
                result = await supabaseClient.from('status').insert([updates]);
            }
        } else {
            throw new Error(`Tipo de edición desconocido: ${currentEditingType} `);
        }

        if (result.error) throw result.error;

        alert('Cambios guardados exitosamente');
        closeModal();
        loadSection(currentSection); // Refresh view
    } catch (err) {
        console.error("Error saving:", err);
        alert("Error al guardar: " + err.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar Cambios';
    }
};

// Action Handlers
window.editMiembro = async function (id) {
    const record = cachedData.miembros.find(m => m.id === id) ||
        (await supabaseClient.from('miembros').select('*').eq('id', id).single()).data;

    if (!record) return alert("No se encontró el registro");
    await showMiembroForm(record, id);
};

window.addMiembro = async function () {
    await showMiembroForm({}, null);
};

async function showMiembroForm(record, id) {
    // Fetch all lookup data for dropdowns
    const [
        { data: statusList },
        { data: sexList },
        { data: mesList },
        { data: diaList },
        { data: padrinosList },
        { data: gruposList },
        { data: dlList },
        { data: dfList },
        { data: sinoList }
    ] = await Promise.all([
        supabaseClient.from('status').select('*').order('status'),
        supabaseClient.from('sexo').select('*').order('sexid'),
        supabaseClient.from('mes').select('*').order('mesid'),
        supabaseClient.from('dias').select('*').order('diaid'),
        supabaseClient.from('padrinos').select('*').order('padrino'),
        supabaseClient.from('grupos').select('*').order('grupo'),
        supabaseClient.from('dl').select('*').order('dl'),
        supabaseClient.from('df').select('*').order('df'),
        supabaseClient.from('si_no').select('*').order('sino')
    ]);

    const html = `
        <div class="form-grid">
            <div class="form-section">
                <h3>Información Personal</h3>
                
                <div class="row">
                    <div class="form-group flex-2">
                        <label>Nombres</label>
                        <input type="text" name="nombres" id="field-nombres" value="${record.nombres || ''}">
                    </div>
                    <div class="form-group">
                        <label>Apellido Paterno</label>
                        <input type="text" name="paterno" id="field-paterno" value="${record.paterno || ''}">
                    </div>
                </div>

                <div class="row">
                    <div class="form-group">
                        <label>Apellido Materno</label>
                        <input type="text" name="materno" id="field-materno" value="${record.materno || ''}">
                    </div>
                    <div class="form-group flex-2">
                        <label>Nombre Completo (Automático)</label>
                        <input type="text" name="nombre_completo" id="field-nombre-completo" value="${record.nombre_completo || ''}" readonly style="background-color: #f9f9f9; cursor: not-allowed;">
                    </div>
                </div>

                <div class="row">
                    <div class="form-group">
                        <label>INE</label>
                        <input type="text" name="ine" id="field-ine" value="${record.ine || ''}">
                    </div>
                    <div class="form-group">
                        <label>Día Nacimiento</label>
                        <select name="dia">
                            <option value="">Día</option>
                            ${diaList?.map(d => `<option value="${d.dia}" ${record.dia == d.dia ? 'selected' : ''}>${d.dia}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="row">
                    <div class="form-group">
                        <label>Mes Nacimiento</label>
                        <select name="mes">
                            <option value="">Mes</option>
                            ${mesList?.map(m => `<option value="${m.mes}" ${record.mes == m.mes ? 'selected' : ''}>${m.mes}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Sexo</label>
                        <select name="sexo" id="field-sexo">
                            <option value="">Seleccione...</option>
                            ${sexList?.map(s => `<option value="${s.sexid}" ${record.sexo == s.sexid ? 'selected' : ''}>${s.sexo}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Fecha Afiliación</label>
                        <input type="text" name="fecha_afiliacion" value="${record.fecha_afiliacion || ''}" placeholder="dd/mm/año">
                    </div>
                </div>
            </div>

            <div class="form-section">
                <h3>Domicilio y Contacto</h3>
                <div class="form-group">
                    <label>Calle</label>
                    <input type="text" name="calle" value="${record.calle || ''}">
                </div>
                <div class="row">
                    <div class="form-group">
                        <label>Número</label>
                        <input type="text" name="num" value="${record.num || ''}">
                    </div>
                    <div class="form-group">
                        <label>C.P.</label>
                        <input type="number" name="cp" value="${record.cp || ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Colonia</label>
                    <input type="text" name="colonia" value="${record.colonia || ''}">
                </div>
                <div class="row">
                    <div class="form-group">
                        <label>Sección</label>
                        <input type="number" name="seccion" value="${record.seccion || ''}">
                    </div>
                    <div class="form-group">
                        <label>Localidad (DL)</label>
                        <select name="dl">
                            <option value="">Seleccione...</option>
                            ${dlList?.map(d => `<option value="${d.dl}" ${record.dl == d.dl ? 'selected' : ''}>${d.dl}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Federal (DF)</label>
                        <select name="df">
                            <option value="">Seleccione...</option>
                            ${dfList?.map(d => `<option value="${d.df}" ${record.df == d.df ? 'selected' : ''}>${d.df}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="row">
                    <div class="form-group">
                        <label>Celular</label>
                        <input type="text" name="celular" value="${record.celular || ''}">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" name="email" value="${record.email || ''}">
                    </div>
                </div>
            </div>

            <div class="form-section full-width">
                <h3>Estatus y Organización</h3>
                <div class="row">
                    <div class="form-group">
                        <label>Status</label>
                        <select name="status">
                            <option value="">Seleccione...</option>
                            ${statusList?.map(s => `<option value="${s.idst}" ${record.status == s.idst ? 'selected' : ''}>${s.status}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Padrino principal</label>
                        <select name="padrino">
                            <option value="">Seleccione...</option>
                            ${padrinosList?.map(p => `<option value="${p.padrinoid}" ${record.padrino == p.padrinoid ? 'selected' : ''}>${p.padrino}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Padrino 2</label>
                        <select name="padrino2">
                            <option value="">Seleccione...</option>
                            ${padrinosList?.map(p => `<option value="${p.padrinoid}" ${record.padrino2 == p.padrinoid ? 'selected' : ''}>${p.padrino}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="row">
                    <div class="form-group">
                        <label>Grupo</label>
                        <select name="grupo">
                            <option value="">Seleccione...</option>
                            ${gruposList?.map(g => `<option value="${g.grupoid}" ${record.grupo == g.grupoid ? 'selected' : ''}>${g.grupo}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Contacto</label>
                        <input type="text" name="contacto" value="${record.contacto || ''}">
                    </div>
                </div>
                <div class="row">
                    <div class="form-group">
                        <label>Voto Noviembre</label>
                        <select name="voto_nov">
                            <option value="">Seleccione...</option>
                            ${sinoList?.map(s => `<option value="${s.sinoid}" ${record.voto_nov == s.sinoid ? 'selected' : ''}>${s.sino}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Voto Marzo</label>
                        <select name="voto_mzo">
                            <option value="">Seleccione...</option>
                            ${sinoList?.map(s => `<option value="${s.sinoid}" ${record.voto_mzo == s.sinoid ? 'selected' : ''}>${s.sino}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Observaciones</label>
                    <textarea name="observaciones" rows="3">${record.observaciones || ''}</textarea>
                </div>
            </div>
        </div>
        `;
    const title = id ? "Editar Miembro" : "Agregar Nuevo Miembro";
    openModal(title, html, 'miembro', id);

    // Form logic: Auto-concatenation and INE detection
    const nombresInput = document.getElementById('field-nombres');
    const paternoInput = document.getElementById('field-paterno');
    const maternoInput = document.getElementById('field-materno');
    const fullInput = document.getElementById('field-nombre-completo');
    const ineInput = document.getElementById('field-ine');
    const sexoSelect = document.getElementById('field-sexo');

    const updateFullName = () => {
        const n = nombresInput.value.trim();
        const p = paternoInput.value.trim();
        const m = maternoInput.value.trim();
        fullInput.value = `${n} ${p} ${m}`.trim().replace(/\s+/g, ' ');
    };

    const detectFromINE = () => {
        const val = ineInput.value.toUpperCase();
        if (val.length >= 15) {
            const char15 = val.charAt(14);
            if (char15 === 'H') {
                sexoSelect.value = '2'; // 2 = MASC
            } else if (char15 === 'M') {
                sexoSelect.value = '1'; // 1 = FEM
            }
        }
    };

    if (nombresInput) nombresInput.addEventListener('input', updateFullName);
    if (paternoInput) paternoInput.addEventListener('input', updateFullName);
    if (maternoInput) maternoInput.addEventListener('input', updateFullName);
    if (ineInput) ineInput.addEventListener('input', detectFromINE);

    // Trigger initial detection if edit mode
    if (id) {
        detectFromINE();
    }
}

window.editPadrino = async function (id) {
    const { data: record, error } = await supabaseClient.from('padrinos').select('*').eq('padrinoid', id).single();
    if (error || !record) return alert("Error al cargar datos");

    const html = `
        <div class="form-group">
            <label>Nombre del Padrino</label>
            <input type="text" name="padrino" value="${record.padrino || ''}">
        </div>
    `;
    openModal("Editar Padrino", html, 'padrino', id);
};

window.addPadrino = function () {
    const html = `
        <div class="form-group">
            <label>Nombre del Padrino</label>
            <input type="text" name="padrino" placeholder="Ej. Juan Pérez">
        </div>
    `;
    openModal("Nuevo Padrino", html, 'padrino', null);
};

window.editStatus = async function (id) {
    const { data: record, error } = await supabaseClient.from('status').select('*').eq('idst', id).single();
    if (error || !record) return alert("Error al cargar datos");

    const html = `
        <div class="form-group">
            <label>Descripción del Status</label>
            <input type="text" name="status" value="${record.status || ''}">
        </div>
    `;
    openModal("Editar Status", html, 'status', id);
};

window.addStatus = function () {
    const html = `
        <div class="form-group">
            <label>Descripción del Status</label>
            <input type="text" name="status" placeholder="Ej. Suspendido">
        </div>
    `;
    openModal("Nuevo Status", html, 'status', null);
};

window.viewReportItem = function (id) {
    // For now, reuse edit flow or show read-only modal
    editMiembro(id);
};

// Initializer function to handle async setup
async function startApp() {
    supabaseClient = await initializeSupabase();
    if (supabaseClient) {
        console.log("Supabase client successfully initialized.");
        await init();
    }
}

window.deleteMiembro = async function (id) {
    if (!confirm("¿Estás seguro de que deseas eliminar este miembro de forma permanente?")) return;

    try {
        const { error } = await supabaseClient.from('miembros').delete().eq('id', id);
        if (error) throw error;
        alert("Miembro eliminado exitosamente");
        loadSection('miembros');
    } catch (err) {
        console.error("Error deleting miembro:", err);
        alert("Error al eliminar: " + err.message);
    }
};

window.deletePadrino = async function (id) {
    if (!confirm("¿Deseas eliminar este padrino definitivamente?")) return;

    try {
        const { error } = await supabaseClient.from('padrinos').delete().eq('padrinoid', id);
        if (error) throw error;
        alert("Padrino eliminado");
        loadSection('padrinos');
    } catch (err) {
        alert("Error al eliminar: " + err.message);
    }
};

window.deleteStatus = async function (id) {
    if (!confirm("¿Deseas eliminar este registro de status?")) return;

    try {
        const { error } = await supabaseClient.from('status').delete().eq('idst', id);
        if (error) throw error;
        alert("Status eliminado");
        loadSection('status');
    } catch (err) {
        alert("Error al eliminar: " + err.message);
    }
};

// Start the app
startApp();
