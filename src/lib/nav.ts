import { router } from 'expo-router';

/** Back one screen. Falls back to home when there is nothing behind this screen (a deep link, or a screen that replaced its parent). */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** All the way home, clearing whatever was stacked on top of it. */
export function goHome() {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/');
}
