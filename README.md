# Generador de Vouchers de Pago ITEEC

Aplicación de escritorio para generar vouchers de pago para docentes a partir de archivos Excel de planilla.

## Requisitos

- Node.js 18 o superior
- npm (viene con Node.js)

## Instalación

```bash
npm install
```

## Uso

```bash
npm start
```

## Funcionamiento

1. **Seleccionar Archivo**: Haz clic en "Seleccionar archivo Excel" y elige el archivo de planilla
2. **Configurar Período**: Opcionalmente ingresa el período de pago (ej: "Enero 2026")
3. **Vista Previa**: Revisa los docentes y montos cargados desde el Excel
4. **Generar PDF**: Haz clic en "Generar PDF Consolidado" y guarda el archivo

## Formato del Excel esperado

El archivo debe contener las siguientes columnas (el programa detecta automáticamente):

| Columna | Nombres alternativos aceptados |
|---------|-------------------------------|
| Nombre | nombre, docente, empleado, name, nombres, apellidos |
| Cargo | cargo, puesto, position, plaza, area |
| Salario Base | salario, sueldo, salario base, total ganado |
| ISSS | isss, seguro social, seguro |
| AFP | afp, pension |
| Renta | renta, isr, impuesto |
| Otras Deducciones | otras, descuentos, prestamo, anticipo |
| Neto | neto, liquido, salario neto, a recibir |

El programa también detecta automáticamente columnas de:
- **Ingresos adicionales**: bono, hora extra, incentivo, comisión, aguinaldo
- **Deducciones adicionales**: descuento, retención, multa, cuota

## Características del Voucher

Cada voucher incluye:
- Encabezado con nombre del instituto (ITEEC)
- Nombre del docente y cargo
- Tabla de ingresos detallados
- Tabla de deducciones (ISSS, AFP, Renta, etc.)
- Total neto a recibir destacado
- Líneas de firma para el empleado y RRHH
- Numeración de páginas

## Estructura del Proyecto

```
├── main.js              # Proceso principal de Electron
├── preload.js           # Bridge de seguridad
├── package.json         # Dependencias
├── lib/
│   ├── excelParser.js   # Parseo de archivos Excel
│   └── pdfGenerator.js  # Generación de PDFs
├── src/
│   ├── index.html       # Interfaz de usuario
│   ├── styles.css       # Estilos
│   ├── renderer.js      # Lógica frontend
│   └── template/
│       └── voucher.html # Plantilla de voucher
└── dist/                # PDFs generados (output)
```

## Licencia

© 2026 ITEEC - Instituto Técnico de Educación Especializado de El Salvador
