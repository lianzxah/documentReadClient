/**
 * Electron main process for Document Reader.
 *
 * Responsibilities:
 * 1. Find a free port and start the backend server as a child process.
 * 2. Wait for the backend to become healthy (/healthz).
 * 3. Create the BrowserWindow and load the frontend.
 * 4. Manage the system tray (hide-to-tray on close, right-click menu).
 * 5. Support auto-launch at login.
 * 6. Cleanly kill the backend on quit.
 */
'use strict'

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  dialog,
} = require('electron')
const { fork, spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const http = require('http')

// get-port is ESM-only; we dynamic-import it.
let getPort

// ─── State ──────────────────────────────────────────────────────────────────

let mainWindow = null
let tray = null
let serverProcess = null
let serverPort = null
let isQuitting = false

const isDev = !app.isPackaged

// ─── Paths ──────────────────────────────────────────────────────────────────

function getDataDir() {
  if (isDev) {
    // In dev mode, use the same .data directory the server already uses.
    return path.join(__dirname, '..', 'server', '.data')
  }
  // In production, store data in the OS user-data directory so it persists
  // across application updates.
  const dir = path.join(app.getPath('userData'), 'data')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function getWebDir() {
  if (isDev) {
    return path.join(__dirname, '..', 'web', 'dist')
  }
  return path.join(process.resourcesPath, 'web', 'dist')
}

function getIconPath() {
  return path.join(__dirname, 'build', 'icon.png')
}

function getTrayIconPath() {
  // macOS: use template images (system auto-applies dark/light mode tinting).
  if (process.platform === 'darwin') {
    const tpl = path.join(__dirname, 'build', 'iconTemplate.png')
    if (fs.existsSync(tpl)) return tpl
  }
  return getIconPath()
}

// ─── Server Lifecycle ───────────────────────────────────────────────────────

async function startServer() {
  getPort = (await import('get-port')).default
  serverPort = await getPort({ port: 8787 })

  const dataDir = getDataDir()
  const env = {
    ...process.env,
    PORT: String(serverPort),
    HOST: '127.0.0.1',
    DATA_DIR: dataDir,
    LANCEDB_PATH: path.join(dataDir, 'lancedb'),
  }

  if (isDev) {
    // In development, use tsx to run TypeScript directly.
    const serverEntry = path.join(__dirname, '..', 'server', 'src', 'index.ts')
    // Resolve tsx binary path to avoid shell:true (DEP0190 warning).
    const tsxBin = path.join(
      __dirname,
      '..',
      'server',
      'node_modules',
      '.bin',
      'tsx',
    )
    serverProcess = spawn(tsxBin, [serverEntry], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '..', 'server'),
    })
  } else {
    // In production, the compiled JS is bundled as an extra resource.
    const serverEntry = path.join(process.resourcesPath, 'server', 'index.js')
    serverProcess = fork(serverEntry, [], {
      env,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      cwd: path.join(process.resourcesPath, 'server'),
    })
  }

  // Pipe server stdout/stderr to main process console for debugging.
  if (serverProcess.stdout) {
    serverProcess.stdout.on('data', (d) =>
      process.stdout.write(`[server] ${d}`),
    )
  }
  if (serverProcess.stderr) {
    serverProcess.stderr.on('data', (d) =>
      process.stderr.write(`[server:err] ${d}`),
    )
  }

  serverProcess.on('exit', (code) => {
    console.log(`[main] Server process exited with code ${code}`)
    serverProcess = null
  })

  // Wait until the health endpoint responds.
  await waitForServer(serverPort)
  console.log(`[main] Server is ready on port ${serverPort}`)
}

function waitForServer(port, timeout = 30000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() - start > timeout) {
        return reject(new Error('Server startup timed out'))
      }
      const req = http.get(`http://127.0.0.1:${port}/healthz`, (res) => {
        if (res.statusCode === 200) {
          resolve()
        } else {
          setTimeout(check, 300)
        }
      })
      req.on('error', () => setTimeout(check, 300))
      req.end()
    }
    check()
  })
}

function killServer() {
  if (!serverProcess) return
  console.log('[main] Killing server process...')
  try {
    // On Windows, tree-kill behavior differs; process.kill works for fork/spawn.
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(serverProcess.pid), '/f', '/t'])
    } else {
      serverProcess.kill('SIGTERM')
    }
  } catch (e) {
    console.error('[main] Failed to kill server:', e)
  }
  serverProcess = null
}

// ─── Window ─────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Document Reader',
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--api-port=${serverPort}`],
    },
    show: false, // Show after ready-to-show to avoid white flash.
  })

  // Load the frontend.
  const webDir = getWebDir()
  const indexPath = path.join(webDir, 'index.html')

  if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath)
  } else if (isDev) {
    // Fallback: if web hasn't been built yet, try the Vite dev server.
    mainWindow.loadURL('http://localhost:5173')
  } else {
    dialog.showErrorBox(
      'Error',
      `Frontend not found at ${indexPath}. Please rebuild the application.`,
    )
    app.quit()
    return
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (isDev) {
      mainWindow.webContents.openDevTools()
    }
  })

  // Hide instead of close (tray mode).
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })
}

// ─── Tray ───────────────────────────────────────────────────────────────────

function createTray() {
  const iconPath = getTrayIconPath()
  let trayIcon = nativeImage.createFromPath(iconPath)

  // macOS template images: 16x16 or 18x18, marked as template.
  if (process.platform === 'darwin') {
    trayIcon = trayIcon.resize({ width: 18, height: 18 })
    trayIcon.setTemplateImage(true)
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('Document Reader')

  const contextMenu = buildTrayMenu()
  tray.setContextMenu(contextMenu)

  // Click on tray icon shows the window (mainly for Windows/Linux).
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.focus() : mainWindow.show()
    }
  })
}

function buildTrayMenu() {
  const loginSettings = app.getLoginItemSettings()
  return Menu.buildFromTemplate([
    {
      label: '打开主界面',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: '开机自启动',
      type: 'checkbox',
      checked: loginSettings.openAtLogin,
      click: (menuItem) => {
        app.setLoginItemSettings({
          openAtLogin: menuItem.checked,
          openAsHidden: true,
        })
      },
    },
    { type: 'separator' },
    {
      label: '退出应用',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])
}

// ─── App Lifecycle ──────────────────────────────────────────────────────────

// Prevent multiple instances.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    try {
      await startServer()
    } catch (e) {
      console.error('[main] Failed to start server:', e)
      dialog.showErrorBox('启动失败', `后端服务启动失败: ${e.message}`)
      app.quit()
      return
    }

    createWindow()
    createTray()

    // macOS: re-create window when dock icon is clicked.
    app.on('activate', () => {
      if (mainWindow) {
        mainWindow.show()
      }
    })
  })

  app.on('before-quit', () => {
    isQuitting = true
  })

  app.on('will-quit', () => {
    killServer()
  })

  // Ensure clean exit on uncaught errors.
  process.on('uncaughtException', (err) => {
    console.error('[main] Uncaught exception:', err)
    killServer()
    app.quit()
  })
}
