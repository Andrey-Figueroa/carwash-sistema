// ===================== SUPABASE =====================
const SUPABASE_URL = 'https://jrusddndxmcztxxmzlfc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_m1oaIAYCibEvZWgWf0KQNw_1QQpiSzM';

let supabaseClient = null;
try {
    if (window.supabase && window.supabase.createClient) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.warn('⚠️ Supabase CDN no cargó.');
    }
} catch (e) {
    console.error('⚠️ Error inicializando Supabase:', e);
}

// ===================== ESTADO GLOBAL =====================
let inspecciones = [];

// ===================== INICIALIZACIÓN =====================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchInspecciones);
} else {
    fetchInspecciones();
}

// ===================== FETCH DATA =====================
async function fetchInspecciones() {
    const loader = document.getElementById('loader');
    if (loader) loader.textContent = "Iniciando conexión a base de datos...";
    
    if (!supabaseClient) {
        if (loader) {
            loader.textContent = "Error: La librería de la base de datos (Supabase) no se pudo cargar. Revisa tu conexión a internet.";
            loader.style.color = "#ff4d6d";
        }
        return;
    }

    try {
        if (loader) loader.textContent = "Consultando inspecciones...";
        const { data, error } = await supabaseClient
            .from('inspecciones')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            if (loader) {
                loader.textContent = "Error de Supabase: " + error.message;
                loader.style.color = "#ff4d6d";
            }
            console.error("Supabase error:", error);
            return;
        }

        inspecciones = data || [];
        renderList();
    } catch (err) {
        console.error('Error fetching inspecciones:', err);
        if (loader) {
            loader.textContent = "Error al cargar: " + (err.message || err);
            loader.style.color = "#ff4d6d";
        }
    }
}

// ===================== RENDERIZADO =====================
function renderList() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
    
    const container = document.getElementById('listContainer');
    const emptyState = document.getElementById('emptyState');
    const totalCount = document.getElementById('totalCount');

    if (totalCount) {
        totalCount.textContent = `${inspecciones.length} registro${inspecciones.length !== 1 ? 's' : ''}`;
    }

    if (inspecciones.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        if (container) container.innerHTML = '';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    
    if (container) {
        container.innerHTML = inspecciones.map(insp => {
            let fechaFormat = insp.fecha;
            if (fechaFormat) {
                const parts = fechaFormat.split('-');
                if (parts.length === 3) fechaFormat = `${parts[2]}/${parts[1]}/${parts[0]}`;
            } else {
                fechaFormat = 'Sin fecha';
            }

            // Hora desde created_at
            let horaFormat = '';
            if (insp.created_at) {
                try {
                    const dt = new Date(insp.created_at);
                    horaFormat = dt.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true });
                } catch(e) { horaFormat = ''; }
            }

            return `
                <div class="card">
                    <div class="card-top">
                        <div>
                            <div class="card-title">
                                🚗 ${insp.marca} ${insp.modelo}
                                <span class="card-placa">${insp.placa || 'S/P'}</span>
                            </div>
                            <div class="card-date">🗓️ ${fechaFormat}${horaFormat ? ' &nbsp;⏰ ' + horaFormat : ''}</div>
                        </div>
                        <button class="btn-delete" onclick="openDeleteModal('${insp.id}')" title="Borrar inspección">✕</button>
                    </div>
                    
                    <div class="card-details">
                        <div class="detail-item">
                            <span class="detail-label">Cliente</span>
                            <span class="detail-value">👤 ${insp.cliente || 'No registrado'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Mecánico</span>
                            <span class="detail-value">🔧 ${insp.mecanico || 'No asignado'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Año</span>
                            <span class="detail-value">📅 ${insp.anio || '-'}</span>
                        </div>
                    </div>

                    <div class="card-actions">
                        <button class="btn-action btn-pdf" onclick="descargarPDF('${insp.id}')" id="btnPdf_${insp.id}">
                            📄 PDF
                        </button>
                        <button class="btn-action btn-fotos" onclick="openFotoModal('${insp.id}')" id="btnFotos_${insp.id}">
                            📷 Fotos<span class="foto-badge" id="fotoBadge_${insp.id}"></span>
                        </button>
                        <a href="javascript:void(0)" class="btn-action btn-whatsapp" onclick="enviarWhatsApp('${insp.id}')" id="btnWA_${insp.id}">
                            💬 Enviar
                        </a>
                    </div>
                </div>
            `;
        }).join('');
        setTimeout(() => loadAllFotoCounts(), 200);
    }
}

// ===================== WHATSAPP =====================
async function enviarWhatsApp(id) {
    const insp = inspecciones.find(i => String(i.id) === String(id));
    if (!insp) return;

    const btnWA = document.getElementById(`btnWA_${id}`);
    if (btnWA) { btnWA.style.pointerEvents = 'none'; btnWA.innerHTML = '⏳...'; }

    try {
        // 1. Generar y descargar PDF
        await descargarPDF(id);

        // 2. Si hay fotos, crear y descargar ZIP
        if (!fotosCache[id]) await loadFotoCount(id);
        const fotos = fotosCache[id] || [];
        if (fotos.length > 0) await descargarZip(id);

        // 3. Abrir WhatsApp con mensaje
        const hayFotos = (fotosCache[id] || []).length > 0;
        const texto = encodeURIComponent(
            `Hola ${insp.cliente || ''},\n\n` +
            `Te compartimos el reporte de inspección mecánica de tu vehículo *${insp.marca} ${insp.modelo}* (Placa: *${insp.placa}*).\n\n` +
            (hayFotos
                ? `Se descargaron el *PDF de inspección* y el *ZIP con fotos* en este dispositivo. Por favor compártelos por este medio.\n\n`
                : `Se descargó el *PDF de inspección* en este dispositivo. Por favor compártelo por este medio.\n\n`) +
            `*Sus Amigos Detailer's Center* ✨`
        );
        window.open(`https://wa.me/?text=${texto}`, '_blank');

    } catch(e) {
        console.error(e);
        showToast('Error al preparar envío', 'error');
    } finally {
        if (btnWA) { btnWA.style.pointerEvents = ''; btnWA.innerHTML = '💬 Enviar'; }
    }
}

// ===================== GENERAR PDF =====================
async function descargarPDF(id) {
    const btn = document.getElementById(`btnPdf_${id}`);
    const originalText = btn ? btn.innerHTML : '';
    
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ Generando...';
    }

    try {
        const insp = inspecciones.find(i => String(i.id) === String(id));
        if (!insp) throw new Error("Inspección no encontrada");

        const { data: detalles, error } = await supabaseClient
            .from('detalle_inspeccion')
            .select('*')
            .eq('inspeccion_id', id);

        if (error) throw error;

        const formData = {
            vehiculo: {
                fecha: insp.fecha,
                placa: insp.placa,
                cliente: insp.cliente,
                mecanico: insp.mecanico,
                marca: insp.marca,
                modelo: insp.modelo,
                anio: insp.anio
            },
            interiorExterior: {},
            parteInferior: {},
            neumaticos: {},
            motor: {},
            frenos: {},
            observaciones: insp.observaciones || ''
        };

        const seccionMap = {
            'Interior/Exterior': 'interiorExterior',
            'Parte Inferior': 'parteInferior',
            'Neumáticos': 'neumaticos',
            'Motor': 'motor',
            'Frenos': 'frenos'
        };

        if (detalles) {
            detalles.forEach(d => {
                const mapKey = seccionMap[d.seccion];
                if (mapKey) formData[mapKey][d.item] = d.estado;
            });
        }

        await buildPDF(formData);

    } catch (err) {
        console.error("Error al generar PDF:", err);
        showToast('Error al generar PDF', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

async function buildPDF(formData) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        showToast('Error: librería PDF no cargó.', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'letter');
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const margin = 16;
    let y = 0;

    const gold = [212, 175, 55];
    const darkBg = [22, 22, 22];
    const white = [255, 255, 255];
    const lightGray = [200, 200, 200];
    const green = [39, 174, 96];
    const orange = [243, 156, 18];
    const red = [231, 76, 60];

    function addPageBg() {
        doc.setFillColor(...darkBg);
        doc.rect(0, 0, W, H, 'F');
    }

    function checkPage(needed) {
        if (y + needed > H - 20) {
            doc.addPage();
            addPageBg();
            y = 20;
        }
    }

    const logoImg = await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = 'logo.jpg';
    });

    addPageBg();
    doc.setFillColor(...gold);
    doc.rect(0, 38, W, 1.5, 'F');

    let textStartX = margin;
    if (logoImg) {
        doc.addImage(logoImg, 'JPEG', margin, 10, 24, 24);
        textStartX = margin + 30;
    }

    doc.setTextColor(...gold);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('INSPECCIÓN MECÁNICA', textStartX, 18);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...lightGray);
    doc.text("Sus Amigos Detailer's Center", textStartX, 26);

    doc.setTextColor(...gold);
    doc.setFontSize(10);
    doc.text('Fecha: ' + (formData.vehiculo.fecha || ''), W - margin, 18, { align: 'right' });

    y = 48;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...gold);
    doc.text('DATOS DEL VEHÍCULO', margin, y);
    y += 2;
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.4);
    doc.line(margin, y, W - margin, y);
    y += 7;

    const v = formData.vehiculo;
    const campos = [
        ['Placa', v.placa],
        ['Cliente', v.cliente],
        ['Mecánico', v.mecanico],
        ['Marca', v.marca],
        ['Modelo', v.modelo],
        ['Año', v.anio]
    ];

    doc.setFontSize(9);
    const colW = (W - margin * 2) / 3;
    campos.forEach((c, i) => {
        const col = i % 3;
        const x = margin + col * colW;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...lightGray);
        doc.text(c[0] + ':', x, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...white);
        doc.text(String(c[1] || '—'), x + 22, y);
        if (col === 2) y += 7;
    });
    if (campos.length % 3 !== 0) y += 7;
    y += 4;

    const estadoLabel = {
        'buen_estado': 'Buen estado',
        'atencion_futura': 'Atención futura',
        'atencion_inmediata': 'Atención inmediata'
    };
    const estadoColor = {
        'buen_estado': green,
        'atencion_futura': orange,
        'atencion_inmediata': red
    };

    const secciones = [
        { titulo: 'INTERIOR / EXTERIOR', datos: formData.interiorExterior },
        { titulo: 'PARTE INFERIOR', datos: formData.parteInferior },
        { titulo: 'NEUMÁTICOS', datos: formData.neumaticos },
        { titulo: 'MOTOR', datos: formData.motor },
        { titulo: 'FRENOS', datos: formData.frenos }
    ];

    secciones.forEach(sec => {
        const items = Object.entries(sec.datos || {});
        if (items.length === 0) return;

        const secHeight = 12 + items.length * 7;
        checkPage(secHeight);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...gold);
        doc.text(sec.titulo, margin, y);
        y += 2;
        doc.setDrawColor(...gold);
        doc.setLineWidth(0.3);
        doc.line(margin, y, W - margin, y);
        y += 6;

        doc.setFontSize(9);
        items.forEach(([item, estado]) => {
            checkPage(8);
            doc.setFillColor(30, 30, 30);
            doc.roundedRect(margin, y - 4, W - margin * 2, 6.5, 1, 1, 'F');
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...lightGray);
            doc.text(item, margin + 3, y);

            if (estado && estadoLabel[estado]) {
                const color = estadoColor[estado];
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...color);
                doc.setFillColor(...color);
                doc.circle(W - margin - 50, y - 1.2, 1.5, 'F');
                doc.text(estadoLabel[estado], W - margin - 46, y);
            } else {
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(100, 100, 100);
                doc.text('Sin evaluar', W - margin - 46, y);
            }
            y += 7;
        });
        y += 5;
    });

    if (formData.observaciones && formData.observaciones.trim()) {
        checkPage(25);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...gold);
        doc.text('OBSERVACIONES', margin, y);
        y += 2;
        doc.setDrawColor(...gold);
        doc.line(margin, y, W - margin, y);
        y += 6;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...lightGray);
        const lines = doc.splitTextToSize(formData.observaciones, W - margin * 2 - 4);
        lines.forEach(line => {
            checkPage(6);
            doc.text(line, margin + 2, y);
            y += 5;
        });
        y += 5;
    }

    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFillColor(...gold);
        doc.rect(0, H - 14, W, 0.5, 'F');
        doc.setFontSize(7);
        doc.setTextColor(...lightGray);
        doc.text("Sus Amigos Detailer's Center — Inspección Mecánica", margin, H - 6);
        doc.setTextColor(...gold);
        doc.text(`Página ${p} de ${totalPages}`, W - margin, H - 6, { align: 'right' });
    }

    const nombre = `Inspeccion_${formData.vehiculo.placa || 'SP'}_${formData.vehiculo.fecha || 'SF'}.pdf`;
    doc.save(nombre);
    showToast('✅ PDF generado', 'success');
}

// ===================== TOAST =====================
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'toast show';
    if (type === 'error') toast.classList.add('toast-error');
    else toast.classList.add('toast-success');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

// ===================== BORRAR REGISTRO =====================
let deleteTargetId = null;

function openDeleteModal(id) {
    deleteTargetId = id;
    const input = document.getElementById('deletePwInput');
    const error = document.getElementById('deletePwError');
    const modal = document.getElementById('deleteModal');
    
    if (input) input.value = '';
    if (error) error.style.display = 'none';
    if (modal) modal.classList.add('show');
    
    setTimeout(() => { if (input) input.focus(); }, 100);
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    if (modal) modal.classList.remove('show');
    deleteTargetId = null;
}

const btnConfirm = document.getElementById('btnDeleteConfirm');
if (btnConfirm) {
    btnConfirm.addEventListener('click', async () => {
        const input = document.getElementById('deletePwInput');
        const pw = input ? input.value.trim() : '';
        
        if (pw !== "AnEd2026" && pw !== "EdAn2026") {
            const error = document.getElementById('deletePwError');
            if (error) error.style.display = 'block';
            return;
        }

        if (!deleteTargetId) return;

        const originalText = btnConfirm.innerHTML;
        btnConfirm.disabled = true;
        btnConfirm.innerHTML = '⏳ Borrando...';

        try {
            const resDetalle = await supabaseClient.from('detalle_inspeccion').delete().eq('inspeccion_id', deleteTargetId).select();
            if (resDetalle.error) throw resDetalle.error;

            const { data, error } = await supabaseClient.from('inspecciones').delete().eq('id', deleteTargetId).select();
            if (error) throw error;
            if (data && data.length === 0) {
                throw new Error("Bloqueado por permisos de Supabase (RLS)");
            }

            showToast('✅ Registro borrado permanentemente', 'success');
            closeDeleteModal();
            fetchInspecciones();
        } catch (err) {
            console.error("Error borrando:", err);
            showToast('Error al borrar el registro', 'error');
        } finally {
            btnConfirm.disabled = false;
            btnConfirm.innerHTML = originalText;
        }
    });
}

const deleteModal = document.getElementById('deleteModal');
if (deleteModal) {
    deleteModal.addEventListener('click', e => {
        if (e.target === deleteModal) closeDeleteModal();
    });
}

// ===================== FOTOS =====================
const BUCKET = 'inspeccion-fotos';
let fotoTargetId = null;
let fotosCache = {};

// --- Modal control ---
function openFotoModal(id) {
    fotoTargetId = id;
    const modal = document.getElementById('fotoModal');
    const grid = document.getElementById('fotoGrid');
    if (modal) modal.classList.add('show');
    if (grid) grid.innerHTML = '<div class="foto-loading">Cargando fotos...</div>';
    loadFotos(id);
    // reset file input
    const inp = document.getElementById('fotoInput');
    if (inp) inp.value = '';
}

function closeFotoModal() {
    const modal = document.getElementById('fotoModal');
    if (modal) modal.classList.remove('show');
    fotoTargetId = null;
}

if (document.getElementById('fotoModal')) {
    document.getElementById('fotoModal').addEventListener('click', e => {
        if (e.target === document.getElementById('fotoModal')) closeFotoModal();
    });
}

// --- Cargar fotos desde Supabase Storage ---
async function loadFotos(id) {
    const grid = document.getElementById('fotoGrid');
    try {
        const { data, error } = await supabaseClient.storage
            .from(BUCKET)
            .list(String(id), { sortBy: { column: 'created_at', order: 'desc' } });
        if (error) throw error;

        const fotos = (data || []).filter(f => f.name !== '.emptyFolderPlaceholder');
        fotosCache[id] = fotos.map(f => ({
            name: f.name,
            url: supabaseClient.storage.from(BUCKET).getPublicUrl(`${id}/${f.name}`).data.publicUrl
        }));

        updateFotoBadge(id, fotos.length);
        renderFotoGrid(id);
    } catch(e) {
        console.error('Error cargando fotos:', e);
        if (grid) grid.innerHTML = '<div class="foto-loading" style="color:#ff4d6d">⚠️ Error al cargar fotos.<br>Verifica que el bucket "inspeccion-fotos" exista y sea público en Supabase.</div>';
    }
}

function renderFotoGrid(id) {
    const grid = document.getElementById('fotoGrid');
    if (!grid) return;
    const fotos = fotosCache[id] || [];
    if (fotos.length === 0) {
        grid.innerHTML = '<div class="foto-empty">📷 Sin fotos aún. Agrega fotos arriba.</div>';
        return;
    }
    grid.innerHTML = fotos.map(f => `
        <div class="foto-item">
            <img src="${f.url}" alt="${f.name}" loading="lazy" onclick="window.open('${f.url}','_blank')">
            <button class="foto-delete" onclick="deleteFoto('${id}','${f.name}')">✕</button>
        </div>
    `).join('');
}

function updateFotoBadge(id, count) {
    const badge = document.getElementById(`fotoBadge_${id}`);
    if (!badge) return;
    badge.textContent = count > 0 ? count : '';
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

// --- Subir fotos ---
async function uploadFotos(files) {
    if (!fotoTargetId || !files || files.length === 0) return;
    const label = document.querySelector('.foto-upload-area');
    if (label) label.style.opacity = '0.5';

    let uploaded = 0;
    for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop().toLowerCase();
        const fileName = `foto_${Date.now()}_${Math.random().toString(36).slice(2,6)}.${ext}`;
        const path = `${fotoTargetId}/${fileName}`;
        try {
            const { error } = await supabaseClient.storage.from(BUCKET).upload(path, file, { upsert: false });
            if (!error) uploaded++;
            else console.error('Upload error:', error);
        } catch(e) { console.error(e); }
    }

    if (label) label.style.opacity = '1';
    // reset input
    const inp = document.getElementById('fotoInput');
    if (inp) inp.value = '';

    if (uploaded > 0) {
        showToast(`✅ ${uploaded} foto(s) subida(s)`, 'success');
        loadFotos(fotoTargetId);
    } else {
        showToast('❌ Error al subir fotos', 'error');
    }
}

// --- Eliminar foto ---
async function deleteFoto(id, name) {
    const { error } = await supabaseClient.storage.from(BUCKET).remove([`${id}/${name}`]);
    if (error) { showToast('Error al borrar foto', 'error'); return; }
    showToast('🗑️ Foto eliminada', 'success');
    loadFotos(id);
}

// --- Descargar ZIP (desde modal) ---
async function descargarZipModal() {
    if (fotoTargetId) await descargarZip(fotoTargetId);
}

// --- Descargar ZIP por ID ---
async function descargarZip(id) {
    if (!fotosCache[id]) await loadFotoCount(id);
    const fotos = fotosCache[id] || [];
    if (fotos.length === 0) { showToast('No hay fotos para comprimir', 'error'); return; }
    if (!window.JSZip) { showToast('Error: librería ZIP no cargó', 'error'); return; }

    const btn = document.getElementById('btnModalZip');
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Creando ZIP...'; }

    try {
        const insp = inspecciones.find(i => String(i.id) === String(id));
        const zip = new window.JSZip();
        const carpeta = zip.folder(`Fotos_${insp?.placa || id}`);

        for (const foto of fotos) {
            const resp = await fetch(foto.url);
            const blob = await resp.blob();
            carpeta.file(foto.name, blob);
        }

        const content = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(content);
        a.download = `Fotos_${insp?.placa || id}_${insp?.fecha || ''}.zip`;
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('✅ ZIP descargado', 'success');
    } catch(e) {
        console.error('Error ZIP:', e);
        showToast('Error al crear ZIP', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '🗜️ Descargar ZIP de Fotos'; }
    }
}

// --- Cargar conteo de fotos en segundo plano ---
async function loadAllFotoCounts() {
    for (const insp of inspecciones) {
        loadFotoCount(insp.id);
    }
}

async function loadFotoCount(id) {
    try {
        const { data, error } = await supabaseClient.storage.from(BUCKET).list(String(id));
        if (error) return;
        const fotos = (data || []).filter(f => f.name !== '.emptyFolderPlaceholder');
        fotosCache[id] = fotos.map(f => ({
            name: f.name,
            url: supabaseClient.storage.from(BUCKET).getPublicUrl(`${id}/${f.name}`).data.publicUrl
        }));
        updateFotoBadge(id, fotos.length);
    } catch(e) { /* silent */ }
}
