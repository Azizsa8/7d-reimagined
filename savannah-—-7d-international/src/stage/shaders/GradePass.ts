import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null },
    uShadowLift: { value: new THREE.Color(0x0B0D12) }, // lifted shadows #0B0D12
    uHighlightWarm: { value: new THREE.Color(0xE0A94A) }, // warm brass highlights #E0A94A
    uVignetteStrength: { value: 0.25 },
    uChromaticAberration: { value: 0.0015 },
    uExposure: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec3 uShadowLift;
    uniform vec3 uHighlightWarm;
    uniform float uVignetteStrength;
    uniform float uChromaticAberration;
    uniform float uExposure;

    varying vec2 vUv;

    void main() {
      vec2 center = vec2(0.5, 0.5);
      vec2 uvOffset = vUv - center;
      float distFromCenter = length(uvOffset);

      // Chromatic Aberration at frame edges only
      float ca = uChromaticAberration * smoothstep(0.3, 0.8, distFromCenter);
      vec2 rUv = vUv + normalize(uvOffset + 0.0001) * ca;
      vec2 gUv = vUv;
      vec2 bUv = vUv - normalize(uvOffset + 0.0001) * ca;

      float r = texture2D(tDiffuse, rUv).r;
      float g = texture2D(tDiffuse, gUv).g;
      float b = texture2D(tDiffuse, bUv).b;
      vec3 color = vec3(r, g, b) * uExposure;

      // Subtle vignette
      float vignette = 1.0 - smoothstep(0.45, 1.0, distFromCenter) * uVignetteStrength;
      color *= vignette;

      // Film grade: Lift shadows toward #0B0D12, warm highlights toward brass
      float lum = dot(color, vec3(0.299, 0.587, 0.114));
      
      // Shadow lift on lower luminance
      vec3 lifted = mix(uShadowLift, color, smoothstep(0.0, 0.35, lum));
      // Warm highlight tint on upper luminance
      vec3 graded = mix(lifted, lifted * (vec3(1.0) + (uHighlightWarm - vec3(0.5)) * 0.25), smoothstep(0.6, 1.0, lum));

      gl_FragColor = vec4(graded, 1.0);
    }
  `,
};

export function createGradePass() {
  return new ShaderPass(GradeShader);
}
