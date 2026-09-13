/* Concept 3 — the two WebGL moments.
 *
 * 1. Hero sphere: a true three-dimensional shell of latitude rings on a tilted
 *    axis. Every ring is drawn twice, as a hairline and as a bead of points, and
 *    shaded by how directly it faces the camera, so the back of the sphere recedes
 *    instead of overlapping the front. A slow wave travels along the axis, the
 *    shell answers the pointer, and scrolling away pulls the rings apart.
 *
 * 2. Mark: the 7D diamond cut into eight extruded shards of polished brass and
 *    dark bronze, lit by a baked room environment so the facets carry real
 *    reflections. Scroll brings the shards in from both sides as mirrored pairs
 *    and seats them; a sheen then travels across the assembled mark.
 */
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = matchMedia('(hover: none)').matches;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function makeRenderer(canvas) {
  const r = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true, powerPreference: 'high-performance'});
  r.setPixelRatio(Math.min(devicePixelRatio, TOUCH ? 1.5 : 2));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1;
  r.setClearColor(0x000000, 0);
  return r;
}
function sizeOf(canvas) {
  const b = canvas.parentElement.getBoundingClientRect();
  return [Math.max(1, Math.round(b.width)), Math.max(1, Math.round(b.height))];
}

/* =========================================================================
   HERO SPHERE
   ========================================================================= */
export function initHero(canvas) {
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, .1, 100);
  cam.position.set(0, 0, 9);

  const shell = new THREE.Group();
  shell.rotation.z = -Math.PI / 4;
  shell.rotation.x = .95;
  scene.add(shell);

  const R = 1.75, RINGS = TOUCH ? 18 : 24, SEG = 240;
  const uniforms = {
    uTime: {value: 0}, uExplode: {value: 0}, uFade: {value: 1},
    uBrass: {value: new THREE.Color(0xE0A94A)}, uIvory: {value: new THREE.Color(0xF4EDE0)}
  };
  // shared vertex logic: breathing wave along the axis, scroll explosion, facing term
  const vert = /* glsl */`
    attribute float aRing;
    uniform float uTime, uExplode;
    varying float vFacing, vRing;
    void main(){
      vec3 p = position;
      float wave = sin(uTime*1.15 - aRing*6.0);
      float rad = 1.0 + 0.06*wave;
      p.y += 0.05*wave;
      p.xz *= rad;
      p.y += uExplode*(aRing-0.5)*3.2;
      p.xz *= 1.0 + uExplode*0.35;
      vec4 mv = modelViewMatrix*vec4(p,1.0);
      // how much this point faces the eye: the front of the shell is bright, the back recedes
      vec3 n = normalize(normalMatrix*normalize(position));
      vFacing = clamp(dot(n, normalize(-mv.xyz))*0.5+0.5, 0.0, 1.0);
      vRing = aRing;
      gl_PointSize = (1.6 + 2.2*vFacing) * (${(Math.min(devicePixelRatio, 2)).toFixed(1)});
      gl_Position = projectionMatrix*mv;
    }`;
  const lineMat = new THREE.ShaderMaterial({
    uniforms, vertexShader: vert, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    fragmentShader: /* glsl */`
      uniform vec3 uBrass, uIvory; uniform float uFade, uTime;
      varying float vFacing, vRing;
      void main(){
        float glint = pow(max(0.0, sin(uTime*0.7 - vRing*9.0)), 12.0);
        vec3 c = mix(uBrass*0.55, mix(uBrass, uIvory, 0.55), vFacing) + glint*uIvory*0.6;
        gl_FragColor = vec4(c, (0.015 + 0.78*pow(vFacing,2.6)) * uFade);
      }`
  });
  const dotMat = new THREE.ShaderMaterial({
    uniforms, vertexShader: vert, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    fragmentShader: /* glsl */`
      uniform vec3 uBrass, uIvory; uniform float uFade;
      varying float vFacing;
      void main(){
        float d = length(gl_PointCoord-0.5);
        float a = smoothstep(0.5, 0.0, d);
        vec3 c = mix(uBrass, uIvory, vFacing*0.7);
        gl_FragColor = vec4(c, a * (0.0 + 0.7*pow(vFacing,3.0)) * uFade);
      }`
  });

  for (let i = 0; i < RINGS; i++) {
    const v = -1 + 2 * (i + .5) / RINGS, y = v * R, r = R * Math.sqrt(1 - v * v);
    const pos = new Float32Array(SEG * 3), ring = new Float32Array(SEG);
    for (let k = 0; k < SEG; k++) {
      const a = k / SEG * Math.PI * 2;
      pos[k * 3] = Math.cos(a) * r; pos[k * 3 + 1] = y; pos[k * 3 + 2] = Math.sin(a) * r;
      ring[k] = i / (RINGS - 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aRing', new THREE.BufferAttribute(ring, 1));
    shell.add(new THREE.LineLoop(g, lineMat));
    // beads: every fourth vertex, so the shell reads as drawn with a jewelled pen
    const bp = new Float32Array(Math.ceil(SEG / 4) * 3), br = new Float32Array(Math.ceil(SEG / 4));
    for (let k = 0, j = 0; k < SEG; k += 4, j++) { bp.set(pos.subarray(k * 3, k * 3 + 3), j * 3); br[j] = ring[k]; }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    bg.setAttribute('aRing', new THREE.BufferAttribute(br, 1));
    shell.add(new THREE.Points(bg, dotMat));
  }

  // (no separate equator: an unshaded ring ignores the depth fade and cut a bright stripe through the shell)

  // dust drifting through and around the shell
  const DUST = TOUCH ? 380 : 900;
  const dpos = new Float32Array(DUST * 3), dseed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    const rr = 2.2 + Math.random() * 3.2, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    dpos[i * 3] = rr * Math.sin(ph) * Math.cos(th); dpos[i * 3 + 1] = rr * Math.cos(ph); dpos[i * 3 + 2] = rr * Math.sin(ph) * Math.sin(th);
    dseed[i] = Math.random();
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  dg.setAttribute('aSeed', new THREE.BufferAttribute(dseed, 1));
  const dust = new THREE.Points(dg, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSeed; uniform float uTime; varying float vA;
      void main(){
        vec3 p = position;
        p.y += sin(uTime*0.25 + aSeed*20.0)*0.25;
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        vA = 0.25 + 0.75*fract(aSeed*13.7);
        gl_PointSize = (1.0 + 1.6*fract(aSeed*7.1)) * ${(Math.min(devicePixelRatio, 2)).toFixed(1)};
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uBrass; uniform float uFade; varying float vA;
      void main(){ float d=length(gl_PointCoord-0.5); gl_FragColor=vec4(uBrass, smoothstep(0.5,0.0,d)*vA*0.35*uFade); }`
  }));
  scene.add(dust);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, cam));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .7, .65, 0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let W = 1, H = 1, px = 0, py = 0, tx = 0, ty = 0;
  const resize = () => {
    [W, H] = sizeOf(canvas);
    renderer.setSize(W, H, false); composer.setSize(W, H);
    cam.aspect = W / H;
    // keep the shell a consistent share of the frame on tall and wide screens
    cam.position.z = W / H < 1 ? 9 / Math.max(.62, W / H) : 9;
    cam.updateProjectionMatrix();
  };
  resize();
  if (!TOUCH) addEventListener('pointermove', e => { tx = (e.clientX / innerWidth - .5); ty = (e.clientY / innerHeight - .5); }, {passive: true});

  return {
    resize,
    render(t, leave) {
      uniforms.uTime.value = REDUCED ? 0 : t;
      uniforms.uExplode.value = easeInOut(clamp(leave));
      uniforms.uFade.value = 1 - clamp((leave - .55) / .45);
      px = lerp(px, tx, .05); py = lerp(py, ty, .05);
      shell.rotation.y = (REDUCED ? 0 : t * .08) + px * .5;
      shell.rotation.x = .95 + py * .3;
      // the shell sits opposite the copy, which in Arabic means the left
      const side = document.documentElement.dir === 'rtl' ? -1 : 1;
      shell.position.x = lerp(shell.position.x, W / H > 1.1 ? 1.55 * side : 0, .1);
      shell.position.y = W / H > 1.1 ? .25 : .9;
      dust.rotation.y = t * .015;
      composer.render();
    }
  };
}

/* =========================================================================
   MARK — eight shards assemble the diamond
   ========================================================================= */
export function initMark(canvas) {
  const renderer = makeRenderer(canvas);
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
  pm.dispose();
  const cam = new THREE.PerspectiveCamera(32, 1, .1, 100);
  cam.position.set(0, 0, 8.4);

  const key = new THREE.DirectionalLight(0xFFE6C0, 1.6); key.position.set(3, 4, 5); scene.add(key);
  const fill = new THREE.DirectionalLight(0xE8D2B0, .5); fill.position.set(-4, 1, 4); scene.add(fill);
  const rim = new THREE.DirectionalLight(0x9FB8D8, 1.1); rim.position.set(-4, -2, -3); scene.add(rim);
  const sheen = new THREE.PointLight(0xFFF1D6, 0, 9, 2); scene.add(sheen);

  const mark = new THREE.Group(); scene.add(mark);
  const S = 1.75;
  const T = [0, S], Rr = [S, 0], B = [0, -S], L = [-S, 0], C = [0, 0];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const tris = [[T, mid(T, Rr), C], [mid(T, Rr), Rr, C], [Rr, mid(Rr, B), C], [mid(Rr, B), B, C],
                [B, mid(B, L), C], [mid(B, L), L, C], [L, mid(L, T), C], [mid(L, T), T, C]];

  // one metal in two tempers: close enough to read as a single cast object,
  // different enough that neighbouring facets separate under the light
  const brass = new THREE.MeshPhysicalMaterial({color: 0xE2AE55, metalness: 1, roughness: .16, clearcoat: .4, clearcoatRoughness: .2, envMapIntensity: 1.35, flatShading: true, side: THREE.DoubleSide});
  const bronze = new THREE.MeshPhysicalMaterial({color: 0xB07A36, metalness: 1, roughness: .3, clearcoat: .3, clearcoatRoughness: .3, envMapIntensity: 1.2, flatShading: true, side: THREE.DoubleSide});
  const edge = new THREE.LineBasicMaterial({color: 0xFFF1D2, transparent: true, opacity: .0});

  /* A cut facet, not a flat tile. The outer edge sits at the rim, the inner corner
     rises to a raised apex at the centre of the mark, and a thin back plate gives it
     body. Every facet therefore faces a slightly different direction and catches the
     light on its own, which is what makes a cut stone or a chiselled plaque read. */
  const APEX = .62, BACK = -.16, RIM = .04;
  function facetGeometry(a, b, c, cx, cy) {
    const P = (q, z) => new THREE.Vector3(q[0] - cx, q[1] - cy, z);
    const ta = P(a, RIM), tb = P(b, RIM), tc = P(c, APEX);     // top: rim, rim, apex
    const ba = P(a, BACK), bb = P(b, BACK), bc = P(c, BACK);   // back plate
    const tri = (p, q, r, out) => out.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
    const v = [];
    tri(ta, tb, tc, v);                          // cut face
    tri(bb, ba, bc, v);                          // back
    tri(ba, bb, tb, v); tri(ba, tb, ta, v);      // outer rim wall
    tri(bb, bc, tc, v); tri(bb, tc, tb, v);      // inner wall
    tri(bc, ba, ta, v); tri(bc, ta, tc, v);      // inner wall
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  }

  const shards = tris.map((tri, i) => {
    const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
    // shrink each facet toward its centroid a touch, so a hairline gap shows the cut
    const k = .972, sh = q => [cx + (q[0] - cx) * k, cy + (q[1] - cy) * k];
    const geo = facetGeometry(sh(tri[0]), sh(tri[1]), sh(tri[2]), cx, cy);
    const mesh = new THREE.Mesh(geo, i % 2 ? bronze : brass);
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edge);
    mesh.add(lines);
    mark.add(mesh);
    const side = cx < -.01 ? -1 : cx > .01 ? 1 : (cy > 0 ? -1 : 1);
    const seed = (i * 37 % 11) / 11;
    return {
      mesh, home: new THREE.Vector3(cx, cy, 0),
      from: new THREE.Vector3(side * (4.2 + seed * 2.2), cy * 1.8 + (seed - .5) * 2.4, -1.5 - seed * 3),
      rot: new THREE.Euler((seed - .5) * 3, side * (1.6 + seed), (seed - .5) * 2.4),
      delay: Math.abs(i - 3.5) / 3.5 * .22
    };
  });

  // a hairline ring that closes around the finished mark
  const ringPts = [];
  for (let k = 0; k <= 256; k++) { const a = Math.PI / 2 - k / 256 * Math.PI * 2; ringPts.push(new THREE.Vector3(Math.cos(a) * 2.55, Math.sin(a) * 2.55, 0)); }
  const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
  const ring = new THREE.Line(ringGeo, new THREE.LineBasicMaterial({color: 0xE0A94A, transparent: true, opacity: .7}));
  ringGeo.setDrawRange(0, 0);
  scene.add(ring);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, cam));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), .18, .4, .94));
  composer.addPass(new OutputPass());

  let W = 1, H = 1;
  const resize = () => {
    [W, H] = sizeOf(canvas);
    renderer.setSize(W, H, false); composer.setSize(W, H);
    cam.aspect = W / H; cam.position.z = W / H < 1 ? 8.4 / Math.max(.55, W / H) : 8.4;
    cam.updateProjectionMatrix();
  };
  resize();
  const q = new THREE.Quaternion(), qa = new THREE.Quaternion();

  return {
    resize,
    render(t, p) {
      shards.forEach(s => {
        const k = easeInOut(clamp((p - s.delay) / .6));
        s.mesh.position.lerpVectors(s.from, s.home, k);
        qa.setFromEuler(s.rot); q.identity();
        s.mesh.quaternion.slerpQuaternions(qa, q, k);
      });
      const settled = clamp((p - .62) / .3);
      edge.opacity = .55 * settled;
      ringGeo.setDrawRange(0, Math.floor(257 * easeInOut(clamp((p - .66) / .28))));
      // once seated the mark turns slowly and a sheen crosses it
      const idle = REDUCED ? 0 : t;
      mark.rotation.y = -.42 + Math.sin(idle * .35) * .22 * settled + (1 - settled) * -.2;
      mark.rotation.x = .28 + Math.sin(idle * .27) * .06 * settled;
      sheen.intensity = 7 * settled;
      sheen.position.set(Math.sin(idle * .6) * 3.4, Math.cos(idle * .45) * 1.4, 3.6);
      composer.render();
    }
  };
}
