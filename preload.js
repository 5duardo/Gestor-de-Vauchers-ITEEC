const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectExcelFile: () => ipcRenderer.invoke('select-excel-file'),
  getSheetNames: (filePath) => ipcRenderer.invoke('get-sheet-names', filePath),
  parseExcel: ({ filePath, sheetName }) => ipcRenderer.invoke('parse-excel', { filePath, sheetName }),
  generatePdf: (options) => ipcRenderer.invoke('generate-pdf', options),
  getOutputPath: () => ipcRenderer.invoke('get-output-path'),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath)
});
