import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  Alert,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import type { GardenConfig } from '../types'
import { parseConfigFromJson } from '../types'
import {
  loadSavedConfigs,
  saveConfigToStorage,
  deleteConfigFromStorage,
  getDefaultConfigName,
  setDefaultConfigName,
  clearDefaultConfig,
} from '../storage'
import { C, Section, Row, Btn } from '../ui/components'

export function ConfigPanel({
  getCurrentConfig,
  onLoadConfig,
}: {
  getCurrentConfig: (name: string) => GardenConfig
  onLoadConfig: (c: GardenConfig) => void
}) {
  const [saveName, setSaveName] = useState('')
  const [configs, setConfigs] = useState<Record<string, GardenConfig>>({})
  const [defaultName, setDefaultName] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')

  const refresh = useCallback(async () => {
    setConfigs(await loadSavedConfigs())
    setDefaultName(await getDefaultConfigName())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const note = (m: string) => {
    setFlash(m)
    setTimeout(() => setFlash(null), 2000)
  }

  const names = Object.keys(configs).sort(
    (a, b) =>
      new Date(configs[b].savedAt).getTime() -
      new Date(configs[a].savedAt).getTime(),
  )

  async function handleSave(name: string) {
    const n = name.trim()
    if (!n) return
    await saveConfigToStorage(getCurrentConfig(n))
    setSaveName('')
    await refresh()
    note(`Saved “${n}”`)
  }

  async function handleDelete(name: string) {
    await deleteConfigFromStorage(name)
    await refresh()
  }

  async function handleToggleDefault(name: string) {
    if (defaultName === name) {
      await clearDefaultConfig()
      note('Cleared default')
    } else {
      await setDefaultConfigName(name)
      note(`“${name}” is default`)
    }
    await refresh()
  }

  async function handleExport(name: string) {
    const cfg = configs[name]
    if (!cfg) return
    await Clipboard.setStringAsync(JSON.stringify(cfg, null, 2))
    note('JSON copied to clipboard')
  }

  function handleImport() {
    const cfg = parseConfigFromJson(importText)
    if (!cfg) {
      Alert.alert('Import failed', 'Could not parse a valid garden config JSON.')
      return
    }
    onLoadConfig(cfg)
    saveConfigToStorage(cfg).then(refresh)
    setImportOpen(false)
    setImportText('')
    note(`Imported “${cfg.name}”`)
  }

  return (
    <Section title="Save / Load">
      {flash && (
        <View style={styles.flash}>
          <Text style={styles.flashText}>{flash}</Text>
        </View>
      )}

      <Row style={{ marginBottom: 8 }}>
        <TextInput
          value={saveName}
          onChangeText={setSaveName}
          placeholder="Config name…"
          placeholderTextColor={C.faint}
          style={styles.input}
        />
        <Btn label="Save" tone="emerald" onPress={() => handleSave(saveName)} />
      </Row>

      <Row style={{ marginBottom: 8 }}>
        <Btn label="Import JSON" flex onPress={() => setImportOpen(true)} />
        <Btn
          label="Copy current"
          flex
          onPress={async () => {
            await Clipboard.setStringAsync(
              JSON.stringify(getCurrentConfig(saveName.trim() || 'garden-config'), null, 2),
            )
            note('Current copied to clipboard')
          }}
        />
      </Row>

      {names.length === 0 && (
        <Text style={styles.empty}>No saved configurations yet</Text>
      )}
      <View style={{ gap: 6 }}>
        {names.map((name) => {
          const cfg = configs[name]
          const isDef = defaultName === name
          const d = new Date(cfg.savedAt)
          return (
            <View
              key={name}
              style={[styles.card, isDef && { borderColor: C.amber }]}
            >
              <View style={styles.cardHead}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {name}
                  {isDef ? '  ★' : ''}
                </Text>
                <Text style={styles.cardDate}>
                  {d.toLocaleDateString()}{' '}
                  {d.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <Row style={{ marginTop: 6 }}>
                <Btn
                  label="Load"
                  flex
                  small
                  tone="emerald"
                  onPress={() => {
                    onLoadConfig(cfg)
                    note(`Loaded “${name}”`)
                  }}
                />
                <Btn label="Save" small onPress={() => handleSave(name)} />
                <Btn
                  label={isDef ? 'Unset' : 'Default'}
                  small
                  active={isDef}
                  tone="amber"
                  onPress={() => handleToggleDefault(name)}
                />
                <Btn label="Copy" small onPress={() => handleExport(name)} />
                <Btn
                  label="Del"
                  small
                  tone="red"
                  onPress={() => handleDelete(name)}
                />
              </Row>
            </View>
          )
        })}
      </View>

      <Modal
        visible={importOpen}
        animationType="slide"
        onRequestClose={() => setImportOpen(false)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Import Config JSON</Text>
            <Pressable onPress={() => setImportOpen(false)}>
              <Text style={styles.close}>Cancel</Text>
            </Pressable>
          </View>
          <Row style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <Btn
              label="Paste from clipboard"
              flex
              onPress={async () => setImportText(await Clipboard.getStringAsync())}
            />
          </Row>
          <TextInput
            value={importText}
            onChangeText={setImportText}
            multiline
            placeholder="Paste config JSON here…"
            placeholderTextColor={C.faint}
            style={styles.jsonBox}
          />
          <View style={{ padding: 16 }}>
            <Btn label="Import" tone="emerald" onPress={handleImport} />
          </View>
        </View>
      </Modal>
    </Section>
  )
}

const styles = StyleSheet.create({
  flash: {
    backgroundColor: '#0d2e22',
    borderColor: C.emeraldDk,
    borderWidth: 1,
    borderRadius: 5,
    padding: 7,
    marginBottom: 8,
  },
  flashText: { color: '#6ee7b7', fontSize: 11 },
  input: {
    flex: 1,
    backgroundColor: '#11151f',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: C.text,
    fontSize: 13,
  },
  empty: { color: C.faint, fontSize: 11 },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 10,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: { color: C.text, fontSize: 13, fontWeight: '600', flex: 1 },
  cardDate: { color: C.faint, fontSize: 9, marginLeft: 8 },
  modal: { flex: 1, backgroundColor: C.bg, paddingTop: 50 },
  modalHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  close: { color: C.emerald, fontSize: 15, fontWeight: '600' },
  jsonBox: {
    flex: 1,
    marginHorizontal: 16,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 12,
    color: C.text,
    fontSize: 12,
    textAlignVertical: 'top',
  },
})
