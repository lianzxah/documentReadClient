/**
 * Electron preload script.
 *
 * Runs in the renderer process BEFORE the web page loads.
 * Injects the backend API base URL (with the dynamically allocated port)
 * so the frontend can make requests to the local Fastify server.
 *
 * The port is passed from the main process via additionalArguments:
 *   webPreferences.additionalArguments = ['--api-port=XXXXX']
 */
'use strict'

const { contextBridge } = require('electron')

// Parse the --api-port=XXXXX argument passed from the main process.
const portArg = process.argv.find((arg) => arg.startsWith('--api-port='))
const port = portArg ? portArg.split('=')[1] : '8787'

// Expose the API base URL as a global variable that api.js reads.
contextBridge.exposeInMainWorld(
  '__ELECTRON_API_BASE__',
  `http://127.0.0.1:${port}`,
)
