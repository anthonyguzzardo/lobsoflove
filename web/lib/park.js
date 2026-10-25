// A public park court on a sunny afternoon, around the drill's court (web/drill.js): mowed grass with stripes, the chain-link
// enclosure with green windscreen on the far and side fences, light poles, a bench and a cooler by the net post, the next courts
// over on both sides, trees, and a sky. Real sizes: the enclosure is 18.3 x 36.6 m, the fence 3.6 m.
//
// Everything that stands up casts a real shadow from one sun, high on the far side and to the left, so shadows reach toward you
// and to the right, like an afternoon match seen into the light. Nothing stands between the camera and your end: the fence behind
// you is bare chain-link, and no tree comes closer than 6 m outside the enclosure.
import * as THREE from 'three';

const ENC_W = 18.3 / 2;
const ENC_L = 36.6 / 2;
const FENCE_H = 3.6;

const canvasTex = (w, h, draw, repeat) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
};
// A small deterministic random, so the park is the same every visit.
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

/** Sky: deep blue overhead to a warm pale haze at the horizon. Used as the scene background and the fog colour. */
export const HAZE = 0xd9e8ee;
function skyTexture() {
  return canvasTex(4, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#3f86d6');
    gr.addColorStop(0.55, '#8cc2ec');
    gr.addColorStop(0.9, '#d9e8ee');
    gr.addColorStop(1, '#efe6d2');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
}

/** Mowed grass: 6 m stripes, light and dark, with blade speckle. */
function grassTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#5f9a43'; g.fillRect(0, 0, w, h / 2);
    g.fillStyle = '#52893a'; g.fillRect(0, h / 2, w, h / 2);
    for (let k = 0; k < 9000; k += 1) {
      const x = rnd() * w; const y = rnd() * h;
      g.fillStyle = rnd() < 0.5 ? 'rgba(30,60,20,.18)' : 'rgba(170,210,120,.16)';
      g.fillRect(x, y, 1.5, 3);
    }
  }, [16, 16]);
}

/** Chain-link: a diamond mesh, see-through. */
function chainTexture() {
  return canvasTex(64, 64, (g, w) => {
    g.strokeStyle = 'rgba(70,80,72,.95)';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, w); g.moveTo(w, 0); g.lineTo(0, w); g.stroke();
  }, [1, 1]);
}

/** Layer for the park's fences, poles, benches, trees and the next courts: drawn in the main view, left out of the side-on view. */
export const PROPS = 1;

export function buildPark(scene, sun) {
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...extra });
  const park = new THREE.Group();
  scene.add(park);
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(HAZE, 70, 190);

  // Grass to the horizon.
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }));
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.02;
  grass.receiveShadow = true;
  park.add(grass);
  grass.material.map.repeat.set(400 / 12, 400 / 12);

  // The next courts over, both sides: the same green and blue slab, painted lines.
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf4f1e6 });
  const slab = (x) => {
    const g = new THREE.Group();
    const run = new THREE.Mesh(new THREE.PlaneGeometry(ENC_W * 2, ENC_L * 2), mat(0x3f8f5a));
    run.rotation.x = -Math.PI / 2; run.receiveShadow = true; g.add(run);
    const blue = new THREE.Mesh(new THREE.PlaneGeometry(10.97, 23.77), mat(0x2f6fd6));
    blue.rotation.x = -Math.PI / 2; blue.position.y = 0.002; blue.receiveShadow = true; g.add(blue);
    const ln = (x0, z0, x1, z1) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(x1 - x0) || 0.05, Math.abs(z1 - z0) || 0.05), lineMat);
      m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.004, (z0 + z1) / 2); g.add(m);
    };
    for (const z of [-11.885, 11.885]) ln(-5.485, z, 5.485, z);
    for (const xx of [-5.485, 5.485, -4.115, 4.115]) ln(xx, -11.885, xx, 11.885);
    for (const z of [-6.4, 6.4]) ln(-4.115, z, 4.115, z);
    ln(0, -6.4, 0, 6.4);
    const net = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.95, 0.04), new THREE.MeshStandardMaterial({ color: 0x1d2420, transparent: true, opacity: 0.55 }));
    net.position.y = 0.48; net.castShadow = true; g.add(net);
    g.position.x = x;
    g.traverse((o) => o.layers.set(PROPS));
    park.add(g);
  };
  slab(-ENC_W * 2 - 0.4);
  slab(ENC_W * 2 + 0.4);

  // The enclosure: posts every 3 m, chain-link all round; windscreen (dark green, 2.4 m) on the far end and the sides.
  const postMat = mat(0x2d4a38, { roughness: 0.6, metalness: 0.3 });
  const chain = new THREE.MeshStandardMaterial({ map: chainTexture(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4 });
  const screen = mat(0x24432f, { roughness: 0.95 });
  const fence = (x0, z0, x1, z1, wind) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(z1 - z0, x1 - x0);
    const cx = (x0 + x1) / 2; const cz = (z0 + z1) / 2;
    const tex = chain.clone();
    tex.map = chain.map.clone();
    tex.map.needsUpdate = true;
    tex.map.repeat.set(len / 0.6, FENCE_H / 0.6);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, FENCE_H), tex);
    mesh.position.set(cx, FENCE_H / 2, cz);
    mesh.rotation.y = -ang;
    mesh.castShadow = true;
    park.add(mesh);
    if (wind) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.4), screen);
      w.position.set(cx, 1.2, cz);
      w.rotation.y = -ang;
      w.castShadow = true; w.receiveShadow = true;
      w.material.side = THREE.DoubleSide;
      park.add(w);
    }
    const n = Math.round(len / 3);
    for (let k = 0; k <= n; k += 1) {
      const u = k / n;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, FENCE_H, 8), postMat);
      p.position.set(x0 + (x1 - x0) * u, FENCE_H / 2, z0 + (z1 - z0) * u);
      p.castShadow = true;
      park.add(p);
    }
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 8), postMat);
    rail.position.set(cx, FENCE_H, cz);
    rail.rotation.z = Math.PI / 2;
    rail.rotation.y = -ang;
    park.add(rail);
  };
  const before = park.children.length;
  fence(-ENC_W, -ENC_L, ENC_W, -ENC_L, true); // far end
  fence(-ENC_W, -ENC_L, -ENC_W, ENC_L, true); // left side
  fence(ENC_W, -ENC_L, ENC_W, ENC_L, true); // right side
  fence(-ENC_W, ENC_L, ENC_W, ENC_L, false); // behind you: bare, so it never hides you

  // Light poles at the far corners only: the near ones would stand across your thumbs.
  for (const [x, z] of [[-ENC_W, -ENC_L], [ENC_W, -ENC_L]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 9, 10), postMat);
    pole.position.set(x * 1.03, 4.5, z * 1.02);
    pole.castShadow = true;
    park.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.5), mat(0xdfe3dc, { roughness: 0.4 }));
    lamp.position.set(x * 0.99, 9, z * 0.99);
    lamp.castShadow = true;
    park.add(lamp);
  }

  // A bench and a water cooler at the right net post, outside the doubles alley.
  {
    const b = new THREE.Group();
    const wood = mat(0xb07a45);
    for (let k = 0; k < 3; k += 1) { const sl = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.12), wood); sl.position.set(0, 0.46, -0.16 + k * 0.16); b.add(sl); }
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 0.05), wood); back.position.set(0, 0.75, 0.26); back.rotation.x = -0.15; b.add(back);
    for (const x of [-0.8, 0.8]) { const lg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.46, 0.5), postMat); lg.position.set(x, 0.23, 0); b.add(lg); }
    b.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    b.position.set(7.6, 0, 1.8);
    b.rotation.y = -Math.PI / 2;
    park.add(b);
    const cooler = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.45, 18), mat(0xe2562f, { roughness: 0.5 }));
    cooler.position.set(7.5, 0.23, -1.2);
    cooler.castShadow = true;
    park.add(cooler);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.06, 18), mat(0xf4f1e6));
    lid.position.set(7.5, 0.48, -1.2);
    park.add(lid);
  }

  for (const o of park.children.slice(before)) o.traverse((c) => c.layers.set(PROPS));

  // Trees: a ring well outside the enclosures, never behind your end within the camera's line.
  const trunkMat = mat(0x6b4a2f);
  const leaves = [0x3f7a35, 0x4d8a3c, 0x36692e, 0x5a9445].map((c) => mat(c, { flatShading: true }));
  const leafGeo = new THREE.IcosahedronGeometry(1, 1);
  const tree = (x, z, s) => {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.26 * s, 3 * s, 8), trunkMat);
    trunk.position.y = 1.5 * s;
    t.add(trunk);
    for (let k = 0; k < 4; k += 1) {
      const blob = new THREE.Mesh(leafGeo, leaves[Math.floor(rnd() * leaves.length)]);
      blob.scale.setScalar(s * (1.3 + rnd() * 0.8));
      blob.position.set((rnd() - 0.5) * 2 * s, s * (3.6 + rnd() * 1.6), (rnd() - 0.5) * 2 * s);
      t.add(blob);
    }
    t.traverse((o) => { o.castShadow = true; });
    t.position.set(x, 0, z);
    t.rotation.y = rnd() * 6.28;
    t.traverse((o) => o.layers.set(PROPS));
    park.add(t);
  };
  for (let k = 0; k < 70; k += 1) {
    const a = rnd() * Math.PI * 2;
    const r = 42 + rnd() * 50;
    const x = Math.cos(a) * r * 1.2;
    const z = Math.sin(a) * r;
    if (z > 20 && Math.abs(x) < 40) continue; // keep the view over your shoulder clear
    tree(x, z, 1 + rnd() * 0.9);
  }
  // A few closer ones beside the far end and the side courts, for depth.
  for (const [x, z, s] of [[-34, -26, 1.6], [35, -24, 1.4], [-12, -30, 1.3], [14, -31, 1.5], [-36, 4, 1.4], [37, -6, 1.6], [0, -36, 1.8]]) tree(x, z, s);

  // Sun: far side and left, high afternoon, shadows toward you and to the right. One shadow map over the court and its neighbours.
  sun.position.set(-18, 30, -10);
  sun.target.position.set(0, 0, 2);
  scene.add(sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 1; sc.far = 90;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  return park;
}
