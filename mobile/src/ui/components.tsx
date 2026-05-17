import { ReactNode } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ViewStyle,
} from 'react-native'
import Slider from '@react-native-community/slider'

export const C = {
  bg: '#161a24',
  panel: '#1e2330',
  panel2: '#262c3b',
  card: '#2b3242',
  border: '#3a4254',
  text: '#e5e7eb',
  sub: '#9ca3af',
  faint: '#6b7280',
  emerald: '#10b981',
  emeraldDk: '#065f46',
  amber: '#f59e0b',
  amberDk: '#92400e',
  red: '#ef4444',
  redDk: '#7f1d1d',
  cyan: '#22d3ee',
  blue: '#3b82f6',
}

export function Section({
  title,
  right,
  children,
}: {
  title: string
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
        {right}
      </View>
      {children}
    </View>
  )
}

export function Row({
  children,
  style,
}: {
  children: ReactNode
  style?: ViewStyle
}) {
  return <View style={[styles.row, style]}>{children}</View>
}

export function Btn({
  label,
  onPress,
  active,
  tone = 'default',
  flex,
  small,
}: {
  label: string
  onPress: () => void
  active?: boolean
  tone?: 'default' | 'emerald' | 'amber' | 'red'
  flex?: boolean
  small?: boolean
}) {
  const bg = active
    ? tone === 'amber'
      ? C.amber
      : tone === 'red'
        ? C.red
        : C.emerald
    : tone === 'emerald'
      ? C.emeraldDk
      : tone === 'red'
        ? C.redDk
        : C.card
  const fg = active ? '#0b0f17' : C.text
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.btn,
        { backgroundColor: bg },
        flex && { flex: 1 },
        small && { paddingVertical: 5 },
      ]}
    >
      <Text style={[styles.btnText, { color: fg }, small && { fontSize: 11 }]}>
        {label}
      </Text>
    </Pressable>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, on && { backgroundColor: C.emerald }]}
          >
            <Text style={[styles.segText, on && { color: '#0b0f17' }]}>
              {o.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  display: string
}) {
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={styles.sliderHead}>
        <Text style={styles.smallLabel}>{label}</Text>
        <Text style={styles.mono}>{display}</Text>
      </View>
      <Slider
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={C.emerald}
        maximumTrackTintColor={C.border}
        thumbTintColor={C.emerald}
      />
    </View>
  )
}

export function NumField({
  label,
  value,
  onCommit,
  width,
}: {
  label: string
  value: number
  onCommit: (v: number) => void
  width?: number
}) {
  return (
    <View style={[styles.numWrap, width ? { width } : { flex: 1 }]}>
      <Text style={styles.numLabel}>{label}</Text>
      <TextInput
        defaultValue={String(value)}
        key={String(value)}
        keyboardType="numbers-and-punctuation"
        style={styles.numInput}
        onEndEditing={(e) => {
          const v = parseFloat(e.nativeEvent.text)
          onCommit(Number.isFinite(v) ? v : value)
        }}
      />
    </View>
  )
}

export function TextField({
  value,
  onCommit,
  placeholder,
}: {
  value: string
  onCommit: (v: string) => void
  placeholder?: string
}) {
  return (
    <TextInput
      defaultValue={value}
      key={value}
      placeholder={placeholder}
      placeholderTextColor={C.faint}
      style={styles.textInput}
      onEndEditing={(e) => onCommit(e.nativeEvent.text)}
    />
  )
}

export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <Pressable style={styles.toggle} onPress={() => onChange(!value)}>
      <View style={[styles.checkbox, value && { backgroundColor: C.emerald }]}>
        {value && <Text style={styles.checkMark}>✓</Text>}
      </View>
      <Text style={styles.smallLabel}>{label}</Text>
    </Pressable>
  )
}

export function Divider() {
  return <View style={styles.divider} />
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 14, paddingVertical: 12 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.sub,
    letterSpacing: 1,
  },
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnText: { fontSize: 12, fontWeight: '600' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  segItem: { flex: 1, paddingVertical: 7, alignItems: 'center' },
  segText: { fontSize: 11, fontWeight: '600', color: C.sub },
  sliderHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  smallLabel: { fontSize: 11, color: C.sub },
  mono: { fontSize: 11, color: C.text, fontVariant: ['tabular-nums'] },
  numWrap: {
    backgroundColor: '#11151f',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  numLabel: { fontSize: 10, color: C.faint },
  numInput: { flex: 1, color: C.text, fontSize: 12, paddingVertical: 6 },
  textInput: {
    backgroundColor: '#11151f',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 7,
    color: C.text,
    fontSize: 13,
  },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#0b0f17', fontSize: 12, fontWeight: '900' },
  divider: { height: 1, backgroundColor: C.border, marginHorizontal: 14 },
})
