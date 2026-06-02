import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Switch, TouchableOpacity, TextInput,
  Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, GAS_THRESHOLD, APP_NAME, USSD_CODE } from '../../constants';
import { getCurrentGasLevel } from '../../services/firebase';
import React from 'react';
import AppHeader from '@/components/AppHeader';

const BACKEND_URL = 'https://jacket-astonish-charity.ngrok-free.dev';

export default function Settings() {
  const [primaryNumber, setPrimaryNumber] = useState('+250780838274');
  const [secondaryNumber, setSecondaryNumber] = useState('');
  const [threshold, setThreshold] = useState(GAS_THRESHOLD.toString());
  const [pushEnabled, setPushEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [ussdEnabled, setUssdEnabled] = useState(false);
  const [editingPrimary, setEditingPrimary] = useState(false);
  const [editingSecondary, setEditingSecondary] = useState(false);
  const [editingThreshold, setEditingThreshold] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [currentPpm, setCurrentPpm] = useState<number | null>(null);

  // Load saved settings and check backend on mount
  useEffect(() => {
    loadSettings();
    checkBackend();
    loadCurrentPpm();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('gasSettings');
      if (saved) {
        const s = JSON.parse(saved);
        if (s.primaryNumber) setPrimaryNumber(s.primaryNumber);
        if (s.secondaryNumber) setSecondaryNumber(s.secondaryNumber);
        if (s.threshold) setThreshold(s.threshold);
        if (s.pushEnabled !== undefined) setPushEnabled(s.pushEnabled);
        if (s.voiceEnabled !== undefined) setVoiceEnabled(s.voiceEnabled);
        if (s.ussdEnabled !== undefined) setUssdEnabled(s.ussdEnabled);
      }
    } catch (e) {
      console.log('Could not load settings');
    }
  };

  const checkBackend = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/`, { signal: AbortSignal.timeout(5000) });
      setBackendStatus(res.ok ? 'online' : 'offline');
    } catch {
      setBackendStatus('offline');
    }
  };

  const loadCurrentPpm = async () => {
    const ppm = await getCurrentGasLevel();
    setCurrentPpm(ppm);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await AsyncStorage.setItem('gasSettings', JSON.stringify({
        primaryNumber, secondaryNumber, threshold,
        pushEnabled, voiceEnabled, ussdEnabled,
      }));
      Alert.alert('Saved', 'Settings updated successfully.');
    } catch {
      Alert.alert('Error', 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestAlert = async () => {
    setTesting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/test-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ppm: 512 }),
      });
      const data = await res.json();
      Alert.alert(
        'Test alert sent',
        `Voice call: ${data.call?.success ? '✓ Sent' : '✗ Failed'}\nSMS: ${data.sms?.success ? '✓ Sent' : '✗ Failed'}`
      );
    } catch {
      Alert.alert('Error', 'Could not reach backend. Is it running?');
    } finally {
      setTesting(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

<AppHeader sensorOnline />


      
      <Text style={styles.title}>Settings</Text>

      {/* Backend status */}
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, {
          backgroundColor: backendStatus === 'online'
            ? '#639922' : backendStatus === 'offline'
            ? '#E24B4A' : '#888',
        }]} />
        <Text style={styles.statusText}>
          Backend {backendStatus}
          {currentPpm !== null ? `  ·  Current: ${currentPpm} ppm` : ''}
        </Text>
        <TouchableOpacity onPress={checkBackend}>
          <Ionicons name="refresh" size={16} color="#888" />
        </TouchableOpacity>
      </View>

      {/* Alert contacts */}
      <Text style={styles.sectionLabel}>Alert contacts</Text>
      <View style={styles.block}>
        <View style={styles.row}>
          <Ionicons name="person-outline" size={16} color="#888" style={styles.rowIcon} />
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Primary number (Twilio)</Text>
            {editingPrimary ? (
              <TextInput
                value={primaryNumber}
                onChangeText={setPrimaryNumber}
                onBlur={() => setEditingPrimary(false)}
                style={styles.input}
                keyboardType="phone-pad"
                autoFocus
              />
            ) : (
              <Text style={styles.rowValue}>{primaryNumber}</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => setEditingPrimary(!editingPrimary)}>
            <Ionicons
              name={editingPrimary ? 'checkmark' : 'pencil-outline'}
              size={16}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Ionicons name="person-outline" size={16} color="#888" style={styles.rowIcon} />
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Secondary number</Text>
            {editingSecondary ? (
              <TextInput
                value={secondaryNumber}
                onChangeText={setSecondaryNumber}
                onBlur={() => setEditingSecondary(false)}
                style={styles.input}
                keyboardType="phone-pad"
                placeholder="+250..."
                autoFocus
              />
            ) : (
              <Text style={styles.rowValue}>
                {secondaryNumber || 'Not set'}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={() => setEditingSecondary(!editingSecondary)}>
            <Ionicons
              name={editingSecondary ? 'checkmark' : 'pencil-outline'}
              size={16}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* USSD info */}
      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={14} color="#185FA5" />
        <Text style={styles.infoText}>
          {'  '}Dial {USSD_CODE} on any phone to check gas status offline
        </Text>
      </View>

      {/* Threshold */}
      <Text style={styles.sectionLabel}>Danger threshold</Text>
      <View style={styles.block}>
        <View style={styles.row}>
          <Ionicons name="alert-circle-outline" size={16} color="#888" style={styles.rowIcon} />
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Alert when gas exceeds (ppm)</Text>
            {editingThreshold ? (
              <TextInput
                value={threshold}
                onChangeText={setThreshold}
                onBlur={() => setEditingThreshold(false)}
                style={styles.input}
                keyboardType="numeric"
                autoFocus
              />
            ) : (
              <Text style={styles.rowValue}>{threshold} ppm</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => setEditingThreshold(!editingThreshold)}>
            <Ionicons
              name={editingThreshold ? 'checkmark' : 'pencil-outline'}
              size={16}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications */}
      <Text style={styles.sectionLabel}>Notifications</Text>
      <View style={styles.block}>
        <View style={styles.row}>
          <Ionicons name="notifications-outline" size={16} color="#888" style={styles.rowIcon} />
          <Text style={[styles.rowContent, styles.rowValue]}>Push notifications</Text>
          <Switch
            value={pushEnabled}
            onValueChange={setPushEnabled}
            trackColor={{ false: '#e0e0e0', true: COLORS.primary }}
            thumbColor="#fff"
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Ionicons name="call-outline" size={16} color="#888" style={styles.rowIcon} />
          <Text style={[styles.rowContent, styles.rowValue]}>Voice call alerts</Text>
          <Switch
            value={voiceEnabled}
            onValueChange={setVoiceEnabled}
            trackColor={{ false: '#e0e0e0', true: COLORS.primary }}
            thumbColor="#fff"
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Ionicons name="keypad-outline" size={16} color="#888" style={styles.rowIcon} />
          <Text style={[styles.rowContent, styles.rowValue]}>USSD alerts ({USSD_CODE})</Text>
          <Switch
            value={ussdEnabled}
            onValueChange={setUssdEnabled}
            trackColor={{ false: '#e0e0e0', true: COLORS.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Backend */}
      <Text style={styles.sectionLabel}>Backend</Text>
      <View style={styles.block}>
        <View style={styles.row}>
          <Ionicons name="server-outline" size={16} color="#888" style={styles.rowIcon} />
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Server URL</Text>
            <Text style={styles.rowValueSmall} numberOfLines={1}>
              {BACKEND_URL}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Ionicons name="cloud-outline" size={16} color="#888" style={styles.rowIcon} />
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Firebase project</Text>
            <Text style={styles.rowValue}>gasleakmonitor-ae209</Text>
          </View>
        </View>
      </View>

      {/* Test alert button */}
      <TouchableOpacity
        style={[styles.testBtn, testing && styles.btnDisabled]}
        onPress={handleTestAlert}
        disabled={testing}
      >
        {testing ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name="warning-outline" size={18} color="#fff" />
        )}
        <Text style={styles.testBtnText}>
          {testing ? 'Sending...' : 'Send test alert (call + SMS)'}
        </Text>
      </TouchableOpacity>

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.btnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.saveBtnText}>Save settings</Text>}
      </TouchableOpacity>

      <Text style={styles.appInfo}>{APP_NAME} v1.0.0</Text>
      <Text style={styles.appInfo}>University of Rwanda · Final Year Project 2025–2026</Text>
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 16 },
  title: { fontSize: 24, fontWeight: '600', color: '#1a1a1a', marginTop: 50, marginBottom: 16 },

  statusRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10,
    padding: 12, marginBottom: 16,
    borderWidth: 0.5, borderColor: '#e0e0e0', gap: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { flex: 1, fontSize: 12, color: '#888' },

  sectionLabel: {
    fontSize: 11, color: '#888', textTransform: 'uppercase',
    letterSpacing: 0.6, marginBottom: 6, marginTop: 16,
  },
  block: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 0.5, borderColor: '#e0e0e0', overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  rowIcon: { marginRight: 10 },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 11, color: '#888' },
  rowValue: { fontSize: 14, color: '#1a1a1a', marginTop: 2 },
  rowValueSmall: { fontSize: 12, color: '#1a1a1a', marginTop: 2 },
  divider: { height: 0.5, backgroundColor: '#e0e0e0', marginLeft: 42 },
  input: {
    fontSize: 14, color: '#1a1a1a',
    borderBottomWidth: 1, borderBottomColor: COLORS.primary,
    paddingVertical: 2,
  },

  infoBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E6F1FB', borderRadius: 8,
    padding: 10, marginTop: 6,
  },
  infoText: { fontSize: 11, color: '#185FA5', flex: 1 },

  testBtn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    backgroundColor: '#E24B4A', borderRadius: 12,
    padding: 14, marginTop: 24,
  },
  testBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },

  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 10,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  btnDisabled: { opacity: 0.6 },

  appInfo: { fontSize: 11, color: '#bbb', textAlign: 'center', marginTop: 12 },
});
