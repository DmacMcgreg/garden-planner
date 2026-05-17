import AsyncStorage from '@react-native-async-storage/async-storage'
import type { GardenConfig } from './types'

const STORAGE_KEY = 'garden-planner-configs'
const DEFAULT_CONFIG_KEY = 'garden-planner-default'

export async function loadSavedConfigs(): Promise<Record<string, GardenConfig>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, GardenConfig>
  } catch {
    return {}
  }
}

export async function saveConfigToStorage(config: GardenConfig): Promise<void> {
  const all = await loadSavedConfigs()
  all[config.name] = config
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export async function deleteConfigFromStorage(name: string): Promise<void> {
  const all = await loadSavedConfigs()
  delete all[name]
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  if ((await getDefaultConfigName()) === name) {
    await clearDefaultConfig()
  }
}

export async function getDefaultConfigName(): Promise<string | null> {
  return AsyncStorage.getItem(DEFAULT_CONFIG_KEY)
}

export async function setDefaultConfigName(name: string): Promise<void> {
  await AsyncStorage.setItem(DEFAULT_CONFIG_KEY, name)
}

export async function clearDefaultConfig(): Promise<void> {
  await AsyncStorage.removeItem(DEFAULT_CONFIG_KEY)
}

export async function loadDefaultConfig(): Promise<GardenConfig | null> {
  const name = await getDefaultConfigName()
  if (!name) return null
  const all = await loadSavedConfigs()
  return all[name] ?? null
}
