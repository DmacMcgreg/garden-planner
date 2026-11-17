import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { loadDefaultConfig, loadSavedConfigs, parseConfigFromJson, saveConfigToStorage } from './types'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root')!)

async function openGarden() {
  const name = new URLSearchParams(window.location.search).get('garden')
  if (!name) {
    root.render(<React.StrictMode><App initialConfig={loadDefaultConfig()} /></React.StrictMode>)
    return
  }
  try {
    const response = await fetch('/local-garden.json')
    const config = response.ok ? parseConfigFromJson(await response.text()) : null
    if (config?.name === name) {
      try {
        if (!Object.prototype.hasOwnProperty.call(loadSavedConfigs(), name)) saveConfigToStorage(config)
      } catch {
        // The file can still open when the browser has no storage space.
      }
      root.render(<React.StrictMode><App initialConfig={config} fromBackup /></React.StrictMode>)
      return
    }
  } catch {
    // Keep the recovery action available if the local preview is offline.
  }
  root.render(<main className="p-6"><h1>Garden backup unavailable</h1>
    <p>Open the local preview that holds this backup, or import its JSON file under Save &amp; load.</p>
    <a href="/">Open planner</a></main>)
}

void openGarden()
