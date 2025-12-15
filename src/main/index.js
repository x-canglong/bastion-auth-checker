import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'
import AuthChecker from './utils/authChecker'
import ExcelProcessor from './utils/excelProcessor'
import fs from 'fs'
import crypto from 'crypto'

// 日志管理：开发环境输出详细日志，生产环境只输出错误
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// 获取日志文件路径
const getLogFilePath = () => {
  const logsDir = join(app.getPath('userData'), 'logs')
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
  }
  // 按日期创建日志文件
  const today = new Date()
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  return join(logsDir, `app-${dateStr}.log`)
}

// 写入日志到文件
const writeLogToFile = (level, ...args) => {
  try {
    const logFilePath = getLogFilePath()
    const timestamp = new Date().toISOString()
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2)
        } catch {
          return String(arg)
        }
      }
      return String(arg)
    }).join(' ')
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`
    fs.appendFileSync(logFilePath, logLine, 'utf-8')
  } catch (error) {
    // 如果写入日志文件失败，不影响主程序运行
    console.error('写入日志文件失败:', error)
  }
}

// 日志管理对象
const log = {
  info: (...args) => {
    if (isDev) console.log(...args)
    writeLogToFile('info', ...args)
  },
  error: (...args) => {
    console.error(...args)
    writeLogToFile('error', ...args)
  },
  warn: (...args) => {
    if (isDev) console.warn(...args)
    writeLogToFile('warn', ...args)
  }
}

let mainWindow = null

// 存储处理结果（用于更新删除标记）- 移到外部避免每次重新创建
const processedResultsCache = new Map()

// 检查历史索引文件路径
const getCheckHistoryIndexPath = () => {
  return join(app.getPath('userData'), 'check-history-index.json')
}

// 历史文件存储目录
const getHistoryFilesDir = () => {
  const dir = join(app.getPath('userData'), 'history-files')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

// 加载检查历史索引
const loadCheckHistoryIndex = () => {
  const indexPath = getCheckHistoryIndexPath()
  try {
    if (fs.existsSync(indexPath)) {
      const data = fs.readFileSync(indexPath, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('加载检查历史索引失败:', error)
  }
  return {}
}

// 保存检查历史索引
const saveCheckHistoryIndex = (index) => {
  const indexPath = getCheckHistoryIndexPath()
  try {
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8')
  } catch (error) {
    log.error('保存检查历史索引失败:', error)
  }
}

// 获取文件的hash值（用于唯一标识文件）
const getFileHash = (filePath) => {
  try {
    const fileBuffer = fs.readFileSync(filePath)
    return crypto.createHash('md5').update(fileBuffer).digest('hex')
  } catch (error) {
    log.error('计算文件hash失败:', error)
    // 如果读取失败，使用文件名+修改时间作为fallback
    try {
      const stats = fs.statSync(filePath)
      return crypto.createHash('md5').update(`${filePath}_${stats.mtimeMs}`).digest('hex')
    } catch (e) {
      // 最后的fallback：使用路径hash
      return crypto.createHash('md5').update(filePath).digest('hex')
    }
  }
}

// 格式化时间戳为年月日时分秒格式（如：20240101_120000）
const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}_${hours}${minutes}${seconds}`
}

// 获取权限的唯一标识（用于比较）
const getPermissionKey = (record) => {
  return `${record['主机IP'] || ''}_${record['主机名称'] || ''}_${record['主机网络'] || ''}_${record['主机组'] || ''}_${record['协议'] || ''}_${record['账户登录名'] || ''}`
}

// 获取30天前（或设定天数前）的检查记录
// 返回历史文件的路径，如果不存在则返回null
const getHistoricalCheck = (fileHash, currentTime, longTimeDays) => {
  const historyIndex = loadCheckHistoryIndex()
  const fileHistory = historyIndex[fileHash] || []

  // 计算目标时间（30天前）
  const targetTime = currentTime - (longTimeDays * 24 * 60 * 60 * 1000)

  // 查找最接近目标时间的检查记录（误差时间根据设置的长时间动态计算，为长时间的10%，最少1天）
  const toleranceDays = Math.max(1, Math.floor(longTimeDays * 0.1))
  const tolerance = toleranceDays * 24 * 60 * 60 * 1000
  let closestCheck = null
  let minDiff = Infinity

  fileHistory.forEach(check => {
    const diff = Math.abs(check.timestamp - targetTime)
    if (diff < tolerance && diff < minDiff) {
      minDiff = diff
      closestCheck = check
    }
  })

  if (closestCheck && closestCheck.filePath) {
    // 检查历史文件是否存在
    if (fs.existsSync(closestCheck.filePath)) {
      return {
        timestamp: closestCheck.timestamp,
        filePath: closestCheck.filePath
      }
    } else {
      log.warn('历史文件不存在:', closestCheck.filePath)
    }
  }

  return null
}

// 检查历史文件索引一致性
const checkHistoryIndexConsistency = () => {
  try {
    const historyIndex = loadCheckHistoryIndex()
    let cleanedCount = 0
    let hasChanges = false

    Object.keys(historyIndex).forEach(fileHash => {
      const originalLength = historyIndex[fileHash].length
      historyIndex[fileHash] = historyIndex[fileHash].filter(check => {
        if (check.filePath && fs.existsSync(check.filePath)) {
          return true
        } else {
          cleanedCount++
          return false
        }
      })
      if (historyIndex[fileHash].length === 0) {
        delete historyIndex[fileHash]
        hasChanges = true
      } else if (historyIndex[fileHash].length < originalLength) {
        hasChanges = true
      }
    })

    if (hasChanges) {
      saveCheckHistoryIndex(historyIndex)
      if (cleanedCount > 0) {
        log.info(`启动时清理了 ${cleanedCount} 个无效的历史文件记录`)
      }
    }
  } catch (error) {
    log.error('检查历史文件索引一致性失败:', error)
  }
}

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
      log.info('开始处理Excel文件:', filePath)

      const currentCheckTime = Date.now()
      const longTimeDays = config.longTimeDays || 30

      // 发送进度：开始处理
      event.sender.send('process-progress', { stage: 'start', message: '开始读取Excel文件...' })

      // 获取文件的hash值作为唯一标识
      const fileHash = getFileHash(filePath)
      log.info('文件hash:', fileHash)

      log.info('当前检查时间:', new Date(currentCheckTime).toLocaleString())

      // 如果有历史文件，用最新规则重新处理历史文件以获取历史权限
      let processedHistoricalCheck = null
      const historicalCheckInfo = getHistoricalCheck(fileHash, currentCheckTime, longTimeDays)
      if (historicalCheckInfo && historicalCheckInfo.filePath) {
        log.info(`找到${longTimeDays}天前的历史文件:`, historicalCheckInfo.filePath)
        log.info(`历史文件时间:`, new Date(historicalCheckInfo.timestamp).toLocaleString())

        event.sender.send('process-progress', { stage: 'history', message: '正在处理历史文件...' })

        try {
          // 用最新规则重新处理历史文件
          const tempAuthChecker = new AuthChecker(config)
          const historicalResult = ExcelProcessor.processExcel(historicalCheckInfo.filePath, tempAuthChecker, {
            historicalCheck: null, // 历史文件不需要再查找更早的历史
            currentCheckTime: historicalCheckInfo.timestamp,
            longTimeDays: 0 // 不需要再往前查找
          })

          // 提取历史权限（只保存生产环境和主数据库的权限）
          const historicalPermissions = {}
          Object.keys(historicalResult.processedSheets).forEach(sheetName => {
            const processed = historicalResult.processedSheets[sheetName]
            const permissionKeys = new Set()

            processed.results.forEach(r => {
              const isProd = tempAuthChecker.isProductionHost(r.record['主机名称'])
              const isMasterDb = tempAuthChecker.isMasterDatabase(r.record['主机IP'], r.record['主机名称'])

              if ((isProd || isMasterDb) && !tempAuthChecker.isOpsPersonnel(sheetName)) {
                const key = getPermissionKey(r.record)
                permissionKeys.add(key)
              }
            })

            if (permissionKeys.size > 0) {
              historicalPermissions[sheetName] = Array.from(permissionKeys)
            }
          })

          processedHistoricalCheck = {
            timestamp: historicalCheckInfo.timestamp,
            permissions: historicalPermissions
          }

          log.info(`历史权限数量:`, Object.keys(historicalPermissions).reduce((sum, sheet) => sum + (historicalPermissions[sheet]?.length || 0), 0))
        } catch (error) {
          log.error('处理历史文件失败:', error)
          log.info('将忽略历史检查，继续处理当前文件')
          // 错误恢复：继续处理当前文件，只是没有历史对比
          event.sender.send('process-progress', { stage: 'history-error', message: '历史文件处理失败，将忽略历史检查继续处理' })
        }
      } else {
        log.info(`未找到${longTimeDays}天前的历史文件（首次检查或历史记录不足）`)
      }

      event.sender.send('process-progress', { stage: 'processing', message: '正在检查当前文件...' })

      const authChecker = new AuthChecker(config)
      const result = ExcelProcessor.processExcel(filePath, authChecker, {
        historicalCheck: processedHistoricalCheck,
        currentCheckTime,
        longTimeDays
      })

      event.sender.send('process-progress', { stage: 'preview', message: '正在生成预览...' })

      const preview = ExcelProcessor.generatePreview(result)

      log.info('处理完成，工作表数量:', Object.keys(result.processedSheets).length)
      log.info('预览数据:', Object.keys(preview).length, '个工作表')

      // 保存当前Excel文件副本到历史目录
      const historyFilesDir = getHistoryFilesDir()
      const timeStr = formatTimestamp(currentCheckTime)
      // 获取原始文件名（不含路径）
      const originalFileName = filePath.split(/[/\\]/).pop()
      // 保存时使用hash_时间戳格式，但索引中保存原始文件名
      const historyFileName = `${fileHash}_${timeStr}.xlsx`
      const historyFilePath = join(historyFilesDir, historyFileName)

      event.sender.send('process-progress', { stage: 'saving', message: '正在保存历史文件...' })

      try {
        // 复制当前文件到历史目录
        fs.copyFileSync(filePath, historyFilePath)
        log.info('已保存历史文件:', historyFilePath)
      } catch (error) {
        log.error('保存历史文件失败:', error)
      }

      // 更新历史索引
      const historyIndex = loadCheckHistoryIndex()

      // 收集所有历史文件记录（跨所有文件hash）
      const allHistoryFiles = []
      Object.keys(historyIndex).forEach(hash => {
        historyIndex[hash].forEach(check => {
          allHistoryFiles.push({
            hash,
            timestamp: check.timestamp,
            filePath: check.filePath,
            originalFileName: check.originalFileName || check.filePath.split(/[/\\]/).pop() // 兼容旧数据
          })
        })
      })

      // 添加当前文件记录（包含检查结果摘要）
      if (!historyIndex[fileHash]) {
        historyIndex[fileHash] = []
      }
      historyIndex[fileHash].push({
        timestamp: currentCheckTime,
        filePath: historyFilePath,
        originalFileName: originalFileName, // 保存原始文件名
        summary: {
          totalSheets: result.summary.totalSheets || 0,
          totalRecords: result.summary.totalRecords || 0,
          markedForDeletion: result.summary.markedForDeletion || 0,
          normalRecords: (result.summary.totalRecords || 0) - (result.summary.markedForDeletion || 0),
          byReason: result.summary.byReason || {}
        }
      })
      allHistoryFiles.push({
        hash: fileHash,
        timestamp: currentCheckTime,
        filePath: historyFilePath
      })

      // 限制历史文件数量（最多50个，超出后删除最早上传的文件）
      const maxHistoryFiles = config.maxHistoryFiles || 50
      if (allHistoryFiles.length > maxHistoryFiles) {
        // 按时间戳排序，最早的在前
        allHistoryFiles.sort((a, b) => a.timestamp - b.timestamp)

        // 删除超出数量的最早文件
        const filesToDelete = allHistoryFiles.slice(0, allHistoryFiles.length - maxHistoryFiles)
        filesToDelete.forEach(file => {
          // 从索引中删除
          if (historyIndex[file.hash]) {
            historyIndex[file.hash] = historyIndex[file.hash].filter(
              check => check.filePath !== file.filePath
            )
            // 如果该hash的记录为空，删除hash键
            if (historyIndex[file.hash].length === 0) {
              delete historyIndex[file.hash]
            }
          }

          // 删除物理文件
          if (file.filePath && fs.existsSync(file.filePath)) {
            try {
              fs.unlinkSync(file.filePath)
              log.info('已删除最早的历史文件:', file.filePath)
            } catch (error) {
              log.error('删除历史文件失败:', error)
            }
          }
        })
      }

      saveCheckHistoryIndex(historyIndex)

      event.sender.send('process-progress', { stage: 'complete', message: '处理完成' })

      // 缓存处理结果
      const cacheKey = `${filePath}_${currentCheckTime}`
      processedResultsCache.set(cacheKey, result)

      // 返回可序列化的对象（不包含workbook等不可序列化的对象）
      return {
        success: true,
        summary: {
          totalSheets: result.summary.totalSheets || 0,
          totalRecords: result.summary.totalRecords || 0,
          markedForDeletion: result.summary.markedForDeletion || 0,
          byReason: result.summary.byReason || {}
        },
        preview,
        filePath,
        cacheKey,
        checkTime: currentCheckTime,
        historicalCheckTime: processedHistoricalCheck ? processedHistoricalCheck.timestamp : null
      }
    } catch (error) {
      log.error('处理Excel文件失败:', error)
      log.error('错误堆栈:', error.stack)
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
    const defaultConfig = {
      opsPersonnel: ['王礼鑫', '王鹏辉', '杨志智', '张涛'],
      productionHostPatterns: ['prd', 'pehx-outpub-'],
      productionHostExcludePatterns: ['uat'],
      masterDbIPs: ['192.168.240.181', '192.168.240.156'],
      masterDbIPRange: {
        start: '192.168.240.150',
        end: '192.168.240.190'
      },
      duplicateFields: ['主机IP', '主机名称', '主机网络', '主机组', '协议', '账户登录名'],
      longTimeDays: 30,
      maxHistoryFiles: 50
    }

    try {
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf-8')
        const loadedConfig = JSON.parse(configData)

        // 合并默认配置，确保新字段存在
        const mergedConfig = {
          ...defaultConfig,
          ...loadedConfig,
          // 确保新字段有默认值（如果旧配置没有）
          duplicateFields: loadedConfig.duplicateFields || defaultConfig.duplicateFields,
          longTimeDays: loadedConfig.longTimeDays !== undefined ? loadedConfig.longTimeDays : defaultConfig.longTimeDays,
          maxHistoryFiles: loadedConfig.maxHistoryFiles !== undefined ? loadedConfig.maxHistoryFiles : defaultConfig.maxHistoryFiles,
          masterDbIPRange: {
            ...defaultConfig.masterDbIPRange,
            ...loadedConfig.masterDbIPRange
          }
        }

        // 如果旧配置缺少新字段，自动保存更新后的配置
        if (!loadedConfig.duplicateFields || loadedConfig.longTimeDays === undefined || loadedConfig.maxHistoryFiles === undefined) {
          const cleanConfig = {
            opsPersonnel: Array.isArray(mergedConfig.opsPersonnel) ? mergedConfig.opsPersonnel : [],
            productionHostPatterns: Array.isArray(mergedConfig.productionHostPatterns) ? mergedConfig.productionHostPatterns : [],
            productionHostExcludePatterns: Array.isArray(mergedConfig.productionHostExcludePatterns) ? mergedConfig.productionHostExcludePatterns : [],
            masterDbIPs: Array.isArray(mergedConfig.masterDbIPs) ? mergedConfig.masterDbIPs : [],
            masterDbIPRange: {
              start: String(mergedConfig.masterDbIPRange?.start || '192.168.240.150'),
              end: String(mergedConfig.masterDbIPRange?.end || '192.168.240.190')
            },
            duplicateFields: Array.isArray(mergedConfig.duplicateFields) ? mergedConfig.duplicateFields : defaultConfig.duplicateFields,
            longTimeDays: Number(mergedConfig.longTimeDays) || 30,
            maxHistoryFiles: Number(mergedConfig.maxHistoryFiles) || 50
          }
          fs.writeFileSync(configPath, JSON.stringify(cleanConfig, null, 2), 'utf-8')
        }

        return mergedConfig
      }
    } catch (error) {
      log.error('加载配置失败:', error)
    }

    // 返回默认配置
    return defaultConfig
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
        },
        duplicateFields: Array.isArray(config.duplicateFields) ? config.duplicateFields : ['主机IP', '主机名称', '主机网络', '主机组', '协议', '账户登录名'],
        longTimeDays: Number(config.longTimeDays) || 30,
        maxHistoryFiles: Number(config.maxHistoryFiles) || 50
      }

      const configString = JSON.stringify(cleanConfig, null, 2)
      fs.writeFileSync(configPath, configString, 'utf-8')
      return { success: true }
    } catch (error) {
      log.error('保存配置失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取历史文件列表
  ipcMain.handle('get-history-files', async () => {
    try {
      const historyIndex = loadCheckHistoryIndex()
      const historyFilesDir = getHistoryFilesDir()
      const files = []

      Object.keys(historyIndex).forEach(fileHash => {
        historyIndex[fileHash].forEach(check => {
          const filePath = check.filePath
          const exists = fs.existsSync(filePath)
          let fileSize = 0
          if (exists) {
            try {
              const stats = fs.statSync(filePath)
              fileSize = stats.size
            } catch (e) {
              // 忽略错误
            }
          }

          files.push({
            fileHash,
            fileName: check.originalFileName || filePath.split(/[/\\]/).pop(), // 优先使用原始文件名
            filePath,
            timestamp: check.timestamp,
            fileSize,
            exists,
            summary: check.summary || null // 检查结果摘要
          })
        })
      })

      // 按时间戳倒序排序
      files.sort((a, b) => b.timestamp - a.timestamp)

      return { success: true, files }
    } catch (error) {
      log.error('获取历史文件列表失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 下载历史文件
  ipcMain.handle('download-history-file', async (event, filePath, originalFileName) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' }
      }

      const { filePath: savePath } = await dialog.showSaveDialog(mainWindow, {
        title: '保存文件',
        defaultPath: originalFileName || filePath.split(/[/\\]/).pop(),
        filters: [
          { name: 'Excel文件', extensions: ['xlsx'] }
        ]
      })

      if (savePath) {
        fs.copyFileSync(filePath, savePath)
        return { success: true, filePath: savePath }
      } else {
        return { success: false, error: '用户取消操作' }
      }
    } catch (error) {
      log.error('下载历史文件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 预览历史文件（返回文件路径供前端打开）
  ipcMain.handle('preview-history-file', async (event, filePath) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' }
      }

      // 打开文件所在文件夹并选中文件
      shell.showItemInFolder(filePath)
      return { success: true }
    } catch (error) {
      log.error('预览历史文件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 删除历史文件
  ipcMain.handle('delete-history-file', async (event, filePath) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' }
      }

      // 从索引中删除
      const historyIndex = loadCheckHistoryIndex()
      let deleted = false

      Object.keys(historyIndex).forEach(fileHash => {
        const originalLength = historyIndex[fileHash].length
        historyIndex[fileHash] = historyIndex[fileHash].filter(
          check => check.filePath !== filePath
        )
        if (historyIndex[fileHash].length < originalLength) {
          deleted = true
        }
        if (historyIndex[fileHash].length === 0) {
          delete historyIndex[fileHash]
        }
      })

      if (deleted) {
        // 删除物理文件
        fs.unlinkSync(filePath)
        saveCheckHistoryIndex(historyIndex)
        log.info('已删除历史文件:', filePath)
        return { success: true }
      } else {
        return { success: false, error: '索引中未找到该文件' }
      }
    } catch (error) {
      log.error('删除历史文件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 清理历史文件索引（删除无效记录）
  ipcMain.handle('cleanup-history-index', async () => {
    try {
      const historyIndex = loadCheckHistoryIndex()
      let cleanedCount = 0

      Object.keys(historyIndex).forEach(fileHash => {
        const originalLength = historyIndex[fileHash].length
        historyIndex[fileHash] = historyIndex[fileHash].filter(check => {
          if (check.filePath && fs.existsSync(check.filePath)) {
            return true
          } else {
            cleanedCount++
            return false
          }
        })
        if (historyIndex[fileHash].length === 0) {
          delete historyIndex[fileHash]
        }
      })

      saveCheckHistoryIndex(historyIndex)
      log.info(`已清理 ${cleanedCount} 个无效的历史文件记录`)
      return { success: true, cleanedCount }
    } catch (error) {
      log.error('清理历史文件索引失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 导出配置
  ipcMain.handle('export-config', async () => {
    try {
      const configPath = join(app.getPath('userData'), 'auth-checker-config.json')
      if (!fs.existsSync(configPath)) {
        return { success: false, error: '配置文件不存在' }
      }

      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: '导出配置',
        defaultPath: 'bastion-auth-checker-config.json',
        filters: [
          { name: 'JSON文件', extensions: ['json'] }
        ]
      })

      if (filePath) {
        fs.copyFileSync(configPath, filePath)
        return { success: true, filePath }
      } else {
        return { success: false, error: '用户取消操作' }
      }
    } catch (error) {
      log.error('导出配置失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 导入配置
  ipcMain.handle('import-config', async () => {
    try {
      const { filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: '导入配置',
        filters: [
          { name: 'JSON文件', extensions: ['json'] }
        ],
        properties: ['openFile']
      })

      if (filePaths && filePaths.length > 0) {
        const configData = fs.readFileSync(filePaths[0], 'utf-8')
        const importedConfig = JSON.parse(configData)

        // 验证配置格式
        if (!importedConfig || typeof importedConfig !== 'object') {
          return { success: false, error: '配置文件格式错误' }
        }

        // 保存到用户配置目录
        const configPath = join(app.getPath('userData'), 'auth-checker-config.json')
        fs.writeFileSync(configPath, JSON.stringify(importedConfig, null, 2), 'utf-8')

        return { success: true, config: importedConfig }
      } else {
        return { success: false, error: '用户取消操作' }
      }
    } catch (error) {
      log.error('导入配置失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取日志文件列表
  ipcMain.handle('get-log-files', async () => {
    try {
      const logsDir = join(app.getPath('userData'), 'logs')
      if (!fs.existsSync(logsDir)) {
        return { success: true, files: [] }
      }

      const files = fs.readdirSync(logsDir)
        .filter(file => file.endsWith('.log'))
        .map(file => {
          const filePath = join(logsDir, file)
          const stats = fs.statSync(filePath)
          return {
            fileName: file,
            filePath,
            size: stats.size,
            modifiedTime: stats.mtime.getTime()
          }
        })
        .sort((a, b) => b.modifiedTime - a.modifiedTime)

      return { success: true, files }
    } catch (error) {
      log.error('获取日志文件列表失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 读取日志文件内容
  ipcMain.handle('read-log-file', async (event, filePath, options = {}) => {
    try {
      if (!fs.existsSync(filePath)) {
        log.error('文件不存在:', filePath)
        return { success: false, error: '文件不存在' }
      }

      const { limit = 1000, level = 'all', keyword = '' } = options
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n').filter(line => line.trim())

      // 过滤日志级别
      let filteredLines = lines
      if (level !== 'all') {
        filteredLines = filteredLines.filter(line => {
          const levelMatch = line.match(/\[(\w+)\]/g)
          if (levelMatch && levelMatch.length >= 2) {
            const logLevel = levelMatch[1].toLowerCase()
            return logLevel === level.toLowerCase()
          }
          return false
        })
      }

      // 关键词搜索
      if (keyword) {
        filteredLines = filteredLines.filter(line => line.includes(keyword))
      }

      // 限制行数（取最后N行）
      const resultLines = filteredLines.slice(-limit)

      return {
        success: true,
        lines: resultLines,
        totalLines: filteredLines.length,
        fileSize: fs.statSync(filePath).size
      }
    } catch (error) {
      log.error('读取日志文件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 删除日志文件
  ipcMain.handle('delete-log-file', async (event, filePath) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' }
      }

      fs.unlinkSync(filePath)
      return { success: true }
    } catch (error) {
      log.error('删除日志文件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 清理旧日志文件（保留最近N天）
  ipcMain.handle('cleanup-log-files', async (event, keepDays = 30) => {
    try {
      const logsDir = join(app.getPath('userData'), 'logs')
      if (!fs.existsSync(logsDir)) {
        return { success: true, deletedCount: 0 }
      }

      const files = fs.readdirSync(logsDir)
        .filter(file => file.endsWith('.log'))
        .map(file => {
          const filePath = join(logsDir, file)
          const stats = fs.statSync(filePath)
          return { fileName: file, filePath, modifiedTime: stats.mtime.getTime() }
        })

      const cutoffTime = Date.now() - (keepDays * 24 * 60 * 60 * 1000)
      let deletedCount = 0

      files.forEach(file => {
        if (file.modifiedTime < cutoffTime) {
          try {
            fs.unlinkSync(file.filePath)
            deletedCount++
          } catch (error) {
            log.error(`删除日志文件失败: ${file.fileName}`, error)
          }
        }
      })

      return { success: true, deletedCount }
    } catch (error) {
      log.error('清理日志文件失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 导出日志文件
  ipcMain.handle('export-log-file', async (event, filePath) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' }
      }

      const { filePath: savePath } = await dialog.showSaveDialog(mainWindow, {
        title: '导出日志文件',
        defaultPath: filePath.split(/[/\\]/).pop(),
        filters: [
          { name: '日志文件', extensions: ['log', 'txt'] }
        ]
      })

      if (savePath) {
        fs.copyFileSync(filePath, savePath)
        return { success: true, filePath: savePath }
      } else {
        return { success: false, error: '用户取消操作' }
      }
    } catch (error) {
      log.error('导出日志文件失败:', error)
      return { success: false, error: error.message }
    }
  })
}

// 版本比较函数：比较两个版本号，返回 true 表示 remoteVersion > currentVersion
function compareVersions(currentVersion, remoteVersion) {
  const current = currentVersion.split('.').map(Number)
  const remote = remoteVersion.split('.').map(Number)
  
  const maxLength = Math.max(current.length, remote.length)
  
  for (let i = 0; i < maxLength; i++) {
    const currentPart = current[i] || 0
    const remotePart = remote[i] || 0
    
    if (remotePart > currentPart) {
      return true
    } else if (remotePart < currentPart) {
      return false
    }
  }
  
  return false // 版本相同
}

// 注册更新相关的IPC handlers
function registerUpdateHandlers() {
  // 检查更新
  ipcMain.handle('check-for-updates', async () => {
    try {
      if (isDev) {
        // return { success: false, error: '开发环境不支持更新检查' }
      }
      const result = await autoUpdater.checkForUpdates()
      if (result && result.updateInfo) {
        const currentVersion = app.getVersion()
        const remoteVersion = result.updateInfo.version
        // 只有当远程版本大于当前版本时才返回更新信息
        if (compareVersions(currentVersion, remoteVersion)) {
          return {
            success: true,
            updateInfo: {
              version: remoteVersion,
              releaseDate: result.updateInfo.releaseDate,
              releaseNotes: result.updateInfo.releaseNotes
            }
          }
        } else {
          return {
            success: true,
            updateInfo: null
          }
        }
      }
      return {
        success: true,
        updateInfo: null
      }
    } catch (error) {
      log.error('检查更新失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 下载更新
  ipcMain.handle('download-update', async () => {
    try {
      if (isDev) {
        return { success: false, error: '开发环境不支持更新下载' }
      }
      isDownloadingUpdate = true
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error) {
      log.error('下载更新失败:', error)
      isDownloadingUpdate = false
      return { success: false, error: error.message }
    }
  })

  // 安装更新
  ipcMain.handle('quit-and-install', () => {
    try {
      autoUpdater.quitAndInstall(false, true)
      return { success: true }
    } catch (error) {
      log.error('安装更新失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 获取当前版本
  ipcMain.handle('get-app-version', () => {
    return { version: app.getVersion() }
  })

  // 监听更新事件
  autoUpdater.on('checking-for-update', () => {
    log.info('正在检查更新...')
    if (mainWindow) {
      mainWindow.webContents.send('update-checking')
    }
  })

  autoUpdater.on('update-available', (info) => {
    const currentVersion = app.getVersion()
    const remoteVersion = info.version
    
    log.info('检查到远程版本:', remoteVersion, '当前版本:', currentVersion)
    
    // 只有当远程版本大于当前版本时才发送更新信息
    if (compareVersions(currentVersion, remoteVersion)) {
      log.info('发现新版本:', remoteVersion)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-available', {
          version: remoteVersion,
          releaseDate: info.releaseDate,
          releaseNotes: info.releaseNotes
        })
        // 自动显示更新对话框（用户可以选择是否更新）
        mainWindow.webContents.send('show-update-dialog')
      }
    } else {
      log.info('版本相同或更旧，不提示更新')
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-not-available', {
          version: currentVersion
        })
      }
    }
  })

  autoUpdater.on('update-not-available', (info) => {
    log.info('当前已是最新版本:', info.version)
    if (mainWindow) {
      mainWindow.webContents.send('update-not-available', {
        version: info.version
      })
    }
  })

  autoUpdater.on('error', (error) => {
    log.error('更新错误:', error)
    if (mainWindow) {
      mainWindow.webContents.send('update-error', {
        message: error.message
      })
    }
  })


  autoUpdater.on('update-downloaded', (info) => {
    log.info('更新下载完成:', info.version)
    isDownloadingUpdate = false
    updateDownloaded = true
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes
      })
    }
    
    // 如果之前有挂起的退出请求，现在可以退出了
    if (pendingQuit) {
      log.info('更新下载完成，应用将退出')
      setTimeout(() => {
        app.quit()
      }, 1000)
    }
  })
  
  autoUpdater.on('download-progress', (progressObj) => {
    isDownloadingUpdate = true
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-download-progress', {
        percent: progressObj.percent,
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond
      })
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

// 配置自动更新（在app.whenReady之前）
if (!isDev) {
  // 根据平台设置不同的更新服务器地址
  const platform = process.platform
  let updateUrl = 'http://115.190.106.118/bastion-auth-checker/updates'
  
  if (platform === 'win32') {
    updateUrl = 'http://115.190.106.118/bastion-auth-checker/updates/win'
  } else if (platform === 'linux') {
    updateUrl = 'http://115.190.106.118/bastion-auth-checker/updates/linux'
  }
  
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: updateUrl
  })

  // 禁用自动下载，手动控制
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
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

  // 注册更新相关的IPC handlers
  registerUpdateHandlers()

  // 启动时检查历史文件索引一致性
  checkHistoryIndexConsistency()

  createWindow()

  // 如果不是开发环境，启动后检查更新（不强制更新）
  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        log.error('检查更新失败:', err)
      })
    }, 3000)
  }
  
  // 检查是否有待安装的更新
  checkPendingUpdate()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 更新下载状态
let isDownloadingUpdate = false
let updateDownloaded = false
let pendingQuit = false

// 检查是否有待安装的更新
function checkPendingUpdate() {
  if (!isDev && autoUpdater) {
    // electron-updater 会自动检查是否有已下载的更新
    // 如果有，会在下次启动时自动安装（因为 autoInstallOnAppQuit = true）
  }
}

// 后台下载更新
async function downloadUpdateInBackground() {
  if (isDev || isDownloadingUpdate) return
  
  try {
    log.info('开始后台检查更新...')
    const result = await autoUpdater.checkForUpdates()
    if (result && result.updateInfo) {
      const currentVersion = app.getVersion()
      const remoteVersion = result.updateInfo.version
      
      if (compareVersions(currentVersion, remoteVersion)) {
        log.info('发现新版本，开始后台下载:', remoteVersion)
        isDownloadingUpdate = true
        await autoUpdater.downloadUpdate()
        log.info('后台下载完成')
        updateDownloaded = true
      }
    }
  } catch (error) {
    log.error('后台下载更新失败:', error)
  } finally {
    isDownloadingUpdate = false
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    // 如果正在下载更新，等待下载完成
    if (isDownloadingUpdate) {
      log.info('正在下载更新，等待下载完成...')
      pendingQuit = true
      // 不立即退出，等待下载完成
      return
    }
    
    // 如果没有下载更新，检查是否有更新需要下载
    if (!isDev && !updateDownloaded) {
      log.info('窗口关闭，检查是否有更新需要下载...')
      // 延迟一下，确保窗口已关闭
      setTimeout(async () => {
        await downloadUpdateInBackground()
        if (pendingQuit) {
          app.quit()
        }
      }, 500)
      return
    }
    
    app.quit()
  }
})

// 阻止应用关闭，如果正在下载更新
app.on('before-quit', (event) => {
  if (isDownloadingUpdate && !isDev) {
    event.preventDefault()
    log.info('正在下载更新，阻止应用关闭')
    pendingQuit = true
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
