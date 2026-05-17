import { useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native'
import {
  PLANT_PRESETS,
  PLANT_CATEGORIES,
  type BedConfig,
  type BedAlert,
  type PlantType,
} from '../types'
import {
  C,
  Section,
  Row,
  Btn,
  NumField,
  TextField,
  Toggle,
  Segmented,
} from '../ui/components'

const SUN_LABEL: Record<BedConfig['sunNeeds'], string> = {
  full: '☀ Full',
  partial: '⛅ Part',
  'shade-tolerant': '☁ Shade',
}

const SWATCHES = [
  '#C62828', '#E65100', '#F9A825', '#2E7D32', '#1B5E20',
  '#00695C', '#4A148C', '#7E57C2', '#AD1457', '#8D6E63',
]

const plantEntries = Object.entries(PLANT_PRESETS) as [PlantType, (typeof PLANT_PRESETS)[PlantType]][]

export function BedPanel({
  beds,
  selectedBedId,
  alerts,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
  onReset,
}: {
  beds: BedConfig[]
  selectedBedId: string | null
  alerts: BedAlert[]
  onSelect: (id: string | null) => void
  onAdd: (t: PlantType) => void
  onUpdate: (id: string, patch: Partial<BedConfig>) => void
  onDelete: (id: string) => void
  onReset: () => void
}) {
  const selected = beds.find((b) => b.id === selectedBedId)
  const [pickOpen, setPickOpen] = useState(false)

  const alertsFor = (id: string) => alerts.filter((a) => a.bedId === id)

  return (
    <Section
      title="Garden Beds"
      right={<Btn label="+ Add" small tone="emerald" onPress={() => setPickOpen(true)} />}
    >
      {beds.length === 0 && (
        <Text style={styles.empty}>No beds yet. Tap “+ Add”.</Text>
      )}
      <View style={{ gap: 4, marginBottom: 8 }}>
        {beds.map((b) => {
          const ba = alertsFor(b.id)
          const on = b.id === selectedBedId
          return (
            <Pressable
              key={b.id}
              onPress={() => onSelect(on ? null : b.id)}
              style={[styles.listItem, on && styles.listItemOn]}
            >
              <View style={[styles.dot, { backgroundColor: b.color }]} />
              <Text style={styles.itemName} numberOfLines={1}>
                {b.name}
              </Text>
              {ba.length > 0 && (
                <Text
                  style={{
                    color: ba.some((a) => a.severity === 'error') ? C.red : C.amber,
                    fontWeight: '900',
                    marginRight: 4,
                  }}
                >
                  !
                </Text>
              )}
              <Text style={styles.itemTag}>{SUN_LABEL[b.sunNeeds]}</Text>
            </Pressable>
          )
        })}
      </View>

      {selected && (
        <View style={styles.editor}>
          <Text style={styles.editTitle}>EDIT: {selected.name}</Text>

          <Text style={styles.lbl}>Name</Text>
          <TextField
            value={selected.name}
            onCommit={(v) => onUpdate(selected.id, { name: v })}
          />

          <Text style={styles.lbl}>Position (X, Z)</Text>
          <Row>
            <NumField
              label="X"
              value={selected.x}
              onCommit={(v) => onUpdate(selected.id, { x: v })}
            />
            <NumField
              label="Z"
              value={selected.z}
              onCommit={(v) => onUpdate(selected.id, { z: v })}
            />
          </Row>

          <Text style={styles.lbl}>Size (W, D) · Rotation</Text>
          <Row>
            <NumField
              label="W"
              value={selected.width}
              onCommit={(v) => onUpdate(selected.id, { width: Math.max(1, v) })}
            />
            <NumField
              label="D"
              value={selected.depth}
              onCommit={(v) => onUpdate(selected.id, { depth: Math.max(1, v) })}
            />
            <NumField
              label="°"
              value={selected.rotation ?? 0}
              onCommit={(v) =>
                onUpdate(selected.id, { rotation: Math.round(v / 45) * 45 })
              }
            />
          </Row>

          {selected.plantType &&
            (() => {
              const p = PLANT_PRESETS[selected.plantType]
              const sp = p.spacingInches / 12
              const cols = Math.floor(selected.width / sp)
              const rows = Math.floor(selected.depth / sp)
              return (
                <Text style={styles.info}>
                  Spacing {p.spacingInches}" ({sp.toFixed(1)}ft) · Fits {cols}×{rows}={cols * rows} ·
                  pH {p.phRange[0]}–{p.phRange[1]}
                </Text>
              )
            })()}

          <Text style={styles.lbl}>Sun Needs</Text>
          <Segmented
            value={selected.sunNeeds}
            onChange={(v) => onUpdate(selected.id, { sunNeeds: v })}
            options={[
              { value: 'full', label: 'Full' },
              { value: 'partial', label: 'Partial' },
              { value: 'shade-tolerant', label: 'Shade' },
            ]}
          />

          <View style={{ height: 8 }} />
          <Row>
            <Toggle
              label="Trellis"
              value={selected.hasTrellis ?? false}
              onChange={(v) =>
                onUpdate(selected.id, {
                  hasTrellis: v,
                  trellisHeight: v ? selected.trellisHeight ?? 5 : undefined,
                })
              }
            />
            {selected.hasTrellis && (
              <NumField
                label="H"
                value={selected.trellisHeight ?? 5}
                width={90}
                onCommit={(v) =>
                  onUpdate(selected.id, { trellisHeight: Math.max(2, v) })
                }
              />
            )}
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

          {alertsFor(selected.id).map((a, i) => (
            <View
              key={i}
              style={[
                styles.alert,
                {
                  backgroundColor: a.severity === 'error' ? '#3b1717' : '#3a2e12',
                  borderColor: a.severity === 'error' ? C.redDk : C.amberDk,
                },
              ]}
            >
              <Text
                style={{
                  color: a.severity === 'error' ? '#fca5a5' : '#fcd34d',
                  fontSize: 11,
                }}
              >
                {a.type === 'sun-exposure' ? '☀ ' : '↔ '}
                {a.message}
              </Text>
            </View>
          ))}

          <View style={{ height: 8 }} />
          <Btn
            label="Delete bed"
            tone="red"
            onPress={() => {
              onDelete(selected.id)
              onSelect(null)
            }}
          />
        </View>
      )}

      <View style={{ height: 8 }} />
      <Btn label="Reset beds" small onPress={onReset} />

      <PlantPickerModal
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        onPick={(t) => {
          onAdd(t)
          setPickOpen(false)
        }}
      />
    </Section>
  )
}

function PlantPickerModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (t: PlantType) => void
}) {
  const data = useMemo(
    () =>
      PLANT_CATEGORIES.flatMap((cat) => [
        { type: 'header' as const, key: cat.key, label: cat.label },
        ...plantEntries
          .filter(([, p]) => p.category === cat.key)
          .map(([key, p]) => ({ type: 'plant' as const, key, preset: p })),
      ]),
    [],
  )
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHead}>
          <Text style={styles.modalTitle}>Add Garden Bed</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.close}>Cancel</Text>
          </Pressable>
        </View>
        <FlatList
          data={data}
          keyExtractor={(d) => d.key}
          renderItem={({ item }) =>
            item.type === 'header' ? (
              <Text style={styles.catHead}>{item.label}</Text>
            ) : (
              <Pressable style={styles.plantItem} onPress={() => onPick(item.key as PlantType)}>
                <View style={[styles.dot, { backgroundColor: item.preset.color }]} />
                <Text style={styles.itemName}>{item.preset.name}</Text>
                <Text style={styles.itemSub}>
                  pH {item.preset.phRange[0]}–{item.preset.phRange[1]} ·{' '}
                  {item.preset.minSunHours}+ PSH
                </Text>
              </Pressable>
            )
          }
        />
      </View>
    </Modal>
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
  info: { color: C.faint, fontSize: 10, marginTop: 4 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  swatch: { width: 26, height: 26, borderRadius: 5, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: '#fff' },
  alert: { borderWidth: 1, borderRadius: 5, padding: 7, marginTop: 6 },
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
  catHead: {
    color: C.amber,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 4,
  },
  plantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  itemSub: { color: C.sub, fontSize: 10 },
})
