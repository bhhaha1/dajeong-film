// 카메라 상세 화면의 대표·예시 사진. 남의 사진을 쓰지 않으려고 코드로 그린 장면이다(카메라 필터를 입혀서 보여 준다).
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const lin = (g, y0, y1, stops) => { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
function glow(g, x, y, r, color) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}
// 사람 실루엣(머리+몸)
function person(g, x, y, s, body, skin = '#e3b08f') {
  g.fillStyle = body; g.beginPath(); g.ellipse(x, y + s * 0.95, s * 0.42, s * 0.75, 0, 0, 7); g.fill();
  g.fillStyle = skin; g.beginPath(); g.arc(x, y, s * 0.26, 0, 7); g.fill();
  g.fillStyle = '#2a201c'; g.beginPath(); g.arc(x, y - s * 0.06, s * 0.28, Math.PI, 0); g.fill();
}

const SCENES = {
  street(g, w, h, r) { // 해 질 녘 상점가
    g.fillStyle = lin(g, 0, h * 0.6, [[0, '#2c3550'], [0.6, '#b0694a'], [1, '#e7a865']]); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 7; i++) {
      const bx = i * w / 6 - w * 0.05, bw = w / 6 + 4, bh = h * (0.35 + r() * 0.25);
      g.fillStyle = ['#2b2a33', '#3a2f2d', '#24303a'][i % 3]; g.fillRect(bx, h * 0.72 - bh, bw, bh + h);
      for (let k = 0; k < 6; k++) if (r() > 0.4) { g.fillStyle = r() > 0.5 ? '#f3c37a' : '#9fd0c8'; g.fillRect(bx + 8 + (k % 2) * bw * 0.45, h * 0.72 - bh + 14 + Math.floor(k / 2) * bh * 0.22, bw * 0.3, bh * 0.1); }
    }
    g.fillStyle = '#f6d48a'; g.fillRect(w * 0.18, h * 0.55, w * 0.42, h * 0.17);
    glow(g, w * 0.39, h * 0.63, w * 0.4, 'rgba(255,200,120,0.55)');
    g.fillStyle = '#c94f3d'; g.fillRect(w * 0.16, h * 0.5, w * 0.46, h * 0.05);
    g.fillStyle = lin(g, h * 0.72, h, [[0, '#4a4040'], [1, '#1d1a1a']]); g.fillRect(0, h * 0.72, w, h);
    person(g, w * 0.7, h * 0.6, h * 0.11, '#1e2a3a');
    glow(g, w * 0.88, h * 0.4, w * 0.12, 'rgba(255,230,170,0.9)');
  },
  sea(g, w, h, r) { // 한낮 바다
    g.fillStyle = lin(g, 0, h * 0.5, [[0, '#2f6fb3'], [1, '#bfe0ee']]); g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 5; i++) { const cx = r() * w, cy = h * (0.08 + r() * 0.25); for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(cx + k * w * 0.05, cy + (k % 2) * 6, w * (0.04 + r() * 0.03), 0, 7); g.fill(); } }
    g.fillStyle = lin(g, h * 0.5, h * 0.8, [[0, '#1f5c88'], [1, '#2f8fa8']]); g.fillRect(0, h * 0.5, w, h * 0.3);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 160; i++) g.fillRect(r() * w, h * 0.5 + r() * h * 0.3, 2 + r() * 10, 1.5);
    g.fillStyle = lin(g, h * 0.8, h, [[0, '#e6d2ae'], [1, '#c7aa80']]); g.fillRect(0, h * 0.8, w, h);
    person(g, w * 0.35, h * 0.62, h * 0.12, '#f2f0ea');
  },
  room(g, w, h, r) { // 창가의 오후
    g.fillStyle = '#c9b49a'; g.fillRect(0, 0, w, h);
    g.fillStyle = lin(g, h * 0.1, h * 0.55, [[0, '#cfe3ef'], [1, '#f5efe0']]); g.fillRect(w * 0.15, h * 0.1, w * 0.55, h * 0.45);
    g.strokeStyle = '#efe7da'; g.lineWidth = w * 0.02; g.strokeRect(w * 0.15, h * 0.1, w * 0.55, h * 0.45);
    g.beginPath(); g.moveTo(w * 0.425, h * 0.1); g.lineTo(w * 0.425, h * 0.55); g.stroke();
    g.fillStyle = 'rgba(255,240,200,0.35)';
    g.beginPath(); g.moveTo(w * 0.15, h * 0.55); g.lineTo(w * 0.7, h * 0.55); g.lineTo(w, h * 0.95); g.lineTo(w * 0.35, h * 0.95); g.fill();
    g.fillStyle = '#8a6748'; g.fillRect(0, h * 0.68, w, h * 0.06);
    g.fillStyle = '#6e5038'; g.fillRect(0, h * 0.74, w, h);
    g.fillStyle = '#f4f1ea'; g.fillRect(w * 0.6, h * 0.58, w * 0.1, h * 0.1);
    g.fillStyle = '#3f6b3a'; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(w * 0.25 + Math.cos(i) * w * 0.06, h * 0.56 - r() * h * 0.08, w * 0.04, h * 0.02, i, 0, 7); g.fill(); }
    g.fillStyle = '#b5583a'; g.fillRect(w * 0.21, h * 0.58, w * 0.08, h * 0.1);
  },
  field(g, w, h, r) { // 풀밭과 나무
    g.fillStyle = lin(g, 0, h * 0.6, [[0, '#3f86c9'], [1, '#d6ecf2']]); g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 4; i++) { const cx = r() * w, cy = h * (0.1 + r() * 0.2); for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(cx + k * w * 0.04, cy - (k % 2) * 8, w * 0.045, 0, 7); g.fill(); } }
    g.fillStyle = lin(g, h * 0.58, h, [[0, '#6aa04a'], [1, '#2f5f2a']]); g.fillRect(0, h * 0.58, w, h);
    g.fillStyle = '#3b2a1e'; g.fillRect(w * 0.72, h * 0.38, w * 0.035, h * 0.22);
    g.fillStyle = '#2f6a35'; g.beginPath(); g.arc(w * 0.74, h * 0.34, w * 0.14, 0, 7); g.fill();
    g.fillStyle = '#f2f0ea'; for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(w * (0.15 + r() * 0.45), h * (0.75 + r() * 0.15), w * 0.03, h * 0.012, 0, 0, 7); g.fill(); }
    person(g, w * 0.3, h * 0.58, h * 0.1, '#e8c547');
  },
  sunwall(g, w, h, r) { // 햇빛 드는 벽돌 벽과 빨간 문
    g.fillStyle = '#d9c4a4'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,90,60,0.35)'; g.lineWidth = 2;
    for (let y = 0; y < h; y += h * 0.035) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = ((y / (h * 0.035)) % 2) * w * 0.06; x < w; x += w * 0.12) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h * 0.035); g.stroke(); } }
    g.fillStyle = '#a8432f'; g.fillRect(w * 0.35, h * 0.1, w * 0.36, h * 0.62);
    g.fillStyle = 'rgba(40,25,20,0.55)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.45, 0); g.lineTo(w * 0.15, h); g.lineTo(0, h); g.fill();
    g.fillStyle = '#8f8a82'; g.fillRect(0, h * 0.72, w, h);
    person(g, w * 0.53, h * 0.5, h * 0.13, '#31435f');
    glow(g, w * 0.9, h * 0.15, w * 0.35, 'rgba(255,220,150,0.45)');
  },
  neon(g, w, h, r) { // 밤거리 네온
    g.fillStyle = lin(g, 0, h, [[0, '#0b0d1a'], [0.7, '#1a1530'], [1, '#0d0b12']]); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) { g.fillStyle = '#15131f'; g.fillRect(i * w / 5 - 10, h * (0.15 + r() * 0.15), w / 5 + 8, h); }
    const colors = ['#ff3d7f', '#3de0ff', '#ffb43d', '#a46bff', '#ff5a3d'];
    for (let i = 0; i < 9; i++) {
      const x = r() * w * 0.9, y = h * (0.2 + r() * 0.4), c = colors[i % 5], bw = w * (0.08 + r() * 0.12), bh = h * 0.04;
      glow(g, x + bw / 2, y + bh / 2, bw, c + '55');
      g.fillStyle = c; g.fillRect(x, y, bw, bh);
    }
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, h * 0.78, w, h);
    for (let i = 0; i < 9; i++) { g.fillStyle = colors[i % 5] + '33'; g.fillRect(r() * w, h * 0.8, w * 0.05, h * 0.2); }
    person(g, w * 0.45, h * 0.62, h * 0.11, '#2a2433', '#d9a08a');
    glow(g, w * 0.45, h * 0.62, w * 0.15, 'rgba(255,180,200,0.25)');
  },
  forest(g, w, h, r) { // 숲길과 빛
    g.fillStyle = lin(g, 0, h, [[0, '#cfe6b8'], [0.5, '#5f8f4a'], [1, '#22401f']]); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) { const x = r() * w; g.fillStyle = `rgba(${30 + r() * 30},${50 + r() * 40},${25 + r() * 20},0.9)`; g.fillRect(x, 0, w * (0.02 + r() * 0.04), h * 0.8); g.beginPath(); g.arc(x, h * (0.1 + r() * 0.3), w * (0.1 + r() * 0.15), 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,250,210,0.18)';
    for (let i = 0; i < 5; i++) { g.beginPath(); const x = w * (0.2 + i * 0.15); g.moveTo(x, 0); g.lineTo(x + w * 0.06, 0); g.lineTo(x + w * 0.3, h); g.lineTo(x + w * 0.1, h); g.fill(); }
    g.fillStyle = '#b8a27a'; g.beginPath(); g.moveTo(w * 0.42, h * 0.7); g.lineTo(w * 0.58, h * 0.7); g.lineTo(w * 0.9, h); g.lineTo(w * 0.1, h); g.fill();
    person(g, w * 0.5, h * 0.62, h * 0.08, '#f1efe8');
  },
  blossom(g, w, h, r) { // 꽃나무 아래
    g.fillStyle = lin(g, 0, h * 0.7, [[0, '#a9cbe6'], [1, '#f3e6e8']]); g.fillRect(0, 0, w, h);
    g.fillStyle = '#5a4034'; g.fillRect(w * 0.18, h * 0.3, w * 0.05, h * 0.5);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${240 + r() * 15},${170 + r() * 50},${190 + r() * 40},0.85)`; g.beginPath(); g.arc(w * (0.05 + r() * 0.5), h * (0.05 + r() * 0.35), w * (0.03 + r() * 0.05), 0, 7); g.fill(); }
    g.fillStyle = lin(g, h * 0.75, h, [[0, '#c9b8a0'], [1, '#9c8a72']]); g.fillRect(0, h * 0.75, w, h);
    g.fillStyle = 'rgba(255,190,210,0.9)'; for (let i = 0; i < 40; i++) g.fillRect(r() * w, h * (0.75 + r() * 0.25), 6, 4);
    person(g, w * 0.62, h * 0.55, h * 0.13, '#f4f1ea');
  },
};

export const SCENE_NAMES = Object.keys(SCENES);

export function drawScene(name, w, h, seed = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  (SCENES[name] || SCENES.street)(c.getContext('2d'), w, h, rng(seed));
  return c;
}
