export const presenceFragmentShader = `
precision highp float;

varying vec3 vColor;
varying float vAlpha;
varying float vSpark;
varying float vFresnel;

void main() {
  // Point coordinates range from (0,0) to (1,1)
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);

  if (dist > 0.5) {
    discard;
  }

  // Smooth circular falloff with hot center
  float core = smoothstep(0.5, 0.05, dist);
  float halo = exp(-dist * 5.0);
  float intensity = mix(halo, core, 0.65);

  if (vSpark > 0.5) {
    intensity = pow(intensity, 0.8) * 1.4;
  }

  gl_FragColor = vec4(vColor * intensity, vAlpha * intensity);
}
`;
