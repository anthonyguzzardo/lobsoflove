## every tip is an example and not meant as a literal interpretioan of the features we want in our app

## you will find supporting videos of cool apps in /vids and supporting images in /images ... do me a favor rename the images appropriatyely once you've review everything but basically i think going forward this format will allow us to fix our piece of shit game design

# tip 1
here's how to make a cozy fishing game solo with Claude Opus 5.5 + Blender + 3D AI + Unity 6...

the trick is giving every tool one job, but there's a smart way to set it up:

- step 1: generate every 3D model with Tripo Smart Mesh P2: palms, rocks, the pier, the boat, the hut, the character
- step 2: connect Claude Code to Blender through MCP
- step 3: Opus 5.5 sets up each model in Blender: scale, pivots, materials, clean export
- step 4: Opus animates in Blender too: the character's walk, the cast, the rod, the boat on the water
- step 5: bring everything into Unity 6 and build the world: forest, river, waterfall, beach, pier
- step 6: add the systems one at a time: walking, fishing, bait choice, a time of day
- step 7: play it after every step and fix one thing at a time

who does what:
> Tripo: the 3D models
> Opus 5.5 + Blender: setup and animation
> Unity 6: the world and the game

one person, one stack, one game you'd actually want to play
---
# tip 2
very animation in this lab was made by Claude Opus 5.5, and each one comes with the exact prompt that made it plus every follow-up it needed. No fake one-shots. Just motion design with receipts.
Since Opus 5.5 launched on September 22, the feed has filled with motion pieces captioned "one prompt". Some really were one line. The most viewed music video was five minutes of talking and a 12-hour run. Almost nobody posts the middle part: the second prompt, the third, the note that says "frame 84 peaks late".
This article is the lab notebook for that middle part. Three animations made by Opus 5.5, picture and sound, with every prompt and every follow-up printed. The numbers that made them work. The setup that takes you from an empty folder to a loop you can post on X.
The opening shot: liquid chrome that pours itself into a title, from a prompt full of numbers.

0:00 / 0:06
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
Experiment 1: Vague prompt vs directed prompt

The most copied motion prompt of launch week is 26 words long: make a 15-second showreel that proves "what an incredible motion designer you are". It comes from kirill sh, who posted it on September 24 with Opus 5.5 and GPT 6 Astra side by side, from an account with 885 followers. It passed 1.8 million views.

kirill sh
@shneural
·
Sep 24
after Opus 5.5 it actually hurts to look at anything GPT 6 Astra designs

gave both models the exact same prompt: "make a dynamic 15-second motion graphics video that shows what an incredible motion designer you are, like it's your showreel for a résumé. go all out."

not even
Show more


This is the original post. Many reruns followed within days. It makes a great model demo because the subject is the model itself: there is no brief to miss, so nothing can come out wrong.
Now point the same trick at your own launch. A showreel is a genre with known rules and no client. Your product, your words and your timing can all come out wrong, and a one-liner says nothing about any of them.
The other end of the scale is the most viewed Opus 5.5 music video, made by Donald. Credit where it's due: the song "Claude-Pop" and its first video are by deckard, posted on September 9, before Opus 5.5 existed. Donald made the Opus 5.5 version.

donald
@donaldjewkes
·
Sep 23
I made this with one prompt using Opus 5.5

I spoke to my computer for 5mins, claude worked for 12 hours, and I woke up to this

full prompt:


Quote

NotinReality
@other__reality
·
Sep 22
Embedded video
Claude Opus 5.5 has the best visual design of any model I have tested so far  x.com/slimer48484/st…
It crossed 3.6 million views. Donald calls it one prompt, and in the same post he says he spoke to his computer for five minutes and Claude worked for 12 hours. The one prompt was a spoken brief plus 12 hours of autonomous work: direction did the heavy lifting.
So the lab ran a controlled test. Same model, same subject (a pair of wireless earbuds), same technical line: one HTML file, three.js, 960x1080 per side, a 6-second loop. Only the direction changes.

0:00 / 0:06
Watch one full loop of each side before you read the prompts. The left is what three adjectives buy. The right is what 448 words of direction buy.
Prompt A, vague (left side):
python
Create a cool 3D product animation for a pair of wireless earbuds. Make it look premium and modern. One self-contained HTML file using three.js, 960x1080, 6-second loop.
Prompt B, directed (right side):
python
GOAL: a studio product film for wireless earbuds: case opens, buds rise to the viewer, everything clicks shut.
OUTPUT: one self-contained HTML file, three.js 0.160.0 from jsdelivr (importmap), 960x1080.
TIME: 6-second loop, 60 fps = 360 frames, 120 BPM (1 beat = 30 frames). Hits land on beats.

MODEL (1 unit = 1 cm, primitives with bevels): case 6.0 x 4.6 x 2.2, 1.0 edge radius, split at 3.3, back-hinged lid, 0.06 split bevel, 0.045 chrome wire around the seam. Inside: D97757 deck, two dark elliptical wells. Buds: ellipsoid head 1.6 x 1.5 x 1.5, lathed silicone tip, 1.6 oval stem with a chrome end cap, dark grille. Seated heads sit flush with the deck.

LOOK: satin ceramic white F4F1EC (roughness 0.38, clearcoat 0.35), chrome (metalness 1, roughness 0.05), D97757 on the deck only, ink 1C1B1A, tips E4E0DA. Backdrop F0EDE8 center to DEDAD3 corners, dithered. Key FFF4E8 3.0 upper front left, soft shadows; fill E8EEF5 0.6 low right; rim FFFFFF 4.0 upper back right. Reflections: PMREM studio built in code (warm gray dome, overhead and key softboxes, rim strip). Contact shadows, opacity 0.55. Neutral tone mapping, 8% vignette, 2% grain seeded per frame.

SHOTS:
0.0 to 0.5 s: a 2.4-wide studio strip (from 5.5 s) sweeps left to right, glinting across the closed lid and seam.
0.72 to 0.95 s: anticipation: lid presses 1.5 degrees shut, case squashes 2%, hold 3 frames.
1.0 s: lid springs to 100 degrees (damping 0.6, about 10% overshoot, settled by 1.4 s).
1.5 s: buds rise 4.0 out of the wells, right first, left 4 frames later (damping 0.7). From rise frame 8 they tilt 14 degrees outward and turn 35 degrees to camera on a looser spring (damping 0.5): stems swing through and settle.
2.0 s: camera push-in.
2.4 to 4.0 s: hold, buds float 0.05 on a 1 s sine. 3.0 s: second glint crosses the buds.
4.0 s: buds straighten (0.2 s) and descend (easeInOutCubic, 0.45 s), seating with a 0.05 magnetic dip.
4.75 s: lid falls (easeInCubic), shuts exactly at 5.0 s, bounces 3 degrees, settles by 5.3 s; case recoils 1.5%.
5.5 s: next glint starts.

CAMERA: fov 30, never parked. Azimuth 34 to 10 degrees from 5.6 s to 4.0 s (easeInOutSine), back by 5.6 s (easeInOutCubic). Distance creeps 21 to 20.2, pushes to 16 at 2.0 s (easeOutExpo, 0.8 s), returns 4.0 to 5.6 s (easeInOutCubic). Buds up: elevation 12 to 19 degrees, target height 2.3 to 4.2.

BANNED: purple or blue gradients, glow orbs, bloom, neon, lens flares, particles, generic spinning turntables, dark backgrounds, text.

QA: renderAt(t) draws exactly time t, seeded noise only. Stills around every hit; frame 359 flows into frame 0.
Follow-ups: left side 0, by design. It is the untouched first output of a separate context that saw only Prompt A, and it came back as dark navy space, a glowing halo ring, bloom, particles, spinning buds and a made-up tagline: most of Prompt B's banned list. Right side: 15 follow-ups in 4 review rounds, printed below exactly as they were sent. The labels and the split were added after rendering.
python
# Round 1, after the first build (stills at 0, 1.25, 2.9 and 4.9 s)
The white case melts into the backdrop and the chrome reads gray. Drop the studio dome to about a third and push the softboxes, so the unlit sides fall off and the chrome shows dark and bright bands.
The open lid reads as a flat slab. Hollow it: 0.16 rim, 0.62 deep cavity, 0.22 fillet at the ceiling.
The round dark grille reads as an eye. Make it a slim slot.
Two dark marks poke through the bottom of the case: the well floors at 0.3 sit outside the bottom arc, which insets the wall by 0.29 at that height. Raise the floors to 0.5.
The deck reads salmon. Roughness 0.7.
# Round 2, after measuring pixels
Front and top are the same value and the right side vanishes into the backdrop. Key to (-7, 12, 8), rim to (2, 8, -12), still upper front left and upper back right. Overhead softbox 2.2, exposure 0.8.
The glint is a flood light: strip on vs off changes 178,864 pixels because the 60-tall strip lights the whole face. Keep the strip in reflections only (a second PMREM for the specular lookup, the static studio for diffuse) and go back to the 2.4 width from the brief.
Exposure 0.9 and key softbox 4.5 so the ceramic reads white. Deck specular 0.3 so the grazing reflection stops washing out D97757.
Give the wells a 0.07 machined round-over.
The buds read as mouse heads. Move the stem to the outer side, replace the ball tip with a short nozzle and a flattened silicone cap, and move the grille off the head (it read as an eye twice) onto the stem.
Crane faster: reach the high target by 2.3 s, so the heads keep headroom during the push.
# Round 3, after isolating each glint
The first glint is too shy for a hook. Clearcoat roughness 0.08, strip peak 24, and shift the sweep to -80 to 0 degrees so the band is mid-face on frame 0.
The second glint flashes the whole lid cavity (207,791 pixels at 3.3 s) because the strip crosses the mirror direction of the flat faces. Raise it to 8 to 61 degrees elevation, 4.8 wide: only the curved heads and stems catch it.
The hold parks the camera: add a 0.4 dolly creep from 2.8 to 4.0 s. Float the left bud 4 frames behind the right, like its rise.
# Round 4, frame-perfect pass
The anticipation holds 4 frames (57 to 60), not 3: the spring starts at rest exactly on 1.0 s, so the beat frame is still the pressed pose. Release half a frame early (59.5/60 s): frames 57 to 59 hold, including their motion-blur subframes, and frame 60 is the first open frame.
The sound, one more prompt with the same rules: one soundtrack for the split screen, with every hit on the directed side's beats. It took 12 sound follow-ups in 4 rounds, all from measurements: the first mix put 80% of its energy under 60 Hz, where phone speakers play nothing, and the hits sat only 0.5 to 1.6 dB over the bed.
python
# Sound prompt
Score the A/B video. Synthesize everything in code with the Web Audio API, no samples, no downloads. 120 BPM, 6 s loop, 360 frames at 60 fps. Each hit lands 1 frame after its visual event, and so does the bed.
Bed: kick every 60 frames, 16th shaker, bass and pad F, B flat at 120, G minor at 240, C at 300.
Right half only:
44 to 60 reverse swell.
60 lid snap: click, 880 Hz body, 120 Hz thump.
90, 94 magnetic pops, air lift to 119.
96 to 120 push-in swell.
180 to 216, 330 to 30 glint shimmer.
240 to 267 falling swish, 270 seat click.
285 to 300 whoosh into the shut: click, 200 Hz thock, 70 Hz thump; ticks 306, 312.
Hits 3 to 6 dB over the bed, nothing above 8 kHz, mono-safe. Render twice, keep the second pass. 48 kHz stereo WAV, about -14 LUFS, peak -1 dBTP. Mux into the MP4 and check every hit in its decoded audio.
# Sound follow-ups (12), exactly as they were sent
# Round 1, after measuring the first render (80.6% of the energy under 60 Hz, 3.5% in 150 Hz to 6 kHz, median 58 Hz; hits 0.5 to 1.6 dB over the bed; bodies peaking 2.5 to 5 ms after the frame)
1. The sub buries everything. Play B flat, G and C an octave higher (117, 98, 131 Hz), open the bass to 900 Hz, shorten the kick to 80 ms and give it a 190 Hz knock. Raise the pad 5 dB and every hit 6 dB, ticks 6 and 10 dB under the shut.
2. Start every body and thump in cosine phase with a 0.5 ms attack, so the first waveform peak sits on frame + 1.
3. Give the push-in swell a clear peak: 60 ms exponential rise into frame 121, then a 25 ms drop into the camera tail.
4. Duck the bed 4 dB from the shut through tick 2 (frames 301 to 313).
5. Remove the DC: subtract each channel's loop mean.
# Round 2, after measuring the second render (full mix -14.0 LUFS but only -22.9 LUFS in the 200 Hz to 6 kHz phone band; hit stem minus bed stem, K-weighted: snap -0.3, pops -3.1 and -5.2, seat -6.9, shut +2.6, ticks -0.8 and -4.3, push-in -9.3 dB; kick peak 5 ms and snap thump 2.4 ms after frame + 1)
6. The bass still carries the loudness. Drop its sine to a third, open the saw to 1200 Hz, bass 2 dB down, pad 4 dB up and brighter (1600 Hz).
7. Hits to 3 to 6 dB over the bed: push-in swell +8 dB, seat click +6 dB, pops +4 dB, ticks 4 and 8 dB under the shut.
8. Phase every tone so its first waveform peak lands exactly on frame + 1, the kick included (cosine start, 1 ms attack).
# Round 3, after measuring the third render (phone band -17.5 LUFS against -14.0 full; phone-band hit minus bed: snap 6.4, pops 5.6 and 3.5, seat 2.3, shut 8.4, ticks 3.0 and 1.8, push-in 3.0 dB; the kick's first peak is on frame + 1 but its wider second lobe is 10% louder, 2.5 ms later; limiter up to 4.4 dB)
9. Give the kick a 3 ms transient (its level falls to 65% within 3 ms of frame + 1) and the knock 3 dB more, so its largest peak is the first one.
10. Shut 2.5 dB down with the ticks kept where they are (tick 2 then 3 dB up), seat click +2 dB, push-in swell +2 dB.
11. The kick's second lobe is still 6% louder: the knock's negative half lands on it. Knock decay 4 ms, kick attack 0.5 ms. Tick bodies decay in 12 ms so earlier tails cannot flip their lobes.
# Round 4, after decoding the muxed article MP4 in Chrome (offset -0.002 ms, every hit 0.0 to 1.3 ms after frame + 1, but the AAC encode lifts the true peak from -1.3 to -0.4 dBTP)
12. Limit the WAV to -2.2 dBTP so the decoded MP4 stays under -1 dBTP; keep -14 LUFS.
The result: about 30 minutes for the left side and about 90 for the right, review rounds included, plus about 90 minutes for the sound. The last picture note is the kind of error only a frame-by-frame check catches: one extra held frame on the beat.
What changed between A and B:
"Premium" became materials: satin ceramic at roughness 0.38 with a 0.35 clearcoat, chrome at roughness 0.05, and Claude orange only on the deck.
"Cool" became a studio: a key, a fill and a rim light with exact colors and strengths, reflections from a studio built in code, soft contact shadows. No glow anywhere.
"Modern" became a camera: a 30-degree field of view, a camera that never parks, an orbit from 34 to 10 degrees and one push-in on easeOutExpo at 2.0 s.
"Animation" became beats and springs: 120 BPM, a 3-frame anticipation before the lid springs open at damping ratio 0.6, then buds rising at 0.7 with a looser 0.5 follow-through.
The defaults got named: bloom, glow orbs, neon, particles, spinning turntables, dark backgrounds and text, banned by name. The left side shows almost every one of them.
Adjectives are where the default look lives. Every adjective you replace with a number is a decision you take back from the model.
How Claude Opus 5.5 actually makes motion

Opus 5.5 outputs text. Every motion design clip in the feed is a program that draws frames, and a browser records them. Gideon Frost of OrcaRouter said it in one line: "Claude Opus 5.5 does not generate pixels. It writes code that paints pixels."
In practice the program is usually one HTML file. Open it in a browser and it plays. Point a headless browser at it, freeze it at each frame, save the PNGs, and ffmpeg stitches them into a GIF or an MP4.
Code instead of pixels has three consequences you can use:
Every frame is reproducible. Eric Kang's rule on the Hugging Face blog: "Every pixel is a pure function of t." Render frame 84 twice and you get the same image twice.
Edits are cheap. You change one number and re-render. No re-rolling a video model and hoping.
Opus 5.5 can check its own work. Anthropic says that even at its lowest effort setting it reads dense charts more accurately than Opus 5 did at its highest, and that it is better at seeing what changed between two versions of a diagram. A contact sheet of your animation is exactly that kind of image.
---
# tip 3
The free tool that cuts your AI coding bill by up to 90% - without changing a single line of your code.

Your AI agent is quietly burning tokens on garbage. Every ls, every git status, every test run dumps a wall of noise straight into its context - and you pay for all of it. RTK sits in the middle and filters that noise out before it ever reaches the model. Free, open-source, one tiny binary. I dug into whether it actually works - here's the honest breakdown.
Image
First - the honest fact-check

No hype. This one is real, it's genuinely clever, and it has clear limits you need to know before you install it.
What's real:
RTK (Rust Token Killer) is a free, open-source tool (Apache 2.0 license) that reduces how many tokens your AI coding agent burns on everyday terminal commands - the project measures 60–90% savings on common ones.
It's not a toy. ~71,000 stars and 4,400+ forks on GitHub, 240+ releases, actively developed. Written in Rust as a single binary with zero dependencies and under 10ms of overhead.
It supports 100+ commands and plugs into 15 AI coding tools - Claude Code, Copilot, Cursor, Codex, Gemini CLI, and more.
The savings are concrete. In the project's own 30-minute Claude Code benchmark, a typical session drops from ~118,000 tokens to ~23,900 - about 80% less, just from filtering command output.
What's NOT true (so you're not disappointed):
It doesn't make your model smarter. It makes it cheaper to feed.
It only intercepts shell/Bash commands. In Claude Code, the built-in Read, Grep, and Glob tools bypass it - so reading a giant file through the built-in reader still costs full price unless you route it through RTK.
There's a name clash: another unrelated "rtk" exists on crates.io. Install from the right source (below).
Every number here comes from the project's own README and docs. Sources at the end.
What it actually is, in plain English

Image
Think about what your AI agent actually does all day. It runs ls, reads files, greps for patterns, checks git status, runs your tests. Each of those spits out a pile of text - and every line lands in the model's context window, which you pay for in tokens and which fills up until the agent starts forgetting things.
Most of that text is noise. Timestamps, permission bits, "Enumerating objects... Counting objects...", 200 lines of a passing test suite when all you needed was "2 of 15 failed."
RTK sits between your agent and the shell like a filter. The command still runs for real - but before the output reaches the model, RTK strips the junk using four tricks: it removes noise, groups similar items, truncates redundancy, and collapses repeated lines into counts.
git push goes from 15 noisy lines to a single ok main. A failed test run goes from 200+ lines to the two tests that actually broke. Same information the model needs - a fraction of the tokens.
And when a command fails, RTK saves the full raw output to a file, so the agent can read every detail if it needs to, without re-running anything.
Who this is for

This is for you if you:
Use Claude Code, Cursor, Copilot, Codex, or any agentic coding tool and keep hitting your usage limits faster than you'd like
Watch your agent's context fill up and "forget" earlier instructions on long sessions
Pay per token via API and want the bill to drop without changing how you work
Run lots of tests, git operations, and file reads in your loop (basically everyone)
It's not for you if you don't use a terminal-based AI agent, or if your workflow is almost entirely the built-in Read/Greptools rather than shell commands — RTK's biggest wins come through the Bash path.
What it costs

Nothing. Apache 2.0, fully free and open-source. No account, no subscription, no telemetry unless you explicitly opt in (it's off by default, and it never collects your source code, file paths, arguments, or secrets).
The only thing it costs you is about two minutes to install. What it saves you is tokens - which is either real money (API) or real headroom (your Claude/subscription limits).
Setup, step by step

The whole thing is a couple of commands. Full docs are in the repo: https://github.com/rtk-ai/rtk
Step 1 — Install (about 1 minute). On macOS or Linux, the cleanest way is Homebrew:
brew install rtk
Or the install script:

curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
Windows works too (native or WSL) — grab the binary from releases and add it to your PATH.
Step 2 - Verify it installed:
rtk --version
rtk gain
If rtk gain errors, you installed the wrong "rtk" (the name clash). Use cargo install --git https://github.com/rtk-ai/rtk instead. ⚠️
Step 3 - Hook it into your agent (the important part). One command wires up the auto-rewrite hook:
rtk init -g                 # Claude Code / Copilot (default)
rtk init -g --codex         # Codex
rtk init -g --gemini        # Gemini CLI
rtk init -g --agent cursor  # Cursor
💰 This is where the savings come from: after this, when your agent runs git status, the hook silently rewrites it to rtk git status before it executes. The agent gets compact output automatically - you don't change your prompts, and you don't have to remember to type rtk.
Step 4 - Restart your agent. Then just work normally. Run a few commands and check your savings:
rtk gain            # summary of tokens saved
rtk gain --graph    # 30-day ASCII graph
rtk discover        # find commands you're not yet saving on

How much you actually save

From the project's own 30-minute Claude Code benchmark, per operation:
git add / commit / push → −92%
cargo test / npm test / pytest / go test → −90%
ls / tree, grep, git status, git log → −80%
git diff → −75%
cat / read → −70%
Total for that session: ~118,000 tokens → ~23,900. Roughly 80% cut, on the exact same work. (Their note, and mine: real numbers vary with your project size and how command-heavy your loop is.)
So what does that save you in actual money on Claude?

Here's the honest answer — and it depends entirely on how you pay for Claude, because the two paths behave completely differently.
If you're on a subscription (Pro $20 / Max 5x $100 / Max 20x $200):
RTK does not put cash back in your pocket here — you pay the same flat fee no matter what. What it saves is your usage window: you burn through your limits far slower, so you hit "you've reached your limit" walls much less often.
That still turns into real money in one specific way — it can save you an upgrade:
Staying comfortably on Pro ($20) instead of jumping to Max 5x ($100) → ~$80/month = ~$960/year you don't spend. 💰
Staying on Max 5x ($100) instead of Max 20x ($200) → ~$100/month = ~$1,200/year. 💰
It also stretches the separate API-rate credit pool that Agent SDK / headless claude -p runs draw from ($20 on Pro, $100/$200 on Max), so those credits last longer too.
⚠️ So on a subscription, the "savings" is deferred upgrades and fewer walls, not a smaller invoice. Be clear-eyed about that.
If you pay per token (API / Agent SDK):
Here it's direct cash off your bill. RTK cuts the input tokens your agent reads from command output by 60–90%. Using the project's own benchmark (~94k tokens saved per 30-minute session) for a developer doing ~4 focused hours a day, ~22 days a month (~16.5M input tokens saved/month):
Model (input rate)~Saved / month~Saved / yearSonnet 5 ($3/M)~$50~$600Opus 4.8 ($5/M)~$83~$990Fable 5 ($10/M)~$165~$1,980
⚠️ The big honest caveat: those figures assume the saved tokens are fresh input. In real Claude Code sessions, a large share of input is cache reads billed at just 10% of the input price — so if the command output you're trimming would've been cached anyway, your real savings can be 5–10x lower (single digits to low tens of dollars a month). RTK's dollar wins are biggest on fresh, uncached output — the first time a test fails, a fresh git diff, a new file read. Treat the table as an optimistic ceiling, then check your own real number with rtk gain --all --format json, which even estimates your USD savings for you.
Bottom line: on API you save cash (tens to low hundreds a month for heavy users); on a subscription you save headroom— which is worth an upgrade tier if you're the kind of user who keeps hitting the ceiling.
What changes for you

Before, half your context window was filled with terminal exhaust — and your usage limits drained on output nobody actually reads. Your agent hit walls mid-task and started forgetting what you told it 20 minutes ago.
After, that same work produces a fraction of the tokens. Your limits stretch further, your sessions run longer before compacting, and the model's context stays focused on what matters instead of 200 lines of a passing test suite. You didn't change your workflow, your prompts, or your code. You just stopped paying to feed the model garbage.
The bottleneck in agentic coding right now usually isn't intelligence — it's context and token burn. This attacks exactly that.
Your next step (today)

Ten minutes, start to finish:
Install it: brew install rtk (or the curl script for Linux/Windows).
Verify: run rtk --version and rtk gain. If gain errors, you grabbed the wrong "rtk" — install via cargo install --git instead.
Hook it in: rtk init -g for Claude Code (or --codex / --gemini / --agent cursor for your tool), then restart your agent.
Work like normal for a day. Don't change anything else.
Check your receipts: run rtk gain --graph and rtk gain --all --format json to see exactly how many tokens — and dollars — you saved.
If you're on the API, that number is money off your bill. If you're on a subscription, it's how much longer you'll go before the next wall. Either way, you'll know in one session whether it's worth keeping — and since it's free and uninstalls with one command (rtk init -g --uninstall), the downside is basically zero.
One last thing

RTK won't write better code for you, and it won't fix a bad prompt. It does one narrow job - shrinking command output before it hits your model — and it does that job extremely well, for free. Just remember its one real blind spot: it works on shell commands, not your agent's built-in file-reading tools, so route heavy reads through rtk read / cat if you want the savings there too. Match it to how you actually work, and it quietly pays for itself from the first session. Expect it to make your agent smarter, and you'll have the wrong idea of what it is.
Tools & context: RTK (Rust Token Killer), Apache 2.0, free · works with Claude Code, Cursor, Copilot, Codex, Gemini CLI and 10+ others · macOS / Linux / Windows. Details current as of mid-2026 - versions and numbers change, so check the repo.
Sources

rtk-ai/rtk — GitHub repository (README, benchmark table, install guide, supported tools)
rtk-ai.app — official project site and user guide
Note: The basis for this article is the open-source rtk repository: https://github.com/rtk-ai/rtk

Please bookmark, RT and follow @thegreatest_sv for more alpha, AI tools and quality research.
DISCLAIMER
This article reflects my own research, experience, and opinion. Any earnings, prices, savings, statistics, tools, or results are illustrative examples only - not guarantees - and outcomes vary based on your effort, skill, timing, and factors outside anyone's control. Prices, tools, and third-party services change and may differ by the time you read this, so verify current details yourself; any brands mentioned are for information only, with no endorsement or affiliation implied. Nothing here is financial, tax, legal, medical, security, or other professional advice - do your own research, consult a qualified professional before acting, and you alone are responsible for how you use this information and for following all applicable laws and platform terms.