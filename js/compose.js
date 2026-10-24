// 프레임(테두리)·날짜 스탬프·출력 크기 계산. 미리보기·사진 저장·영상 녹화가 모두 이 코드를 같이 쓴다.

// aspect: 사진 부분의 가로/세로 비율(null이면 원본 비율), pad: 사진 짧은 변 대비 테두리 두께 [위, 오른쪽, 아래, 왼쪽]
export const FRAMES = [
  { id: 'none', name: '없음', aspect: null, pad: [0, 0, 0, 0] },
  { id: 'thin', name: '흰 테두리', aspect: null, pad: [0.035, 0.035, 0.035, 0.035] },
  { id: 'instant', name: '인스턴트', aspect: () => 1, pad: [0.07, 0.07, 0.3, 0.07] },
  { id: 'film', name: '35mm 필름', aspect: (w, h) => (w >= h ? 3 / 2 : 2 / 3), pad: null },
  { id: 'slide', name: '슬라이드', aspect: (w, h) => (w >= h ? 3 / 2 : 2 / 3), pad: null },
];

export const frameById = id => FRAMES.find(f => f.id === id) || FRAMES[0];

// 사진 부분(cw×ch) 둘레 테두리 두께(px). 필름은 구멍 줄이 긴 변을 따라, 슬라이드는 바깥이 정사각.
export function framePad(frame, cw, ch) {
  const s = Math.min(cw, ch);
  if (frame.id === 'film') {
    const side = s * 0.2, end = s * 0.05;
    return cw >= ch ? [side, end, side, end] : [end, side, end, side];
  }
  if (frame.id === 'slide') {
    const outer = Math.max(cw, ch) * 1.32;
    const x = (outer - cw) / 2, y = (outer - ch) / 2;
    return [y, x, y, x];
  }
  return frame.pad.map(p => p * s);
}

// 원본 크기에서 저장 크기까지. 픽셀 수(maxPixels)와 한 변 길이(maxSide) 제한 안에서 원본 해상도를 최대한 유지한다.
export function planOutput(srcW, srcH, frameId, { maxPixels = 16e6, maxSide = 8192 } = {}) {
  const frame = frameById(frameId);
  const aspect = frame.aspect ? frame.aspect(srcW, srcH) : srcW / srcH;
  let cropW = srcW, cropH = srcH;
  if (srcW / srcH > aspect) cropW = srcH * aspect; else cropH = srcW / aspect;
  const crop = { x: (srcW - cropW) / 2, y: (srcH - cropH) / 2, w: cropW, h: cropH };
  const [t, r, b, l] = framePad(frame, cropW, cropH);
  const fullW = cropW + l + r, fullH = cropH + t + b;
  const scale = Math.min(1, Math.sqrt(maxPixels / (fullW * fullH)), maxSide / Math.max(fullW, fullH));
  // 내림만 쓴다: 한도를 1px도 넘지 않고, 사진 영역이 바깥 크기 안에 들어간다
  const f = v => Math.max(1, Math.floor(v * scale + 1e-6));
  return {
    frame: frame.id, crop,
    contentW: f(cropW), contentH: f(cropH),
    contentX: Math.floor(l * scale + 1e-6), contentY: Math.floor(t * scale + 1e-6),
    outW: f(fullW), outH: f(fullH),
  };
}

// 옛날 카메라 날짜 스탬프: '26 10 7 (해는 두 자리, 달·날은 앞에 0을 붙이지 않음)
export function formatStamp(d) {
  return `'${String(d.getFullYear() % 100).padStart(2, '0')} ${d.getMonth() + 1} ${d.getDate()}`;
}

// 디카·캠코더 시각: 2026 10 13  9:53 AM
export function formatDigital(d) {
  const h = d.getHours();
  return `${d.getFullYear()} ${d.getMonth() + 1} ${d.getDate()}  ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}


// 7세그먼트 숫자. 각 숫자에 켜지는 마디: a(위) b(오른위) c(오른아래) d(아래) e(왼아래) f(왼위) g(가운데)
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };

export function sevenSegWidth(text, h) {
  let w = 0;
  for (const ch of text) w += ch === ' ' ? h * 0.32 : ch === "'" ? h * 0.22 : h * 0.62;
  return w;
}

export function drawSevenSeg(ctx, text, x, y, h, color) {
  const w = h * 0.48, t = h * 0.1, g = t * 0.25, sk = h * 0.08; // 숫자 폭, 마디 두께, 마디 사이, 기울기
  const bar = (x1, y1, x2, y2) => { // 끝이 뾰족한 마디 하나
    const horiz = y1 === y2, ht = t / 2;
    const P = horiz
      ? [[x1 + g, y1], [x1 + g + ht, y1 - ht], [x2 - g - ht, y1 - ht], [x2 - g, y1], [x2 - g - ht, y1 + ht], [x1 + g + ht, y1 + ht]]
      : [[x1, y1 + g], [x1 + ht, y1 + g + ht], [x1 + ht, y2 - g - ht], [x1, y2 - g], [x1 - ht, y2 - g - ht], [x1 - ht, y1 + g + ht]];
    ctx.moveTo(P[0][0] + sk * (1 - (P[0][1] - y) / h), P[0][1]);
    for (const [px, py] of P.slice(1)) ctx.lineTo(px + sk * (1 - (py - y) / h), py);
    ctx.closePath();
  };
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = h * 0.35;
  ctx.beginPath();
  let cx = x;
  for (const ch of text) {
    if (ch === ' ') { cx += h * 0.32; continue; }
    if (ch === "'") { bar(cx + t, y, cx + t, y + h * 0.28); cx += h * 0.22; continue; }
    const on = SEG[ch] || '';
    const L = cx + t / 2, R = cx + w, T = y + t / 2, M = y + h / 2, B = y + h - t / 2;
    if (on.includes('a')) bar(L, T, R, T);
    if (on.includes('b')) bar(R, T, R, M);
    if (on.includes('c')) bar(R, M, R, B);
    if (on.includes('d')) bar(L, B, R, B);
    if (on.includes('e')) bar(L, M, L, B);
    if (on.includes('f')) bar(L, T, L, M);
    if (on.includes('g')) bar(L, M, R, M);
    cx += h * 0.62;
  }
  ctx.fill();
  ctx.shadowBlur = h * 0.12;
  ctx.fill();
  ctx.restore();
}

// 필터 입힌 사진(img: GL 캔버스)을 프레임과 함께 ctx에 그린다. ctx 캔버스 크기는 plan.outW×outH.
// stamp: 카메라마다 다른 날짜 모양 'orange' | 'digital' | 'camcorder' | 'instant'(인스턴트 프레임일 때만, 아니면 orange)
export function compose(ctx, img, plan, { date = null, frameNo = 1, stamp = 'orange' } = {}) {
  const { outW, outH, contentX: x, contentY: y, contentW: w, contentH: h } = plan;
  const s = Math.min(w, h);
  ctx.save();
  ctx.clearRect(0, 0, outW, outH);

  if (plan.frame === 'thin' || plan.frame === 'instant') {
    ctx.fillStyle = '#f6f4ee';
    ctx.fillRect(0, 0, outW, outH);
  } else if (plan.frame === 'film') {
    drawFilmStrip(ctx, plan, frameNo);
  } else if (plan.frame === 'slide') {
    drawSlideMount(ctx, plan, date);
  }

  if (plan.frame === 'slide') {
    ctx.save();
    roundRect(ctx, x, y, w, h, s * 0.04);
    ctx.clip();
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(img, x, y, w, h);
  }

  if (plan.frame === 'instant') { // 사진 가장자리의 얇은 그늘
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = Math.max(1, s * 0.004);
    ctx.strokeRect(x, y, w, h);
  }

  if (stamp === 'camcorder') drawCamcorder(ctx, plan, date, frameNo);
  else if (date && stamp === 'digital') drawDigital(ctx, plan, date);
  else if (date && stamp === 'instant' && plan.frame === 'instant') drawCaption(ctx, plan, date);
  else if (date) {
    const sh = s * 0.045;
    const text = formatStamp(date);
    drawSevenSeg(ctx, text, x + w - sevenSegWidth(text, sh) - s * 0.05, y + h - sh - s * 0.05, sh, 'rgba(255,138,40,0.92)');
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFilmStrip(ctx, plan, frameNo) {
  const { outW, outH, contentX: x, contentY: y, contentW: w, contentH: h } = plan;
  const s = Math.min(w, h), land = w >= h;
  ctx.fillStyle = '#17130f';
  ctx.fillRect(0, 0, outW, outH);
  // 구멍: 긴 변을 따라 양쪽 줄
  const holeA = s * 0.055, holeB = s * 0.075, step = s * 0.125;
  const len = land ? outW : outH, n = Math.floor(len / step);
  const off = (len - n * step) / 2 + (step - holeB) / 2;
  ctx.fillStyle = '#efe9dc';
  const band = land ? y : x;
  for (let i = 0; i < n; i++) {
    const p = off + i * step;
    for (const q of [band * 0.32, (land ? outH : outW) - band * 0.32 - holeA]) {
      if (land) roundRect(ctx, p, q, holeB, holeA, holeA * 0.2); else roundRect(ctx, q, p, holeA, holeB, holeA * 0.2);
      ctx.fill();
    }
  }
  // 가장자리 글씨(필름 이름·번호)
  ctx.fillStyle = 'rgba(232,160,64,0.9)';
  const fs = Math.round(s * 0.034);
  ctx.font = `600 ${fs}px ui-monospace, Menlo, monospace`;
  ctx.textBaseline = 'middle';
  const label = `DAJEONG 400   ${frameNo}  ▸ ${frameNo}A`;
  if (land) ctx.fillText(label, x + s * 0.04, band * 0.82);
  else {
    ctx.save();
    ctx.translate(band * 0.82, y + s * 0.04);
    ctx.rotate(Math.PI / 2);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
}

function drawSlideMount(ctx, plan, date) {
  const { outW, outH, contentX: x, contentY: y, contentW: w, contentH: h } = plan;
  const s = Math.min(outW, outH);
  const grad = ctx.createLinearGradient(0, 0, outW, outH);
  grad.addColorStop(0, '#ebe5d6'); grad.addColorStop(1, '#d8d0bd');
  ctx.fillStyle = grad;
  roundRect(ctx, 0, 0, outW, outH, s * 0.05);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,80,60,0.25)';
  ctx.lineWidth = s * 0.006;
  roundRect(ctx, x - s * 0.012, y - s * 0.012, w + s * 0.024, h + s * 0.024, s * 0.035);
  ctx.stroke();
  ctx.fillStyle = 'rgba(70,62,48,0.75)';
  ctx.font = `600 ${Math.round(s * 0.032)}px ui-rounded, system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  const top = w > h ? y / 2 : x / 2;
  if (w > h) {
    ctx.fillText('다정필름', x, top);
    if (date) { ctx.textAlign = 'right'; ctx.fillText(formatStamp(date).slice(1).replace(/ /g, '.'), x + w, top); }
  } else {
    ctx.save(); ctx.translate(top, y + h); ctx.rotate(-Math.PI / 2);
    ctx.fillText('다정필름', 0, 0);
    if (date) { ctx.textAlign = 'right'; ctx.fillText(formatStamp(date).slice(1).replace(/ /g, '.'), h, 0); }
    ctx.restore();
  }
}

const MONO = '"Courier New", ui-monospace, Menlo, monospace';

function osdText(ctx, fs) {
  ctx.font = `700 ${fs}px ${MONO}`;
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = ctx.shadowOffsetY = Math.max(1, fs * 0.08);
  ctx.fillStyle = '#f6f6f2';
}

// 디카: 오른쪽 아래 흰 시각
function drawDigital(ctx, plan, date) {
  const { contentX: x, contentY: y, contentW: w, contentH: h } = plan;
  const s = Math.min(w, h), fs = Math.round(s * 0.042);
  ctx.save();
  osdText(ctx, fs);
  ctx.fillStyle = 'rgba(255,214,170,0.95)';
  ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.fillText(formatDigital(date), x + w - s * 0.05, y + h - s * 0.05);
  ctx.restore();
}

// 캠코더 화면: 왼쪽 위 배터리·남은 시간, 오른쪽 위 화질·남은 장수, 오른쪽 아래 시각
function drawCamcorder(ctx, plan, date, frameNo) {
  const { contentX: x, contentY: y, contentW: w, contentH: h } = plan;
  const s = Math.min(w, h), m = s * 0.05, fs = Math.round(s * 0.05);
  ctx.save();
  osdText(ctx, fs);
  // 배터리
  const bw = fs * 1.1, bh = fs * 0.6, by = y + m + fs * 0.2;
  ctx.fillStyle = '#f2d34a';
  ctx.fillRect(x + m, by, bw, bh);
  ctx.fillRect(x + m + bw, by + bh * 0.3, fs * 0.12, bh * 0.4);
  ctx.fillStyle = '#f6f6f2';
  ctx.textBaseline = 'top';
  ctx.fillText(`${Math.max(5, 120 - (frameNo % 24) * 4)} MIN`, x + m + bw + fs * 0.4, y + m);
  // 오른쪽 위: 화질, 남은 장수
  const small = Math.round(fs * 0.8);
  ctx.font = `700 ${small}px ${MONO}`;
  ctx.textAlign = 'right';
  const rx = x + w - m - fs * 0.9;
  ctx.fillText('5.0M', rx, y + m);
  ctx.fillText(`${String(frameNo % 100).padStart(2, '0')}/99`, rx, y + m + small * 1.15);
  ctx.fillStyle = '#3b6fd8';
  ctx.fillRect(rx - ctx.measureText('00/99').width - small * 2.1, y + m + small * 1.2, small * 1.8, small * 0.9);
  ctx.strokeStyle = '#f6f6f2';
  ctx.lineWidth = Math.max(1, fs * 0.07);
  ctx.strokeRect(x + w - m - fs * 0.6, y + m, fs * 0.5, fs * 0.8); // 메모리 카드
  if (date) {
    ctx.font = `700 ${fs}px ${MONO}`;
    ctx.fillStyle = '#f6f6f2';
    ctx.textBaseline = 'bottom';
    ctx.fillText(formatDigital(date), x + w - m, y + h - m);
  }
  ctx.restore();
}

// 즉석사진: 아래 흰 여백에 손글씨 날짜
function drawCaption(ctx, plan, date) {
  const { outH, contentX: x, contentY: y, contentW: w, contentH: h } = plan;
  const s = Math.min(w, h), fs = Math.round(s * 0.07);
  ctx.save();
  ctx.font = `${fs}px "Bradley Hand", "Noteworthy", "Segoe Print", "Comic Sans MS", cursive`;
  ctx.fillStyle = 'rgba(44,52,78,0.85)';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.translate(x + w - s * 0.04, y + h + (outH - y - h) * 0.5);
  ctx.rotate(-0.03);
  ctx.fillText(`${date.getFullYear() % 100}.${date.getMonth() + 1}.${date.getDate()}`, 0, 0);
  ctx.restore();
}
