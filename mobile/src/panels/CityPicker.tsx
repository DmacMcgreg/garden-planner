import { useMemo, useState } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
} from 'react-native'
import { WORLD_CITIES, type CityRecord } from '../cities'
import { C } from '../ui/components'

function label(c: CityRecord): string {
  return c.admin ? `${c.name}, ${c.admin}, ${c.country}` : `${c.name}, ${c.country}`
}

export function CityPicker({
  value,
  onChange,
}: {
  value: CityRecord
  onChange: (c: CityRecord) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return WORLD_CITIES.slice(0, 80)
    const out: CityRecord[] = []
    for (const c of WORLD_CITIES) {
      if (label(c).toLowerCase().includes(s)) {
        out.push(c)
        if (out.length >= 80) break
      }
    }
    return out
  }, [q])

  return (
    <>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={styles.fieldText} numberOfLines={1}>
          {label(value)}
        </Text>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Select City</Text>
            <Pressable onPress={() => setOpen(false)}>
              <Text style={styles.close}>Done</Text>
            </Pressable>
          </View>
          <TextInput
            autoFocus
            placeholder="Search city…"
            placeholderTextColor={C.faint}
            value={q}
            onChangeText={setQ}
            style={styles.search}
          />
          <FlatList
            data={results}
            keyExtractor={(c) => `${c.name}|${c.admin}|${c.country}`}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: c }) => (
              <Pressable
                style={styles.item}
                onPress={() => {
                  onChange(c)
                  setOpen(false)
                  setQ('')
                }}
              >
                <Text style={styles.itemName}>{c.name}</Text>
                <Text style={styles.itemSub}>
                  {c.admin ? `${c.admin}, ` : ''}
                  {c.country} · {c.lat.toFixed(2)}°{c.lat >= 0 ? 'N' : 'S'},{' '}
                  {Math.abs(c.lon).toFixed(2)}°{c.lon >= 0 ? 'E' : 'W'}
                </Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  field: {
    backgroundColor: '#11151f',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  fieldText: { color: C.text, fontSize: 13 },
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
  search: {
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.text,
    fontSize: 15,
    marginBottom: 8,
  },
  item: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  itemName: { color: C.text, fontSize: 14, fontWeight: '600' },
  itemSub: { color: C.sub, fontSize: 11, marginTop: 2 },
})
