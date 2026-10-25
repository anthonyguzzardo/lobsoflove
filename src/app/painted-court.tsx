import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';

import { SceneView, useScene } from '@/components/scene-view';
import { PAINTED_COURT_HTML } from '@/generated/painted-court-html';
import { goBack } from '@/lib/nav';

export default function PaintedCourtScreen() {
  const scene = useScene();
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {Platform.OS === 'web' ? (
        <iframe title="The courtyard" srcDoc={PAINTED_COURT_HTML} style={{ border: 0, width: '100%', height: '100%' }} />
      ) : (
        <SceneView scene={scene} html={PAINTED_COURT_HTML} name="painted-court" onMessage={(message) => { if (message.type === 'back') goBack(); }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#f5e7cc' } });
