const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const Handlebars = require('handlebars');

class PdfGenerator {
  constructor() {
    this.template = null;
    this.loadTemplate();
  }

  loadTemplate() {
    const templatePath = path.join(__dirname, '..', 'src', 'template', 'voucher.html');
    if (fs.existsSync(templatePath)) {
      this.template = fs.readFileSync(templatePath, 'utf-8');
    }
  }

  formatMoney(amount) {
    return 'L ' + new Intl.NumberFormat('es-HN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  formatDate() {
    const now = new Date();
    return now.toLocaleDateString('es-HN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  async generate(docentes, outputPath, periodo = '') {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Generar HTML para todos los vouchers
    const vouchersHtml = docentes.map((docente, index) => {
      return this.generateVoucherHtml(docente, periodo, index + 1, docentes.length);
    }).join('<div style="border-top: 2px dashed #999; margin: 30px 0;"></div>');

    const fullHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Vouchers de Pago - ITEEC</title>
  <style>
    @page {
      size: letter;
      margin: 15mm;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #333;
    }
    
    .voucher {
      width: 100%;
      max-width: 200mm;
      margin: 0 auto;
      padding: 20px;
      border: 2px solid #1a5276;
      background: #fff;
    }
    
    .header {
      text-align: center;
      border-bottom: 2px solid #1a5276;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    
    .header h1 {
      font-size: 18pt;
      color: #1a5276;
      margin-bottom: 5px;
    }
    
    .header h2 {
      font-size: 12pt;
      color: #555;
      font-weight: normal;
    }
    
    .info-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    
    .info-box {
      margin-bottom: 10px;
    }
    
    .info-label {
      font-weight: bold;
      color: #1a5276;
      font-size: 9pt;
      text-transform: uppercase;
    }
    
    .info-value {
      font-size: 11pt;
      color: #333;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    
    th {
      background: #1a5276;
      color: white;
      padding: 8px;
      text-align: center;
      font-size: 10pt;
      border: 1px solid #333;
    }
    
    td {
      padding: 6px 8px;
      border: 1px solid #333;
      font-size: 10pt;
      text-align: center;
    }
    
    .text-center {
      text-align: center;
    }
    
    .total-row {
      font-weight: bold;
      background: #f8f9fa;
    }
    
    .neto-box {
      background: #e8f4f8;
      border: 2px solid #1a5276;
      padding: 15px;
      margin: 20px 0;
      text-align: center;
    }
    
    .neto-label {
      font-size: 10pt;
      color: #555;
      text-transform: uppercase;
    }
    
    .neto-value {
      font-size: 18pt;
      font-weight: bold;
      color: #1a5276;
    }
    
    .signature-section {
      margin-top: 30px;
      display: flex;
      justify-content: space-between;
    }
    
    .signature-box {
      width: 45%;
      text-align: center;
    }
    
    .signature-line {
      border-top: 1px solid #333;
      margin-top: 40px;
      padding-top: 5px;
      font-size: 9pt;
    }
    
    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 8pt;
      color: #777;
      border-top: 1px solid #ddd;
      padding-top: 10px;
    }
    
    .page-number {
      text-align: right;
      font-size: 8pt;
      color: #777;
      margin-top: 10px;
    }
    
    .two-columns {
      display: flex;
      gap: 20px;
    }
    
    .column {
      flex: 1;
    }
    
    @media print {
      .voucher {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  ${vouchersHtml}
</body>
</html>`;

    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: outputPath,
      format: 'letter',
      printBackground: true,
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm'
      }
    });

    await browser.close();
    return outputPath;
  }

  generateVoucherHtml(docente, periodo, pageNum, totalPages) {
    const fecha = this.formatDate();

    // Usar datos crudos del Excel si están disponibles
    const columns = docente.columns || [];
    const rawRow = docente.rawRow || [];

    let detalleRows = '';
    if (columns.length > 0 && rawRow.length > 0) {
      for (let i = 0; i < columns.length; i++) {
        const val = rawRow[i];

        const strVal = val === undefined || val === null ? '' : String(val).trim();

        // Tratar de parsearlo a número si es posible
        const cleanStr = strVal.replace(/[L$,]/g, '');
        const parsed = parseFloat(cleanStr);

        const isNum = typeof val === 'number' || (strVal !== '' && strVal !== '-' && !isNaN(parsed));
        const displayValue = (typeof val === 'number') ? val : (!isNaN(parsed) ? parsed : 0);

        // Si está vacío o es un guión, mostrarlo tal cual o "L 0.00" si preferimos que todo tenga formato
        // Como el usuario quiere que salgan todos, mostraremos el texto original si no es número, o "L 0.00"
        let formatted;
        if (strVal === '' || strVal === '-') {
          formatted = strVal; // Mostrar vacío o guión
        } else if (isNum) {
          formatted = 'L ' + Number(displayValue).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else {
          formatted = strVal;
        }

        detalleRows += `
          <tr>
            <td>${String(columns[i] || '').trim()}</td>
            <td class="text-center">${formatted}</td>
          </tr>`;
      }
    } else {
      // Fallback: usar ingresos/deducciones procesados
      const allItems = [
        ...docente.ingresos.map(x => ({ concepto: x.concepto, valor: this.formatMoney(x.monto) })),
        ...docente.deducciones.map(x => ({ concepto: x.concepto, valor: this.formatMoney(x.monto) }))
      ];
      detalleRows = allItems.map(item => `
        <tr>
          <td>${item.concepto}</td>
          <td class="text-center">${item.valor}</td>
        </tr>`).join('');
    }

    const netoFormatted = this.formatMoney(docente.neto);

    let comentarioHtml = '';
    if (docente.comentario && docente.comentario.trim() !== '') {
      comentarioHtml = `
      <div style="margin-top: 15px; padding: 10px; border: 1px dashed #999; background: #fafafa; border-radius: 4px; font-size: 10pt;">
        <strong>Observaciones:</strong><br>
        ${docente.comentario.replace(/\n/g, '<br>')}
      </div>`;
    }

    return `
<div class="voucher">
  <div class="header">
    <h1>INSTITUTO TÉCNICO EN ELECTRICIDAD, ELECTRÓNICA Y COMPUTACIÓN</h1>
    <h2>VOUCHER DE PAGO — ${periodo || 'PLANILLA DOCENTE'}</h2>
  </div>
  
  <div class="info-section">
    <div class="info-box">
      <div class="info-label">Nombre</div>
      <div class="info-value">${docente.nombre}</div>
    </div>
    <div class="info-box">
      <div class="info-label">Cargo / Función</div>
      <div class="info-value">${docente.cargo || '—'}</div>
    </div>
    <div class="info-box">
      <div class="info-label">Fecha de Emisión</div>
      <div class="info-value">${fecha}</div>
    </div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th style="text-align:center">Concepto</th>
        <th style="text-align:center">Monto</th>
      </tr>
    </thead>
    <tbody>
      ${detalleRows}
    </tbody>
  </table>

  <div class="neto-box">
    <div class="neto-label">TOTAL A RECIBIR</div>
    <div class="neto-value">${netoFormatted}</div>
  </div>
  
  ${comentarioHtml}
  
  <div class="footer">
    ITEEC — Instituto Técnico en Electricidad, Electrónica y Computación<br>
    Este documento es un comprobante de pago. Conservar para futuras referencias.
  </div>
  
  <div class="page-number">Página ${pageNum} de ${totalPages}</div>
</div>
`;
  }
}

module.exports = PdfGenerator;
