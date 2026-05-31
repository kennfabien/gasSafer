import { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { GAS_THRESHOLD, COLORS } from '../../constants';
import Header from '../../components/Header';
import {
  subscribeToSensor,
  logReading,
  type SensorData,
} from '../../services/firebase';
import {
  requestPermission,
  sendLocalLeakAlert,
  sendLocalSafeAlert,
} from '../../services/notifications';
import React from 'react';

const BACKEND_URL = 'https://jacket-astonish-charity.ngrok-free.dev';

type Reading = {
  ppm: number;
  status: 'safe' | 'danger';
  time: string;
};

export default function Dashboard() {
  const [ppm, setPpm]               = useState<number | null>(null);
  const [isLeaking, setIsLeaking]   = useState(false);
  const [sensorOnline, setSensorOnline] = useState(false);
  const [lastUpdated, setLastUpdated]   = useState('—');
  const [readings, setReadings]     = useState<Reading[]>([]);
  const [alertStatus, setAlertStatus]   = useState<string | null>(null);
  const [electricity, setElectricity]   = useState<'on' | 'off'>('on');
  const [fan, setFan]               = useState<'on' | 'off'>('off');
  const [rssi, setRssi]             = useState<number | null>(null);

  const wasLeaking      = useRef(false);
  const alertCooldown   = useRef(false);

  useEffect(() => {
    requestPermission();

    // Subscribe to full sensor object (gas + relay states)
    const unsubscribe = subscribeToSensor(async (data: SensorData) => {
      const timeStr = new Date().toLocaleTimeString('en-RW', {
        timeZone: 'Africa/Kigali',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });

      setPpm(data.gasLevel);
      setSensorOnline(true);
      setLastUpdated(timeStr);
      setElectricity(data.electricity);
      setFan(data.fan);
      if (data.rssi !== undefined) setRssi(data.rssi);

      const leaking = data.status === 'danger';
      setIsLeaking(leaking);

      setReadings(prev => [
        { ppm: data.gasLevel, status: data.status, time: timeStr },
        ...prev.slice(0, 9),
      ]);

      await logReading(data.gasLevel, data.status);

      if (leaking && !wasLeaking.current) {
        wasLeaking.current  = true;
        alertCooldown.current = true;

        await sendLocalLeakAlert(data.gasLevel);
        router.push('/alert');
        triggerBackendAlerts(data.gasLevel);

        setTimeout(() => { alertCooldown.current = false; }, 5 * 60 * 1000);

      } else if (!leaking && wasLeaking.current) {
        wasLeaking.current = false;

        await sendLocalSafeAlert(data.gasLevel);
        triggerSafeAlert(data.gasLevel);

        setAlertStatus('resolved');
        router.replace('/(tabs)');
        setTimeout(() => setAlertStatus(null), 4000);
      }
    });

    return () => unsubscribe();
  }, []);

  const triggerBackendAlerts = async (leakPpm: number) => {
    try {
      setAlertStatus('sending');
      const res = await fetch(`${BACKEND_URL}/api/test-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ppm: leakPpm }),
      });
      const data = await res.json();
      setAlertStatus(
        `📞 Call ${data.call?.success ? '✓' : '✗'}  📱 SMS ${data.sms?.success ? '✓' : '✗'}  🔢 USSD active`
      );
    } catch {
      setAlertStatus('⚠ Backend unreachable — call manually');
    }
  };

  const triggerSafeAlert = async (safePpm: number) => {
    try {
      await fetch(`${BACKEND_URL}/api/safe-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ppm: safePpm }),
      });
    } catch (e) {
      console.log('[Backend] Safe alert failed:', e);
    }
  };

  const handleEmergencyCall = () => {
    Alert.alert('Call emergency contact?', '+250 78 083 8274', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Call now',
        style: 'destructive',
        onPress: () => Linking.openURL('tel:+250780838274'),
      },
    ]);
  };

  const fillPercent = Math.min(((ppm ?? 0) / 800) * 100, 100);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      <Header showLogo showMenu showCart />

      {/* RESOLVED BANNER */}
      {alertStatus === 'resolved' && (
        <View style={styles.resolvedBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#3B6D11" />
          <Text style={styles.resolvedText}>
            {'  '}Gas resolved — electricity restored, fan cooling down.
          </Text>
        </View>
      )}

      {/* ALERT SEND STATUS */}
      {alertStatus && alertStatus !== 'resolved' && (
        <View style={[
          styles.statusBanner,
          alertStatus === 'sending' ? styles.statusSending : styles.statusDone,
        ]}>
          <Ionicons
            name={alertStatus === 'sending' ? 'time-outline' : 'notifications'}
            size={15}
            color={alertStatus === 'sending' ? '#888' : '#185FA5'}
          />
          <Text style={[
            styles.statusText,
            { color: alertStatus === 'sending' ? '#888' : '#185FA5' },
          ]}>
            {'  '}{alertStatus === 'sending' ? 'Sending alerts...' : alertStatus}
          </Text>
        </View>
      )}

      {/* STATUS BANNER */}
      <View style={[styles.banner, isLeaking ? styles.bannerDanger : styles.bannerSafe]}>
        <Ionicons
          name={isLeaking ? 'warning' : 'checkmark-circle'}
          size={18}
          color={isLeaking ? COLORS.dangerDark : COLORS.successDark}
        />
        <Text style={[
          styles.bannerText,
          { color: isLeaking ? COLORS.dangerDark : COLORS.successDark },
        ]}>
          {ppm === null
            ? '  Connecting to sensor...'
            : isLeaking
            ? `  Gas leak detected! ${ppm} — evacuate now.`
            : `  All clear — ${ppm} is safe.`}
        </Text>
      </View>

      {/* GAUGE CARD */}
      <View style={[styles.gaugeCard, isLeaking && styles.gaugeCardDanger]}>
        <Text style={styles.gaugeLabel}>Current Gas Level</Text>
        <Text style={[
          styles.gaugeValue,
          { color: isLeaking ? COLORS.dangerDark : '#1a1a1a' },
        ]}>
          {ppm === null ? '—' : ppm}
        </Text>
        <Text style={styles.gaugePpm}>ppm</Text>

        <View style={styles.gaugeBar}>
          <View style={[styles.gaugeBarFill, {
            width: `${fillPercent}%`,
            backgroundColor: isLeaking ? COLORS.danger : COLORS.primary,
          }]} />
          <View style={[styles.thresholdMarker, {
            left: `${(GAS_THRESHOLD / 800) * 100}%`,
          }]} />
        </View>

        <View style={styles.gaugeFooter}>
          <Text style={styles.gaugeThreshold}>
            Threshold: {GAS_THRESHOLD} ppm
          </Text>
          <Text style={styles.gaugeThreshold}>
            {lastUpdated}
          </Text>
        </View>
      </View>

      {/* HARDWARE STATUS CARDS */}
      <View style={styles.statsRow}>

        {/* Electricity relay */}
        <View style={[
          styles.statCard,
          electricity === 'off' && styles.statCardDanger,
        ]}>
          <Ionicons
            name={electricity === 'on' ? 'flash' : 'flash-off'}
            size={20}
            color={electricity === 'on' ? COLORS.primary : COLORS.dangerDark}
          />
          <Text style={styles.statLabel}>Electricity</Text>
          <Text style={[
            styles.statValue,
            {
              fontSize: 13,
              color: electricity === 'on' ? COLORS.successDark : COLORS.dangerDark,
            },
          ]}>
            {electricity === 'on' ? 'ON' : 'CUT OFF'}
          </Text>
        </View>

        {/* Fan relay */}
        <View style={[
          styles.statCard,
          fan === 'on' && styles.statCardInfo,
        ]}>
          <Ionicons
            name="partly-sunny-outline"
            size={20}
            color={fan === 'on' ? '#185FA5' : '#888'}
          />
          <Text style={styles.statLabel}>Exhaust fan</Text>
          <Text style={[
            styles.statValue,
            {
              fontSize: 13,
              color: fan === 'on' ? '#185FA5' : '#888',
            },
          ]}>
            {fan === 'on' ? 'RUNNING' : 'OFF'}
          </Text>
        </View>

        {/* Gas status */}
        <View style={styles.statCard}>
          <Ionicons
            name="shield-checkmark-outline"
            size={20}
            color={isLeaking ? COLORS.dangerDark : COLORS.successDark}
          />
          <Text style={styles.statLabel}>Status</Text>
          <Text style={[
            styles.statValue,
            {
              fontSize: 13,
              color: isLeaking ? COLORS.dangerDark : COLORS.successDark,
            },
          ]}>
            {ppm === null ? '...' : isLeaking ? 'DANGER' : 'SAFE'}
          </Text>
        </View>

      </View>

      {/* ALERT CHANNELS — shown only during leak */}
      {isLeaking && (
        <View style={styles.channelsCard}>
          <Text style={styles.channelsTitle}>Alert channels active</Text>
          <View style={styles.channelsRow}>
            {[
              { icon: 'call',          label: 'Voice call' },
              { icon: 'chatbubble',    label: 'SMS'        },
              { icon: 'keypad',        label: 'USSD'       },
              { icon: 'notifications', label: 'Push'       },
            ].map((ch, i) => (
              <View key={i} style={styles.channelItem}>
                <Ionicons name={ch.icon as any} size={20} color={COLORS.danger} />
                <Text style={styles.channelLabel}>{ch.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* LIVE READINGS */}
      <Text style={styles.sectionTitle}>Live readings</Text>

      {readings.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="time-outline" size={24} color="#ccc" />
          <Text style={styles.emptyText}>Waiting for sensor data...</Text>
        </View>
      ) : (
        readings.map((r, i) => (
          <View key={i} style={[
            styles.readingRow,
            r.status === 'danger' && styles.readingRowDanger,
          ]}>
            <View style={styles.readingLeft}>
              <Ionicons
                name={r.status === 'danger' ? 'warning' : 'checkmark-circle'}
                size={18}
                color={r.status === 'danger' ? COLORS.dangerDark : COLORS.successDark}
              />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.readingPpm}>{r.ppm} ppm</Text>
                <Text style={styles.readingTime}>{r.time}</Text>
              </View>
            </View>
            <View style={[
              styles.badge,
              r.status === 'danger' ? styles.badgeDanger : styles.badgeSafe,
            ]}>
              <Text style={[
                styles.badgeText,
                { color: r.status === 'danger' ? COLORS.dangerDark : COLORS.successDark },
              ]}>
                {r.status === 'danger' ? 'Leak!' : 'Safe'}
              </Text>
            </View>
          </View>
        ))
      )}

      {/* SENSOR STATUS ROW */}
      <View style={styles.sensorRow}>
        <Ionicons name="wifi" size={16} color="#888" />
        <Text style={styles.sensorText}>
          {'  '}Sensor {sensorOnline ? 'online' : 'connecting...'}
          {rssi !== null ? `  ·  WiFi ${rssi} dBm` : ''}
        </Text>
        <TouchableOpacity onPress={handleEmergencyCall}>
          <Ionicons name="call-outline" size={18} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={[styles.dot, {
          backgroundColor: sensorOnline ? '#639922' : '#E24B4A',
        }]} />
      </View>

      <Text style={styles.updated}>
        Firebase: gasleakmonitor-ae209 · Auto-updates live
      </Text>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 16 },

  resolvedBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EAF3DE', padding: 12,
    borderRadius: 10, marginBottom: 10,
  },
  resolvedText: { fontSize: 13, fontWeight: '500', color: '#3B6D11' },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center',
    padding: 10, borderRadius: 10, marginBottom: 10,
  },
  statusSending: { backgroundColor: '#f5f5f5' },
  statusDone:    { backgroundColor: '#E6F1FB' },
  statusText:    { fontSize: 12, fontWeight: '500' },

  banner: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderRadius: 10, marginBottom: 14,
  },
  bannerSafe:   { backgroundColor: '#EAF3DE' },
  bannerDanger: { backgroundColor: '#FCEBEB' },
  bannerText:   { fontSize: 13, fontWeight: '500', flex: 1 },

  gaugeCard: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 28, alignItems: 'center',
    marginBottom: 14, borderWidth: 0.5, borderColor: '#e0e0e0',
  },
  gaugeCardDanger: { borderColor: '#F7C1C1', backgroundColor: '#FFFAFA' },
  gaugeLabel:      { fontSize: 13, color: '#888', marginBottom: 8 },
  gaugeValue:      { fontSize: 72, fontWeight: '500', lineHeight: 80, letterSpacing: -2 },
  gaugePpm:        { fontSize: 16, color: '#888', marginBottom: 14 },
  gaugeBar: {
    width: '100%', height: 6, backgroundColor: '#eee',
    borderRadius: 3, marginBottom: 8,
    overflow: 'visible', position: 'relative',
  },
  gaugeBarFill:     { height: '100%', borderRadius: 3 },
  thresholdMarker: {
    position: 'absolute', top: -4,
    width: 2, height: 14,
    backgroundColor: '#E24B4A', borderRadius: 1,
  },
  gaugeFooter: {
    flexDirection: 'row', justifyContent: 'space-between', width: '100%',
  },
  gaugeThreshold: { fontSize: 11, color: '#aaa' },

  statsRow:      { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12,
    padding: 10, borderWidth: 0.5, borderColor: '#e0e0e0', gap: 4,
    alignItems: 'center',
  },
  statCardDanger: { borderColor: '#F7C1C1', backgroundColor: '#FFFAFA' },
  statCardInfo:   { borderColor: '#b3d0f0', backgroundColor: '#EAF1FB' },
  statLabel:      { fontSize: 10, color: '#888', textAlign: 'center' },
  statValue:      { fontSize: 20, fontWeight: '500', color: '#1a1a1a' },

  channelsCard: {
    backgroundColor: '#FCEBEB', borderRadius: 12,
    padding: 14, marginBottom: 14,
    borderWidth: 0.5, borderColor: '#F7C1C1',
  },
  channelsTitle: {
    fontSize: 11, fontWeight: '600', color: '#A32D2D',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  channelsRow:  { flexDirection: 'row', justifyContent: 'space-around' },
  channelItem:  { alignItems: 'center', gap: 4 },
  channelLabel: { fontSize: 10, color: '#A32D2D', fontWeight: '500' },

  sectionTitle: {
    fontSize: 11, fontWeight: '500', color: '#888',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },

  emptyBox: {
    backgroundColor: '#fff', borderRadius: 12, padding: 24,
    alignItems: 'center', gap: 8, marginBottom: 12,
    borderWidth: 0.5, borderColor: '#e0e0e0',
  },
  emptyText: { fontSize: 13, color: '#bbb' },

  readingRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 10, padding: 12, marginBottom: 8,
    borderWidth: 0.5, borderColor: '#e0e0e0',
  },
  readingRowDanger: { borderColor: '#F7C1C1', backgroundColor: '#FFFAFA' },
  readingLeft:      { flexDirection: 'row', alignItems: 'center' },
  readingPpm:       { fontSize: 14, fontWeight: '500', color: '#1a1a1a' },
  readingTime:      { fontSize: 11, color: '#888', marginTop: 2 },

  badge:       { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeSafe:   { backgroundColor: '#EAF3DE' },
  badgeDanger: { backgroundColor: '#FCEBEB' },
  badgeText:   { fontSize: 11, fontWeight: '500' },

  sensorRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10, padding: 12,
    borderWidth: 0.5, borderColor: '#e0e0e0',
    marginBottom: 8, gap: 6,
  },
  sensorText: { flex: 1, fontSize: 11, color: '#888' },
  dot:        { width: 8, height: 8, borderRadius: 4 },

  updated: {
    fontSize: 11, color: '#bbb',
    textAlign: 'center', marginBottom: 8,
  },
});
