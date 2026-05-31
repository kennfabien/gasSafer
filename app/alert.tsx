import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Linking, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, GAS_THRESHOLD } from '../constants';
import { subscribeToGasLevel } from '../services/firebase';
import React from 'react';

export default function AlertScreen() {
  const [ppm, setPpm] = useState<number | null>(null);
  const [triggeredAt] = useState(
    new Date().toLocaleTimeString('en-RW', {
      timeZone: 'Africa/Kigali',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  );

  useEffect(() => {
    const unsubscribe = subscribeToGasLevel((newPpm) => {
      setPpm(newPpm);
      // Auto-dismiss if gas returns to safe level
      if (newPpm < GAS_THRESHOLD) {
        Alert.alert(
          '✓ Gas level is safe',
          `Level dropped to ${newPpm} ppm. Situation resolved.`,
          [{ text: 'Go back', onPress: () => router.back() }]
        );
      }
    });
    return () => unsubscribe();
  }, []);

  const handleCall = () => {
    Alert.alert('Call emergency contact?', '+250 78 083 8274', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Call now',
        style: 'destructive',
        onPress: () => Linking.openURL('tel:+250780838274'),
      },
    ]);
  };

  const handleDismiss = () => {
    Alert.alert(
      'Confirm safe',
      'Are you sure the situation is under control?',
      [
        { text: 'No, stay', style: 'cancel' },
        { text: 'Yes, dismiss', onPress: () => router.back() },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Icon */}
      <View style={styles.iconCircle}>
        <Ionicons name="warning" size={52} color="#501313" />
      </View>

      <Text style={styles.title}>Gas Leak Detected!</Text>
      <Text style={styles.subtitle}>Triggered at {triggeredAt} (Kigali)</Text>

      {/* Live PPM */}
      <View style={styles.ppmCard}>
        <Text style={styles.ppmLabel}>Current level</Text>
        <Text style={styles.ppmValue}>{ppm ?? '—'}</Text>
        <Text style={styles.ppmUnit}>ppm</Text>

        {/* Bar */}
        <View style={styles.ppmBar}>
          <View style={[styles.ppmBarFill, {
            width: `${Math.min(((ppm ?? 0) / 800) * 100, 100)}%`,
          }]} />
        </View>
        <Text style={styles.ppmThreshold}>
          Safe limit: {GAS_THRESHOLD} ppm
          {ppm !== null && ` · ${ppm - GAS_THRESHOLD} ppm above limit`}
        </Text>
      </View>

      {/* Instructions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Immediate actions</Text>
        {[
          'Do NOT switch lights or appliances on or off',
          'Open all windows and doors immediately',
          'Turn off the gas supply valve if safe to do so',
          'Evacuate everyone from the building now',
          'Call emergency services from outside',
        ].map((item, i) => (
          <View key={i} style={styles.instructionRow}>
            <View style={styles.numBadge}>
              <Text style={styles.numText}>{i + 1}</Text>
            </View>
            <Text style={styles.instructionText}>{item}</Text>
          </View>
        ))}
      </View>

      {/* Actions taken */}
      <View style={styles.actionsCard}>
        <Text style={styles.actionsTitle}>Automated actions taken</Text>
        {[
          'Push notification sent to your device',
          'Voice call placed to +250 780 838 274',
          'SMS alert sent to +250 780 838 274',
          'Incident logged to Firebase database',
          'Exhaust fan relay activated',
        ].map((item, i) => (
          <View key={i} style={styles.actionRow}>
            <Ionicons name="checkmark-circle" size={16} color="#3B6D11" />
            <Text style={styles.actionText}>{item}</Text>
          </View>
        ))}
      </View>

      {/* Buttons */}
      <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
        <Ionicons name="call" size={18} color="#fff" />
        <Text style={styles.callBtnText}>Call emergency contact</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss}>
        <Text style={styles.dismissBtnText}>I am safe — dismiss alert</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFAFA' },
  content: { padding: 20, paddingTop: 60, alignItems: 'center' },

  iconCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#F09595',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 26, fontWeight: '600', color: '#501313', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#A32D2D', marginBottom: 20 },

  ppmCard: {
    backgroundColor: '#FCEBEB',
    borderRadius: 14, padding: 20,
    alignItems: 'center', width: '100%',
    marginBottom: 16,
    borderWidth: 0.5, borderColor: '#F7C1C1',
  },
  ppmLabel: { fontSize: 12, color: '#A32D2D' },
  ppmValue: { fontSize: 64, fontWeight: '500', color: '#501313', lineHeight: 72 },
  ppmUnit: { fontSize: 16, color: '#A32D2D', marginBottom: 12 },
  ppmBar: {
    width: '100%', height: 6,
    backgroundColor: '#F7C1C1', borderRadius: 3,
    marginBottom: 8, overflow: 'hidden',
  },
  ppmBarFill: { height: '100%', backgroundColor: '#E24B4A', borderRadius: 3 },
  ppmThreshold: { fontSize: 11, color: '#A32D2D', opacity: 0.8, textAlign: 'center' },

  card: {
    backgroundColor: '#fff', borderRadius: 14,
    padding: 16, width: '100%', marginBottom: 14,
    borderWidth: 0.5, borderColor: '#F7C1C1',
  },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#501313', marginBottom: 12 },
  instructionRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 8, gap: 10,
  },
  numBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#E24B4A',
    alignItems: 'center', justifyContent: 'center',
  },
  numText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  instructionText: { flex: 1, fontSize: 12, color: '#501313', lineHeight: 18 },

  actionsCard: {
    backgroundColor: '#EAF3DE', borderRadius: 14,
    padding: 14, width: '100%', marginBottom: 20,
    borderWidth: 0.5, borderColor: '#C0DD97',
  },
  actionsTitle: { fontSize: 12, fontWeight: '600', color: '#3B6D11', marginBottom: 10 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  actionText: { fontSize: 12, color: '#3B6D11' },

  callBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#E24B4A', borderRadius: 12,
    padding: 16, width: '100%',
    justifyContent: 'center', marginBottom: 10,
  },
  callBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },

  dismissBtn: {
    borderRadius: 12, padding: 14, width: '100%',
    alignItems: 'center',
    borderWidth: 0.5, borderColor: '#F09595',
    marginBottom: 30,
  },
  dismissBtnText: { color: '#A32D2D', fontSize: 14 },
});
