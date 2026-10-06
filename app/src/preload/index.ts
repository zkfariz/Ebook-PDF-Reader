import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC, type Api } from '@shared/ipc'

const api: Api = {
  app: {
    systemTheme: () => ipcRenderer.invoke(IPC.appSystemTheme)
  },
  files: {
    openDialog: () => ipcRenderer.invoke(IPC.filesOpenDialog),
    readBook: (path) => ipcRenderer.invoke(IPC.filesReadBook, path),
    getPathForFile: (file) => webUtils.getPathForFile(file as Parameters<typeof webUtils.getPathForFile>[0]),
    takeOpenRequest: () => ipcRenderer.invoke(IPC.filesTakeOpenRequest),
    onOpenRequested: (cb) => {
      const listener = () => cb()
      ipcRenderer.on(IPC.filesOpenRequested, listener)
      return () => ipcRenderer.off(IPC.filesOpenRequested, listener)
    }
  },
  library: {
    list: () => ipcRenderer.invoke(IPC.libraryList),
    upsert: (entry) => ipcRenderer.invoke(IPC.libraryUpsert, entry),
    remove: (bookId) => ipcRenderer.invoke(IPC.libraryRemove, bookId),
    locate: (bookId) => ipcRenderer.invoke(IPC.libraryLocate, bookId),
    rekey: (bookId, path) => ipcRenderer.invoke(IPC.libraryRekey, bookId, path)
  },
  bookData: {
    get: (bookId) => ipcRenderer.invoke(IPC.bookDataGet, bookId),
    put: (bookId, data) => ipcRenderer.invoke(IPC.bookDataPut, bookId, data)
  },
  ocr: {
    get: (bookId) => ipcRenderer.invoke(IPC.ocrGet, bookId),
    putPage: (bookId, page, lines) => ipcRenderer.invoke(IPC.ocrPutPage, bookId, page, lines)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    set: (patch) => ipcRenderer.invoke(IPC.settingsSet, patch)
  },
  clipboard: {
    writeText: (text) => ipcRenderer.invoke(IPC.clipboardWriteText, text)
  },
  win: {
    setFullScreen: (on) => ipcRenderer.invoke(IPC.winSetFullScreen, on),
    onFullScreenChange: (cb) => {
      const listener = (_e: Electron.IpcRendererEvent, on: unknown) => cb(on === true)
      ipcRenderer.on(IPC.winFullScreenChanged, listener)
      return () => ipcRenderer.off(IPC.winFullScreenChanged, listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
