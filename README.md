# Generador de Vouchers de Pago ITEEC

Aplicacion de escritorio para generar vouchers de pago para docentes a partir de planillas Excel. Pensada para uso interno del instituto y para facilitar la emision rapida de vouchers en PDF.

## Caracteristicas principales

- Carga planillas Excel y detecta columnas de forma automatica
- Vista previa antes de generar el PDF
- PDF consolidado con detalle de ingresos y deducciones
- Lineas de firma y numeracion de paginas

## Descarga (usuarios)

1. Ve a la seccion de Releases del repositorio y descarga el ejecutable mas reciente.
2. Ejecuta el archivo y abre la aplicacion.

Si tienes problemas para abrirlo, confirma que Windows permita la ejecucion de aplicaciones descargadas.

## Actualizaciones (usuarios)

- Si instalaste la aplicacion con el instalador, se buscara una nueva version al abrirse y podras descargarla con un clic.
- Si usas version portable, debes descargar manualmente la nueva version desde Releases.

## Uso rapido

1. **Seleccionar archivo**: Haz clic en "Seleccionar archivo Excel" y elige la planilla.
2. **Configurar periodo**: Opcionalmente ingresa el periodo de pago (ej: "Enero 2026").
3. **Vista previa**: Revisa docentes y montos cargados desde el Excel.
4. **Generar PDF**: Haz clic en "Generar PDF Consolidado" y guarda el archivo.

## Formato del Excel esperado

El archivo debe contener las siguientes columnas (el programa detecta automaticamente):

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

El programa tambien detecta automaticamente columnas de:
- **Ingresos adicionales**: bono, hora extra, incentivo, comision, aguinaldo
- **Deducciones adicionales**: descuento, retencion, multa, cuota

## Caracteristicas del voucher

Cada voucher incluye:
- Encabezado con nombre del instituto (ITEEC)
- Nombre del docente y cargo
- Tabla de ingresos detallados
- Tabla de deducciones (ISSS, AFP, Renta, etc.)
- Total neto a recibir destacado
- Lineas de firma para el empleado y RRHH
- Numeracion de paginas

## Para desarrollo

### Requisitos

- Node.js 18 o superior
- npm (viene con Node.js)

### Instalacion

```bash
npm install
```

### Ejecucion

```bash
npm start
```

### Publicar releases (auto-update)

1. Ejecuta el build de Windows.
2. Sube al Release los archivos del instalador y los metadatos de actualizacion que genera el build.
3. Publica el Release como version estable (no draft).

## Estructura del proyecto

```
├── main.js              # Proceso principal de Electron
├── preload.js           # Bridge de seguridad
├── package.json         # Dependencias
├── lib/
│   ├── excelParser.js   # Parseo de archivos Excel
│   └── pdfGenerator.js  # Generacion de PDFs
├── src/
│   ├── index.html       # Interfaz de usuario
│   ├── styles.css       # Estilos
│   ├── renderer.js      # Logica frontend
│   └── template/
│       └── voucher.html # Plantilla de voucher
└── dist/                # PDFs generados (output)
```

## Soporte

Si encuentras errores o quieres sugerir mejoras, abre un issue en el repositorio.

## Licencia

© 2026 ITEEC - Instituto Tecnico de Educacion Especializado de El Salvador
