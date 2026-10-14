Six seconds, one loop: a chrome blob squashes, stretches and pinches into 7 drops, each drop pours into its letter, a glint sweeps the word, and the letters melt back into one wobbling blob. The liquid is a single raymarched shape drawn in a shader, the letters are real three.js TextGeometry, and the GPU rendered every frame at 60 fps with motion blur blended from subframes.
The exact prompt, pasted into Opus 5.5 as is:
python
Liquid Chrome: 6 s seamless loop, 60 fps, 1080x1080, one HTML file, three.js 0.160.0 via jsdelivr importmap only.

window.renderAt(t) sets everything from t in seconds; all motion and noise periodic in 6 s; with ?t= never start requestAnimationFrame; window.__ready after font and bake. Quarter-pixel camera jitter, 4 offsets from frac(t*60).

Raymarch blob, 7 droplets and text as one SDF in a full-screen shader. Smooth-min k 0.35, falling to 0.1 as droplets part; each droplet becomes its glyph through mix(dropSDF, textSDF, K). Text: TextGeometry "OPUS 5.5" per glyph, helvetiker_bold from the pinned examples/fonts, size 0.52, height 0.12 (r160 reads height, not depth), bevel 0.03, 10 bevel and 24 curve segments, tracking -0.04 em, period optically centered. Bake the same outlines into a 2048x512 signed distance texture on the GPU, extruded as a rounded box to match the mesh. From 3.3 to 4.7 s cross-fade to the real mesh (creased normals, 35 degrees), same GLSL, reflections traced into the SDF.

Chrome: F0 0.92, Schlick fresnel, roughness 0.04, 3 bounces.

Studio: white floor at y -0.8, soft overhead shadow, contact darkening, 6% reflection, black beyond z 4 (camera side) so letter faces reflect dark. Environment in azimuth and elevation, camera at 0: black camera-side panel 86x57 degrees, softboxes overhead (2.4) and upper left (3.0), black flags at 75 degrees left and right, a D97757 rim strip behind at 149 degrees, 24 up, intensity 1.4, a 2 degree glint strip, intensity 6, tilted 40 degrees, sweeping left to right 3.3 to 4.1 s.

Timeline:
0 to 1.2 s: blob radius 0.62 breathes 3% every 1.5 s, simplex noise 0.05.
1.2 to 1.4 s: squash 10%.
1.4 to 2.1 s: stretch 2.4x wide and pinch into 7 droplets sized by glyph area; each arcs 0.2 up to its glyph, overshoots 7%, stretches along its velocity.
2.2 to 2.9 s: droplets become letters left to right, 3 frames apart, 0.4 s each; bevels start 0.07 puffy and spring flat.
2.9 to 4.8 s: hold.
4.8 s: 6-frame swell, letters slump 0.12 and soften, drain to the center with ease-in, merge at 5.62 s with a 3-bounce wobble (14%, damping 0.25) running through frame 0.

Camera: 30 degree lens, dolly 5.6 to 7.2 by 2.6 s, push to 6.95 in the hold, back to 5.6 by 5.9 s; orbit 7 degrees each way centered on the hold; 6 degrees above.

Post: bloom threshold 1.0, strength 0.3; tone curve linear to 0.9, then a soft shoulder; vignette 7%; grain 1.5% seeded by frame index.
One line in it comes from a real three.js trap. In r160, TextGeometry reads "height" for the extrusion depth, and a "depth" parameter is overwritten with 50, so letters meant to be 0.12 deep come out 50 deep. Pin the version, name the right parameter, and the trap is gone.
Follow-ups: 10, printed below exactly as they were sent. The first build already had the whole choreography, blob to drops to letters and back. Follow-ups 1 to 5 fixed what stills and measurements showed: white plastic instead of chrome, a glint that erased the P, bevels that fused the letters, drops that left the frame. Follow-ups 6 to 9 came from checking 12 transitions frame by frame and caught things like a bump that popped onto the blob at frame 85. The last one added a horizon line for the letter faces to reflect, so they read as chrome instead of flat charcoal.
python
1. It reads as white plastic, the letter faces only see the black floor so the glint never shows, and the mesh caps reflect bent shards. Make the studio dark (0.1 gray) with only a white cyc behind the subject, 140 degrees wide, from 10 below to 40 up. End the white floor at z 4 so camera-side rays reach the black panel. Flatten the mesh cap normals. Rim strip 12x40 degrees. Blob noise frequency 1.0.
2. The glint is a flare that erases the P: make it 0.6 degrees wide at intensity 3. The rim never reaches the letters: move the D97757 strip behind and up (165 degrees, 42 up, 70x16 degrees) and add a soft D97757 kicker on the right, azimuth 55 to 125, elevation -16 to 10, so every right-facing bevel catches it.
3. The 0.03 bevels fuse every letter pair. Space the glyphs by their measured outlines, 0.09 apart and 0.26 for the word space, and hold the camera at 7.8, pushing to 7.55. The mesh speckles on its bevels: shade it with the SDF gradient so it matches the raymarched text.
4. The outer droplets leave the frame by 8 px around frame 112. Start them at 40% of their glyph position, ease the flight with u^2.4 so the 7% overshoot lands at 1.97 s, and dolly from 1.2 to 2.5 s.
5. While the letters form they look like camouflage and the merged blob looks like crumpled foil. Surface ripple 0.008 at frequency 3.2.
6. A bump pops onto the blob at frame 85. Grow the droplets from radius -0.4 over 1.2 to 1.65 s and regrow the blob from -0.4, so their smooth-min pull fades in.
7. mix(sphere, letter) passes through flat coins. Let each droplet pour into its glyph instead: bake one SDF channel per glyph, reveal each letter inside a sphere growing from its droplet (smooth max 0.05, ease-out, 0.4 s), shrink the droplet into it, join them with smooth-min, and start the puff spring only once the letter is full (damping 0.55, 3 Hz). Melt in reverse, draining from 5.2 s.
8. The glint reaches the O late and leaves the last 5 early. Make it touch the O at 3.3 s and clear the last 5 at 4.1 s (calibrated sweep: azimuth -0.083 to 0.302).
9. The letters vanish before their drops exist and the merged ball inflates. Regrow the drops first (4.88 to 5.1 s, 1.15x glyph size), retract the letters after (5.0 to 5.35 s), and grow the central blob from 5.15 s.
10. The letter faces read as flat charcoal. Add a thin 0.5 horizon strip at -6 degrees inside the camera-side panel, and soften the floor's end over z 3.6 to 4.0.
Then the sound, from one more prompt. Opus 5.5 can't hear, so it scored the loop from frame numbers: every sound synthesized in code with the Web Audio API, no samples, and each hit landing 1 frame after its picture. It took 5 sound follow-ups, all from measuring the decoded audio, none from listening: the first hits peaked 8 to 11 ms late, the levels over the bed were uneven, the limiter squashed the final gloop, and the codec added 16 ms of padding at the seam.
python
# Sound prompt
Score this seamless 6 s loop (360 frames, 60 fps). Synthesize everything in code with the Web Audio API, no samples, no downloads. Each hit lands 1 frame after its visual event.
Bed: 120 BPM, four 3/4 bars of 90 frames starting on frames 67, 157, 247 and 337. Kick on 67, 247 and 337, offbeat shaker only where no hit plays, sub and pad on Bm, G, A, D.
Events: squash inhale peaking at 84, stretch glide 84 to 112, pinch bloops at 112, 113, 114 and 120, pour bloops rising through D major pentatonic at 136, 138, 141, 145, 147, 150 and 153, metallic ting at 200 (partials under 8 kHz), shimmer panned left to right until 245, liquid swell from 288 peaking at 303, drips at 309, merge blups at 319, 321, 322 and 325, slurp into a gloop at 337 wobbling at 2.4 Hz.
48 kHz stereo WAV, about -14 LUFS, peak -1 dBTP, no click at the seam. Mux into the MP4.
# Sound follow-ups (5), exactly as they were sent
1. Measured on the isolated hits: the kick and the gloop peak 8 to 11 ms late (a 4x waveshaper and sines that start at phase 0), and the levels over the bed are uneven (ting +10 dB, gloop +1 dB, drips -8 dB, dot drop +1 dB). Build every tonal hit as a buffer whose attack ends on a cosine crest at exactly (F + 1) x 800 samples, with no waveshaper. Put every hit, or pair of hits on the same frame, 3 to 6 dB above the bed (K-weighted, first 60 ms). The mix loses 4.5 dB through a 150 Hz high-pass: cut the sub 4 dB, the kicks 1.5 dB and the kick under the gloop 4 dB, and raise the pad 1.5 dB.
2. Timing is exact now. The hits sit 6.5 to 9 dB over the quieter bed: trim the hit bus 2.5 dB, then the two pinch pairs 1.4 dB, the U and S pinch 1 dB, the swell 1.2 dB and the last pour bloop 0.5 dB, and raise the drips 2.5 dB and the gloop 3 dB, so every hit reads 3 to 6 dB over the bed.
3. The limiter takes 3.4 dB off the gloop because all its partials and the kick crest on the same sample. Put the gloop's even harmonics in sine phase and lower the kick under it 2.7 dB, so the limiter stays under 1.5 dB and the gloop keeps 3 to 6 dB over the bed.
4. Sine-phase harmonics moved the gloop's biggest waveform peak 4 ms after its frame. Keep every gloop harmonic in cosine phase so the peak is on sample 270400, set the 2nd harmonic to 0.2 and the 3rd to 0.08, drop the 4th, and lower the gloop 0.5 dB.
5. The MP4's audio runs 16 ms of codec padding past the video, so the file starts on a hard step and a looping player stops the sound hard at 6.000 s, plays 16 ms of silence and restarts hard. Keep the seamless loop as the master WAV for the two-loop post, and for the single-loop article MP4 add a 2 ms raised-cosine fade to the first and last 96 samples only.
The result: about 2 hours from the first prompt to the finished loop, including the 12 transition checks, plus about 45 minutes for the sound. The wobble that ends the loop runs straight through frame 0, so the seam never shows.
Every drop, light and camera move in that loop came from a number in the prompt or in a follow-up. That's the whole lab in one loop.
What's inside:
Experiment 1: the same 3D product shot from a vague prompt and a directed one, side by side
How it works: why Opus 5.5 writes code instead of pixels, and why that helps you
Setup from zero: no install, Mac or Windows
Prompt anatomy: the lines a directed motion prompt needs
The numbers: easing, springs, durations, stagger, beat grid
Experiment 2: anticipation, squash and stretch, overlapping action, follow-through and arcs on a 3D mascot
The lab loop: how Opus 5.5 checks its own frames
Equipment: Remotion, HyperFrames, GSAP, Motion, Three.js
The last mile: sound, perfect loops, export for X
Fixes: the failures you will hit, each with the prompt that fixes it
No After Effects needed. A browser and Claude are enough to start.
---

# tip 4
hree days ago I gave Opus 5.5 an empty folder and asked for a game you can't put down. The post about it pulled 13,328 views and 192 bookmarks in its first day. People didn't bookmark the video. They bookmarked the idea that one person with Claude Code can ship a real game in an afternoon.
The game is Skyhold. The sky islands are falling, houses arrive by balloon one at a time, and every house you drop tips the island. Past 15° the rim slides into the clouds. Lose five houses and the island flips.
Here is everything: the setup, the prompts, the bugs, the trailer pipeline, the leaderboard, the store route, and the two ways this turns into money. Every number below comes from the run logs.
01. Pick a game you can explain in one rule

Opus can build almost anything. The hard part is choosing something people understand in two seconds of a muted video.
The rule for Skyhold: "the island has a centre of mass". Everything else (roads, balloons, storms, leaderboards) hangs off that one sentence.
Good one-rule games for a first build:
a stack that tips when it gets uneven
a city that floods when you build too low
a ship that sinks if you load one side
a garden that dies without shade
The test: describe the rule to a friend in one sentence. If they ask "and then what?", the rule is working.
02. Set up the studio in 10 minutes

You need four things on one machine:
Claude Code with Opus 5.5
three.js copied into the project folder (no CDN, so the game works offline)
headless Chromium (Playwright) to look at frames
ffmpeg to turn frames into video
mkdir skyhold && cd skyhold
curl -L -o three.module.js https://unpkg.com/three@0.160.0/build/three.module.js
pip install playwright && python -m playwright install chromium
That's the whole stack. No game engine, no asset store, no build step. Every house, cloud and keeper in Skyhold is drawn in code.
03. Write the first prompt like a design doc

The first build took 46 minutes of Opus. The prompt was about 700 words, and the length mattered more than any trick. It had four parts:
the look: "a real indie game, not a tech demo: think Townscaper / Islanders polish"
the tech: "three.js from ./three.module.js, no external assets, InstancedMesh for repeated things, one shadow map at 1024"
the game: tools, rules, economy, day and night
the contract: "with ?capture in the URL, expose window.render(t) that advances the real simulation to time t, deterministic, seeded randomness only"
Copy this skeleton:
Build a small but genuinely polished 3D browser game in this folder, entry point index.html.
Working title: [name]. One rule: [your rule].

TECH: three.js local via importmap, no external assets, everything modelled in code.
Must run in headless Chromium (SwiftShader): modest geometry, no postprocessing.

THE GAME: [the loop in 5 bullets], playable with mouse AND touch.

RECORDING MODE: with ?capture, no rAF loop. window.render(t) steps the REAL
simulation to time t with a fixed timestep and a seeded PRNG, and renders.
A scripted cursor plays a 45 s session through the same input functions a human uses.

QUALITY BAR: every frame of the demo must look like a screenshot from a released game.
Do not open a browser or run anything. Just write the files.
The last line matters. Opus writes better code when it's told to finish the files instead of starting to test halfway.
04. Make it deterministic from day one

Fixed timestep (1/60 s with an accumulator), seeded randomness, and no Date or performance calls inside the simulation.
This one decision pays for itself three times:
you can record the trailer frame by frame at any quality
a replay of the same inputs gives the same island, so a server can check scores
the physics plays the same at 60 Hz and 144 Hz
Someone in my replies asked exactly that: "what's your timestep? 144hz players break the island first." The answer was one line, because it was in the first prompt.
05. Record the trailer from the game itself

Screen recording a WebGL game on a laptop drops frames. Instead, step the game and screenshot each frame:
for i in range(30 * 45):
    await page.evaluate(f"window.render({i/30})")
    ff.stdin.write(await page.screenshot(type="png"))
Pipe that into ffmpeg (libx264, crf 16) and you get a perfectly smooth 45-second trailer at 1080x1350. That's the vertical format that fills the feed on a phone.
Two traps I hit:
SwiftShader sometimes loses the WebGL context and you get white frames. Check gl.isContextLost() after each render and reload the page when it happens.
Odd frame sizes break x264. 1080x675 failed, 1080x674 worked.
Then write the music in code too, on the same beat as the cuts. Every video in this series has its own soundtrack generated from a short sound brief.
06. Playtest with frames, not vibes

After every Opus pass I render 8-12 keyframes and read them before rendering anything long. That's how most of the real bugs showed up:
balloons subtracted from the island's mass, so twenty of them tipped a level island to 22°
houses the balloon auto-dropped skipped the road check and still scored
the tilt gauge moved when you rotated the camera, so it looked broken
a text label covered the HOLD ON! banner in the trailer
None of these were syntax errors, so a test suite wouldn't have caught them. You only see them by looking at the frames.
07. Turn a sandbox into a one-more-run loop

The first version was a cozy city builder, and nobody was hooked by it. What changed it was taking choices away:
pieces arrive one at a time under a balloon, and a NEXT card shows the one after
no skipping, one hold slot, and a slow drop lands on a random edge
heavier pieces arrive later in the run
gusts start at a minute in and get stronger
5 houses lost and the island flips: 3-6 minute runs
The Opus pass for this took 41 minutes and cost $12.94. It's the change that turned a sandbox into something you replay.
---
