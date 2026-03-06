// Supabase Configuration
const SUPABASE_URL = 'https://xbzyvpcqtmyhrtgkgizm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lqwGzBuvDXFT1stqUb_iDw_ta9DZlKt';

// Global error handling for debugging
window.onerror = function (msg, url, line, col, error) {
    console.error("DEBUG ERROR:", msg, "at", line, ":", col);
    if (document.getElementById('content-area')) {
        document.getElementById('content-area').innerHTML += `<div class="card" style="border: 1px solid red; color: red; margin-top: 10px;"><b>Error de Aplicación:</b> ${msg}</div>`;
    }
    return false;
};

window.onunhandledrejection = function (event) {
    console.error("DEBUG PROMISE REJECTION:", event.reason);
    if (document.getElementById('content-area')) {
        document.getElementById('content-area').innerHTML += `<div class="card" style="border: 1px solid red; color: red; margin-top: 10px;"><b>Error de Conexión:</b> ${event.reason.message || event.reason}</div>`;
    }
};

async function initializeSupabase() {
    if (typeof supabase === 'undefined') {
        console.error("Supabase library not loaded!");
        return null;
    }
    const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase client created:", client);
    return client;
}

function showLoading() {
    const contentArea = document.getElementById('content-area');
    if (contentArea) {
        contentArea.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Cargando datos desde Supabase...</p>
            </div>
        `;
    }
    if (window.lucide) lucide.createIcons();
}

async function updateStatsBadge() {
    const statsSummary = document.getElementById('stats-summary');
    if (!statsSummary || !window.supabaseClient) return;
    try {
        const { count, error } = await window.supabaseClient
            .from('miembros')
            .select('*', { count: 'exact', head: true });

        if (!error) {
            statsSummary.textContent = `${count.toLocaleString()} Miembros en total`;
        }
    } catch (e) {
        console.error("Error fetching stats:", e);
    }
}

function generateCSV(data, statusMap, padrinosMap, selectedFields, fieldMapping) {
    const headers = selectedFields.map(f => fieldMapping[f]);
    const rows = data.map(m => selectedFields.map(f => {
        let val = m[f];
        if (f === 'nombre_completo' && !val) val = `${m.nombres} ${m.paterno} ${m.materno}`;
        if (f === 'status') val = statusMap[m[f]] || m[f];
        if (f === 'padrino') val = padrinosMap[m[f]] || m[f];
        if (f === 'sexo') val = (window.sexoMap && window.sexoMap[m[f]]) || m[f];
        return val;
    }));

    let csvContent = headers.join(",") + "\n";
    rows.forEach(row => {
        const rowStr = row.map(val => {
            const str = (val === null || val === undefined) ? "" : String(val);
            return `"${str.replace(/"/g, '""')}"`;
        }).join(",");
        csvContent += rowStr + "\n";
    });
    return csvContent;
}
