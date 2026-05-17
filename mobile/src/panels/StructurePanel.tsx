import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { Structure, StructureType } from '../types'
import {
  C,
  Section,
  Row,
  Btn,
  NumField,
  TextField,
  Toggle,
} from '../ui/components'

const SWATCHES = ['#607d8b', '#8d6e63', '#9e9e9e', '#795548', '#546e7a', '#455a64']

export function StructurePanel({
  structures,
  selectedId,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
  onReset,
}: {
  structures: Structure[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onAdd: (t: StructureType) => void
  onUpdate: (id: string, patch: Partial<Structure>) => void
  onDelete: (id: string) => void
  onReset: () => void
}) {
  const selected = structures.find((s) => s.id === selectedId)
  return (
    <Section title="Structures">
      {structures.length === 0 && (
        <Text style={styles.empty}>No structures yet.</Text>
      )}
      <View style={{ gap: 4, marginBottom: 8 }}>
        {structures.map((s) => {
          const on = s.id === selectedId
          return (
            <Pressable
              key={s.id}
              onPress={() => onSelect(on ? null : s.id)}
              style={[styles.listItem, on && styles.listItemOn]}
            >
              <View style={[styles.dot, { backgroundColor: s.color }]} />
              <Text style={styles.itemName} numberOfLines={1}>
                {s.name}
              </Text>
              <Text style={styles.itemTag}>
                {s.type === 'building' ? 'BLD' : 'FNC'}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <Row style={{ marginBottom: 8 }}>
        <Btn label="+ Building" flex onPress={() => onAdd('building')} />
        <Btn label="+ Fence" flex onPress={() => onAdd('fence')} />
      </Row>

      {selected && (
        <View style={styles.editor}>
          <Text style={styles.editTitle}>EDIT: {selected.name}</Text>

          <Text style={styles.lbl}>Name</Text>
          <TextField
            value={selected.name}
            onCommit={(v) => onUpdate(selected.id, { name: v })}
          />

          <Text style={styles.lbl}>Position (X, Y, Z)</Text>
          <Row>
            {(['X', 'Y', 'Z'] as const).map((ax, i) => (
              <NumField
                key={ax}
                label={ax}
                value={selected.position[i]}
                onCommit={(v) => {
                  const pos: [number, number, number] = [...selected.position]
                  pos[i] = v
                  onUpdate(selected.id, { position: pos })
                }}
              />
            ))}
          </Row>

          <Text style={styles.lbl}>Size (W, H, D)</Text>
          <Row>
            {(['W', 'H', 'D'] as const).map((ax, i) => (
              <NumField
                key={ax}
                label={ax}
                value={selected.size[i]}
                onCommit={(v) => {
                  const size: [number, number, number] = [...selected.size]
                  size[i] = Math.max(0.1, v)
                  onUpdate(selected.id, { size })
                }}
              />
            ))}
          </Row>

          <Text style={styles.lbl}>Color</Text>
          <View style={styles.swatchRow}>
            {SWATCHES.map((s) => (
              <Pressable
                key={s}
                onPress={() => onUpdate(selected.id, { color: s })}
                style={[
                  styles.swatch,
                  { backgroundColor: s },
                  selected.color === s && styles.swatchOn,
                ]}
              />
            ))}
          </View>

          <View style={{ height: 8 }} />
          <Row>
            <Toggle
              label="Cast shadow"
              value={selected.castShadow}
              onChange={(v) => onUpdate(selected.id, { castShadow: v })}
            />
          </Row>
          <View style={{ height: 4 }} />
          <Row>
            <Toggle
              label="Receive shadow"
              value={selected.receiveShadow}
              onChange={(v) => onUpdate(selected.id, { receiveShadow: v })}
            />
          </Row>

          <View style={{ height: 8 }} />
          <Btn
            label="Delete structure"
            tone="red"
            onPress={() => {
              onDelete(selected.id)
              onSelect(null)
            }}
          />
        </View>
      )}

      <View style={{ height: 8 }} />
      <Btn label="Reset structures" small onPress={onReset} />
    </Section>
  )
}

const styles = StyleSheet.create({
  empty: { color: C.faint, fontSize: 11, fontStyle: 'italic', marginBottom: 6 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  listItemOn: { borderColor: C.emerald, backgroundColor: '#13312a' },
  dot: { width: 11, height: 11, borderRadius: 3 },
  itemName: { color: C.text, fontSize: 13, fontWeight: '600', flex: 1 },
  itemTag: { color: C.sub, fontSize: 10 },
  editor: {
    backgroundColor: C.panel2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  editTitle: {
    color: C.sub,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  lbl: { color: C.faint, fontSize: 10, marginTop: 6, marginBottom: 2 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  swatch: {
    width: 26,
    height: 26,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchOn: { borderColor: '#fff' },
})
