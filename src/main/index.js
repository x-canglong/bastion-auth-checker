import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import AuthChecker from './utils/authChecker'
import ExcelProcessor from './utils/excelProcessor'
import fs from 'fs'

let mainWindow = null

// 存储处理结果（用于更新删除标记）- 移到外部避免每次重新创建
const processedResultsCache = new Map()

// 注册所有IPC handlers（在应用启动时就注册，避免HMR问题）
function registerIpcHandlers() {
  // Excel文件选择对话框
  ipcMain.handle('select-excel-file', async () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow
    const result = await dialog.showOpenDialog(win, {
      title: '选择Excel文件',
      filters: [
        { name: 'Excel文件', extensions: ['xlsx', 'xls'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    
    if (result.canceled) {
      return null
    }
    
    return result.filePaths[0]
  })

  // 保存文件对话框
  ipcMain.handle('save-excel-file', async (event, defaultPath) => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow
    const result = await dialog.showSaveDialog(win, {
      title: '保存Excel文件',
      defaultPath: defaultPath || '授权检查结果.xlsx',
      filters: [
        { name: 'Excel文件', extensions: ['xlsx'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    
    if (result.canceled) {
      return null
    }
    
    return result.filePath
  })

  // 处理Excel文件
  ipcMain.handle('process-excel', async (event, filePath, config) => {
    try {
      console.log('开始处理Excel文件:', filePath)
      console.log('配置:', JSON.stringify(config, null, 2))
      
      const authChecker = new AuthChecker(config)
      const result = ExcelProcessor.processExcel(filePath, authChecker)
      const preview = ExcelProcessor.generatePreview(result)
      
      console.log('处理完成，工作表数量:', Object.keys(result.processedSheets).length)
      console.log('预览数据:', Object.keys(preview).length, '个工作表')
      
      // 缓存处理结果
      const cacheKey = `${filePath}_${Date.now()}`
      processedResultsCache.set(cacheKey, result)
      
      return {
        success: true,
        summary: result.summary,
        preview,
        filePath,
        cacheKey
      }
    } catch (error) {
      console.error('处理Excel文件失败:', error)
      console.error('错误堆栈:', error.stack)
      return {
        success: false,
        error: error.message || String(error)
      }
    }
  })

  // 更新删除标记
  ipcMain.handle('update-delete-mark', async (event, cacheKey, sheetName, recordIndex, shouldDelete) => {
    try {
      const result = processedResultsCache.get(cacheKey)
      if (!result) {
        return {
          success: false,
          error: '处理结果已过期，请重新处理文件'
        }
      }
      
      const updatedResult = ExcelProcessor.updateDeleteMark(result, sheetName, recordIndex, shouldDelete)
      const preview = ExcelProcessor.generatePreview(updatedResult)
      
      return {
        success: true,
        summary: updatedResult.summary,
        preview
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  })

  // 保存处理后的Excel文件
  ipcMain.handle('save-processed-excel', async (event, cacheKey, outputPath) => {
    try {
      const result = processedResultsCache.get(cacheKey)
      if (!result) {
        return {
          success: false,
          error: '处理结果已过期，请重新处理文件'
        }
      }
      
      const savedPath = ExcelProcessor.saveExcel(result, outputPath)
      
      return {
        success: true,
        filePath: savedPath
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  })

  // 加载配置文件
  ipcMain.handle('load-config', async () => {
    const configPath = join(app.getPath('userData'), 'auth-checker-config.json')
    try {
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf-8')
        return JSON.parse(configData)
      }
    } catch (error) {
      console.error('加载配置失败:', error)
    }
    
    // 返回默认配置
    return {
      opsPersonnel: ['王礼鑫', '王鹏辉', '杨志智', '张涛'],
      productionHostPatterns: ['prd', 'pehx-outpub-'],
      productionHostExcludePatterns: ['uat'],
      masterDbIPs: ['192.168.240.181', '192.168.240.156'],
      masterDbIPRange: {
        start: '192.168.240.150',
        end: '192.168.240.190'
      }
    }
  })

  // 保存配置文件
  ipcMain.handle('save-config', async (event, config) => {
    const configPath = join(app.getPath('userData'), 'auth-checker-config.json')
    try {
      // 确保配置对象可以被序列化
      // 创建一个新的纯对象，只包含可序列化的数据
      const cleanConfig = {
        opsPersonnel: Array.isArray(config.opsPersonnel) ? config.opsPersonnel : [],
        productionHostPatterns: Array.isArray(config.productionHostPatterns) ? config.productionHostPatterns : [],
        productionHostExcludePatterns: Array.isArray(config.productionHostExcludePatterns) ? config.productionHostExcludePatterns : [],
        masterDbIPs: Array.isArray(config.masterDbIPs) ? config.masterDbIPs : [],
        masterDbIPRange: {
          start: String(config.masterDbIPRange?.start || '192.168.240.150'),
          end: String(config.masterDbIPRange?.end || '192.168.240.190')
        }
      }
      
      const configString = JSON.stringify(cleanConfig, null, 2)
      fs.writeFileSync(configPath, configString, 'utf-8')
      return { success: true }
    } catch (error) {
      console.error('保存配置失败:', error)
      return { success: false, error: error.message }
    }
  })
}

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // 注册IPC handlers（移除旧的handlers避免重复注册）
  ipcMain.removeAllListeners('select-excel-file')
  ipcMain.removeAllListeners('save-excel-file')
  ipcMain.removeAllListeners('process-excel')
  ipcMain.removeAllListeners('update-delete-mark')
  ipcMain.removeAllListeners('save-processed-excel')
  ipcMain.removeAllListeners('load-config')
  ipcMain.removeAllListeners('save-config')
  
  registerIpcHandlers()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
