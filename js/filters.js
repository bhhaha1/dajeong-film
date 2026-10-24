// 필터 프리셋. 값은 모두 셰이더 유니폼으로 그대로 들어간다(gl.js).
// 없는 값은 BASE 기본값을 쓴다.
export const BASE = {
  exposure: 0,      // 노출(스톱)
  contrast: 1,      // 대비
  saturation: 1,    // 채도
  temp: 0,          // 색온도 -1(차갑게)..1(따뜻하게)
  tint: 0,          // 색조 -1(초록)..1(자홍)
  fade: 0,          // 검은색 들뜸(빛바램)
  shadows: [0, 0, 0],    // 어두운 부분에 섞을 색
  highlights: [0, 0, 0], // 밝은 부분에 섞을 색
  mono: 0,          // 1이면 흑백
  grain: 0.05,      // 입자 세기
  grainSize: 1.4,   // 입자 크기(1000px 높이 기준 px)
  vignette: 0.25,   // 비네팅
  leak: 0,          // 빛샘 세기
  leakColor: [1, 0.45, 0.15],
  leakPos: [1.0, 0.15],  // 빛샘 중심(0..1, 화면 밖도 가능)
  halation: 0,      // 밝은 곳 주변 붉은 번짐
  soften: 0,        // 부드럽게(살짝 흐림)
  vhs: 0,           // 캠코더 테이프 효과
  flicker: 0,       // 8mm 깜빡임
  dust: 0,          // 먼지·흠집
};

export const FILTERS = [
  { id: 'plain', name: '그대로', desc: '필터 없이', grain: 0, vignette: 0 },
  { id: 'spring', name: '봄날', desc: '따뜻하고 포근한 파스텔',
    exposure: 0.15, contrast: 0.92, saturation: 0.9, temp: 0.35, tint: 0.1, fade: 0.08,
    shadows: [0.05, 0.02, 0.06], highlights: [0.06, 0.03, 0], grain: 0.06, vignette: 0.2,
    leak: 0.25, leakColor: [1, 0.55, 0.45], leakPos: [1.05, 0.1] },
  { id: 'alley', name: '골목', desc: '노란 오후빛 거리',
    exposure: 0.05, contrast: 1.12, saturation: 1.08, temp: 0.55, tint: -0.05, fade: 0.04,
    shadows: [0.02, 0.0, -0.03], highlights: [0.08, 0.04, -0.04], grain: 0.08, vignette: 0.35, halation: 0.25 },
  { id: 'sea', name: '여름 바다', desc: '청록빛 선명한 바다색',
    exposure: 0.1, contrast: 1.08, saturation: 1.2, temp: -0.3, tint: -0.1, fade: 0.03,
    shadows: [-0.03, 0.03, 0.06], highlights: [0.03, 0.04, 0.0], grain: 0.05, vignette: 0.2 },
  { id: 'diary', name: '흑백 일기', desc: '거친 입자의 흑백',
    mono: 1, contrast: 1.25, exposure: 0.05, fade: 0.05, grain: 0.14, grainSize: 1.8, vignette: 0.45, dust: 0.3 },
  { id: 'four', name: '오후 4시', desc: '창으로 새는 주황 빛샘',
    exposure: 0.1, contrast: 1.0, saturation: 1.0, temp: 0.4, fade: 0.05, grain: 0.07, vignette: 0.3,
    leak: 0.95, leakColor: [1, 0.42, 0.12], leakPos: [-0.05, 0.35], halation: 0.2 },
  { id: 'snow', name: '첫눈', desc: '맑고 차가운 겨울',
    exposure: 0.25, contrast: 0.9, saturation: 0.75, temp: -0.45, tint: 0.05, fade: 0.06,
    highlights: [0.0, 0.02, 0.05], grain: 0.04, vignette: 0.15 },
  { id: 'faded', name: '빛바랜', desc: '서랍 속 오래된 사진',
    exposure: 0.05, contrast: 0.82, saturation: 0.62, temp: 0.45, tint: 0.05, fade: 0.2,
    shadows: [0.08, 0.04, 0.0], highlights: [0.06, 0.04, -0.02], grain: 0.09, vignette: 0.5, dust: 0.25 },
  { id: 'f400', name: '필름 400', desc: '피부가 고운 기본 필름',
    exposure: 0.08, contrast: 1.04, saturation: 0.95, temp: 0.2, tint: 0.08, fade: 0.05,
    shadows: [0.0, 0.02, 0.04], highlights: [0.05, 0.02, -0.02], grain: 0.07, vignette: 0.25, halation: 0.15 },
  { id: 'dusk', name: '노을', desc: '자홍빛 저녁 하늘',
    exposure: 0.0, contrast: 1.1, saturation: 1.1, temp: 0.3, tint: 0.35, fade: 0.06,
    shadows: [0.04, -0.02, 0.08], highlights: [0.1, 0.03, -0.03], grain: 0.07, vignette: 0.35,
    leak: 0.35, leakColor: [1, 0.3, 0.45], leakPos: [0.5, -0.2] },
  { id: 'night', name: '밤거리', desc: '네온이 번지는 밤',
    exposure: 0.2, contrast: 1.15, saturation: 1.1, temp: -0.1, fade: 0.04,
    shadows: [-0.02, 0.04, 0.07], highlights: [0.09, 0.04, -0.03], grain: 0.12, grainSize: 1.6, vignette: 0.4, halation: 0.6 },
  { id: 'cream', name: '크림', desc: '뽀얗고 부드러운 무광',
    exposure: 0.2, contrast: 0.85, saturation: 0.82, temp: 0.25, tint: 0.05, fade: 0.14,
    highlights: [0.04, 0.03, 0.0], grain: 0.05, vignette: 0.12, soften: 0.5 },
  { id: 'instant', name: '인스턴트', desc: '즉석 필름의 초록 그늘',
    exposure: 0.15, contrast: 0.9, saturation: 0.85, temp: 0.1, tint: -0.15, fade: 0.12,
    shadows: [-0.02, 0.05, 0.03], highlights: [0.06, 0.05, 0.0], grain: 0.06, vignette: 0.35, soften: 0.25 },
  { id: 'home', name: '홈비디오', desc: '테이프 캠코더 화면',
    exposure: 0.1, contrast: 1.05, saturation: 1.15, temp: 0.1, fade: 0.06, grain: 0.06, grainSize: 1.2,
    vignette: 0.2, vhs: 1, soften: 0.3 },
  { id: 'reel', name: '영사기', desc: '깜빡이는 8mm 옛날 영화',
    exposure: 0.0, contrast: 1.1, saturation: 0.8, temp: 0.5, tint: 0.0, fade: 0.1,
    shadows: [0.04, 0.02, 0.0], grain: 0.13, grainSize: 2.0, vignette: 0.7, flicker: 1, dust: 0.6, soften: 0.35 },
];

export function resolve(filter) {
  return { ...BASE, ...filter };
}
