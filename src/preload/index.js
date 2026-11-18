import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  yt: {
    checkDeps: () => ipcRenderer.invoke('yt:deps'),
    getPresets: () => ipcRenderer.invoke('yt:presets'),
    getInfo: (url) => ipcRenderer.invoke('yt:info', url),
    start: (req) => ipcRenderer.invoke('yt:start', req), // { jobId, url, presetId }
    cancel: (jobId) => ipcRenderer.invoke('yt:cancel', jobId),
    showInFolder: (filePath) => ipcRenderer.invoke('yt:show', filePath),
    openDownloads: () => ipcRenderer.invoke('yt:open-downloads'),
    onProgress: (cb) => {
      const handler = (_e, payload) => cb(payload)
      ipcRenderer.on('yt:progress', handler)
      return () => ipcRenderer.removeListener('yt:progress', handler) // เรียกเพื่อเลิกฟัง
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
