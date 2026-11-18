import { app, ipcMain, shell } from 'electron'
import { resolve, sep } from 'node:path'
import { cancelAll, cancelDownload, checkDeps, getInfo, startDownload } from './downloader.js'
import { publicPresets } from './presets.js'

export function registerIpc() {
  ipcMain.handle('yt:deps', () => checkDeps())
  ipcMain.handle('yt:presets', () => publicPresets())
  ipcMain.handle('yt:info', (_e, url) => getInfo(url))

  ipcMain.handle('yt:start', (e, req) =>
    startDownload(req ?? {}, (p) => {
      if (!e.sender.isDestroyed()) e.sender.send('yt:progress', p)
    })
  )

  ipcMain.handle('yt:cancel', (_e, jobId) => cancelDownload(jobId))

  // เปิดได้เฉพาะไฟล์ในโฟลเดอร์ Downloads เท่านั้น
  ipcMain.handle('yt:show', (_e, filePath) => {
    const dir = resolve(app.getPath('downloads')) + sep
    const target = resolve(String(filePath ?? ''))
    if (!target.startsWith(dir)) return false
    shell.showItemInFolder(target)
    return true
  })

  ipcMain.handle('yt:open-downloads', () => shell.openPath(app.getPath('downloads')))

  app.on('before-quit', cancelAll)
}
