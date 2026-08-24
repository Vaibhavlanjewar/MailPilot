import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActiveCall } from '../context/ActiveCallContext';
import { colors } from '../theme/colors';

/**
 * The "still on a call" bubble, drawn above the navigator so it survives
 * moving between screens — the same affordance WhatsApp shows when you leave
 * a call screen without hanging up. Hidden while the room screen itself is
 * focused, since the full call UI is already on screen there.
 */
export default function FloatingCallBubble() {
  const { call } = useActiveCall();
  const insets = useSafeAreaInsets();

  if (!call || call.focused) return null;

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
      <Pressable style={styles.card} onPress={call.onReturn}>
        <View style={styles.thumb}>
          {call.renderThumbnail ? (
            call.renderThumbnail()
          ) : (
            <View style={styles.thumbFallback}>
              <Text style={styles.thumbFallbackText}>●</Text>
            </View>
          )}
        </View>

        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>
            Practice room
          </Text>
          <Text style={styles.label} numberOfLines={1}>
            {call.label} · tap to return
          </Text>
        </View>

        <Pressable
          onPress={call.onLeave}
          hitSlop={8}
          style={styles.leaveButton}
          accessibilityLabel="Leave the call"
        >
          <Text style={styles.leaveText}>End</Text>
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 10,
    width: '92%',
    // Sits above every screen, so it needs its own elevation to avoid being
    // painted under headers or cards on Android.
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  thumb: { width: 46, height: 46, borderRadius: 10, overflow: 'hidden', backgroundColor: '#000' },
  thumbFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  thumbFallbackText: { color: colors.success, fontSize: 16 },
  meta: { flex: 1, minWidth: 0 },
  title: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  label: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  leaveButton: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  leaveText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
