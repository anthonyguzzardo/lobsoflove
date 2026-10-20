// Push notifications: "confirm your match" and "you got called up". The phone registers its Expo push token with the server
// (fn_save_push_token); database triggers send the pushes (db/sql/migrations/004_lol_push.sql). Tapping one opens the route in
// its data.url. Remote push needs a development build: in Expo Go on Android there is no token, and this quietly does nothing.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { type Href, router } from 'expo-router';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** Asks once for permission and returns this phone's Expo push token, or null (simulator, refused, Expo Go on Android). */
export async function pushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  try {
    if (Platform.OS === 'android') {
      // Android 13+ only shows the permission prompt once a channel exists.
      await Notifications.setNotificationChannelAsync('default', { name: 'Matches and call-ups', importance: Notifications.AndroidImportance.HIGH });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) return null;
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null;
  }
}

/** Opens whatever a tapped push points at, including the one that launched the app. Returns the unsubscribe. */
export function followTaps(): () => void {
  const open = (r: Notifications.NotificationResponse | null) => {
    const url = r?.notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) router.push(url as Href);
  };
  open(Notifications.getLastNotificationResponse());
  const sub = Notifications.addNotificationResponseReceivedListener(open);
  return () => sub.remove();
}
