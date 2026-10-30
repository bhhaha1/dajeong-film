import { FILTERS } from './filters.js';
import { Renderer } from './gl.js';
import { FRAMES, frameById, planOutput, compose } from './compose.js';
import { exifDate } from './exif.js';
import { drawScene } from './scenes.js';
import { cameraSvg } from './camera-art.js';
import * as store from './store.js';
import { pickMime, saveToDevice, isAndroid } from './media.js';

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
// 아이폰 사파리 캔버스 한도(약 1677만 화소)보다 조금 아래
const MAX_PIXELS = 16e6;
const MAX_VIDEO_SEC = 30;
const CAMERAS = FILTERS.filter(f => f.month); // Drop에 나오는 15대(필터 없음 제외)

// ---------- 설정(이 기기에만 저장) ----------
const DEFAULTS = { filter: 'alley', frame: 'auto', date: true, timer: 0, flash: false, quality: 'high', mic: true, facing: 'environment', sound: false, autoSave: false };
const settings = (() => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('dj-settings') || '{}') }; } catch { return { ...DEFAULTS }; } })();
const saveSettings = () => { try { localStorage.setItem('dj-settings', JSON.stringify(settings)); } catch {} };

// ---------- 상태 ----------
const view = $('view'), vctx = view.getContext('2d'), video = $('video');
let renderer, thumbRenderer;
let stream = null, hasTorch = false;
let mode = 'photo';            // 'photo' | 'video' | 'hires'
let source = 'camera';         // 'camera' | 'image'
let image = null;              // { el, w, h, date }
let tab = 'camera';
let dirty = true, recording = null, shotCount = 0;
let holdPreview = false; // 셔터 깜빡임이 덮는 한 프레임은 미리보기를 그리지 않아 반응을 바로 내보낸다
let startSeq = 0;

const filterIndex = () => Math.max(0, FILTERS.findIndex(f => f.id === settings.filter));
const curFilter = () => FILTERS[filterIndex()];
// 프레임 '카메라 기본'이면 카메라마다 정해진 프레임(예: Seoul instc는 즉석사진)
const curFrame = () => (settings.frame === 'auto' ? curFilter().frame : settings.frame);
const mirrored = () => source === 'camera' && settings.facing === 'user';
const cameraLive = () => tab === 'camera' && source === 'camera' && mode !== 'hires' && !document.hidden;

function currentSource() {
  if (source === 'image') return image && { el: image.el, w: image.w, h: image.h };
  if (video.readyState >= 2 && video.videoWidth) return { el: video, w: video.videoWidth, h: video.videoHeight };
  return null;
}

function previewLimits() {
  const r = $('finder').getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  return { maxSide: Math.min(1440, Math.ceil(Math.max(r.width, r.height) * dpr)), maxPixels: 1.6e6 };
}

// ---------- 미리보기 그리기 ----------
function loop(t) {
  requestAnimationFrame(loop);
  if (tab !== 'camera' || mode === 'hires') return;
  if (holdPreview) { holdPreview = false; return; }
  const src = currentSource();
  if (!src || !renderer) return;
  if (source === 'image' && !dirty) return; // 정지 사진은 바뀔 때만
  dirty = false;
  const plan = planOutput(src.w, src.h, curFrame(), previewLimits());
  if (view.width !== plan.outW || view.height !== plan.outH) {
    if (recording) return; // 녹화 중엔 크기를 바꾸지 않는다
    view.width = plan.outW; view.height = plan.outH;
  }
  try {
    renderer.upload(src.el);
    const gl = renderer.draw(curFilter(), {
      srcW: src.w, srcH: src.h, crop: plan.crop, outW: plan.contentW, outH: plan.contentH,
      flipX: mirrored(), time: t / 1000, seed: source === 'camera' ? Math.floor(t / 42) % 97 : 7,
    });
    compose(vctx, gl, plan, { date: settings.date ? (source === 'image' ? image.date : new Date()) : null, frameNo: shotCount + 1, stamp: curFilter().stamp });
  } catch (e) { console.warn(e); }
}

// ---------- 카메라 ----------
function stopCamera() {
  ic = null;
  stream?.getTracks().forEach(t => t.stop());
  stream = null;
  video.srcObject = null;
}

async function startCamera() {
  const seq = ++startSeq;
  stopCamera();
  hideMsg();
  if (!cameraLive()) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    showMsg(isSecureContext ? '이 브라우저에서는 실시간 카메라를 쓸 수 없어요.\n고화질 촬영이나 불러오기는 쓸 수 있어요.' : 'https 주소로 열어야 카메라를 쓸 수 있어요.', false);
    return;
  }
  // 실시간 촬영은 미리보기가 부드러운 크기로(긴 변 2560 / 1920). 더 큰 원본은 고화질 모드(기본 카메라)
  const size = settings.quality === 'high' ? { width: { ideal: 2560 }, height: { ideal: 1920 } } : { width: { ideal: 1920 }, height: { ideal: 1440 } };
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
  if (seq !== startSeq || !cameraLive()) { s?.getTracks().forEach(t => t.stop()); return; }
  if (!s) {
    const m = {
      NotAllowedError: '카메라 권한이 꺼져 있어요.\n아이폰: 설정 → 사파리 → 카메라 → 허용\n안드로이드: 주소창 왼쪽 자물쇠 → 권한',
      NotFoundError: '카메라를 찾지 못했어요.\n불러오기로 필터를 입혀 보세요.',
      NotReadableError: '다른 앱이 카메라를 쓰고 있어요.\n그 앱을 닫고 다시 켜 주세요.',
    }[err?.name] || `카메라를 켜지 못했어요. (${err?.name || '알 수 없음'})`;
    showMsg(m, true);
    return;
  }
  stream = s;
  video.muted = true; // 아이폰: 속성으로도 음소거해야 자동 재생됨
  video.srcObject = s;
  try { await video.play(); } catch {}
  hasTorch = !!s.getVideoTracks()[0].getCapabilities?.().torch;
  prepareImageCapture(s.getVideoTracks()[0]);
  dirty = true;
  setTimeout(updateThumbs, 600);
}

const setTorch = on => stream?.getVideoTracks()[0]?.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {});
function showMsg(text, retry) { $('msgText').textContent = text; $('msgRetry').hidden = !retry; $('msg').hidden = false; }
function hideMsg() { $('msg').hidden = true; }

// ---------- 카메라 고르기(띠) ----------
const chips = FILTERS.map((f, i) => {
  const b = el('button', { className: 'chip' }, el('canvas', { width: 108, height: 136 }), el('span', { textContent: f.name }));
  b.setAttribute('role', 'option');
  b.onclick = () => setFilter(i);
  $('strip').append(b);
  return b;
});
const snap = el('canvas', { width: 108, height: 136 });

function updateThumbs() {
  const src = currentSource();
  if (!src || !thumbRenderer) return;
  const a = snap.width / snap.height;
  let w = src.w, h = src.h;
  if (w / h > a) w = h * a; else h = w / a;
  snap.getContext('2d').drawImage(src.el, (src.w - w) / 2, (src.h - h) / 2, w, h, 0, 0, snap.width, snap.height);
  try {
    thumbRenderer.upload(snap);
    FILTERS.forEach((f, i) => {
      const gl = thumbRenderer.draw(f, { srcW: snap.width, srcH: snap.height, crop: { x: 0, y: 0, w: snap.width, h: snap.height }, outW: snap.width, outH: snap.height, flipX: mirrored(), seed: 3 });
      chips[i].firstChild.getContext('2d').drawImage(gl, 0, 0);
    });
  } catch (e) { console.warn(e); }
}
setInterval(() => { if (cameraLive() && !recording) updateThumbs(); }, 4000);

function setFilter(i) {
  i = (i + FILTERS.length) % FILTERS.length;
  settings.filter = FILTERS[i].id;
  saveSettings();
  chips.forEach((c, j) => c.setAttribute('aria-selected', String(i === j)));
  chips[i].scrollIntoView({ inline: 'center', block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  $('camTag').textContent = FILTERS[i].tag;
  $('camTitle').textContent = FILTERS[i].name;
  syncTools();
  dirty = true;
}

// 뷰파인더 좌우로 밀어 카메라 바꾸기(키보드는 ←/→)
let swipe = null;
$('finder').addEventListener('pointerdown', e => { swipe = { x: e.clientX, y: e.clientY }; });
$('finder').addEventListener('pointerup', e => {
  if (!swipe) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  swipe = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && !recording) setFilter(filterIndex() + (dx < 0 ? 1 : -1));
});
$('camName').onclick = () => openDetail(curFilter());

// ---------- 소리: 기본 끔(설정에서 켬) ----------
let actx;
function tone(kind) {
  if (!settings.sound) return;
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
    for (const [at, len, freq] of [[0, 0.03, 3200], [0.07, 0.05, 1800]]) { // 셔터: 짧은 잡음 두 번
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
  const c = $('countdown');
  for (let n = sec; n > 0; n--) { c.textContent = n; tone('tick'); await sleep(1000); }
  c.textContent = '';
}

const toBlob = (c, type, q) => (c.convertToBlob
  ? c.convertToBlob({ type, quality: q }) // OffscreenCanvas: 인코딩이 메인 스레드를 덜 막는다
  : new Promise((ok, fail) => c.toBlob(b => (b ? ok(b) : fail(new Error('이미지를 만들지 못했어요'))), type, q)));
// 다음 그림이 화면에 나간 직후(rAF 다음 작업)
const nextFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
const canvasOf = (w, h) => ('OffscreenCanvas' in window ? new OffscreenCanvas(w, h) : el('canvas', { width: w, height: h }));

async function makeThumb(canvas, size = 360) {
  const s = Math.min(1, size / Math.max(canvas.width, canvas.height));
  const t = canvasOf(Math.round(canvas.width * s), Math.round(canvas.height * s));
  t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
  return toBlob(t, 'image/jpeg', 0.8);
}

// 누른 순간 앨범 자리에 지금 화면(이미 필터 입힘)을 작게 띄운다. 진짜 썸네일은 처리 뒤 바뀐다
function quickThumb() {
  const s = 120 / Math.max(view.width, view.height);
  const t = el('canvas', { width: Math.max(1, Math.round(view.width * s)), height: Math.max(1, Math.round(view.height * s)) });
  t.getContext('2d').drawImage(view, 0, 0, t.width, t.height);
  const img = $('albumThumb');
  if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
  img.src = t.toDataURL('image/jpeg', 0.7);
}

function shutterFeedback() {
  const f = $('flash');
  f.classList.remove('on', 'blink');
  void f.offsetWidth; // 연속으로 눌러도 매번 다시 깜빡이게
  f.classList.add('blink');
  holdPreview = !recording;
  document.dispatchEvent(new Event('dj:shutter')); // 반응 시각 측정용(perf.mjs)
  requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('blink')));
  tone('shutter');
}

// 안드로이드 크롬: ImageCapture. 사진 크기는 카메라를 켤 때 한 번만 알아 둔다(startCamera)
let ic = null, icOpts = {}, icBusy = false;
function prepareImageCapture(track) {
  ic = null;
  if (!('ImageCapture' in window)) return;
  try {
    const cap = new ImageCapture(track);
    cap.getPhotoCapabilities().then(c => {
      icOpts = c.imageWidth?.max ? { imageWidth: c.imageWidth.max, imageHeight: c.imageHeight.max } : {};
      if (stream?.getVideoTracks()[0] === track) ic = cap;
    }).catch(() => {});
  } catch {}
}
// 300ms 안에 오면 전체 해상도 사진, 늦으면 null(누른 순간 잡아 둔 화면 프레임을 쓴다. 늦게 온 사진은 버림)
function quickPhoto() {
  if (!ic || icBusy) return null;
  icBusy = true;
  let late = false;
  const p = ic.takePhoto(icOpts).then(b => createImageBitmap(b, { imageOrientation: 'from-image' })).finally(() => { icBusy = false; });
  p.then(bmp => { if (late) bmp.close(); }, () => {});
  return Promise.race([p.catch(() => null), sleep(300).then(() => { late = true; return null; })]);
}

// 누른 순간의 영상 프레임(원본 크기). createImageBitmap은 부르는 순간의 프레임을 잡는다
async function grabFrame() {
  const w = video.videoWidth, h = video.videoHeight;
  if (window.createImageBitmap) {
    try { return { el: await createImageBitmap(video), w, h }; } catch {}
  }
  const c = el('canvas', { width: w, height: h });
  c.getContext('2d').drawImage(video, 0, 0);
  return { el: c, w, h };
}

// 폰을 든 방향. 화면 회전 잠금으로 화면은 세로인데 폰을 가로로 들고 찍으면 영상은 세로로 들어온다.
// 그때 사진을 가로로 돌려 저장해야 날짜 스탬프가 그 가로 사진의 오른쪽 아래에 바로 찍힌다(기본 카메라 앱과 같음).
let tilt = null, tiltAsked = false;
addEventListener('deviceorientation', e => { if (e.beta != null && e.gamma != null) tilt = [e.beta, e.gamma]; });
// 아이폰은 방향 센서에 허락이 필요하다(누른 순간에만 물을 수 있음). 처음 한 번만 묻는다
async function askTilt() {
  if (tiltAsked || typeof window.DeviceOrientationEvent?.requestPermission !== 'function') return;
  tiltAsked = true;
  try { if (await DeviceOrientationEvent.requestPermission() === 'granted' && !tilt) await sleep(150); } catch {}
}
// 저장할 때 왼쪽으로 돌릴 횟수(90도 단위): 0 그대로, 1 왼쪽으로 90도, 3 오른쪽으로 90도
function holdTurn() {
  if (!tilt) return 0;
  const [b, g] = tilt.map(v => v * Math.PI / 180);
  const ux = -Math.sin(g) * Math.cos(b), uy = Math.sin(b); // 하늘 방향(화면 기준: 오른쪽 x, 위 y)
  if (Math.hypot(ux, uy) < 0.5) return 0; // 거의 눕혀 들면(바닥·하늘 찍기) 판단하지 않는다
  const screenAngle = screen.orientation?.angle ?? window.orientation ?? 0; // 화면이 따라 돌았으면 영상도 이미 돌아 있다
  const q = ((Math.round((Math.atan2(ux, uy) * 180 / Math.PI - screenAngle) / 90) % 4) + 4) % 4;
  return q === 2 ? 0 : q; // 거꾸로 들기는 잘못 읽기 쉬워 돌리지 않는다
}
// 원본을 왼쪽으로 q×90도 돌린 캔버스
function turnSource(src, q) {
  const c = el('canvas', { width: q % 2 ? src.h : src.w, height: q % 2 ? src.w : src.h });
  const g = c.getContext('2d');
  if (q === 1) { g.translate(0, c.height); g.rotate(-Math.PI / 2); }
  if (q === 3) { g.translate(c.width, 0); g.rotate(Math.PI / 2); }
  g.drawImage(src.el, 0, 0);
  return { el: c, w: c.width, h: c.height };
}

// 찍는 순간의 설정을 묶어 둔다(처리 중에 카메라를 바꿔도 그 사진은 그대로).
// 앞 카메라도 미리보기(거울)와 달리 실제 모습대로 저장한다(사용자 결정: 장면 속 글자가 바로 읽히게)
const makeJob = (src, date) => ({
  src, filter: curFilter(), frame: curFrame(), front: mirrored(), stamp: curFilter().stamp, turn: source === 'camera' ? holdTurn() : 0,
  date: settings.date ? date : null, frameNo: shotCount + queue.length + 1,
});

// 원본 해상도로 필터를 입혀 JPEG로 만든다
async function renderFull(job) {
  const { src } = job;
  const maxSide = Math.min(renderer.maxSide, renderer.gl.getParameter(renderer.gl.MAX_VIEWPORT_DIMS)[0]);
  let maxPixels = MAX_PIXELS, plan, gl;
  for (let i = 0; i < 4; i++) {
    plan = planOutput(src.w, src.h, job.frame, { maxPixels, maxSide });
    renderer.upload(src.el);
    gl = renderer.draw(job.filter, {
      srcW: src.w, srcH: src.h, crop: plan.crop, outW: plan.contentW, outH: plan.contentH,
      time: performance.now() / 1000, seed: Math.random() * 90,
    });
    // 메모리가 모자라면 브라우저가 그림 버퍼를 작게 만든다 → 한 단계 줄여 다시
    if (renderer.gl.drawingBufferWidth >= plan.contentW && renderer.gl.drawingBufferHeight >= plan.contentH) break;
    maxPixels /= 2;
  }
  const out = canvasOf(plan.outW, plan.outH);
  compose(out.getContext('2d'), gl, plan, { date: job.date, frameNo: job.frameNo, stamp: job.stamp });
  dirty = true;
  const thumb = await makeThumb(out);
  const blob = await toBlob(out, 'image/jpeg', 0.92);
  out.width = out.height = 0; // 아이폰 캔버스 메모리 바로 돌려주기
  return { type: 'photo', blob, thumb, w: plan.outW, h: plan.outH, filter: job.filter.id, frame: plan.frame };
}

// 처리 대기열: 셔터는 바로 받고, 무거운 렌더·인코딩·저장은 뒤에서 한 장씩. 메모리 보호로 최대 3장
const MAX_QUEUE = 3;
const queue = [];
let working = false, preparing = false;
const queueFull = () => queue.length >= MAX_QUEUE;

function enqueue(job) {
  queue.push(job);
  pump();
}
async function pump() {
  if (working) return;
  working = true;
  while (queue.length) {
    const job = queue[0];
    await nextFrame(); // 누른 화면 반응이 먼저 그려지게
    try {
      if (job.photo) { // 안드로이드 전체 해상도 사진이 제때 왔고, 방향이 같고, 더 크면 그걸 쓴다
        const bmp = await job.photo;
        if (bmp && (bmp.height > bmp.width) === (job.src.h > job.src.w) && bmp.width * bmp.height > job.src.w * job.src.h) {
          job.src.el.close?.();
          job.src = { el: bmp, w: bmp.width, h: bmp.height };
        } else bmp?.close();
      }
      if (job.turn) { // 앞 카메라 원본은 거울 미리보기와 좌우가 반대라 반대쪽으로 돌린다
        const turned = turnSource(job.src, job.front ? 4 - job.turn : job.turn);
        job.src.el.close?.();
        job.src = turned;
      }
      await keep(await renderFull(job));
    } catch (e) {
      showToast(e.message || '찍지 못했어요');
    } finally {
      if (job.src.el !== image?.el) job.src.el.close?.();
      queue.shift();
    }
  }
  working = false;
}

async function takePhoto() {
  if (preparing) return;
  if (queueFull()) { showToast('앞 사진을 정리하는 중이에요'); return; }
  if (source === 'image') {
    shutterFeedback();
    await nextFrame();
    quickThumb();
    enqueue(makeJob({ el: image.el, w: image.w, h: image.h }, image.date));
    return;
  }
  if (!currentSource()) { showToast('아직 카메라가 준비되지 않았어요'); return; }
  await askTilt();
  const flash = $('flash');
  let torchOn = false;
  if (settings.timer || settings.flash) { preparing = true; $('shutter').disabled = true; }
  try {
    if (settings.timer) await countdown(settings.timer);
    if (settings.flash) {
      if (hasTorch && !mirrored()) { await setTorch(true); torchOn = true; await sleep(300); }
      else { flash.classList.add('on'); await sleep(250); } // 화면을 하얗게 밝혀 얼굴을 비춘다
    }
    // 반응(깜빡임)을 먼저 화면에 내보내고, 바로 다음 프레임을 잡는다(30fps 영상이라 한 프레임 안쪽 차이)
    shutterFeedback();
    const date = new Date();
    await nextFrame();
    const photo = quickPhoto();
    const frame = grabFrame();
    quickThumb();
    const job = makeJob(await frame, date);
    job.photo = photo;
    enqueue(job);
  } catch (e) {
    showToast(e.message || '찍지 못했어요');
  } finally {
    if (torchOn) setTorch(false);
    flash.classList.remove('on');
    preparing = false;
    $('shutter').disabled = false;
  }
}

async function keep(shot) {
  shot.createdAt = Date.now();
  try {
    shot.id = await store.addShot(shot);
  } catch {
    showToast('앨범에 넣지 못했어요(저장 공간). 지금 휴대폰에 저장하세요.', shot, true);
    return;
  }
  shotCount++;
  setAlbumThumb(shot.thumb);
  navigator.storage?.persist?.().catch(() => {});
  if (settings.autoSave) {
    // 안드로이드는 바로 내려받기(갤러리에 들어감), 아이폰은 공유 창을 바로 띄운다
    const r = await saveToDevice(shot, { download: isAndroid() || !navigator.canShare });
    if (r === 'blocked') showToast('휴대폰에 저장하려면 눌러 주세요', shot, true);
    else if (r === 'downloaded') showToast('휴대폰에 저장했어요');
    return;
  }
  showToast(shot.type === 'video' ? '영상을 앨범에 담았어요' : '앨범에 담았어요', shot);
}

// 고화질: 휴대폰 기본 카메라로 찍고 돌아오면 필터를 입힌다
$('fileCapture').onchange = async e => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  try {
    const img = await loadImage(f);
    enqueue(makeJob(img, img.date));
  } catch (err) {
    showToast(err.message || '사진을 열 수 없어요');
  }
};

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
  catch { vs.getTracks().forEach(t => t.stop()); showToast('녹화를 시작하지 못했어요'); return; }
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
    await keep({ type: 'video', blob, thumb: await posterP, w, h, filter: curFilter().id, frame: curFrame(), duration: (performance.now() - t0) / 1000 });
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
  for (const id of ['btnFrame', 'btnFlip', 'modePhoto', 'modeHires', 'btnImport', 'btnAlbum']) $(id).disabled = on;
  document.querySelectorAll('.tabbar button').forEach(b => { b.disabled = on; });
}

// ---------- 조작부 ----------
function updateShutter() {
  const s = $('shutter');
  s.classList.toggle('video', mode === 'video' && source === 'camera');
  s.classList.toggle('hires', mode === 'hires' && source === 'camera');
  s.classList.toggle('save', source === 'image');
  s.setAttribute('aria-label', source === 'image' ? '필터 입혀 저장하기' : mode === 'video' ? '녹화 시작' : mode === 'hires' ? '기본 카메라로 고화질 촬영' : '사진 찍기');
  $('hiresMsg').hidden = !(mode === 'hires' && source === 'camera');
  $('btnFlip').disabled = source === 'image' || mode === 'hires';
}

$('shutter').onclick = () => {
  if (source === 'camera' && mode === 'video') toggleRecording();
  else if (source === 'camera' && mode === 'hires') $('fileCapture').click();
  else takePhoto();
};

function setMode(m) {
  if (mode === m || recording) return;
  const prev = mode;
  mode = m;
  for (const [id, v] of [['modePhoto', 'photo'], ['modeVideo', 'video'], ['modeHires', 'hires']]) $(id).setAttribute('aria-checked', String(m === v));
  updateShutter();
  if (source !== 'camera') return;
  if (m === 'hires') { startSeq++; stopCamera(); return; }
  // 영상에 소리를 넣으려면 마이크가 같이 들어간 스트림이 필요하다(아이폰은 따로 열면 화면 트랙이 멈출 수 있음)
  if (prev === 'hires' || !stream || (settings.mic && (m === 'video') !== !!stream.getAudioTracks().length)) startCamera();
}
$('modePhoto').onclick = () => setMode('photo');
$('modeVideo').onclick = () => setMode('video');
$('modeHires').onclick = () => setMode('hires');

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
  $('frameLabel').textContent = settings.frame === 'auto' ? '프레임' : frameById(settings.frame).name;
  document.querySelectorAll('[data-set]').forEach(b => {
    const v = settings[b.dataset.set];
    b.setAttribute('aria-checked', String(typeof v === 'boolean' ? (b.dataset.val === 'on') === v : b.dataset.val === v));
  });
}

// ---------- 시트·겹친 화면 ----------
// 닫으면 연 버튼으로 초점을 돌려준다(겹쳐 열린 화면도 각자 기억)
function openLayer(e) { e._ret = document.activeElement; e.hidden = false; e.querySelector('button')?.focus(); }
function closeLayer(e) { e.hidden = true; if (e._ret?.isConnected) e._ret.focus(); }
document.querySelectorAll('[data-close]').forEach(b => { b.onclick = () => closeLayer(b.closest('[role=dialog]')); });
document.querySelectorAll('.sheet').forEach(s => s.addEventListener('click', e => { if (e.target === s) closeLayer(s); }));
addEventListener('keydown', e => {
  const open = [...document.querySelectorAll('[role=dialog]')].reverse().find(d => !d.hidden);
  if (e.key === 'Escape') { if (open === $('exhibit')) stopExhibit(); else if (open) closeLayer(open); }
  else if (!open && tab === 'camera' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !recording) setFilter(filterIndex() + (e.key === 'ArrowRight' ? 1 : -1));
});

// 프레임 고르기: 견본은 실제 compose()로 그린다
const sample = drawScene('street', 300, 400, 5);
const FRAME_CHOICES = [{ id: 'auto', name: '카메라 기본' }, ...FRAMES];
const frameBtns = FRAME_CHOICES.map(f => {
  const plan = planOutput(300, 400, f.id === 'auto' ? 'none' : f.id, { maxSide: 144 });
  const c = el('canvas', { width: plan.outW, height: plan.outH });
  compose(c.getContext('2d'), sample, plan, { date: new Date(), frameNo: 1 });
  const b = el('button', {}, c, el('span', { textContent: f.name }));
  b.setAttribute('role', 'radio');
  b.onclick = () => { settings.frame = f.id; saveSettings(); syncFrames(); syncTools(); dirty = true; };
  $('frames').append(b);
  return b;
});
const syncFrames = () => frameBtns.forEach((b, i) => b.setAttribute('aria-checked', String(FRAME_CHOICES[i].id === settings.frame)));
$('btnFrame').onclick = () => { syncFrames(); openLayer($('frameSheet')); };

document.querySelectorAll('[data-set]').forEach(b => {
  b.onclick = () => {
    const k = b.dataset.set, before = settings[k];
    settings[k] = typeof DEFAULTS[k] === 'boolean' ? b.dataset.val === 'on' : b.dataset.val;
    saveSettings();
    syncTools();
    if (before !== settings[k] && (k === 'quality' || (k === 'mic' && mode === 'video'))) startCamera();
  };
});

// ---------- 사진 불러오기 ----------
async function loadImage(f) {
  const url = URL.createObjectURL(f);
  const img = new Image();
  img.src = url;
  try { await img.decode(); } catch { throw new Error('이 사진은 열 수 없어요(HEIC는 사진 앱에서 JPEG로 바꿔 주세요)'); } finally { URL.revokeObjectURL(url); }
  let e = img, w = img.naturalWidth, h = img.naturalHeight;
  // 텍스처·캔버스 한도를 넘는 큰 사진(4800만 화소 등)은 미리 줄인다
  const s = Math.min(1, (renderer?.maxSide ?? 4096) / Math.max(w, h), Math.sqrt(MAX_PIXELS / (w * h)));
  if (s < 1) {
    e = el('canvas', { width: Math.round(w * s), height: Math.round(h * s) });
    e.getContext('2d').drawImage(img, 0, 0, e.width, e.height);
    w = e.width; h = e.height;
  }
  let date = null;
  try { date = exifDate(await f.slice(0, 256 * 1024).arrayBuffer()); } catch {}
  return { el: e, w, h, date: date || new Date(f.lastModified || Date.now()) };
}

$('btnImport').onclick = () => $('file').click();
$('file').onchange = async e => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  try {
    image = await loadImage(f);
    if (recording) recording.rec.stop();
    source = 'image';
    startSeq++;
    stopCamera();
    hideMsg();
    $('editBar').hidden = false;
    $('modeVideo').disabled = $('modeHires').disabled = true;
    updateShutter();
    dirty = true;
    updateThumbs();
  } catch (err) { showToast(err.message); }
};
$('btnBack').onclick = () => {
  source = 'camera';
  image = null;
  $('editBar').hidden = true;
  $('modeVideo').disabled = $('modeHires').disabled = false;
  updateShutter();
  startCamera();
};
$('msgRetry').onclick = () => startCamera();

// ---------- 알림 ----------
let toastHide, toastShot = null;
function showToast(text, shot = null, big = false) {
  toastShot = shot;
  $('toastText').textContent = text;
  $('toastSave').hidden = !shot;
  $('toast').classList.toggle('big', big);
  $('toast').hidden = false;
  clearTimeout(toastHide);
  toastHide = setTimeout(() => { $('toast').hidden = true; }, big ? 15000 : shot ? 5000 : 2600);
}
$('toastSave').onclick = async () => {
  if (!toastShot) return;
  $('toast').hidden = true;
  const r = await saveToDevice(toastShot);
  if (r === 'downloaded') showToast('파일로 내려받았어요');
};

// ---------- 탭 ----------
function setTab(t) {
  if (recording) return;
  tab = t;
  document.querySelectorAll('.tabbar button').forEach(b => (b.dataset.tab === t ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  for (const name of ['drop', 'camera', 'museum', 'my']) $('tab-' + name).hidden = name !== t;
  $('selectBar').hidden = true;
  if (t === 'camera') { if (source === 'camera') startCamera(); dirty = true; }
  else { startSeq++; stopCamera(); }
  if (t === 'drop') renderDrop();
  if (t === 'museum') renderMuseum();
  if (t === 'my') renderMy();
}
document.querySelectorAll('.tabbar button').forEach(b => { b.onclick = () => setTab(b.dataset.tab); });

// 카메라 장면 하나를 그 카메라 색감·날짜·프레임으로 그린다(Drop 대표, 상세 예시)
// hero: 글자가 아래에 겹치는 대표 사진이라 날짜를 넣지 않는다
function sceneShot(cam, scene, w, h, seed, hero = false) {
  const src = drawScene(scene, w, h, seed);
  const plan = planOutput(w, h, cam.frame, { maxSide: Math.max(w, h) });
  thumbRenderer.upload(src);
  const gl = thumbRenderer.draw(cam, { srcW: w, srcH: h, crop: plan.crop, outW: plan.contentW, outH: plan.contentH, seed: seed % 50, time: 1 });
  const c = el('canvas', { width: plan.outW, height: plan.outH });
  const date = hero ? null : new Date(2026, (seed * 7) % 12, 1 + (seed * 13) % 27, 9 + seed % 10, (seed * 17) % 60);
  compose(c.getContext('2d'), gl, plan, { date, frameNo: seed % 40 + 1, stamp: hero && cam.stamp === 'camcorder' ? 'orange' : cam.stamp });
  return c;
}

const monthLabel = ym => { const [y, m] = ym.split('-'); return `${y}년 ${+m}월`; };

let dropDone = false;
function renderDrop() {
  if (dropDone || !thumbRenderer) return;
  dropDone = true;
  const feat = CAMERAS[0];
  const hero = sceneShot(feat, feat.scenes[0], 720, 900, 11, true);
  const go = el('button', { className: 'pill outline', textContent: '이 카메라 자세히 보기 ›' });
  go.onclick = () => openDetail(feat);
  $('feature').replaceChildren(hero, el('div', { className: 'fade' }), el('div', { className: 'txt' },
    el('p', { className: 'kicker', textContent: '이달에 출시된 카메라' }),
    el('h1', { className: 'serif', textContent: feat.name }),
    el('p', { className: 'sub', textContent: feat.tagline }),
    el('p', { className: 'when', textContent: `${feat.released} 출시` }), go));
  const list = [];
  let month = '';
  for (const cam of CAMERAS.slice(1)) {
    if (cam.month !== month) list.push(el('div', { className: 'month' }, el('span', { textContent: monthLabel(month = cam.month) }), el('i')));
    const row = el('button', { className: 'drop-row' });
    row.innerHTML = cameraSvg(cam.body);
    row.append(el('div', {}, el('b', { textContent: cam.name }), el('span', { textContent: cam.tagline }), el('em', { textContent: '자세히 보기 ›' })));
    row.setAttribute('aria-label', `${cam.name}, ${cam.tagline}`);
    row.onclick = () => openDetail(cam);
    list.push(row);
  }
  $('dropList').replaceChildren(...list);
}

// ---------- 카메라 상세 ----------
let detailCam = null, detailUrls = [];
async function openDetail(cam) {
  detailCam = cam;
  $('dTag').textContent = cam.tag;
  $('dName').textContent = cam.name;
  $('dTagline').textContent = cam.tagline;
  $('dStory').replaceChildren(...cam.story.map(t => el('p', { textContent: t })));
  const hero = sceneShot(cam, cam.scenes[0], 720, 900, 21, true);
  const dh = $('dHero');
  dh.width = hero.width; dh.height = hero.height;
  dh.getContext('2d').drawImage(hero, 0, 0);
  $('dSamples').replaceChildren(...cam.scenes.slice(1).map((s, i) => sceneShot(cam, s, 720, 900, 31 + i)));
  detailUrls.forEach(URL.revokeObjectURL);
  detailUrls = [];
  const mine = (await store.listShots()).filter(s => s.filter === cam.id && s.type === 'photo').slice(0, 12);
  $('dMine').replaceChildren(...(mine.length ? mine.map(s => {
    const u = URL.createObjectURL(s.thumb);
    detailUrls.push(u);
    return el('img', { src: u, alt: `${new Date(s.createdAt).toLocaleDateString('ko-KR')}에 찍은 사진` });
  }) : [el('p', { className: 'none', textContent: '아직 이 카메라로 찍은 사진이 없어요. 아래 버튼으로 첫 장을 남겨 보세요.' })]));
  $('detail').scrollTop = 0;
  if ($('detail').hidden) openLayer($('detail'));
}
$('dUse').onclick = () => {
  setFilter(FILTERS.indexOf(detailCam));
  closeLayer($('detail'));
  setTab('camera');
};

// ---------- 앨범 데이터 ----------
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
const thumbUrl = blob => { const u = URL.createObjectURL(blob); urls.push(u); return u; };
const ym = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

// ---------- Museum: 달마다 여는 사진관 ----------
let museumMonth = null;
async function renderMuseum() {
  items = await store.listShots();
  urls.forEach(URL.revokeObjectURL); urls = [];
  const months = [...new Set(items.map(i => ym(i.createdAt)))];
  const now = ym(Date.now());
  if (!museumMonth || !months.includes(museumMonth)) museumMonth = now;
  const [, m] = museumMonth.split('-');
  $('museumTitle').textContent = `${+m}월, 우리 사진관`;
  const photos = items.filter(i => i.type === 'photo' && ym(i.createdAt) === museumMonth);
  const pick = photos[photos.length - 1]; // 그달 첫 장을 대표로
  $('museumPick').replaceChildren(...(pick ? [(() => {
    const b = el('button', {}, el('img', { src: thumbUrl(pick.thumb), alt: '' }), el('div', {},
      el('small', { textContent: `${+m}월의 한 장` }),
      el('b', { textContent: FILTERS.find(f => f.id === pick.filter)?.name || '' }),
      el('span', { textContent: `${new Date(pick.createdAt).toLocaleDateString('ko-KR')} · 자세히 보기` })));
    b.onclick = () => openViewer(items.indexOf(pick));
    return b;
  })()] : []));
  $('btnExhibit').disabled = !photos.length;
  $('museumWall').replaceChildren(...(photos.length ? photos.map(p => {
    const b = el('button', {}, el('img', { src: thumbUrl(p.blob), alt: '', loading: 'lazy' }));
    b.setAttribute('aria-label', `${new Date(p.createdAt).toLocaleString('ko-KR')} 사진 크게 보기`);
    b.onclick = () => openViewer(items.indexOf(p));
    return b;
  }) : [el('p', { className: 'empty-wall', textContent: '이번 달에는 아직 걸린 사진이 없어요. Camera에서 첫 장을 찍어 보세요.' })]));
  const past = months.filter(x => x !== museumMonth);
  $('museumPast').replaceChildren(...(past.length ? [el('div', { className: 'rule-row' }, el('span', { textContent: '다른 달의 사진관' }), el('i'))] : []),
    ...past.map(x => {
      const b = el('button', { className: 'past' }, el('b', { className: 'serif', textContent: monthLabel(x) }), el('span', { textContent: `${items.filter(i => i.type === 'photo' && ym(i.createdAt) === x).length}장 ›` }));
      b.onclick = () => { museumMonth = x; renderMuseum(); $('tab-museum').scrollTop = 0; };
      return b;
    }));
  $('btnExhibit').onclick = () => startExhibit(photos);
}

// ---------- My: 앨범(달별) + 여러 장 고르기 ----------
let selecting = false;
const selected = new Set();
async function renderMy() {
  items = await store.listShots();
  urls.forEach(URL.revokeObjectURL); urls = [];
  let month = '';
  $('grid').replaceChildren(...items.flatMap((it, i) => {
    const head = ym(it.createdAt) !== month ? [el('h3', { textContent: monthLabel(month = ym(it.createdAt)) })] : [];
    const b = el('button', {}, el('img', { src: thumbUrl(it.thumb), alt: '' }));
    b.setAttribute('aria-label', `${it.type === 'video' ? '영상' : '사진'} ${new Date(it.createdAt).toLocaleString('ko-KR')}`);
    if (selecting) b.setAttribute('aria-pressed', String(selected.has(it.id)));
    if (it.type === 'video') {
      const d = Math.round(it.duration || 0);
      b.append(el('span', { className: 'badge', textContent: `영상 ${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}` }));
    }
    b.onclick = () => {
      if (!selecting) return openViewer(i);
      selected.has(it.id) ? selected.delete(it.id) : selected.add(it.id);
      b.setAttribute('aria-pressed', String(selected.has(it.id)));
      syncSelect();
    };
    return [...head, b];
  }));
  $('albumEmpty').hidden = items.length > 0;
  $('btnSelect').hidden = !items.length;
}
function syncSelect() {
  $('selSave').textContent = `휴대폰에 저장 (${selected.size})`;
  $('selSave').disabled = $('selDelete').disabled = !selected.size;
}
function setSelecting(on) {
  selecting = on;
  selected.clear();
  $('selectBar').hidden = !on;
  $('btnSelect').textContent = on ? '고르는 중' : '여러 장 고르기';
  syncSelect();
  renderMy();
}
$('btnSelect').onclick = () => setSelecting(!selecting);
$('selCancel').onclick = () => setSelecting(false);
$('selSave').onclick = async () => {
  const pickd = items.filter(i => selected.has(i.id));
  const r = await saveToDevice(pickd); // 공유 창 한 번에 여러 장(아이폰: 'n개의 이미지 저장')
  if (r === 'downloaded') showToast(`${pickd.length}개 파일을 내려받았어요`);
  if (r !== 'cancelled') setSelecting(false);
};
$('selDelete').onclick = async () => {
  if (!confirm(`${selected.size}장을 앨범에서 지울까요? 되돌릴 수 없어요.`)) return;
  for (const id of selected) await store.deleteShot(id);
  await refreshAlbumButton();
  setSelecting(false);
};
$('btnAlbum').onclick = () => setTab('my');

// ---------- 크게 보기 ----------
let vIndex = 0, vUrl = null;
function openViewer(i) {
  vIndex = i;
  const it = items[i];
  if (vUrl) URL.revokeObjectURL(vUrl);
  vUrl = URL.createObjectURL(it.blob);
  let m;
  if (it.type === 'video') {
    m = el('video', { src: vUrl, controls: true, playsInline: true, loop: true });
    m.setAttribute('playsinline', '');
  } else m = el('img', { src: vUrl, alt: '찍은 사진' });
  $('stage').replaceChildren(m);
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
  await refreshAlbumButton();
  if (tab === 'my') renderMy(); else if (tab === 'museum') renderMuseum();
};
$('viewer').querySelector('[data-close]').addEventListener('click', () => $('stage').replaceChildren());

// 슬라이드로 보기: 7초마다 천천히 바뀜, 누르면 닫힘
let exTimer = null, exUrls = [];
function startExhibit(photos) {
  if (!photos.length) return;
  const imgs = [$('exA'), $('exB')];
  let n = 0;
  const show = () => {
    const it = photos[n % photos.length], img = imgs[n % 2], other = imgs[(n + 1) % 2];
    const u = URL.createObjectURL(it.blob);
    exUrls.push(u);
    if (exUrls.length > 3) URL.revokeObjectURL(exUrls.shift());
    img.onload = () => { other.classList.remove('on'); img.classList.add('on'); };
    img.src = u;
    const d = new Date(it.createdAt);
    $('exCaption').textContent = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}  ${FILTERS.find(f => f.id === it.filter)?.name || ''}`;
    n++;
  };
  show();
  exTimer = setInterval(show, 7000);
  $('exhibit').hidden = false;
}
function stopExhibit() {
  clearInterval(exTimer);
  $('exhibit').hidden = true;
  exUrls.forEach(URL.revokeObjectURL); exUrls = [];
  for (const i of [$('exA'), $('exB')]) { i.classList.remove('on'); i.removeAttribute('src'); }
}
$('exhibit').onclick = stopExhibit;

// ---------- 앱이 가려지면 카메라 끄기(배터리·아이폰은 어차피 멈춤) ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (recording) recording.rec.stop();
    startSeq++;
    stopCamera();
  } else startCamera();
});

// ---------- 시작 ----------
try {
  renderer = new Renderer();
  thumbRenderer = new Renderer();
} catch {
  showMsg('이 브라우저는 WebGL을 쓸 수 없어 필터를 입힐 수 없어요.', false);
}
setFilter(filterIndex());
syncTools();
updateShutter();
refreshAlbumButton();
requestAnimationFrame(loop);
if (renderer) startCamera();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
