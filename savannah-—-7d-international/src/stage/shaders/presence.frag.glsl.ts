export const presenceFragmentShader = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vAlpha;
varying float vSpark;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.06, d);
  float halo = exp(-d * 6.0);
  float i = mix(halo, core, 0.6);
  if (vSpark > 0.5) i = pow(i, 0.8) * 1.3;
  gl_FragColor = vec4(vColor * i, vAlpha * i);
}
`;
