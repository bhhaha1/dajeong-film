import { FILTERS } from './filters.js';
import { Renderer } from './gl.js';
import { FRAMES, frameById, planOutput, compose } from './compose.js';
import { exifDate } from './exif.js';
import * as store from './store.js';
import { pickMime, saveToDevice } from './media.js';

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
// 아이폰 사파리 캔버스 한도(약 1677만 화소)보다 조금 아래
const MAX_PIXELS = 16e6;
const MAX_VIDEO_SEC = 30;

// ---------- 설정(이 기기에만 저장) ----------
const DEFAULTS = { filter: 'spring', frame: 'none', date: true, timer: 0, flash: false, quality: 'high', mic: true, facing: 'environment' };
const settings = (() => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('dj-settings') || '{}') }; } catch { return { ...DEFAULTS }; } })();
const saveSettings = () => { try { localStorage.setItem('dj-settings', JSON.stringify(settings)); } catch {} };

// ---------- 상태 ----------
const view = $('view'), vctx = view.getContext('2d'), video = $('video');
let renderer, thumbRenderer;
let stream = null, hasTorch = false;
let mode = 'photo';            // 'photo' | 'video'
let source = 'camera';         // 'camera' | 'image'
let image = null;              // { el, w, h, date }
let dirty = true, busy = false, recording = null, shotCount = 0;
let startSeq = 0;

const filterIndex = () => Math.max(0, FILTERS.findIndex(f => f.id === settings.filter));
const curFilter = () => FILTERS[filterIndex()];
const mirrored = () => source === 'camera' && settings.facing === 'user';

function currentSource() {
  if (source === 'image') return image && { el: image.el, w: image.w, h: image.h };
  if (video.readyState >= 2 && video.videoWidth) return { el: video, w: video.videoWidth, h: video.videoHeight };
  return null;
}
const stampDate = () => (settings.date ? (source === 'image' ? image.date : new Date()) : null);

function previewLimits() {
  const r = $('finder').getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  return { maxSide: Math.min(1440, Math.ceil(Math.max(r.width, r.height) * dpr)), maxPixels: 1.6e6 };
}

// ---------- 미리보기 그리기 ----------
function loop(t) {
  requestAnimationFrame(loop);
  const src = currentSource();
  if (!src || !renderer) return;
  if (source === 'image' && !dirty) return; // 정지 사진은 바뀔 때만
  dirty = false;
  const plan = planOutput(src.w, src.h, settings.frame, previewLimits());
  if (!recording && (view.width !== plan.outW || view.height !== plan.outH)) { view.width = plan.outW; view.height = plan.outH; }
  if (recording && (view.width !== plan.outW || view.height !== plan.outH)) return; // 녹화 중엔 크기를 바꾸지 않는다
  try {
    renderer.upload(src.el);
    const gl = renderer.draw(curFilter(), {
      srcW: src.w, srcH: src.h, crop: plan.crop, outW: plan.contentW, outH: plan.contentH,
      flipX: mirrored(), time: t / 1000, seed: source === 'camera' ? Math.floor(t / 42) % 97 : 7,
    });
    compose(vctx, gl, plan, { date: stampDate(), frameNo: shotCount + 1 });
  } catch (e) { console.warn(e); }
}

// ---------- 카메라 ----------
function stopCamera() {
  stream?.getTracks().forEach(t => t.stop());
  stream = null;
  video.srcObject = null;
}

async function startCamera() {
  const seq = ++startSeq;
  stopCamera();
  hideMsg();
  if (!navigator.mediaDevices?.getUserMedia) {
    showMsg(isSecureContext ? '이 브라우저에서는 카메라를 쓸 수 없어요.\n사진 불러오기는 쓸 수 있어요.' : 'https 주소로 열어야 카메라를 쓸 수 있어요.', false);
    return;
  }
  const size = settings.quality === 'high' ? { width: { ideal: 4032 }, height: { ideal: 3024 } } : { width: { ideal: 1920 }, height: { ideal: 1440 } };
  const wantAudio = mode === 'video' && settings.mic;
  const tries = [
    { video: { facingMode: settings.facing, ...size }, audio: wantAudio },
    { video: { facingMode: settings.facing }, audio: wantAudio },
    ...(wantAudio ? [{ video: { facingMode: settings.facing }, audio: false }] : []),
  ];
  let s = null, err = null;
  for (const c of tries) {
    try { s = await navigator.mediaDevices.getUserMedia(c); break; } catch (e) { err = e; if (e.name === 'NotAllowedError' && !c.audio) break; }
  }
  if (seq !== startSeq || source !== 'camera' || document.hidden) { s?.getTracks().forEach(t => t.stop()); return; }
  if (!s) {
    const m = {
      NotAllowedError: '카메라 권한이 꺼져 있어요.\n아이폰: 설정 → 사파리 → 카메라 → 허용\n안드로이드: 주소창 왼쪽 자물쇠 → 권한',
      NotFoundError: '카메라를 찾지 못했어요.\n사진 불러오기로 필터를 입혀 보세요.',
      NotReadableError: '다른 앱이 카메라를 쓰고 있어요.\n그 앱을 닫고 다시 켜 주세요.',
    }[err?.name] || `카메라를 켜지 못했어요. (${err?.name || '알 수 없음'})`;
    showMsg(m, true);
    return;
  }
  stream = s;
  video.muted = true; // 아이폰: 속성으로도 음소거해야 자동 재생됨
  video.srcObject = s;
  try { await video.play(); } catch {}
  const track = s.getVideoTracks()[0];
  hasTorch = !!track.getCapabilities?.().torch;
  dirty = true;
  setTimeout(updateThumbs, 600);
}

const setTorch = on => stream?.getVideoTracks()[0]?.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {});

function showMsg(text, retry) { $('msgText').textContent = text; $('msgRetry').hidden = !retry; $('msg').hidden = false; }
function hideMsg() { $('msg').hidden = true; }

// ---------- 필터 띠 ----------
const chips = FILTERS.map((f, i) => {
  const b = document.createElement('button');
  b.className = 'chip';
  b.setAttribute('role', 'option');
  b.innerHTML = '<canvas width="120" height="152"></canvas><span></span>';
  b.lastChild.textContent = f.name;
  b.onclick = () => setFilter(i);
  $('strip').append(b);
  return b;
});
const snap = document.createElement('canvas');
snap.width = 120; snap.height = 152;

function updateThumbs() {
  const src = currentSource();
  if (!src || !thumbRenderer) return;
  const sc = snap.getContext('2d');
  const a = snap.width / snap.height;
  let w = src.w, h = src.h;
  if (w / h > a) w = h * a; else h = w / a;
  sc.drawImage(src.el, (src.w - w) / 2, (src.h - h) / 2, w, h, 0, 0, snap.width, snap.height);
  try {
    thumbRenderer.upload(snap);
    FILTERS.forEach((f, i) => {
      const gl = thumbRenderer.draw(f, { srcW: snap.width, srcH: snap.height, crop: { x: 0, y: 0, w: snap.width, h: snap.height }, outW: snap.width, outH: snap.height, flipX: mirrored(), seed: 3 });
      chips[i].firstChild.getContext('2d').drawImage(gl, 0, 0);
    });
  } catch (e) { console.warn(e); }
}
setInterval(() => { if (source === 'camera' && !document.hidden && !recording) updateThumbs(); }, 4000);

let toastTimer;
function setFilter(i, announce = true) {
  i = (i + FILTERS.length) % FILTERS.length;
  settings.filter = FILTERS[i].id;
  saveSettings();
  chips.forEach((c, j) => c.setAttribute('aria-selected', String(i === j)));
  chips[i].scrollIntoView({ inline: 'center', block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  $('lcdName').textContent = FILTERS[i].name;
  $('lcdDesc').textContent = FILTERS[i].desc;
  $('lcdNo').textContent = `${String(i + 1).padStart(2, '0')}/${FILTERS.length}`;
  dirty = true;
  if (announce) {
    const t = $('filterToast');
    t.textContent = FILTERS[i].name;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 900);
  }
}

// 뷰파인더 좌우로 밀어 필터 바꾸기
let swipe = null;
$('finder').addEventListener('pointerdown', e => { swipe = { x: e.clientX, y: e.clientY }; });
$('finder').addEventListener('pointerup', e => {
  if (!swipe) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  swipe = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) setFilter(filterIndex() + (dx < 0 ? 1 : -1));
});

// ---------- 소리(셔터·타이머) ----------
let actx;
function tone(kind) {
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime;
    if (kind === 'tick') {
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = 1320;
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.09);
      return;
    }
    // 셔터: 짧은 잡음 두 번(열림·닫힘)
    for (const [at, len, freq] of [[0, 0.03, 3200], [0.07, 0.05, 1800]]) {
      const n = actx.createBuffer(1, Math.ceil(actx.sampleRate * len), actx.sampleRate);
      const d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
      const s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
      s.buffer = n; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8; g.gain.value = 0.5;
      s.connect(f).connect(g).connect(actx.destination); s.start(t + at);
    }
  } catch {}
}

// ---------- 촬영 ----------
async function countdown(sec) {
  const el = $('countdown');
  for (let n = sec; n > 0; n--) { el.textContent = n; tone('tick'); await sleep(1000); }
  el.textContent = '';
}

const toBlob = (c, type, q) => new Promise((ok, fail) => c.toBlob(b => (b ? ok(b) : fail(new Error('이미지를 만들지 못했어요'))), type, q));

async function makeThumb(canvas, size = 360) {
  const s = Math.min(1, size / Math.max(canvas.width, canvas.height));
  const t = document.createElement('canvas');
  t.width = Math.round(canvas.width * s); t.height = Math.round(canvas.height * s);
  t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
  return toBlob(t, 'image/jpeg', 0.8);
}

// 원본 해상도로 필터를 입혀 JPEG로 만든다
async function renderFull() {
  const src = currentSource();
  if (!src) throw new Error('아직 카메라가 준비되지 않았어요');
  const maxSide = Math.min(renderer.maxSide, renderer.gl.getParameter(renderer.gl.MAX_VIEWPORT_DIMS)[0]);
  let maxPixels = MAX_PIXELS, plan, gl;
  for (let i = 0; i < 4; i++) {
    plan = planOutput(src.w, src.h, settings.frame, { maxPixels, maxSide });
    renderer.upload(src.el);
    gl = renderer.draw(curFilter(), {
      srcW: src.w, srcH: src.h, crop: plan.crop, outW: plan.contentW, outH: plan.contentH,
      flipX: mirrored(), time: performance.now() / 1000, seed: Math.random() * 90,
    });
    // 메모리가 모자라면 브라우저가 그림 버퍼를 작게 만든다 → 한 단계 줄여 다시
    if (renderer.gl.drawingBufferWidth >= plan.contentW && renderer.gl.drawingBufferHeight >= plan.contentH) break;
    maxPixels /= 2;
  }
  const out = document.createElement('canvas');
  out.width = plan.outW; out.height = plan.outH;
  compose(out.getContext('2d'), gl, plan, { date: stampDate(), frameNo: shotCount + 1 });
  dirty = true;
  const blob = await toBlob(out, 'image/jpeg', 0.92);
  const thumb = await makeThumb(out);
  out.width = out.height = 0; // 아이폰 캔버스 메모리 바로 돌려주기
  return { type: 'photo', blob, thumb, w: plan.outW, h: plan.outH, filter: curFilter().id, frame: plan.frame };
}

async function takePhoto() {
  if (busy) return;
  busy = true;
  $('shutter').disabled = true;
  const flash = $('flash');
  try {
    if (settings.timer && source === 'camera') await countdown(settings.timer);
    let torchOn = false;
    if (settings.flash && source === 'camera') {
      if (hasTorch && !mirrored()) { await setTorch(true); torchOn = true; await sleep(400); }
      else { flash.classList.add('on'); await sleep(280); } // 화면을 하얗게 밝혀 얼굴을 비춘다
    }
    const pending = renderFull();
    if (torchOn) setTorch(false);
    flash.classList.remove('on');
    flash.classList.add('blink');
    requestAnimationFrame(() => requestAnimationFrame(() => flash.classList.remove('blink')));
    tone('shutter');
    await keep(await pending);
  } catch (e) {
    showToast(e.message || '찍지 못했어요');
  } finally {
    busy = false;
    $('shutter').disabled = false;
  }
}

async function keep(shot) {
  shot.createdAt = Date.now();
  try {
    shot.id = await store.addShot(shot);
  } catch {
    showToast('앨범에 넣지 못했어요(저장 공간). 지금 휴대폰에 저장하세요.', shot);
    return;
  }
  shotCount++;
  setAlbumThumb(shot.thumb);
  showToast(shot.type === 'video' ? '영상을 앨범에 담았어요' : '앨범에 담았어요', shot);
  navigator.storage?.persist?.().catch(() => {});
}

// ---------- 영상 ----------
function toggleRecording() {
  if (recording) { recording.rec.stop(); return; }
  if (!view.captureStream || !window.MediaRecorder) { showToast('이 브라우저는 영상 녹화를 지원하지 않아요'); return; }
  if (!currentSource()) return;
  const mime = pickMime(t => MediaRecorder.isTypeSupported(t));
  const vs = view.captureStream(30);
  const tracks = [...vs.getVideoTracks(), ...(stream?.getAudioTracks() ?? [])];
  let rec;
  try { rec = new MediaRecorder(new MediaStream(tracks), { ...(mime && { mimeType: mime }), videoBitsPerSecond: 6_000_000 }); }
  catch (e) { vs.getTracks().forEach(t => t.stop()); showToast('녹화를 시작하지 못했어요'); return; }
  const chunks = [];
  const posterP = makeThumb(view);
  const w = view.width, h = view.height, t0 = performance.now();
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = async () => {
    clearInterval(recording.tick);
    vs.getTracks().forEach(t => t.stop());
    recording = null;
    setRecordingUI(false);
    const blob = new Blob(chunks, { type: (rec.mimeType || mime || 'video/webm').split(';')[0] });
    if (!blob.size) { showToast('영상이 비어 있어요'); return; }
    await keep({ type: 'video', blob, thumb: await posterP, w, h, filter: curFilter().id, frame: settings.frame, duration: (performance.now() - t0) / 1000 });
  };
  rec.start(1000);
  tone('tick');
  recording = {
    rec,
    tick: setInterval(() => {
      const s = Math.floor((performance.now() - t0) / 1000);
      $('recTime').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      if (s >= MAX_VIDEO_SEC && rec.state === 'recording') rec.stop();
    }, 250),
  };
  $('recTime').textContent = '0:00';
  setRecordingUI(true);
}

function setRecordingUI(on) {
  $('shutter').classList.toggle('recording', on);
  $('shutter').setAttribute('aria-label', on ? '녹화 멈추기' : '녹화 시작');
  $('recBadge').hidden = !on;
  for (const id of ['btnFrame', 'btnFlip', 'modePhoto', 'btnImport', 'btnAlbum', 'btnMore']) $(id).disabled = on;
}

// ---------- 조작부 ----------
function updateShutter() {
  const s = $('shutter');
  s.classList.toggle('video', mode === 'video' && source === 'camera');
  s.classList.toggle('save', source === 'image');
  s.setAttribute('aria-label', source === 'image' ? '필터 입혀 저장하기' : mode === 'video' ? '녹화 시작' : '사진 찍기');
}

$('shutter').onclick = () => {
  if (source === 'camera' && mode === 'video') toggleRecording();
  else takePhoto();
};

function setMode(m) {
  if (mode === m || recording) return;
  mode = m;
  $('modePhoto').setAttribute('aria-checked', String(m === 'photo'));
  $('modeVideo').setAttribute('aria-checked', String(m === 'video'));
  updateShutter();
  // 영상에 소리를 넣으려면 마이크가 같이 들어간 스트림이 필요하다(아이폰은 따로 열면 화면 트랙이 멈출 수 있음)
  if (source === 'camera' && settings.mic && (m === 'video') !== !!stream?.getAudioTracks().length) startCamera();
}
$('modePhoto').onclick = () => setMode('photo');
$('modeVideo').onclick = () => setMode('video');

$('btnFlip').onclick = () => {
  settings.facing = settings.facing === 'user' ? 'environment' : 'user';
  saveSettings();
  startCamera();
};

const TIMERS = [0, 3, 10];
$('btnTimer').onclick = () => { settings.timer = TIMERS[(TIMERS.indexOf(settings.timer) + 1) % TIMERS.length]; saveSettings(); syncTools(); };
$('btnFlash').onclick = () => { settings.flash = !settings.flash; saveSettings(); syncTools(); };
$('btnDate').onclick = () => { settings.date = !settings.date; saveSettings(); syncTools(); dirty = true; };

function syncTools() {
  $('btnFlash').setAttribute('aria-pressed', String(settings.flash));
  $('btnTimer').setAttribute('aria-pressed', String(!!settings.timer));
  $('timerLabel').textContent = settings.timer ? `${settings.timer}초` : '타이머';
  $('btnDate').setAttribute('aria-pressed', String(settings.date));
  $('frameLabel').textContent = settings.frame === 'none' ? '프레임' : frameById(settings.frame).name;
  document.querySelectorAll('[data-quality]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.quality === settings.quality)));
  document.querySelectorAll('[data-mic]').forEach(b => b.setAttribute('aria-checked', String((b.dataset.mic === 'on') === settings.mic)));
}

// ---------- 시트(프레임·설정) ----------
// 닫으면 연 버튼으로 초점을 돌려준다(겹쳐 열린 앨범→보기도 각자 기억)
function openLayer(el) { el._ret = document.activeElement; el.hidden = false; el.querySelector('button')?.focus(); }
function closeLayer(el) { el.hidden = true; if (el._ret?.isConnected) el._ret.focus(); }
document.querySelectorAll('[data-close]').forEach(b => { b.onclick = () => closeLayer(b.closest('[role=dialog]')); });
document.querySelectorAll('.sheet').forEach(s => s.addEventListener('click', e => { if (e.target === s) closeLayer(s); }));
addEventListener('keydown', e => {
  const open = [...document.querySelectorAll('[role=dialog]')].reverse().find(d => !d.hidden);
  if (e.key === 'Escape') { if (open === $('exhibit')) stopExhibit(); else if (open) closeLayer(open); }
  // 좌우로 밀기의 키보드 대신: 방향키로 필터 바꾸기
  else if (!open && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !recording) setFilter(filterIndex() + (e.key === 'ArrowRight' ? 1 : -1));
});

// 프레임 고르기: 견본은 실제 compose()로 그린다
const sample = document.createElement('canvas');
sample.width = 300; sample.height = 400;
{
  const g = sample.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 400);
  gr.addColorStop(0, '#9fb7c9'); gr.addColorStop(0.6, '#e7c9a4'); gr.addColorStop(1, '#7f8f6a');
  g.fillStyle = gr; g.fillRect(0, 0, 300, 400);
}
const frameBtns = FRAMES.map(f => {
  const b = document.createElement('button');
  b.setAttribute('role', 'radio');
  const c = document.createElement('canvas');
  const plan = planOutput(300, 400, f.id, { maxSide: 144 });
  c.width = plan.outW; c.height = plan.outH;
  compose(c.getContext('2d'), sample, plan, { date: new Date(), frameNo: 1 });
  const label = document.createElement('span');
  label.textContent = f.name;
  b.append(c, label);
  b.onclick = () => { settings.frame = f.id; saveSettings(); syncFrames(); syncTools(); dirty = true; };
  $('frames').append(b);
  return b;
});
const syncFrames = () => frameBtns.forEach((b, i) => b.setAttribute('aria-checked', String(FRAMES[i].id === settings.frame)));
$('btnFrame').onclick = () => { syncFrames(); openLayer($('frameSheet')); };
$('btnMore').onclick = () => openLayer($('moreSheet'));
document.querySelectorAll('[data-quality]').forEach(b => {
  b.onclick = () => { if (settings.quality === b.dataset.quality) return; settings.quality = b.dataset.quality; saveSettings(); syncTools(); if (source === 'camera') startCamera(); };
});
document.querySelectorAll('[data-mic]').forEach(b => {
  b.onclick = () => { settings.mic = b.dataset.mic === 'on'; saveSettings(); syncTools(); if (source === 'camera' && mode === 'video') startCamera(); };
});

// ---------- 사진 불러오기 ----------
$('btnImport').onclick = () => $('file').click();
$('file').onchange = async e => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  try {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.src = url;
    await img.decode(); // 브라우저가 EXIF 방향을 반영해 그린다
    URL.revokeObjectURL(url);
    let el = img, w = img.naturalWidth, h = img.naturalHeight;
    // 텍스처·캔버스 한도를 넘는 큰 사진(4800만 화소 등)은 미리 줄인다
    const s = Math.min(1, (renderer?.maxSide ?? 4096) / Math.max(w, h), Math.sqrt(MAX_PIXELS / (w * h)));
    if (s < 1) {
      const c = document.createElement('canvas');
      c.width = Math.round(w * s); c.height = Math.round(h * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      el = c; w = c.width; h = c.height;
    }
    let date = null;
    try { date = exifDate(await f.slice(0, 256 * 1024).arrayBuffer()); } catch {}
    image = { el, w, h, date: date || new Date(f.lastModified || Date.now()) };
    if (recording) recording.rec.stop();
    source = 'image';
    startSeq++;
    stopCamera();
    hideMsg();
    $('editBar').hidden = false;
    $('btnFlip').disabled = $('modeVideo').disabled = true;
    updateShutter();
    dirty = true;
    updateThumbs();
  } catch {
    showToast('이 사진은 열 수 없어요(HEIC는 사진 앱에서 JPEG로 바꿔 주세요)');
  }
};
$('btnBack').onclick = backToCamera;
function backToCamera() {
  source = 'camera';
  image = null;
  $('editBar').hidden = true;
  $('btnFlip').disabled = $('modeVideo').disabled = false;
  updateShutter();
  startCamera();
}
$('msgRetry').onclick = () => startCamera();

// ---------- 알림 ----------
let toastHide, toastShot = null;
function showToast(text, shot = null) {
  toastShot = shot;
  $('toastText').textContent = text;
  $('toastSave').hidden = !shot;
  $('toast').hidden = false;
  clearTimeout(toastHide);
  toastHide = setTimeout(() => { $('toast').hidden = true; }, shot ? 5000 : 2600);
}
$('toastSave').onclick = async () => {
  if (!toastShot) return;
  $('toast').hidden = true;
  const r = await saveToDevice(toastShot);
  if (r === 'downloaded') showToast('파일로 내려받았어요');
};

// ---------- 앨범 ----------
let items = [], urls = [];
function setAlbumThumb(blob) {
  const img = $('albumThumb');
  if (img.src) URL.revokeObjectURL(img.src);
  if (blob) img.src = URL.createObjectURL(blob); else img.removeAttribute('src');
  $('albumCount').textContent = shotCount ? shotCount : '';
}

async function refreshAlbumButton() {
  try {
    items = await store.listShots();
    shotCount = items.length;
    setAlbumThumb(items[0]?.thumb);
  } catch {}
}

async function openAlbum() {
  items = await store.listShots();
  urls.forEach(URL.revokeObjectURL);
  urls = [];
  const grid = $('grid');
  grid.replaceChildren(...items.map((it, i) => {
    const b = document.createElement('button');
    const img = document.createElement('img');
    const u = URL.createObjectURL(it.thumb);
    urls.push(u);
    img.src = u;
    img.alt = '';
    b.setAttribute('aria-label', `${it.type === 'video' ? '영상' : '사진'} ${new Date(it.createdAt).toLocaleString('ko-KR')}`);
    b.append(img);
    if (it.type === 'video') {
      const s = document.createElement('span');
      s.className = 'badge';
      const d = Math.round(it.duration || 0);
      s.textContent = `영상 ${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`;
      b.append(s);
    }
    b.onclick = () => openViewer(i);
    return b;
  }));
  $('albumTitle').textContent = items.length ? `앨범 ${items.length}장` : '앨범';
  $('albumEmpty').hidden = items.length > 0;
  $('btnExhibit').disabled = !items.some(i => i.type === 'photo');
  if ($('album').hidden) openLayer($('album'));
}
$('btnAlbum').onclick = openAlbum;

let vIndex = 0, vUrl = null;
function openViewer(i) {
  vIndex = i;
  const it = items[i];
  if (vUrl) URL.revokeObjectURL(vUrl);
  vUrl = URL.createObjectURL(it.blob);
  let el;
  if (it.type === 'video') {
    el = document.createElement('video');
    Object.assign(el, { src: vUrl, controls: true, playsInline: true, loop: true });
    el.setAttribute('playsinline', '');
  } else {
    el = document.createElement('img');
    el.src = vUrl;
    el.alt = '찍은 사진';
  }
  $('stage').replaceChildren(el);
  const f = FILTERS.find(x => x.id === it.filter);
  $('viewerMeta').textContent = `${new Date(it.createdAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}  ${f ? f.name : ''}  ${it.w}×${it.h}`;
  $('viewerPrev').disabled = i === 0;
  $('viewerNext').disabled = i === items.length - 1;
  if ($('viewer').hidden) openLayer($('viewer'));
}
$('viewerPrev').onclick = () => vIndex > 0 && openViewer(vIndex - 1);
$('viewerNext').onclick = () => vIndex < items.length - 1 && openViewer(vIndex + 1);
$('viewerSave').onclick = async () => { const r = await saveToDevice(items[vIndex]); if (r === 'downloaded') showToast('파일로 내려받았어요'); };
$('viewerDelete').onclick = async () => {
  if (!confirm('이 사진을 앨범에서 지울까요? 되돌릴 수 없어요.')) return;
  await store.deleteShot(items[vIndex].id);
  closeLayer($('viewer'));
  $('stage').replaceChildren();
  await openAlbum();
  await refreshAlbumButton();
};
$('viewer').querySelector('[data-close]').addEventListener('click', () => $('stage').replaceChildren());

// 전시 보기: 사진만, 7초마다 천천히 바뀜
let exTimer = null;
function startExhibit() {
  const photos = items.filter(i => i.type === 'photo');
  if (!photos.length) return;
  const imgs = [$('exA'), $('exB')];
  let n = 0;
  const exUrls = [];
  const show = () => {
    const it = photos[n % photos.length], img = imgs[n % 2], other = imgs[(n + 1) % 2];
    const u = URL.createObjectURL(it.blob);
    exUrls.push(u);
    if (exUrls.length > 3) URL.revokeObjectURL(exUrls.shift());
    img.onload = () => { other.classList.remove('on'); img.classList.add('on'); };
    img.src = u;
    const d = new Date(it.createdAt);
    $('exCaption').textContent = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
    n++;
  };
  show();
  exTimer = setInterval(show, 7000);
  $('exhibit').hidden = false;
  $('exhibit')._urls = exUrls;
}
function stopExhibit() {
  clearInterval(exTimer);
  $('exhibit').hidden = true;
  (($('exhibit')._urls) || []).forEach(URL.revokeObjectURL);
  for (const i of [$('exA'), $('exB')]) { i.classList.remove('on'); i.removeAttribute('src'); }
}
$('btnExhibit').onclick = startExhibit;
$('exhibit').onclick = stopExhibit;

// ---------- 앱이 가려지면 카메라 끄기(배터리·아이폰은 어차피 멈춤) ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (recording) recording.rec.stop();
    startSeq++;
    stopCamera();
  } else if (source === 'camera') startCamera();
});

// ---------- 시작 ----------
try {
  renderer = new Renderer();
  thumbRenderer = new Renderer();
} catch (e) {
  showMsg('이 브라우저는 WebGL을 쓸 수 없어 필터를 입힐 수 없어요.', false);
}
setFilter(filterIndex(), false);
syncTools();
updateShutter();
refreshAlbumButton();
requestAnimationFrame(loop);
if (renderer) startCamera();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
