// WebGL 필터 렌더러. 원본(비디오·이미지·캔버스)을 텍스처로 올려 한 번에 색감·입자·빛샘·비네팅·테이프 효과를 입힌다.
import { resolve } from './filters.js';

const VS = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FS = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform vec4 u_crop;      // 원본에서 쓸 영역(uv): x, y, w, h
uniform float u_flipX;
uniform float u_time;
uniform float u_seed;
uniform float u_exposure, u_contrast, u_saturation, u_temp, u_tint, u_fade, u_mono;
uniform vec3 u_shadows, u_highlights;
uniform float u_grain, u_grainSize, u_vignette, u_leak, u_halation, u_soften, u_vhs, u_flicker, u_dust;
uniform vec3 u_leakColor;
uniform vec2 u_leakPos;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

vec3 src(vec2 uv) {
  uv = clamp(uv, 0.0, 1.0);
  if (u_flipX > 0.5) uv.x = 1.0 - uv.x;
  return texture2D(u_tex, u_crop.xy + uv * u_crop.zw).rgb;
}

void main() {
  vec2 uv = v_uv;
  float k = u_res.y / 1000.0;            // 해상도와 무관하게 같은 모양이 나오도록
  vec2 px = 1.0 / u_res;

  // 테이프: 가로 흔들림과 트래킹 띠
  if (u_vhs > 0.0) {
    float band = smoothstep(0.0, 0.03, abs(fract(uv.y * 0.7 - u_time * 0.07) - 0.5) - 0.44);
    uv.x += u_vhs * (sin(uv.y * 40.0 + u_time * 3.0) * 0.0012 + (1.0 - band) * 0.006 * (hash(vec2(floor(uv.y * 240.0), u_time)) - 0.3));
  }

  vec3 c = src(uv);
  if (u_soften > 0.0 || u_vhs > 0.0) {
    vec2 o = px * k * (1.2 + 1.6 * u_vhs);
    vec3 b = (src(uv + vec2(o.x, 0.0)) + src(uv - vec2(o.x, 0.0)) + src(uv + vec2(0.0, o.y)) + src(uv - vec2(0.0, o.y))) * 0.25;
    c = mix(c, b, clamp(u_soften + u_vhs * 0.3, 0.0, 1.0));
  }
  if (u_vhs > 0.0) {
    vec2 o = vec2(px.x * k * 4.0 * u_vhs, 0.0);  // 색 번짐
    c.r = mix(c.r, src(uv + o).r, 0.8);
    c.b = mix(c.b, src(uv - o).b, 0.8);
  }

  // 밝은 곳 주변 번짐(할레이션)
  if (u_halation > 0.0) {
    vec3 glow = vec3(0.0);
    float r = 6.0 * k;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.785398;
      vec3 s = src(uv + vec2(cos(a), sin(a)) * px * r);
      glow += max(s - 0.72, 0.0);
    }
    c += glow * 0.25 * u_halation * vec3(1.0, 0.45, 0.25);
  }

  float flick = 1.0 + u_flicker * (hash(vec2(floor(u_time * 12.0), 3.1)) - 0.5) * 0.12;
  c *= exp2(u_exposure) * flick;
  c *= vec3(1.0 + u_temp * 0.1, 1.0 - u_tint * 0.06, 1.0 - u_temp * 0.12);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, u_mono > 0.5 ? 0.0 : u_saturation);
  c = (c - 0.5) * u_contrast + 0.5;
  l = clamp(dot(c, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
  c += u_shadows * (1.0 - l) * (1.0 - l) * 1.6 + u_highlights * l * l * 1.6;
  c = mix(vec3(u_fade), vec3(1.0 - u_fade * 0.25), clamp(c, 0.0, 1.0));

  // 빛샘: 가장자리에서 들어오는 부드러운 색 덩어리 두 개, 스크린 합성
  if (u_leak > 0.0) {
    vec2 a = vec2(u_res.x / u_res.y, 1.0);
    float d1 = length((v_uv - u_leakPos) * a);
    float d2 = length((v_uv - u_leakPos * vec2(0.85, 1.1) - vec2(0.05, 0.08)) * a * vec2(1.6, 0.8));
    float m = smoothstep(1.15, 0.0, d1) * 0.95 + smoothstep(0.6, 0.0, d2) * 0.7;
    vec3 lc = u_leakColor * clamp(m * u_leak, 0.0, 1.0);
    c = 1.0 - (1.0 - c) * (1.0 - lc);
  }

  // 비네팅
  vec2 vd = (v_uv - 0.5) * vec2(u_res.x / u_res.y, 1.0);
  c *= 1.0 - u_vignette * smoothstep(0.35, 0.95, length(vd) * 1.25);

  if (u_vhs > 0.0) {
    c *= 1.0 - u_vhs * 0.1 * (0.5 + 0.5 * sin(v_uv.y * 520.0 * 3.14159)); // 주사선
    float line = step(0.985, hash(vec2(floor(v_uv.y * 300.0), floor(u_time * 20.0))));
    c += u_vhs * line * 0.25 * hash(gl_FragCoord.xy + u_time);
  }

  // 먼지·흠집
  if (u_dust > 0.0) {
    vec2 g = floor(v_uv * vec2(90.0, 90.0 * u_res.y / u_res.x));
    float h = hash(g + floor(u_seed * 7.0 + u_time * 8.0 * u_flicker));
    float speck = step(1.0 - 0.0025 * u_dust, h);
    c = mix(c, vec3(u_mono > 0.5 ? 0.95 : 0.12), speck * 0.7);
    float scratch = step(0.9994, hash(vec2(floor(v_uv.x * 700.0), floor(u_seed + u_time * 4.0 * u_flicker))));
    c += scratch * u_dust * 0.25;
  }

  // 필름 입자: 중간 밝기에서 가장 잘 보이게
  if (u_grain > 0.0) {
    vec2 cell = floor(gl_FragCoord.xy / max(1.0, u_grainSize * k));
    float n = hash(cell + u_seed) + hash(cell * 1.7 + u_seed + 17.0) - 1.0;
    l = dot(c, vec3(0.299, 0.587, 0.114));
    c += n * u_grain * (0.55 + 0.45 * (1.0 - abs(l - 0.5) * 2.0));
  }

  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

const UNIFORMS = ['u_res', 'u_crop', 'u_flipX', 'u_time', 'u_seed', 'u_exposure', 'u_contrast', 'u_saturation', 'u_temp', 'u_tint',
  'u_fade', 'u_mono', 'u_shadows', 'u_highlights', 'u_grain', 'u_grainSize', 'u_vignette', 'u_leak', 'u_leakColor', 'u_leakPos',
  'u_halation', 'u_soften', 'u_vhs', 'u_flicker', 'u_dust'];

export class Renderer {
  constructor() {
    this.canvas = document.createElement('canvas');
    // 그린 직후 drawImage로 옮기지만, 사파리에서 빈 화면이 나오는 일을 막으려 버퍼를 보존한다.
    const gl = this.canvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
    if (!gl) throw new Error('WebGL을 쓸 수 없습니다');
    this.gl = gl;
    this.maxSide = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const prog = gl.createProgram();
    for (const [type, code] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, code); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(prog, s);
    }
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = Object.fromEntries(UNIFORMS.map(n => [n, gl.getUniformLocation(prog, n)]));
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  }

  upload(source) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
  }

  // crop은 원본 픽셀 좌표 {x,y,w,h}. 원본 크기 srcW·srcH로 uv를 만든다(텍스처는 위아래가 뒤집혀 올라감).
  draw(filter, { srcW, srcH, crop, outW, outH, flipX = false, time = 0, seed = 0 }) {
    const gl = this.gl, u = this.u, p = resolve(filter);
    if (this.canvas.width !== outW || this.canvas.height !== outH) { this.canvas.width = outW; this.canvas.height = outH; }
    gl.viewport(0, 0, outW, outH);
    gl.uniform2f(u.u_res, outW, outH);
    gl.uniform4f(u.u_crop, crop.x / srcW, 1 - (crop.y + crop.h) / srcH, crop.w / srcW, crop.h / srcH);
    gl.uniform1f(u.u_flipX, flipX ? 1 : 0);
    gl.uniform1f(u.u_time, time);
    gl.uniform1f(u.u_seed, seed);
    for (const k of ['exposure', 'contrast', 'saturation', 'temp', 'tint', 'fade', 'mono', 'grain', 'grainSize', 'vignette', 'leak', 'halation', 'soften', 'vhs', 'flicker', 'dust']) gl.uniform1f(u['u_' + k], p[k]);
    gl.uniform3fv(u.u_shadows, p.shadows);
    gl.uniform3fv(u.u_highlights, p.highlights);
    gl.uniform3fv(u.u_leakColor, p.leakColor);
    gl.uniform2fv(u.u_leakPos, p.leakPos);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.canvas;
  }
}
