// Estado de la aplicación
let currentData = null;
let selectedFilePath = null;
let availableSheets = [];

// Referencias a elementos DOM
const elements = {
  btnSelectFile: document.getElementById('btnSelectFile'),
  btnDownloadTemplate: document.getElementById('btnDownloadTemplate'),
  fileName: document.getElementById('fileName'),
  stepMes: document.getElementById('stepMes'),
  mesSelect: document.getElementById('mesSelect'),
  btnCargarMes: document.getElementById('btnCargarMes'),
  step3: document.getElementById('step3'),
  step4: document.getElementById('step4'),
  previewHead: document.getElementById('previewHead'),
  previewBody: document.getElementById('previewBody'),
  stats: document.getElementById('stats'),
  btnGenerate: document.getElementById('btnGenerate'),
  btnReset: document.getElementById('btnReset'),
  status: document.getElementById('status'),
  progress: document.getElementById('progress'),
  viewToggle: document.getElementById('viewToggle'),
  tableContainer: document.getElementById('tableContainer'),
  cardsContainer: document.getElementById('cardsContainer')
};

// Utilidades — Moneda Lempira (Honduras)
const formatMoney = (amount) => {
  if (typeof amount !== 'number' || isNaN(amount)) return '';
  return 'L ' + amount.toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const formatCell = (value) => {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') {
    // Si tiene decimales o es valor grande, formatear como número
    return value.toLocaleString('es-HN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  return String(value);
};

const isNumeric = (value) => {
  return typeof value === 'number' && !isNaN(value);
};

let statusTimeout = null;

window.closeStatus = function() {
  elements.status.classList.add('hidden');
};

const showStatus = (message, type = 'info', filePath = null) => {
  if (statusTimeout) {
    clearTimeout(statusTimeout);
    statusTimeout = null;
  }

  let content = `<span>${message}</span>`;
  
  if (filePath && type === 'success') {
    // Escapar barras invertidas para Windows
    const safePath = filePath.replace(/\\/g, '\\\\');
    content += `
      <div style="display: flex; gap: 10px; align-items: center;">
        <button onclick="window.electronAPI.openFile('${safePath}')" class="btn btn-success" style="font-size: 1.1rem; padding: 10px 24px; box-shadow: 0 4px 15px rgba(22, 163, 74, 0.4);">📄 Abrir PDF</button>
        <button onclick="window.closeStatus()" class="btn btn-secondary" style="padding: 10px 15px;">✖ Cerrar</button>
      </div>`;
  }

  elements.status.innerHTML = content;
  elements.status.className = `status ${type}`;
  elements.status.classList.remove('hidden');

  // Si no hay botón de abrir, ocultar automáticamente
  if (!filePath) {
    statusTimeout = setTimeout(() => {
      elements.status.classList.add('hidden');
    }, 5000);
  }
};

const showProgress = (show = true) => {
  if (show) {
    elements.progress.classList.remove('hidden');
    elements.progress.classList.add('active');
  } else {
    elements.progress.classList.add('hidden');
    elements.progress.classList.remove('active');
  }
};

// ─── PASO 1: Seleccionar archivo ──────────────────────────────────────────────
elements.btnSelectFile.addEventListener('click', async () => {
  try {
    showProgress(true);
    showStatus('Seleccionando archivo...', 'info');

    const filePath = await window.electronAPI.selectExcelFile();

    if (!filePath) {
      showStatus('Selección cancelada', 'info');
      showProgress(false);
      return;
    }

    selectedFilePath = filePath;
    elements.fileName.textContent = filePath.split('\\').pop();

    showStatus('Leyendo hojas del archivo...', 'info');

    const sheetsResult = await window.electronAPI.getSheetNames(filePath);

    showProgress(false);

    if (!sheetsResult.success) {
      showStatus(`Error al leer archivo: ${sheetsResult.error}`, 'error');
      return;
    }

    availableSheets = sheetsResult.sheets;

    // Poblar el dropdown con las hojas encontradas
    elements.mesSelect.innerHTML = '<option value="">— Seleccione un mes —</option>';
    availableSheets.forEach(sheet => {
      const opt = document.createElement('option');
      opt.value = sheet;
      opt.textContent = sheet;
      elements.mesSelect.appendChild(opt);
    });

    if (availableSheets.length === 1) {
      elements.mesSelect.value = availableSheets[0];
      elements.btnCargarMes.disabled = false;
    } else {
      elements.btnCargarMes.disabled = true;
    }

    // Ocultar pasos de datos previos y mostrar selector de mes
    elements.step3.classList.add('hidden');
    elements.step4.classList.add('hidden');
    elements.stepMes.classList.remove('hidden');

    showStatus(`Archivo cargado. Se encontraron ${availableSheets.length} hoja(s). Seleccione el mes a procesar.`, 'success');

  } catch (error) {
    showProgress(false);
    showStatus(`Error inesperado: ${error.message}`, 'error');
  }
});

// ─── Descargar plantilla Excel ─────────────────────────────────────────────
elements.btnDownloadTemplate.addEventListener('click', async () => {
  try {
    showProgress(true);
    showStatus('Preparando plantilla...', 'info');

    const result = await window.electronAPI.downloadTemplate();

    showProgress(false);

    if (!result || result.canceled) {
      showStatus('Descarga cancelada', 'info');
      return;
    }

    if (!result.success) {
      showStatus(`Error al guardar plantilla: ${result.error}`, 'error');
      return;
    }

    showStatus(`Plantilla guardada en: ${result.filePath}`, 'success', result.filePath);
  } catch (error) {
    showProgress(false);
    showStatus(`Error inesperado: ${error.message}`, 'error');
  }
});

// ─── Habilitar botón cuando se elige mes ──────────────────────────────────────
elements.mesSelect.addEventListener('change', () => {
  elements.btnCargarMes.disabled = !elements.mesSelect.value;
});

// ─── PASO 2: Cargar datos del mes seleccionado ────────────────────────────────
elements.btnCargarMes.addEventListener('click', async () => {
  const sheetName = elements.mesSelect.value;
  if (!sheetName || !selectedFilePath) {
    showStatus('Seleccione un mes antes de continuar', 'error');
    return;
  }

  try {
    showProgress(true);
    elements.btnCargarMes.disabled = true;
    showStatus(`Cargando datos de "${sheetName}"...`, 'info');

    const result = await window.electronAPI.parseExcel({ filePath: selectedFilePath, sheetName });

    showProgress(false);
    elements.btnCargarMes.disabled = false;

    if (!result.success) {
      showStatus(`Error al procesar la hoja: ${result.error}`, 'error');
      return;
    }

    currentData = result.data;
    
    // El periodo siempre será el nombre de la hoja
    currentData.periodo = sheetName;

    // Mostrar pasos siguientes
    elements.step3.classList.remove('hidden');
    elements.step4.classList.remove('hidden');

    // Actualizar vista previa con TODOS los campos del Excel
    updatePreview(currentData);

    showStatus(`Datos cargados: ${currentData.totalDocentes} docente(s) en "${sheetName}".`, 'success');

  } catch (error) {
    showProgress(false);
    elements.btnCargarMes.disabled = false;
    showStatus(`Error inesperado: ${error.message}`, 'error');
  }
});

// ─── Generar PDF ──────────────────────────────────────────────────────────────
elements.btnGenerate.addEventListener('click', async () => {
  if (!currentData || !currentData.docentes.length) {
    showStatus('No hay datos para generar vouchers', 'error');
    return;
  }

  try {
    showProgress(true);
    elements.btnGenerate.disabled = true;
    showStatus('Generando PDF... Esto puede tomar unos momentos.', 'info');

    const result = await window.electronAPI.generatePdf({
      docentes: currentData.docentes,
      periodo: currentData.periodo
    });

    showProgress(false);
    elements.btnGenerate.disabled = false;

    if (result.success) {
      showStatus(`PDF generado exitosamente en: ${result.filePath}`, 'success', result.filePath);
    } else {
      showStatus(`Error al generar PDF: ${result.error}`, 'error');
    }

  } catch (error) {
    showProgress(false);
    elements.btnGenerate.disabled = false;
    showStatus(`Error: ${error.message}`, 'error');
  }
});

// ─── Resetear todo ────────────────────────────────────────────────────────────
elements.btnReset.addEventListener('click', () => {
  currentData = null;
  selectedFilePath = null;
  availableSheets = [];

  elements.fileName.textContent = 'Ningún archivo seleccionado';
  elements.previewHead.innerHTML = '';
  elements.previewBody.innerHTML = '';
  elements.stats.innerHTML = '';
  elements.status.classList.add('hidden');
  elements.mesSelect.innerHTML = '<option value="">— Seleccione un mes —</option>';
  elements.btnCargarMes.disabled = true;

  elements.stepMes.classList.add('hidden');
  elements.step3.classList.add('hidden');
  elements.step4.classList.add('hidden');
});
// ─── Toggle Vistas (Tabla / Cajas) ────────────────────────────────────────────
elements.viewToggle.addEventListener('change', (e) => {
  if (e.target.checked) {
    elements.tableContainer.classList.add('hidden');
    elements.cardsContainer.classList.remove('hidden');
  } else {
    elements.tableContainer.classList.remove('hidden');
    elements.cardsContainer.classList.add('hidden');
  }
});

// ─── Actualizar Comentario ───────────────────────────────────────────────────
window.updateComment = function(idx, value) {
  if (currentData && currentData.docentes && currentData.docentes[idx]) {
    currentData.docentes[idx].comentario = value;
  }
};
// ─── Vista previa dinámica con TODOS los campos del Excel ─────────────────────
function updatePreview(data) {
  const headers = data.columns || [];
  const rawRows = data.rawRows || [];

  // ── Estadísticas de resumen ──
  const totalDocentes = rawRows.length;
  // Buscar columna de neto (Total a Pagar) para mostrar en stats
  const netoIdx = data.mappings ? data.mappings.neto : undefined;
  const salarioIdx = data.mappings ? data.mappings.salarioBase : undefined;

  let sumSalarios = 0;
  let sumNeto = 0;
  rawRows.forEach(row => {
    if (salarioIdx !== undefined && isNumeric(row[salarioIdx])) {
      sumSalarios += row[salarioIdx];
    }
    if (netoIdx !== undefined && isNumeric(row[netoIdx])) {
      sumNeto += row[netoIdx];
    }
  });

  elements.stats.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${totalDocentes}</div>
      <div class="stat-label">Docentes</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatMoney(sumSalarios)}</div>
      <div class="stat-label">Total Salarios</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatMoney(sumNeto)}</div>
      <div class="stat-label">Total a Pagar</div>
    </div>
  `;

  // ── Encabezados dinámicos ──
  let headHTML = '<tr><th>#</th>';
  headers.forEach(h => {
    headHTML += `<th>${String(h || '').trim()}</th>`;
  });
  headHTML += '<th>Acciones</th></tr>';
  elements.previewHead.innerHTML = headHTML;

  // ── Filas de datos ──
  let bodyHTML = '';
  rawRows.forEach((row, idx) => {
    bodyHTML += `<tr><td>${idx + 1}</td>`;
    for (let c = 0; c < headers.length; c++) {
      const val = row[c];
      // Resaltar columna de neto
      const bold = (c === netoIdx) ? 'font-weight:bold; color:#0a1f44;' : '';
      bodyHTML += `<td style="${bold}">${formatCell(val)}</td>`;
    }
    bodyHTML += `<td style="text-align:center"><button class="btn btn-primary btn-sm" title="Imprimir voucher" onclick="printSingleVoucher(${idx})" style="padding:4px 10px; font-size:1.1rem; line-height:1;">🖨️</button></td></tr>`;
  });

  // ── Fila de totales ──
  bodyHTML += '<tr class="totals-row"><td></td>';
  for (let c = 0; c < headers.length; c++) {
    let colSum = 0;
    let hasNumbers = false;
    rawRows.forEach(row => {
      if (isNumeric(row[c])) {
        colSum += row[c];
        hasNumbers = true;
      }
    });
    if (hasNumbers) {
      bodyHTML += `<td style="font-weight:bold;">${formatCell(colSum)}</td>`;
    } else {
      bodyHTML += '<td></td>';
    }
  }
  bodyHTML += '<td></td></tr>';

  elements.previewBody.innerHTML = bodyHTML;

  // ── Generar vista de cajas (Cards) ──
  let cardsHTML = '';
  data.docentes.forEach((docente, idx) => {
    // Para simplificar, mostramos Total Ingresos y Total Deducciones en la tarjeta, más el Neto
    const ingresos = formatMoney(docente.totalIngresos);
    const deducciones = formatMoney(docente.totalDeducciones);
    const neto = formatMoney(docente.neto);
    const comment = docente.comentario || '';
    
    cardsHTML += `
      <div class="docente-card">
        <h3>${docente.nombre}</h3>
        <div class="card-cargo">${docente.cargo || 'Sin cargo especificado'}</div>
        
        <div class="card-row">
          <span>Ingresos:</span>
          <span>${ingresos}</span>
        </div>
        <div class="card-row">
          <span>Deducciones:</span>
          <span>${deducciones}</span>
        </div>
        <div class="card-row total-row">
          <span>Total a Pagar:</span>
          <span>${neto}</span>
        </div>
        
        <div class="comment-box">
          <label style="font-size: 0.85rem; font-weight: 600; color: var(--navy-mid);">Comentario para Voucher:</label>
          <textarea placeholder="Ej: Pago retroactivo incluido..." oninput="window.updateComment(${idx}, this.value)">${comment}</textarea>
        </div>
        
        <div class="card-actions">
          <button class="btn btn-primary btn-sm" onclick="printSingleVoucher(${idx})">🖨️ Imprimir Voucher</button>
        </div>
      </div>
    `;
  });
  
  elements.cardsContainer.innerHTML = cardsHTML;
}

// ─── Imprimir un solo voucher ─────────────────────────────────────────────────
window.printSingleVoucher = async (idx) => {
  if (!currentData || !currentData.docentes || !currentData.docentes[idx]) {
    showStatus('Error: no se encontró el docente', 'error');
    return;
  }

  const docente = currentData.docentes[idx];
  
  try {
    showProgress(true);
    showStatus(`Generando PDF para ${docente.nombre}...`, 'info');

    const result = await window.electronAPI.generatePdf({
      docentes: [docente],
      periodo: currentData.periodo
    });

    showProgress(false);

    if (result.success) {
      showStatus(`PDF generado exitosamente para ${docente.nombre}`, 'success', result.filePath);
    } else {
      showStatus(`Error al generar PDF: ${result.error}`, 'error');
    }

  } catch (error) {
    showProgress(false);
    showStatus(`Error: ${error.message}`, 'error');
  }
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  console.log('Generador de Vouchers ITEEC - Iniciado');
});
