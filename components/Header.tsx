// components/Header.tsx
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS } from '../constants';
import React from 'react';

type HeaderProps = {
  title?: string;
  showLogo?: boolean;
  showBack?: boolean;
  showCart?: boolean;
  showMenu?: boolean;
};

export default function Header({
  title,
  showLogo = false,
  showBack = false,
  showCart = false,
  showMenu = false,
}: HeaderProps) {
  return (
    <View style={styles.container}>

      {/* Left side */}
      <View style={styles.left}>
        {showBack && (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconBtn}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        {showLogo && (
          <View style={styles.logoRow}>
            <Ionicons name="shield-checkmark" size={22} color={COLORS.primary} />
            <Text style={styles.logoText}>GasSafer</Text>
          </View>
        )}

        {title && !showLogo && (
          <Text style={styles.title}>{title}</Text>
        )}
      </View>

      {/* Right side */}
      <View style={styles.right}>
        {showCart && (
          <TouchableOpacity
            onPress={() => router.push('/history')}
            style={styles.iconBtn}
          >
            <Ionicons name="time-outline" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        {showMenu && (
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            style={styles.iconBtn}
          >
            <Ionicons name="menu" size={26} color="#333" />
          </TouchableOpacity>
        )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
    marginBottom: 14,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: 6,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
  },
});