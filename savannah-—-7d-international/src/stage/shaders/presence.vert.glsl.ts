import { simplexNoiseGLSL } from './noise.glsl';

export const presenceVertexShader = /* glsl */ `
${simplexNoiseGLSL}

uniform float uTime;
uniform float uRadius;
uniform float uNoiseSpeed;
uniform float uLevel;
uniform float uLow;
uniform float uMid;
uniform float uHigh;
uniform float uMicLevel;
uniform float uFlatten;
uniform float uHush;
uniform float uSweepPos;
uniform float uPointSize;
uniform float uDpr;
uniform float uDistance;
uniform float uEmber;
uniform float uBodyScale;
uniform float uTealTint;
uniform float uMorph;
uniform float uScatter;
uniform float uAlpha;
uniform float uWarmth;   // 0 = cool grey-blue (lost connection) … 1 = brass
uniform vec3 uCenter;    // where the morph target's centre is (world units)

attribute float aSpark;
attribute float aRandom;
attribute vec3 aTargetPos;
attribute vec3 aTargetColor;
attribute float aDelay;
attribute float aArcHeight;

varying vec3 vColor;
varying float vAlpha;
varying float vSpark;

void main() {
  vec3 n = normalize(position);

  float slowTime = uTime * uNoiseSpeed;
  vec3 nc = n * 1.8 + vec3(slowTime * 0.4, slowTime * 0.3, slowTime * 0.5);
  float nVal = fbm2(nc);

  float lowD = uLow * 0.30;
  float midD = nVal * (0.10 + uMid * 0.34);
  float highD = sin(uTime * 18.0 + aRandom * 6.28318) * (uHigh * 0.10);
  float micIn = -uMicLevel * 0.22 * (0.5 + 0.5 * sin(n.y * 9.0 - uTime * 7.0));

  float radius = uRadius * (1.0 - uHush * 0.22);
  float dispScale = (1.0 - uEmber * 0.75) * clamp(uBodyScale, 0.08, 1.0);
  vec3 pos = n * (radius + (nVal * 0.07 + lowD + midD + highD + micIn) * dispScale);
  pos.z *= (1.0 - uFlatten * 0.16);

  // Morph to target along a curved path, each particle with its own delay.
  float p = clamp((uMorph - aDelay * 0.35) / max(0.001, 1.0 - aDelay * 0.35), 0.0, 1.0);
  p = p * p * (3.0 - 2.0 * p);
  vec3 arc = vec3(0.0, sin(p * 3.14159) * aArcHeight, sin(p * 3.14159) * aArcHeight * 0.4);
  vec3 morphed = mix(pos, aTargetPos, p) + arc * step(0.001, uMorph);
  // Scatter outward from the target centre as golden dust.
  vec3 away = normalize(aTargetPos - uCenter + vec3(aRandom - 0.5, aRandom * 0.7 - 0.35, 0.3));
  morphed += away * uScatter * (0.5 + aRandom * 0.9) + vec3(0.0, uScatter * 0.25, 0.0);
  pos = morphed;

  vec3 brass = vec3(0.878, 0.663, 0.290);
  vec3 ivory = vec3(0.957, 0.945, 0.918);
  vec3 teal  = vec3(0.184, 0.663, 0.545);
  vec3 cool  = vec3(0.42, 0.50, 0.62);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vec3 viewDir = normalize(-mv.xyz);
  vec3 tn = normalize(normalMatrix * n);
  float fresnel = clamp(1.0 - abs(dot(viewDir, tn)), 0.0, 1.0);

  vec3 base = mix(brass, ivory, pow(fresnel, 1.4));
  base = mix(cool, base, uWarmth);
  base = mix(base, teal, fresnel * uTealTint);
  float band = smoothstep(0.30, 0.0, abs(n.y - uSweepPos));
  base += brass * band * 0.55;
  if (aSpark > 0.5) base = mix(base, teal, 0.85) + vec3(0.1, 0.2, 0.16) * (1.0 + uHigh * 2.0);
  base += vec3(0.10, 0.07, 0.02) * uLevel;
  base = mix(base, aTargetColor, p * (1.0 - uScatter * 0.6));
  vColor = base;
  vSpark = aSpark;

  float depthFade = smoothstep(-2.4, 0.4, pos.z * (1.0 - p));
  float alpha = (0.42 + 0.5 * pow(1.0 - fresnel * 0.6, 2.0)) * (0.5 + 0.5 * depthFade);
  alpha *= (1.0 - uHush * 0.45) * (1.0 - uScatter) * uAlpha * (1.0 - uEmber * 0.6) * mix(0.02, 1.0, pow(uBodyScale, 4.0));
  vAlpha = alpha;

  gl_PointSize = uPointSize * uDpr * (uDistance / -mv.z) * (1.0 + aSpark * 0.6) * (1.0 - p * 0.35) * (1.0 - uEmber * 0.55) * mix(0.6, 1.0, uBodyScale);
  gl_Position = projectionMatrix * mv;
}
`;
