// Every page's line back to the app: `post` sends a message to the React Native screen hosting the WebView, and any uncaught
// error or rejected promise on the page is reported there too (the screens log them), instead of dying silently.
export const post = (msg) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));
window.addEventListener('error', (e) => post({ type: 'error', message: String(e.message), at: `${e.lineno}:${e.colno}` }));
window.addEventListener('unhandledrejection', (e) => post({ type: 'error', message: String(e.reason) }));
