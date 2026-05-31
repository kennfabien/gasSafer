/**
 * Push Notifications Service
 * Local alerts shown on the phone when the app is open.
 * Remote alerts (calls + SMS) are handled by the backend server.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const requestPermission = async (): Promise<boolean> => {
  if (!Device.isDevice) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

export const sendLocalLeakAlert = async (ppm: number) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚠ Gas Leak Detected!',
      body: `Gas level is ${ppm} ppm. Evacuate immediately.`,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      color: '#E24B4A',
    },
    trigger: null,
  });
};

export const sendLocalSafeAlert = async (ppm: number) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '✓ Gas Level Normal',
      body: `Gas concentration is ${ppm} ppm — within safe limits.`,
    },
    trigger: null,
  });
};
