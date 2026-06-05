const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const ExcelParser = require('./lib/excelParser');
const PdfGenerator = require('./lib/pdfGenerator');

let mainWindow;
let updateCheckInProgress = false;

function resolveTemplatePath() {
  const candidates = [
    path.join(app.getAppPath(), 'assets', 'PLANILLA_2026.xlsx'),
    path.join(__dirname, 'assets', 'PLANILLA_2026.xlsx')
  ];

  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'assets', 'PLANILLA_2026.xlsx'));
  }

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function setupAutoUpdater() {
  if (!app.isPackaged) {
    return;
  }

  autoUpdater.autoDownload = false;

  autoUpdater.on('update-available', async (info) => {
    if (!mainWindow) {
      return;
    }

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Actualizacion disponible',
      message: `Hay una nueva version (${info.version}).`,
      detail: 'Quieres descargarla ahora?',
      buttons: ['Descargar', 'Mas tarde'],
      defaultId: 0,
      cancelId: 1
    });

    if (result.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow && progress && typeof progress.percent === 'number') {
      mainWindow.setProgressBar(progress.percent / 100);
    }
  });

  autoUpdater.on('update-downloaded', async () => {
    if (mainWindow) {
      mainWindow.setProgressBar(-1);
    }

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Actualizacion lista',
      message: 'La actualizacion se descargo correctamente.',
      detail: 'Quieres instalarla y reiniciar ahora?',
      buttons: ['Instalar y reiniciar', 'Mas tarde'],
      defaultId: 0,
      cancelId: 1
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on('error', (error) => {
    console.error('[Updater] Error:', error && error.message ? error.message : error);
  });
}

function checkForUpdates() {
  if (!app.isPackaged || updateCheckInProgress) {
    return;
  }

  updateCheckInProgress = true;

  autoUpdater.checkForUpdates()
    .catch((error) => {
      console.error('[Updater] Error:', error && error.message ? error.message : error);
    })
    .finally(() => {
      updateCheckInProgress = false;
    });
}

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
  setupAutoUpdater();
  checkForUpdates();

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

ipcMain.handle('download-template', async () => {
  try {
    const templatePath = resolveTemplatePath();

    if (!fs.existsSync(templatePath)) {
      return { success: false, error: 'No se encontro la plantilla en la aplicacion.' };
    }

    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: path.join(app.getPath('documents'), 'PLANILLA_2026.xlsx'),
      filters: [
        { name: 'Excel Files', extensions: ['xlsx'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    const buffer = await fs.promises.readFile(templatePath);
    await fs.promises.writeFile(result.filePath, buffer);

    return { success: true, filePath: result.filePath };
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
