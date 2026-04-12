import { useState, useRef } from 'react'
import type { GardenConfig } from './types'
import { SectionHeader, IconSave } from './SectionHeader'
import {
  loadSavedConfigs,
  saveConfigToStorage,
  deleteConfigFromStorage,
  exportConfigToFile,
  parseConfigFromJson,
  getDefaultConfigName,
  setDefaultConfigName,
  clearDefaultConfig,
} from './types'

interface ConfigPanelProps {
  getCurrentConfig: (name: string) => GardenConfig
  onLoadConfig: (config: GardenConfig) => void
}

export default function ConfigPanel({
  getCurrentConfig,
  onLoadConfig,
}: ConfigPanelProps) {
  const [saveName, setSaveName] = useState('')
  const [configs, setConfigs] = useState(() => loadSavedConfigs())
  const [importError, setImportError] = useState<string | null>(null)
  const [flashMessage, setFlashMessage] = useState<string | null>(null)
  const [defaultName, setDefaultName] = useState<string | null>(() => getDefaultConfigName())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const configNames = Object.keys(configs).sort(
    (a, b) => new Date(configs[b].savedAt).getTime() - new Date(configs[a].savedAt).getTime(),
  )

  function flash(msg: string) {
    setFlashMessage(msg)
    setTimeout(() => setFlashMessage(null), 2000)
  }

  function handleSave() {
    const name = saveName.trim()
    if (!name) return
    const config = getCurrentConfig(name)
    saveConfigToStorage(config)
    setConfigs(loadSavedConfigs())
    setSaveName('')
    flash(`Saved "${name}"`)
  }

  function handleOverwrite(name: string) {
    const config = getCurrentConfig(name)
    saveConfigToStorage(config)
    setConfigs(loadSavedConfigs())
    flash(`Updated "${name}"`)
  }

  function handleLoad(name: string) {
    const config = configs[name]
    if (!config) return
    onLoadConfig(config)
    flash(`Loaded "${name}"`)
  }

  function handleDelete(name: string) {
    deleteConfigFromStorage(name)
    setConfigs(loadSavedConfigs())
    if (defaultName === name) setDefaultName(null)
  }

  function handleToggleDefault(name: string) {
    if (defaultName === name) {
      clearDefaultConfig()
      setDefaultName(null)
      flash('Cleared default')
    } else {
      setDefaultConfigName(name)
      setDefaultName(name)
      flash(`"${name}" set as default`)
    }
  }

  function handleExport(name: string) {
    const config = configs[name]
    if (config) exportConfigToFile(config)
  }

  function handleExportCurrent() {
    const name = saveName.trim() || 'garden-config'
    const config = getCurrentConfig(name)
    exportConfigToFile(config)
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError(null)
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const config = parseConfigFromJson(reader.result as string)
      if (!config) {
        setImportError('Invalid config file')
        return
      }
      onLoadConfig(config)
      saveConfigToStorage(config)
      setConfigs(loadSavedConfigs())
      flash(`Imported "${config.name}"`)
    }
    reader.readAsText(file)
    // Reset so the same file can be re-imported
    e.target.value = ''
  }

  return (
    <section className="px-4 py-3">
      <SectionHeader icon={<IconSave />} title="Save / Load" />

      {/* Flash message */}
      {flashMessage && (
        <div className="mb-2 px-2 py-1 bg-emerald-900/50 border border-emerald-700/50 rounded text-[10px] text-emerald-300">
          {flashMessage}
        </div>
      )}

      {/* Save current */}
      <div className="flex gap-1.5 mb-2">
        <input
          type="text"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="Config name..."
          className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
        />
        <button
          onClick={handleSave}
          disabled={!saveName.trim()}
          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 rounded text-xs font-medium transition-colors"
        >
          Save
        </button>
      </div>

      {/* Import / Export current buttons */}
      <div className="flex gap-1.5 mb-3">
        <button
          onClick={handleImportClick}
          className="flex-1 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300 font-medium transition-colors"
        >
          Import JSON
        </button>
        <button
          onClick={handleExportCurrent}
          className="flex-1 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300 font-medium transition-colors"
        >
          Export JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {importError && (
        <div className="mb-2 px-2 py-1 bg-red-900/40 border border-red-700/40 rounded text-[10px] text-red-300">
          {importError}
        </div>
      )}

      {/* Saved configs list */}
      {configNames.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {configNames.map((name) => {
            const cfg = configs[name]
            const isDefault = defaultName === name
            const date = new Date(cfg.savedAt)
            const dateStr = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            return (
              <div
                key={name}
                className={`bg-gray-800 border rounded px-2.5 py-1.5 group ${
                  isDefault ? 'border-amber-600/60' : 'border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium truncate flex items-center gap-1.5">
                    {name}
                    {isDefault && (
                      <span className="text-[8px] font-semibold text-amber-400 bg-amber-900/40 px-1 py-px rounded">
                        DEFAULT
                      </span>
                    )}
                  </span>
                  <span className="text-[9px] text-gray-500 flex-shrink-0 ml-2">
                    {dateStr}
                  </span>
                </div>
                <div className="flex gap-1 mt-1">
                  <button
                    onClick={() => handleLoad(name)}
                    className="flex-1 px-1.5 py-0.5 bg-emerald-800/50 hover:bg-emerald-700/50 rounded text-[10px] text-emerald-300 font-medium transition-colors"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => handleOverwrite(name)}
                    className="px-1.5 py-0.5 bg-blue-800/50 hover:bg-blue-700/50 rounded text-[10px] text-blue-300 font-medium transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => handleToggleDefault(name)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      isDefault
                        ? 'bg-amber-800/50 hover:bg-amber-700/50 text-amber-300'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                  >
                    {isDefault ? 'Unset' : 'Default'}
                  </button>
                  <button
                    onClick={() => handleExport(name)}
                    className="px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-[10px] text-gray-300 transition-colors"
                  >
                    Export
                  </button>
                  <button
                    onClick={() => handleDelete(name)}
                    className="px-1.5 py-0.5 bg-red-900/40 hover:bg-red-800/50 rounded text-[10px] text-red-300 transition-colors"
                  >
                    Del
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {configNames.length === 0 && (
        <p className="text-[10px] text-gray-500">
          No saved configurations yet
        </p>
      )}
    </section>
  )
}
