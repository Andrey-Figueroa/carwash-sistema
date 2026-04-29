/* ============================================================
   INSPECCIÓN MECÁNICA — LÓGICA DE APLICACIÓN
   ============================================================ */

// ===================== SUPABASE =====================
const SUPABASE_URL = 'https://jrusddndxmcztxxmzlfc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_m1oaIAYCibEvZWgWf0KQNw_1QQpiSzM';
let supabaseClient = null;
try {
  if (window.supabase && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.warn('⚠️ Supabase CDN no cargó. Guardar en BD no disponible.');
  }
} catch (e) {
  console.error('⚠️ Error inicializando Supabase:', e);
}

// ===================== DATOS DE CHECKLISTS =====================
const CHECKLIST_DATA = {
  interiorExterior: [
    'Luces delanteras', 'Luces traseras', 'Direccionales',
    'Retrovisores', 'Limpiaparabrisas', 'Claxon',
    'Embrague', 'Filtro de aire cabina'
  ],
  parteInferior: [
    'Tuberías de freno', 'Suspensión', 'Dirección',
    'Escape', 'Fugas de fluidos', 'Juntas y botas'
  ],
  neumaticos: [
    'Delantero izquierdo', 'Delantero derecho',
    'Trasero izquierdo', 'Trasero derecho', 'Repuesto'
  ],
  motor: [
    'Niveles de líquidos', 'Correas', 'Filtros', 'Depósitos'
  ],
  frenos: [
    'Delantero izquierdo', 'Delantero derecho',
    'Trasero izquierdo', 'Trasero derecho'
  ]
};

// Opciones de estado para cada ítem
const STATUS_OPTIONS = [
  { value: 'buen_estado', label: 'Buen estado', css: 'opt-good' },
  { value: 'atencion_futura', label: 'Atención futura', css: 'opt-future' },
  { value: 'atencion_inmediata', label: 'Atención inmediata', css: 'opt-urgent' }
];

// ===================== ESTADO GLOBAL =====================
let currentStep = 1;
const TOTAL_STEPS = 7;

// Almacén de datos del formulario
const formData = {
  vehiculo: {},
  interiorExterior: {},
  parteInferior: {},
  neumaticos: {},
  motor: {},
  frenos: {},
  observaciones: ''
};

// ===================== ELEMENTOS DEL DOM =====================
const formContainer = document.getElementById('formContainer');
const btnBack = document.getElementById('btnBack');
const btnNext = document.getElementById('btnNext');
const btnPdf = document.getElementById('btnPdf');
const btnSave = document.getElementById('btnSave');
const headerStep = document.getElementById('headerStep');
const progressFill = document.getElementById('progressFill');
const progressSteps = document.getElementById('progressSteps');

// ===================== INICIALIZACIÓN =====================
document.addEventListener('DOMContentLoaded', () => {

  // Generar checklists dinámicamente
  buildChecklist('checklistInteriorExterior', CHECKLIST_DATA.interiorExterior, 'ie');
  buildChecklist('checklistParteInferior', CHECKLIST_DATA.parteInferior, 'pi');
  buildChecklist('checklistNeumaticos', CHECKLIST_DATA.neumaticos, 'nm');
  buildChecklist('checklistMotor', CHECKLIST_DATA.motor, 'mt');
  buildChecklist('checklistFrenos', CHECKLIST_DATA.frenos, 'fr');

  // Crear toast para errores
  createToast();

  // Actualizar UI inicial
  updateUI();
});

// Navegación y acciones
btnNext.addEventListener('click', nextStep);
btnBack.addEventListener('click', prevStep);
btnSave.addEventListener('click', guardarInspeccion);
btnPdf.addEventListener('click', generatePDF);

// ===================== CONSTRUIR CHECKLIST =====================
/**
 * Genera el HTML de un checklist con radio buttons de 3 opciones.
 * @param {string} containerId - ID del div contenedor
 * @param {string[]} items - Lista de nombres de ítems
 * @param {string} prefix - Prefijo único para los name de radio
 */
function buildChecklist(containerId, items, prefix) {
  const container = document.getElementById(containerId);
  container.innerHTML = items.map((item, i) => {
    const name = `${prefix}_${i}`;
    const optionsHTML = STATUS_OPTIONS.map(opt => `
      <input type="radio" name="${name}" id="${name}_${opt.value}" value="${opt.value}" />
      <label for="${name}_${opt.value}" class="${opt.css}">${opt.label}</label>
    `).join('');

    return `
      <div class="checklist-item">
        <span class="checklist-label">${item}</span>
        <div class="checklist-options">${optionsHTML}</div>
      </div>
    `;
  }).join('');
}

// ===================== NAVEGACIÓN ENTRE PASOS =====================
function nextStep() {
  if (!validateStep(currentStep)) return;
  saveStepData(currentStep);
  if (currentStep < TOTAL_STEPS) {
    animateStep(currentStep, currentStep + 1, 'forward');
    currentStep++;
    updateUI();
    // Si es el último paso, generar resumen
    if (currentStep === TOTAL_STEPS) buildSummary();
  }
}

function prevStep() {
  if (currentStep > 1) {
    saveStepData(currentStep);
    animateStep(currentStep, currentStep - 1, 'backward');
    currentStep--;
    updateUI();
  }
}

// ===================== ANIMACIÓN DE TRANSICIÓN =====================
function animateStep(from, to, direction) {
  const steps = formContainer.querySelectorAll('.form-step');
  const fromEl = steps[from - 1];
  const toEl = steps[to - 1];

  // Ocultar paso actual
  fromEl.classList.remove('active');
  fromEl.classList.add(direction === 'forward' ? 'slide-out-left' : 'slide-out-right');

  // Preparar paso destino
  toEl.style.display = 'block';
  toEl.style.opacity = '0';
  toEl.style.transform = direction === 'forward' ? 'translateX(40px)' : 'translateX(-40px)';

  // Limpiar clase de salida y activar entrada tras un frame
  requestAnimationFrame(() => {
    fromEl.classList.remove('slide-out-left', 'slide-out-right');
    fromEl.style.display = 'none';
    toEl.classList.add('active');
    toEl.style.opacity = '';
    toEl.style.transform = '';
  });

  // Scroll arriba
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===================== ACTUALIZAR UI =====================
function updateUI() {
  // Header badge
  headerStep.textContent = `Paso ${currentStep} de ${TOTAL_STEPS}`;

  // Progress fill
  progressFill.style.width = `${(currentStep / TOTAL_STEPS) * 100}%`;

  // Step dots
  const dots = progressSteps.querySelectorAll('.step-dot');
  dots.forEach((dot, i) => {
    dot.classList.remove('active', 'done');
    if (i + 1 === currentStep) dot.classList.add('active');
    else if (i + 1 < currentStep) dot.classList.add('done');
  });

  // Botones
  btnBack.disabled = currentStep === 1;

  if (currentStep === TOTAL_STEPS) {
    btnNext.classList.add('hidden');
    btnSave.classList.remove('hidden');
    btnPdf.classList.remove('hidden');
  } else {
    btnNext.classList.remove('hidden');
    btnSave.classList.add('hidden');
    btnPdf.classList.add('hidden');
  }
}

// ===================== VALIDACIÓN =====================
function validateStep(step) {
  if (step === 1) {
    const required = ['placa', 'cliente', 'mecanico', 'marca', 'modelo', 'anio'];
    let valid = true;
    required.forEach(id => {
      const el = document.getElementById(id);
      if (!el.value.trim()) {
        el.classList.add('invalid');
        valid = false;
      } else {
        el.classList.remove('invalid');
      }
    });
    if (!valid) showToast('Por favor complete todos los campos requeridos.');
    return valid;
  }
  // Los checklists no requieren validación obligatoria
  return true;
}

// ===================== GUARDAR DATOS =====================
function saveStepData(step) {
  switch (step) {
    case 1:
      formData.vehiculo = {
        fecha: new Date().toISOString().split('T')[0],
        placa: document.getElementById('placa').value,
        cliente: document.getElementById('cliente').value,
        mecanico: document.getElementById('mecanico').value,
        marca: document.getElementById('marca').value,
        modelo: document.getElementById('modelo').value,
        anio: document.getElementById('anio').value
      };
      break;
    case 2:
      formData.interiorExterior = readChecklist(CHECKLIST_DATA.interiorExterior, 'ie');
      break;
    case 3:
      formData.parteInferior = readChecklist(CHECKLIST_DATA.parteInferior, 'pi');
      break;
    case 4:
      formData.neumaticos = readChecklist(CHECKLIST_DATA.neumaticos, 'nm');
      break;
    case 5:
      formData.motor = readChecklist(CHECKLIST_DATA.motor, 'mt');
      break;
    case 6:
      formData.frenos = readChecklist(CHECKLIST_DATA.frenos, 'fr');
      break;
    case 7:
      formData.observaciones = document.getElementById('observaciones').value;
      break;
  }
}

/**
 * Lee los valores seleccionados de un checklist.
 * @param {string[]} items - Lista de nombres de ítems
 * @param {string} prefix - Prefijo de los radio buttons
 * @returns {Object} Mapa { nombreItem: valor }
 */
function readChecklist(items, prefix) {
  const result = {};
  items.forEach((item, i) => {
    const selected = document.querySelector(`input[name="${prefix}_${i}"]:checked`);
    result[item] = selected ? selected.value : null;
  });
  return result;
}

// ===================== RESUMEN =====================
function buildSummary() {
  // Guardar todos los pasos previos
  for (let s = 1; s <= 6; s++) saveStepData(s);

  const container = document.getElementById('summaryContent');
  let html = '';

  // Datos del vehículo
  const v = formData.vehiculo;
  const vehiculoLabels = {
    fecha: 'Fecha', placa: 'Placa',
    cliente: 'Cliente', mecanico: 'Mecánico', marca: 'Marca',
    modelo: 'Modelo', anio: 'Año'
  };
  html += '<div class="summary-group"><h4>🚗 Datos del Vehículo</h4>';
  Object.entries(vehiculoLabels).forEach(([key, label]) => {
    html += `<div class="summary-row"><span class="s-label">${label}</span><span class="s-value">${v[key] || '—'}</span></div>`;
  });
  html += '</div>';

  // Secciones de checklist
  const sections = [
    { title: '🔦 Interior / Exterior', data: formData.interiorExterior },
    { title: '🔧 Parte Inferior', data: formData.parteInferior },
    { title: '🛞 Neumáticos', data: formData.neumaticos },
    { title: '⚡ Motor', data: formData.motor },
    { title: '🛑 Frenos', data: formData.frenos }
  ];

  sections.forEach(sec => {
    html += `<div class="summary-group"><h4>${sec.title}</h4>`;
    Object.entries(sec.data).forEach(([item, val]) => {
      let cssClass = 's-none';
      let display = 'Sin evaluar';
      if (val === 'buen_estado') { cssClass = 's-good'; display = 'Buen estado'; }
      else if (val === 'atencion_futura') { cssClass = 's-future'; display = 'Atención futura'; }
      else if (val === 'atencion_inmediata') { cssClass = 's-urgent'; display = 'Atención inmediata'; }
      html += `<div class="summary-row"><span class="s-label">${item}</span><span class="s-value ${cssClass}">${display}</span></div>`;
    });
    html += '</div>';
  });

  container.innerHTML = html;
}

// ===================== SUPABASE — GUARDAR INSPECCIÓN =====================

/**
 * Construye el array de detalle para todos los checklists.
 * Cada objeto: { inspeccion_id, seccion, item, estado }
 */
function buildDetalleArray(inspeccionId) {
  const secciones = [
    { nombre: 'Interior/Exterior', datos: formData.interiorExterior },
    { nombre: 'Parte Inferior',    datos: formData.parteInferior },
    { nombre: 'Neumáticos',        datos: formData.neumaticos },
    { nombre: 'Motor',             datos: formData.motor },
    { nombre: 'Frenos',            datos: formData.frenos }
  ];

  const detalles = [];
  secciones.forEach(sec => {
    Object.entries(sec.datos).forEach(([item, estado]) => {
      // Solo insertar ítems que fueron evaluados (el CHECK no permite otros valores)
      if (!estado) return;
      detalles.push({
        inspeccion_id: inspeccionId,
        seccion: sec.nombre,
        item: item,
        estado: estado
      });
    });
  });
  return detalles;
}

/**
 * Guarda la inspección completa en Supabase:
 * 1. Inserta en "inspecciones" los datos generales.
 * 2. Obtiene el ID generado.
 * 3. Inserta todos los detalles del checklist en "detalle_inspeccion".
 */
async function guardarInspeccion() {
  // Guardar datos del paso actual
  saveStepData(7);
  // Asegurar que todos los pasos están guardados
  for (let s = 1; s <= 7; s++) saveStepData(s);

  // Deshabilitar botón mientras se guarda
  btnSave.disabled = true;
  btnSave.textContent = '⏳ Guardando...';

  // Verificar que Supabase está disponible
  if (!supabaseClient) {
    showToast('⚠️ Supabase no disponible. Verifique la conexión.', 'error');
    return;
  }

  try {
    // ---- PASO 1: Insertar en tabla "inspecciones" ----
    const v = formData.vehiculo;
    const registro = {
      fecha: v.fecha || null,
      placa: v.placa,
      cliente: v.cliente,
      mecanico: v.mecanico,
      marca: v.marca,
      modelo: v.modelo,
      anio: parseInt(v.anio, 10),
      observaciones: formData.observaciones || null
    };

    const { data: inspeccionData, error: inspeccionError } = await supabaseClient
      .from('inspecciones')
      .insert([registro])
      .select('id')
      .single();

    if (inspeccionError) throw inspeccionError;

    const inspeccionId = inspeccionData.id;
    console.log('✅ Inspección creada con ID:', inspeccionId);

    // ---- PASO 2: Insertar detalles del checklist ----
    const detalles = buildDetalleArray(inspeccionId);

    const { error: detalleError } = await supabaseClient
      .from('detalle_inspeccion')
      .insert(detalles);

    if (detalleError) throw detalleError;

    console.log(`✅ ${detalles.length} detalles insertados correctamente.`);

    // ---- Éxito ----
    showToast('✅ Inspección guardada exitosamente', 'success');
    btnSave.textContent = '✅ Guardado';

  } catch (err) {
    console.error('❌ Error al guardar inspección:', err);
    showToast('❌ Error al guardar: ' + (err.message || err), 'error');
    btnSave.disabled = false;
    btnSave.textContent = '💾 Guardar Inspección';
  }
}

// ===================== GENERAR PDF =====================
async function generatePDF() {
  saveStepData(7);
  for (let s = 1; s <= 7; s++) saveStepData(s);

  // Verificar que jsPDF cargó
  if (!window.jspdf || !window.jspdf.jsPDF) {
    showToast('⚠️ Error: librería PDF no cargó. Verifique su conexión a internet.', 'error');
    return;
  }

  btnPdf.disabled = true;
  btnPdf.textContent = '⏳ Generando...';

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'letter');
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 16;
  let y = 0;

  // --- Colores ---
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

  // --- Helper: nueva página si no cabe ---
  function checkPage(needed) {
    if (y + needed > H - 20) {
      doc.addPage();
      addPageBg();
      y = 20;
    }
  }

  // Cargar logo
  const logoImg = await new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = 'logo.jpg';
  });

  // ========== FIRST PAGE BG ==========
  addPageBg();

  // ========== HEADER ==========
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
  doc.text('Sus Amigos Detailer\'s Center', textStartX, 26);

  // Fecha arriba a la derecha
  doc.setTextColor(...gold);
  doc.setFontSize(10);
  doc.text('Fecha: ' + formData.vehiculo.fecha, W - margin, 18, { align: 'right' });

  y = 48;

  // ========== DATOS DEL VEHÍCULO ==========
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

  // ========== SECCIONES DE CHECKLIST ==========
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
    const items = Object.entries(sec.datos);
    const secHeight = 12 + items.length * 7;
    checkPage(secHeight);

    // Título de sección
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...gold);
    doc.text(sec.titulo, margin, y);
    y += 2;
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.3);
    doc.line(margin, y, W - margin, y);
    y += 6;

    // Ítems
    doc.setFontSize(9);
    items.forEach(([item, estado]) => {
      checkPage(8);

      // Fondo alterno sutil
      doc.setFillColor(30, 30, 30);
      doc.roundedRect(margin, y - 4, W - margin * 2, 6.5, 1, 1, 'F');

      // Nombre del ítem
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...lightGray);
      doc.text(item, margin + 3, y);

      // Estado
      if (estado && estadoLabel[estado]) {
        const color = estadoColor[estado];
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...color);
        // Indicador circular
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

  // ========== OBSERVACIONES ==========
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

  // ========== PIE DE PÁGINA ==========
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    // Footer se dibuja sobre el fondo oscuro
    doc.setFillColor(...gold);
    doc.rect(0, H - 14, W, 0.5, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...lightGray);
    doc.text('Sus Amigos Detailer\'s Center — Inspección Mecánica', margin, H - 6);
    doc.setTextColor(...gold);
    doc.text(`Página ${p} de ${totalPages}`, W - margin, H - 6, { align: 'right' });
  }

  // ========== DESCARGAR ==========
  const nombre = `Inspeccion_${formData.vehiculo.placa}_${formData.vehiculo.fecha}.pdf`;
  doc.save(nombre);
  
  btnPdf.disabled = false;
  btnPdf.textContent = '📄 Generar PDF';
  showToast('✅ PDF generado: ' + nombre, 'success');
}

// ===================== TOAST =====================
function createToast() {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.id = 'toast';
  document.body.appendChild(toast);
}

/**
 * Muestra un toast con mensaje y tipo (error, success, warning).
 */
function showToast(msg, type = 'error') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  // Limpiar variantes anteriores
  toast.classList.remove('toast-success', 'toast-warning');
  if (type === 'success') toast.classList.add('toast-success');
  else if (type === 'warning') toast.classList.add('toast-warning');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show', 'toast-success', 'toast-warning'), 3500);
}
