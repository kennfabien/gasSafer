import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, GAS_THRESHOLD } from '../../constants';
import { fetchHistory } from '../../services/firebase';
import React from 'react';
import AppHeader from '@/components/AppHeader';

type Filter = 'All' | 'Safe' | 'Leak';

type Reading = {
  ppm: number;
  status: 'safe' | 'danger';
  timestamp: string;
};

export default function History() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('All');

  const load = useCallback(async () => {
    const data = await fetchHistory(50);
    setReadings(data as Reading[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const filtered = readings.filter(r => {
    if (filter === 'Safe') return r.status === 'safe';
    if (filter === 'Leak') return r.status === 'danger';
    return true;
  });

  const leakCount = readings.filter(r => r.status === 'danger').length;
  const safeCount = readings.filter(r => r.status === 'safe').length;
  const avgPpm = readings.length
    ? Math.round(readings.reduce((a, r) => a + r.ppm, 0) / readings.length)
    : 0;
  const maxPpm = readings.length
    ? Math.max(...readings.map(r => r.ppm))
    : 0;

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleString('en-RW', {
        timeZone: 'Africa/Kigali',
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading from Firebase...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.primary}
        />
      }
    >
      <AppHeader sensorOnline />
      <Text style={styles.title}>History</Text>
      <Text style={styles.subtitle}>
        Pull down to refresh · {readings.length} total readings
      </Text>

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNum}>{readings.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={[styles.summaryCard, leakCount > 0 && styles.summaryCardDanger]}>
          <Text style={[styles.summaryNum, leakCount > 0 && { color: COLORS.dangerDark }]}>
            {leakCount}
          </Text>
          <Text style={styles.summaryLabel}>Leaks</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNum}>{avgPpm}</Text>
          <Text style={styles.summaryLabel}>Avg ppm</Text>
        </View>
        <View style={[styles.summaryCard, maxPpm >= GAS_THRESHOLD && styles.summaryCardDanger]}>
          <Text style={[styles.summaryNum, maxPpm >= GAS_THRESHOLD && { color: COLORS.dangerDark }]}>
            {maxPpm}
          </Text>
          <Text style={styles.summaryLabel}>Peak ppm</Text>
        </View>
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        {(['All', 'Safe', 'Leak'] as Filter[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterPill, filter === f && styles.filterPillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f} {f === 'All' ? readings.length : f === 'Safe' ? safeCount : leakCount}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Reading list */}
      {filtered.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="time-outline" size={28} color="#ccc" />
          <Text style={styles.emptyText}>No readings found</Text>
        </View>
      ) : (
        filtered.map((r, i) => (
          <View
            key={i}
            style={[styles.card, r.status === 'danger' && styles.cardDanger]}
          >
            <View style={styles.cardLeft}>
              <Ionicons
                name={r.status === 'danger' ? 'warning' : 'checkmark-circle'}
                size={20}
                color={r.status === 'danger' ? COLORS.dangerDark : COLORS.successDark}
              />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.cardPpm}>{r.ppm} ppm</Text>
                <Text style={styles.cardTime}>{formatTime(r.timestamp)}</Text>
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

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: '#888' },

  title: { fontSize: 24, fontWeight: '600', color: '#1a1a1a', marginTop: 50, marginBottom: 4 },
  subtitle: { fontSize: 12, color: '#888', marginBottom: 16 },

  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10,
    padding: 10, alignItems: 'center',
    borderWidth: 0.5, borderColor: '#e0e0e0',
  },
  summaryCardDanger: { borderColor: '#F7C1C1', backgroundColor: '#FFFAFA' },
  summaryNum: { fontSize: 20, fontWeight: '600', color: '#1a1a1a' },
  summaryLabel: { fontSize: 10, color: '#888', marginTop: 2 },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#fff',
    borderWidth: 0.5, borderColor: '#e0e0e0',
  },
  filterPillActive: { backgroundColor: '#EAF3DE', borderColor: '#1D9E75' },
  filterText: { fontSize: 12, color: '#888' },
  filterTextActive: { color: '#3B6D11', fontWeight: '500' },

  emptyBox: {
    backgroundColor: '#fff', borderRadius: 12,
    padding: 32, alignItems: 'center', gap: 8,
    borderWidth: 0.5, borderColor: '#e0e0e0',
  },
  emptyText: { fontSize: 13, color: '#bbb' },

  card: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 10, padding: 14, marginBottom: 8,
    borderWidth: 0.5, borderColor: '#e0e0e0',
  },
  cardDanger: { borderColor: '#F7C1C1', backgroundColor: '#FFFAFA' },
  cardLeft: { flexDirection: 'row', alignItems: 'center' },
  cardPpm: { fontSize: 14, fontWeight: '500', color: '#1a1a1a' },
  cardTime: { fontSize: 11, color: '#888', marginTop: 2 },

  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeSafe: { backgroundColor: '#EAF3DE' },
  badgeDanger: { backgroundColor: '#FCEBEB' },
  badgeText: { fontSize: 11, fontWeight: '500' },
});
