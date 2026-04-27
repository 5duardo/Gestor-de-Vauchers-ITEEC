const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const ExcelParser = require('./lib/excelParser');
const PdfGenerator = require('./lib/pdfGenerator');

let mainWindow;

function createWindow() {
  // Quitar menú de ventana
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    icon: path.join(__dirname, 'assets', 'logo-pantera.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.maximize();
  mainWindow.show();

  mainWindow.loadFile('src/index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('select-excel-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('get-sheet-names', async (event, filePath) => {
  console.log('[IPC] get-sheet-names llamado con:', filePath);
  try {
    const parser = new ExcelParser();
    const sheets = parser.getSheetNames(filePath);
    console.log('[IPC] Hojas encontradas:', sheets);
    return { success: true, sheets };
  } catch (error) {
    console.error('[IPC] Error en get-sheet-names:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('parse-excel', async (event, args) => {
  console.log('[IPC] parse-excel llamado con:', JSON.stringify(args));
  try {
    const { filePath, sheetName } = args;
    const parser = new ExcelParser();
    const data = await parser.parse(filePath, sheetName || null);
    console.log('[IPC] parse-excel completado. Docentes:', data.totalDocentes);
    return { success: true, data };
  } catch (error) {
    console.error('[IPC] Error en parse-excel:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('generate-pdf', async (event, { docentes, outputPath, periodo }) => {
  try {
    const generator = new PdfGenerator();
    
    if (!outputPath) {
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: path.join(app.getPath('documents'), 'vouchers_pago.pdf'),
        filters: [
          { name: 'PDF Files', extensions: ['pdf'] }
        ]
      });

      if (result.canceled) {
        return { success: false, error: 'Guardado cancelado' };
      }
      outputPath = result.filePath;
    }

    await generator.generate(docentes, outputPath, periodo);
    return { success: true, filePath: outputPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-file', async (event, filePath) => {
  try {
    const errorMessage = await shell.openPath(filePath);
    if (errorMessage) {
      return { success: false, error: errorMessage };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-output-path', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(app.getPath('documents'), 'vouchers_pago.pdf'),
    filters: [
      { name: 'PDF Files', extensions: ['pdf'] }
    ]
  });

  if (result.canceled) {
    return null;
  }

  return result.filePath;
});
