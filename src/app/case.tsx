import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackSwing } from '@/components/back-swing';
import { type Cue, SceneView, type SceneMsg, useScene } from '@/components/scene-view';
import { CASE_HTML } from '@/generated/case-html';
import { computeSeason, scoreLine, useMatches, winnerOf } from '@/lib/matches';
import { CAST, useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';

const CUES: Record<string, Cue> = {
  open: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('tick', 0.6); },
  pick: () => { void Haptics.selectionAsync(); sfx('swish', 0.5); },
  side: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft); sfx('tick', 0.4); },
  slid: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); sfx('go'); },
  played: () => { sfx('select', 0.8); },
};

/**
 * Opponent select: every rival is a disc in a clear jewel case (web/case.js). Spin the case for the tracklist (your matches against
 * them), open it for their liner notes, slide the ball to load the disc and play.
 */
export default function CaseSelect() {
  const params = useLocalSearchParams<{ pick?: string; demo?: string }>();
  const roster = useRoster();
  const matches = useMatches();
  const scene = useScene();
  const { run } = scene;
  const you = roster.find((f) => f.isYou) ?? roster[0];

  const payload = useMemo(() => {
    const { rows } = computeSeason(roster, matches);
    const rank = Object.fromEntries(rows.map((r, i) => [r.id, i + 1]));
    const rivals = roster.filter((f) => !f.isYou).map((f) => {
      const games = matches
        .filter((m) => (m.p1 === you.id && m.p2 === f.id) || (m.p2 === you.id && m.p1 === f.id))
        .sort((a, b) => a.playedAt - b.playedAt);
      // Every score is read from your side, so the tracklist always says what you did.
      const tracks = games.map((m) => ({
        r: winnerOf(m) === you.id ? 'W' : 'L',
        score: scoreLine(m.p1 === you.id ? m.sets : m.sets.map(([a, b]) => [b, a] as [number, number])),
        date: new Date(m.playedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(),
      }));
      const w = tracks.filter((t) => t.r === 'W').length;
      return {
        id: f.id, name: f.name, cast: f.cast, color: f.color, rank: rank[f.id] ?? rows.length + 1,
        style: CAST[f.cast].label, tagline: f.bio || CAST[f.cast].tagline, pro: f.favoritePro, home: f.homeCourt, racket: f.racket,
        h2h: [w, tracks.length - w], tracks,
      };
    });
    return JSON.stringify({ rivals, pick: params.pick ?? rivals[0]?.id });
  }, [roster, matches, you.id, params.pick]);

  useEffect(() => { run(`window.setRack(${payload})`); }, [run, payload]);

  const onMessage = (m: SceneMsg) => {
    if (m.type === 'played') router.push({ pathname: '/match', params: { vs: m.id } });
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SceneView
        scene={scene}
        html={CASE_HTML}
        name="case"
        cues={CUES}
        onMessage={onMessage}
        // `?demo=1` plays the screen by itself (spin at 1.5 s, open at 3.5 s, next rival at 6 s) so the motion can be recorded without a finger.
        onReady={() => { if (params.demo === '1') run('setTimeout(() => window.fling(0, 1500), 1500); setTimeout(() => window.setOpen(true), 3500); setTimeout(() => window.pick(window.nextId()), 6000)'); }}
      />
      <BackSwing floating />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#efece5' },
});
