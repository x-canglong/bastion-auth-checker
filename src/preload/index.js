import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// 扩展 electronAPI，添加 ipcRenderer
const extendedElectronAPI = {
  ...electronAPI,
  ipcRenderer: {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    on: (channel, func) => {
      ipcRenderer.on(channel, func)
      // 返回清理函数
      return () => ipcRenderer.removeListener(channel, func)
    },
    removeListener: (channel, func) => ipcRenderer.removeListener(channel, func)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
try {
  // 尝试使用 contextBridge（context isolation 启用时）
  if (typeof contextBridge !== 'undefined') {
    contextBridge.exposeInMainWorld('electron', extendedElectronAPI)
  } else {
    // Fallback for non-isolated context
    window.electron = extendedElectronAPI
  }
} catch (error) {
  // 如果 contextBridge 失败，直接设置到 window
  console.error('Failed to expose APIs via contextBridge:', error)
  window.electron = extendedElectronAPI
}
