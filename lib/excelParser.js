const xlsx = require('xlsx');
const fs = require('fs');

class ExcelParser {
  constructor() {
    this.columnMappings = {
      nombre: ['nombre', 'docente', 'empleado', 'name', 'nombres', 'apellidos', 'apellido', 'nombre completo', 'full name'],
      cargo: ['cargo', 'puesto', 'position', 'plaza', 'area', 'departamento', 'rol', 'hrs/clase', 'hrs/ clase', 'clase'],
      salarioBase: ['salario', 'sueldo', 'salario base', 'sueldo base', 'base', 'total ganado', 'total ingresos', 'ganado', 'ingresos', 'devengado', 'salario bruto', 'ordinario'],
      isss: ['isss', 'seguro social', 'seguro', 'inss', 'seguridad social', 'i.h.s.s.', 'ihss'],
      afp: ['afp', 'pension', 'afp_confia', 'afp_crecer', 'pensiones'],
      renta: ['renta', 'isr', 'impuesto sobre renta', 'ir', 'impuesto renta', 'impto. vecinal', 'impto vecinal', 'impuesto vecinal', 'vecinal'],
      otrasDeducciones: ['otras deduc', 'otras deducciones', 'descuentos', 'prestamo', 'prestamos', 'anticipo', 'descuento', 'deducciones', 'llegada tarde', 'llegada tar', 'de/inasist', 'insistencia', 'inassist'],
      neto: ['neto', 'liquido', 'total neto', 'salario neto', 'a recibir', 'total a pagar', 'pagar', 'liquido a recibir', 'pago neto']
    };
  }

  detectColumns(headers) {
    const normalizedHeaders = headers.map(h => 
      String(h || '').toLowerCase().trim().replace(/\s+/g, ' ')
    );

    const mappings = {};
    
    for (const [field, possibleNames] of Object.entries(this.columnMappings)) {
      for (let i = 0; i < normalizedHeaders.length; i++) {
        const header = normalizedHeaders[i];
        if (!header) continue; // Saltar headers vacíos o undefined
        if (possibleNames.some(name => name && header.includes(name))) {
          mappings[field] = i;
          break;
        }
      }
    }

    // Detectar columnas adicionales de ingresos (bonos, horas extra, etc.)
    const ingresosKeywords = ['bono', 'hora extra', 'extra', 'incentivo', 'comision', 'aguinaldo', 'vacacion', 'vacaciones', 'dias', 'comisiones', 'recargo', 'subsidio', 'transporte', 'alimentacion'];
    const deduccionesKeywords = ['descuento', 'retencion', 'multa', 'sancion', 'cuota', 'embargo', 'sancion', 'faltante', 'daño', 'donacion'];
    
    // Palabras que indican que NO es una columna de datos numéricos
    const excludeKeywords = ['#', 'no.', 'numero', 'id', 'codigo', 'dpi', 'dui', 'nit', 'fecha', 'date', 'telefono', 'email', 'correo', 'direccion', 'dirección', 'nota', 'observacion', 'observación'];
    
    mappings.ingresosAdicionales = [];
    mappings.deduccionesAdicionales = [];
    mappings.possibleDeductionColumns = []; // Columnas que podrían ser deducciones
    mappings.possibleIncomeColumns = []; // Columnas que podrían ser ingresos

    for (let i = 0; i < normalizedHeaders.length; i++) {
      const header = normalizedHeaders[i];
      
      // Saltar si el header está vacío o undefined
      if (!header || header === '') continue;
      
      // Verificar que no sea una columna de identificación
      const isExcluded = excludeKeywords.some(k => k && header.includes(k));
      
      if (!isExcluded) {
        if (ingresosKeywords.some(k => k && header.includes(k))) {
          mappings.ingresosAdicionales.push({ column: i, name: headers[i] });
        }
        
        if (deduccionesKeywords.some(k => k && header.includes(k))) {
          mappings.deduccionesAdicionales.push({ column: i, name: headers[i] });
        }
        
        // Si es numérica y no está mapeada aún, podría ser ingreso o deducción
        if (!mappings.salarioBase || mappings.salarioBase !== i) {
          if (!mappings.isss || mappings.isss !== i) {
            if (!mappings.afp || mappings.afp !== i) {
              if (!mappings.renta || mappings.renta !== i) {
                if (!mappings.neto || mappings.neto !== i) {
                  mappings.possibleDeductionColumns.push({ column: i, name: headers[i] });
                }
              }
            }
          }
        }
      }
    }

    return { mappings, headers };
  }

  // Método para analizar muestra de datos y clasificar columnas
  analyzeSampleData(rawData, mappings, headerRowIndex = 0, sampleSize = 10) {
    const incomeColumns = [];
    const deductionColumns = [];
    
    for (let colInfo of mappings.possibleDeductionColumns) {
      if (!colInfo || colInfo.column === undefined) continue;
      const colIndex = colInfo.column;
      let positiveCount = 0;
      let negativeCount = 0;
      let totalValue = 0;
      let samples = 0;
      
      // Empezar después de la fila de encabezados
      const startRow = headerRowIndex + 1;
      for (let i = startRow; i < Math.min(rawData.length, startRow + sampleSize); i++) {
        const row = rawData[i];
        if (row && row[colIndex] !== undefined && row[colIndex] !== null && row[colIndex] !== '') {
          const value = this.parseNumber(row[colIndex]);
          if (value !== 0) {
            samples++;
            totalValue += value;
            if (value > 0) positiveCount++;
            else negativeCount++;
          }
        }
      }
      
      // Clasificar basado en la muestra
      if (samples > 0) {
        const headerName = String(colInfo.name).toLowerCase();
        
        // Si más del 80% son negativos, es deducción
        if (negativeCount / samples > 0.8) {
          deductionColumns.push({ ...colInfo, isNegative: true });
        }
        // Si el nombre sugiere deducción y hay valores positivos, convertir a deducción
        else if (headerName.includes('descuento') || headerName.includes('deduccion') || 
                 headerName.includes('retencion') || headerName.includes('isss') || 
                 headerName.includes('afp') || headerName.includes('renta') ||
                 headerName.includes('prestamo') || headerName.includes('multa')) {
          deductionColumns.push({ ...colInfo, isNegative: false });
        }
        // Si el nombre sugiere ingreso
        else if (headerName.includes('salario') || headerName.includes('sueldo') || 
                 headerName.includes('bono') || headerName.includes('incentivo') ||
                 headerName.includes('hora') || headerName.includes('comision')) {
          incomeColumns.push({ ...colInfo });
        }
        // Por defecto, si hay más valores positivos es ingreso
        else if (positiveCount >= negativeCount) {
          incomeColumns.push({ ...colInfo });
        }
        else {
          deductionColumns.push({ ...colInfo, isNegative: false });
        }
      }
    }
    
    return { incomeColumns, deductionColumns };
  }

  getSheetNames(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error('El archivo no existe');
    }
    const workbook = xlsx.readFile(filePath);
    console.log('SheetNames encontradas:', workbook.SheetNames);
    return workbook.SheetNames;
  }

  async parse(filePath, targetSheet = null) {
    if (!fs.existsSync(filePath)) {
      throw new Error('El archivo no existe');
    }

    const workbook = xlsx.readFile(filePath);
    let allDocentes = [];
    
    // Procesar todas las hojas del archivo
    let lastHeaders = [];
    let lastMappings = {};
    let lastRawRows = [];
    
    // Si se especificó una hoja, solo procesar esa
    const sheetsToProcess = targetSheet
      ? workbook.SheetNames.filter(s => s === targetSheet)
      : workbook.SheetNames;

    for (const sheetName of sheetsToProcess) {
      console.log(`Procesando hoja: ${sheetName}`);
      const worksheet = workbook.Sheets[sheetName];
      const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (rawData.length < 2) continue; // Saltar hojas vacías

      // ── Buscar la fila de encabezados ──────────────────────────────────
      // Prioridad 1: buscar fila que contenga 'nombre', 'docente' o 'empleado'
      const identityKeywords = ['nombre', 'docente', 'empleado'];
      const fallbackKeywords = ['sueldo', 'salario', 'isss', 'afp', 'renta', 'codigo', 'dpi', 'ordinario', 'total a pagar'];
      let headerRowIndex = -1;
      let headers = [];

      // Pase 1: buscar fila con columnas de identidad (nombre, docente, empleado)
      for (let i = 0; i < Math.min(rawData.length, 20); i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;
        const rowText = row.map(cell => String(cell || '').toLowerCase()).join(' ');
        if (identityKeywords.some(kw => rowText.includes(kw))) {
          headerRowIndex = i;
          headers = [...row]; // copia para poder modificar
          break;
        }
      }

      // Pase 2: si no encontró identidad, buscar keywords financieras
      if (headerRowIndex === -1) {
        for (let i = 0; i < Math.min(rawData.length, 20); i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;
          const rowText = row.map(cell => String(cell || '').toLowerCase()).join(' ');
          if (fallbackKeywords.some(kw => rowText.includes(kw))) {
            headerRowIndex = i;
            headers = [...row];
            break;
          }
        }
      }

      // Pase 3: primera fila no vacía
      if (headerRowIndex === -1) {
        for (let i = 0; i < Math.min(rawData.length, 10); i++) {
          const row = rawData[i];
          if (row && row.some(cell => cell && String(cell).trim() !== '')) {
            headerRowIndex = i;
            headers = [...row];
            break;
          }
        }
      }

      if (headerRowIndex === -1) {
        console.log(`Saltando hoja ${sheetName}: no se encontraron encabezados`);
        continue;
      }

      // ── Fusionar headers multi-fila ──────────────────────────────────
      // Si la fila anterior tiene celdas (sub-encabezados de grupo), combinarlas
      if (headerRowIndex > 0) {
        const prevRow = rawData[headerRowIndex - 1];
        if (prevRow) {
          // Contar celdas no vacías en la fila anterior
          const nonEmpty = prevRow.filter(c => c && String(c).trim() !== '').length;
          // Solo fusionar si parece fila de sub-encabezados (>=2 celdas), no un título
          if (nonEmpty >= 2) {
            const maxLen = Math.max(headers.length, prevRow.length);
            for (let j = 0; j < maxLen; j++) {
              const prev = String(prevRow[j] || '').trim();
              const curr = String(headers[j] || '').trim();
              if (prev && curr) {
                headers[j] = prev + ' ' + curr;
              } else if (prev && !curr) {
                headers[j] = prev;
              }
            }
            console.log('Headers fusionados con fila anterior');
          }
        }
      }

      console.log('Fila de encabezados encontrada en índice:', headerRowIndex);
      console.log('Headers:', headers);
      
      const { mappings } = this.detectColumns(headers);
      lastHeaders = headers;
      lastMappings = mappings;

      // Verificar columnas mínimas requeridas
      if (mappings.nombre === undefined) {
        console.log(`Saltando hoja ${sheetName}: no se encontró columna de nombre`);
        continue;
      }

      // Analizar muestra de datos para clasificar columnas adicionales
      const { incomeColumns, deductionColumns } = this.analyzeSampleData(rawData, mappings, headerRowIndex);
      
      console.log('Columnas de ingreso detectadas:', incomeColumns.map(c => c.name));
      console.log('Columnas de deducción detectadas:', deductionColumns.map(c => c.name));
      console.log('Mapeo principal:', mappings);

      const docentes = [];
      const rawRows = [];
      
      // Procesar datos comenzando después de la fila de encabezados
      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row[mappings.nombre]) continue;

        const docente = {
          nombre: String(row[mappings.nombre] || '').trim(),
          cargo: mappings.cargo !== undefined ? String(row[mappings.cargo] || '').trim() : 'Docente',
          ingresos: [],
          deducciones: [],
          totalIngresos: 0,
          totalDeducciones: 0,
          neto: 0,
          // Datos crudos del Excel para el PDF
          rawRow: row,
          columns: headers,
          _nombreIdx: mappings.nombre,
          _cargoIdx: mappings.cargo
        };

        // Salario base
        if (mappings.salarioBase !== undefined) {
          const salario = this.parseNumber(row[mappings.salarioBase]);
          if (salario > 0) {
            docente.ingresos.push({ concepto: 'Salario Base', monto: salario });
            docente.totalIngresos += salario;
          }
        }

        // Ingresos adicionales detectados por palabras clave
        if (mappings.ingresosAdicionales) {
          for (const ing of mappings.ingresosAdicionales) {
            const monto = this.parseNumber(row[ing.column]);
            if (monto > 0) {
              docente.ingresos.push({ concepto: ing.name, monto });
              docente.totalIngresos += monto;
            }
          }
        }

        // Ingresos adicionales detectados por análisis de muestra
        for (const ing of incomeColumns) {
          const monto = this.parseNumber(row[ing.column]);
          if (monto > 0) {
            // Verificar que no sea la columna de salario base ya procesada
            if (mappings.salarioBase !== ing.column) {
              docente.ingresos.push({ concepto: ing.name, monto });
              docente.totalIngresos += monto;
            }
          }
        }

        // ISSS
        if (mappings.isss !== undefined) {
          const monto = this.parseNumber(row[mappings.isss]);
          if (monto > 0) {
            docente.deducciones.push({ concepto: 'ISSS', monto });
            docente.totalDeducciones += monto;
          }
        }

        // AFP
        if (mappings.afp !== undefined) {
          const monto = this.parseNumber(row[mappings.afp]);
          if (monto > 0) {
            docente.deducciones.push({ concepto: 'AFP', monto });
            docente.totalDeducciones += monto;
          }
        }

        // Renta
        if (mappings.renta !== undefined) {
          const monto = this.parseNumber(row[mappings.renta]);
          if (monto > 0) {
            docente.deducciones.push({ concepto: 'Renta (ISR)', monto });
            docente.totalDeducciones += monto;
          }
        }

        // Otras deducciones
        if (mappings.otrasDeducciones !== undefined) {
          const monto = this.parseNumber(row[mappings.otrasDeducciones]);
          if (monto > 0) {
            docente.deducciones.push({ concepto: 'Otras Deducciones', monto });
            docente.totalDeducciones += monto;
          }
        }

        // Deducciones adicionales detectadas por palabras clave
        if (mappings.deduccionesAdicionales) {
          for (const ded of mappings.deduccionesAdicionales) {
            const monto = this.parseNumber(row[ded.column]);
            if (monto > 0) {
              docente.deducciones.push({ concepto: ded.name, monto });
              docente.totalDeducciones += monto;
            }
          }
        }

        // Deducciones detectadas por análisis de muestra
        for (const ded of deductionColumns) {
          let monto = this.parseNumber(row[ded.column]);
          if (monto !== 0) {
            // Si la columna tiene valores negativos, convertir a positivo para mostrar
            if (ded.isNegative && monto < 0) {
              monto = Math.abs(monto);
            }
            
            // Verificar que no sea una de las deducciones principales ya procesadas
            const isMainDeduction = (mappings.isss === ded.column) || 
                                    (mappings.afp === ded.column) || 
                                    (mappings.renta === ded.column) ||
                                    (mappings.otrasDeducciones === ded.column);
            
            if (!isMainDeduction && monto > 0) {
              docente.deducciones.push({ concepto: ded.name, monto });
              docente.totalDeducciones += monto;
            }
          }
        }

        // Neto
        if (mappings.neto !== undefined) {
          docente.neto = this.parseNumber(row[mappings.neto]);
        } else {
          docente.neto = docente.totalIngresos - docente.totalDeducciones;
        }

        // Filtrar filas que parecen ser totales (sin nombre válido o nombre que contiene 'total')
        if (!docente.nombre || docente.nombre.toLowerCase().includes('total')) continue;
        
        // Guardar fila cruda para vista previa
        const rawCells = [];
        for (let c = 0; c < headers.length; c++) {
          rawCells.push(row[c] !== undefined ? row[c] : '');
        }
        rawRows.push(rawCells);

        docentes.push(docente);
      }
      
      // Agregar docentes y filas crudas de esta hoja al total
      allDocentes = allDocentes.concat(docentes);
      // Guardar headers y rawRows de la última hoja procesada
      lastRawRows = lastRawRows.concat(rawRows);
      
    } // Cierre del for de sheetNames

    return {
      docentes: allDocentes,
      totalDocentes: allDocentes.length,
      columns: lastHeaders,
      rawRows: lastRawRows,
      mappings: lastMappings
    };
  }

  parseNumber(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    
    const cleanValue = String(value)
      .replace(/[$,\s]/g, '')
      .replace(/\((\d+)\)/g, '-$1');
    
    const num = parseFloat(cleanValue);
    return isNaN(num) ? 0 : num;
  }
}

module.exports = ExcelParser;
