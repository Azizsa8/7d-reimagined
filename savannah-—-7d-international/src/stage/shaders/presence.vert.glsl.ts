import { simplexNoiseGLSL } from './noise.glsl';

export const presenceVertexShader = `
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
uniform float uTealTint;

// Morph target parameters
uniform float uMorph;

attribute float aSpark;
attribute float aRandom;
attribute vec3 aTargetPos;
attribute vec3 aTargetColor;
attribute float aDelay;
attribute float aArcHeight;

varying vec3 vColor;
varying float vAlpha;
varying float vSpark;
varying float vFresnel;

void main() {
  vec3 n = normalize(position);
  vec3 pos = n;

  // State audio displacement
  float slowTime = uTime * uNoiseSpeed;
  vec3 noiseCoord = n * 1.8 + vec3(slowTime * 0.4, slowTime * 0.3, slowTime * 0.5);
  float nVal = fbm2(noiseCoord);

  // Audio band contributions
  // Low band swells the body
  float lowDisplace = uLow * 0.38;
  // Mid band ripples the surface
  float midDisplace = nVal * (0.12 + uMid * 0.45);
  // High band adds high frequency tremor/sparkle
  float highDisplace = sin(uTime * 18.0 + aRandom * 6.28) * (uHigh * 0.15);

  // Listening mic inward ripple
  float micInward = -uMicLevel * 0.25 * (0.5 + 0.5 * sin(length(pos.xy) * 12.0 - uTime * 8.0));

  // Combine displacement along normal
  float totalDisplace = (nVal * 0.08 + lowDisplace + midDisplace + highDisplace + micInward);
  
  // Apply hush (contracts on barge-in)
  float effectiveRadius = uRadius * (1.0 - uHush * 0.22);
  pos = n * (effectiveRadius + totalDisplace);

  // Listening state slight flattening towards viewer (Z direction)
  pos.z *= (1.0 - uFlatten * 0.18);

  // Morph blending if uMorph > 0.0
  float p = clamp((uMorph - aDelay) / max(0.001, 1.0 - aDelay), 0.0, 1.0);
  float arc = sin(p * 3.14159) * aArcHeight;
  vec3 morphedPos = mix(pos, aTargetPos, p) + vec3(0.0, arc, 0.0);
  pos = mix(pos, morphedPos, step(0.001, uMorph));

  // Palette:
  // Core: warm brass #E0A94A (0.878, 0.663, 0.290)
  // Rim: ivory #F4F1EA (0.957, 0.945, 0.918)
  // Sparks: teal #2FA98B (0.184, 0.663, 0.545)
  vec3 brass = vec3(0.878, 0.663, 0.290);
  vec3 ivory = vec3(0.957, 0.945, 0.918);
  vec3 teal  = vec3(0.184, 0.663, 0.545);

  // View vector and fresnel term for volumetric depth
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  vec3 viewDir = normalize(-mvPosition.xyz);
  vec3 transformedNormal = normalize(normalMatrix * n);
  float fresnel = clamp(1.0 - abs(dot(viewDir, transformedNormal)), 0.0, 1.0);
  vFresnel = fresnel;

  // Base gradient: core (low fresnel/inner) to rim (ivory)
  vec3 baseColor = mix(brass, ivory, pow(fresnel, 1.3));

  // Listening state: teal rim tint rises
  baseColor = mix(baseColor, teal, fresnel * uTealTint);

  // Thinking state: sweep band along latitude
  float latDist = abs(n.y - uSweepPos);
  float sweepBand = smoothstep(0.35, 0.0, latDist);
  baseColor += brass * sweepBand * 0.6;

  // Teal sparks on 2% of particles
  if (aSpark > 0.5) {
    baseColor = mix(baseColor, teal, 0.85);
    baseColor += vec3(0.15, 0.25, 0.2) * (1.0 + uHigh * 2.0);
  }

  // Audio swell brightness boost
  baseColor += vec3(0.12, 0.08, 0.02) * (uLevel * 1.2);

  // Morph target color blend
  baseColor = mix(baseColor, aTargetColor, p);

  vColor = baseColor;
  vSpark = aSpark;

  // Alpha modulation: facing particles slightly brighter, rim soft
  float alpha = 0.55 + 0.45 * pow(1.0 - fresnel * 0.5, 2.0);
  alpha *= (1.0 - uHush * 0.45);
  vAlpha = alpha;

  // Size attenuation with perspective
  gl_PointSize = uPointSize * (1.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;
