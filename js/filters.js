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

// 카메라 15대 = 필터 15개. 이름·구성은 원래 앱을 따랐다(사용자 결정). 색감은 원래 앱 화면 속 그 카메라 사진들에 맞췄다.
// 화면용 정보: tag(작은 영문), tagline(한 줄), story(문단들), month(Drop에 묶이는 달), stamp(날짜 모양), frame(기본 프레임),
// body(카메라 그림: kind·색), scenes(대표·예시 장면 이름, scenes.js)
// stamp: 'orange' 주황 7세그먼트 / 'digital' 흰 디지털 시각 / 'camcorder' 캠코더 화면 / 'instant' 즉석사진 아래 여백 손글씨
export const FILTERS = [
  { id: 'alley', name: 'Osaka Classic', tag: 'osaka classic 35mm, date-back', tagline: '오사카의 저녁은 조금 흐릿해서, 더 오래 남는다.',
    story: ['강가의 네온, 골목 끝 작은 슈퍼의 불빛, 해 질 무렵 가게 앞을 지나던 사람의 뒷모습. 90년대 컴팩트 필름 카메라의 부드러운 확산과 굵은 입자, 하이라이트 둘레로 번지는 빛, 청록으로 가라앉는 그림자를 그대로 재현했습니다.', '모서리로 갈수록 살짝 어두워지는 렌즈의 숨결과, 오른쪽 아래 찍히는 주황빛 날짜가 그날을 한 장의 필름으로 남깁니다.'],
    month: '2026-09', released: '9월 17일', stamp: 'orange', frame: 'none', body: { kind: 'compact', color: '#d9d6cf', accent: '#2b2b2b' }, scenes: ['street', 'sea', 'room'],
    exposure: 0.05, contrast: 1.1, saturation: 1.0, temp: 0.4, tint: -0.05, fade: 0.05,
    shadows: [-0.03, 0.03, 0.05], highlights: [0.08, 0.04, -0.04], grain: 0.09, grainSize: 1.6, vignette: 0.45, halation: 0.5, soften: 0.2 },
  { id: 'butter', name: 'Butterfilm', tag: 'sunlit 35mm', tagline: 'sunlit 35mm',
    story: ['이 카메라로 담는 순간에는 특유의 공기가 있습니다. 빛과 색이 필름처럼 내려앉아, 평범한 오늘을 오래 두고 볼 한 장으로 바꿔줍니다.', '벽돌 벽에 기댄 오후, 문틈으로 쏟아지는 해. 노랗게 녹아드는 빛과 깊게 떨어지는 그림자를 그대로 남겨요.'],
    month: '2026-08', stamp: 'orange', frame: 'none', body: { kind: 'compact', color: '#d8b13a', accent: '#b8402e' }, scenes: ['sunwall', 'street', 'field'],
    exposure: 0.05, contrast: 1.18, saturation: 1.08, temp: 0.55, tint: 0.0, fade: 0.03, shadows: [0.02, 0.0, -0.02], highlights: [0.08, 0.05, -0.04],
    grain: 0.08, vignette: 0.35, leak: 0.55, leakColor: [1, 0.55, 0.15], leakPos: [-0.05, 0.75], halation: 0.3 },
  { id: 'hometape', name: 'Lazy Monkey', tag: "99's home tape memories", tagline: '특별할 것 없던 하루가, 테이프 안에서는 늘 반짝였다.',
    story: ['거실 소파에 뒹굴던 오후, 처음 함께 떠난 여행, 케이크 앞에서 부르던 노래. 576선 테이프 해상도로 다시 그려낸 화면과 CCD 특유의 얕은 초록기, 화면 구석에 새겨지는 남은 시간과 4:3 재생 화면까지.', '1999년 가정용 캠코더가 기록하던 우리의 보통날을 그대로 담습니다.'],
    month: '2026-08', stamp: 'camcorder', frame: 'none', body: { kind: 'camcorder', color: '#c9c9c4', accent: '#2a2a2a' }, scenes: ['room', 'field', 'sea'],
    exposure: 0.15, contrast: 1.0, saturation: 1.05, temp: 0.05, tint: -0.1, fade: 0.06, shadows: [-0.01, 0.03, 0.01],
    grain: 0.05, grainSize: 1.2, vignette: 0.15, vhs: 0.45, soften: 0.35, halation: 0.25 },
  { id: 'nighttape', name: 'Night Tape 98', tag: 'night camcorder, 1998', tagline: '되감기 버튼을 누르면, 그 밤의 네온이 다시 켜진다.',
    story: ['편의점 앞 형광등, 노래방 복도의 보랏빛, 택시 창밖으로 흘러가는 간판들. 어둠 속에서 번지는 불빛과 지지직거리는 테이프 잡음을 그대로 살렸습니다.', '화면 위 녹화 표시와 시각이 그 밤을 한 편의 홈비디오로 남겨요.'],
    month: '2026-07', stamp: 'camcorder', frame: 'none', body: { kind: 'camcorder', color: '#3a3a3e', accent: '#9a9aa0' }, scenes: ['neon', 'street', 'room'],
    exposure: 0.25, contrast: 1.1, saturation: 1.15, temp: -0.3, tint: 0.4, fade: 0.06, shadows: [0.04, -0.02, 0.1], highlights: [0.08, 0.02, 0.06],
    grain: 0.1, grainSize: 1.4, vignette: 0.35, vhs: 1, halation: 0.6, soften: 0.3 },
  { id: 'digicam', name: 'Cold Snap', tag: 'crisp vivid digicam', tagline: '생기있는 2000년대 초반 빈티지 디카 감성',
    story: ['한낮의 바닷가, 하얀 셔츠, 눈부신 콘크리트와 짙은 그늘까지. Cold Snap은 그 시절 작은 디카 특유의 또렷한 색으로 그날의 장면을 담습니다.', '파랑은 시원하고 선명하게, 초록은 깊게, 피부에는 자연스러운 혈색을 남깁니다. 강한 빛 아래에서도 블랙은 단단하게 붙고, 작은 디카 특유의 선명한 질감이 바람과 표정까지 또렷하게 살려줘요.'],
    month: '2026-07', stamp: 'digital', frame: 'none', body: { kind: 'digicam', color: '#cfd1d4', accent: '#3b3e44' }, scenes: ['sea', 'field', 'sunwall'],
    exposure: 0.12, contrast: 1.25, saturation: 1.22, temp: -0.12, tint: 0.03, shadows: [-0.03, 0.0, 0.04], highlights: [0.02, 0.03, 0.05],
    grain: 0.03, grainSize: 1.0, vignette: 0.08, halation: 0.15 },
  { id: 'pearl', name: 'Pearl 08', tag: 'pearl pink compact', tagline: '햇빛 좋은 날, 사랑하는 사람의 얼굴이 가장 예뻐 보이던 순간.',
    story: ['분홍 진주빛 몸체의 작은 카메라. 뽀얀 피부, 볼에 머무는 혈색, 부드럽게 번지는 하이라이트로 좋아하는 사람의 얼굴을 가장 곱게 남겨요.', '창가의 오후, 벚꽃 아래, 카페 테이블 건너편. 가까이에서 찍을수록 빛납니다.'],
    month: '2026-06', stamp: 'orange', frame: 'none', body: { kind: 'compact', color: '#e9c3c3', accent: '#7a5b5b' }, scenes: ['blossom', 'room', 'sunwall'],
    exposure: 0.2, contrast: 0.9, saturation: 0.95, temp: 0.25, tint: 0.22, fade: 0.08, shadows: [0.05, 0.02, 0.06], highlights: [0.07, 0.03, 0.03],
    grain: 0.05, vignette: 0.2, soften: 0.35, halation: 0.25, leak: 0.25, leakColor: [1, 0.55, 0.6], leakPos: [1.05, 0.9] },
  { id: 'flash', name: 'Seoul instc', tag: 'film white', tagline: '서울의 밤은, 집에 돌아가는 길까지 기억이 된다.',
    story: ['막차를 기다리는 지하철역, 택시 뒷자리, 오래된 골목에서 우연히 마주친 얼굴. 차가운 도시의 흰빛과 거친 플래시, 빛바랜 인화 질감으로 서울의 늦은 밤을 오래된 한 장처럼 남깁니다.', '즉석사진처럼 아래 흰 여백에 그날을 적어 둬요.'],
    month: '2026-05', stamp: 'instant', frame: 'instant', body: { kind: 'instant', color: '#e8e0cf', accent: '#d2553d' }, scenes: ['neon', 'street', 'room'],
    exposure: 0.05, contrast: 1.25, saturation: 0.8, temp: 0.1, tint: 0.03, fade: 0.08, shadows: [0.02, 0.02, 0.03], highlights: [0.05, 0.04, 0.02],
    grain: 0.1, grainSize: 1.5, vignette: 0.7, halation: 0.2 },
  { id: 'wedding', name: "Wedding '95", tag: 'vintage wedding', tagline: '그날의 순백을, 오래된 앨범처럼.',
    story: ['웨딩, 기념일, 소중한 사람의 가장 빛나는 날. 90년대 앨범 속 사진처럼 부드럽고 따뜻하게 물들입니다.', '밝은 빛 아래의 흰 드레스와 꽃, 그리고 미소를 담아보세요. 붉은색은 진하게, 흰색은 크림빛으로 남아요.'],
    month: '2026-05', stamp: 'orange', frame: 'none', body: { kind: 'compact', color: '#d8cfb4', accent: '#6b6252' }, scenes: ['blossom', 'street', 'room'],
    exposure: 0.12, contrast: 1.0, saturation: 1.1, temp: 0.35, tint: 0.08, fade: 0.1, shadows: [0.05, 0.01, 0.0], highlights: [0.06, 0.04, 0.0],
    grain: 0.07, vignette: 0.3, soften: 0.3, halation: 0.3 },
  { id: 'sepia', name: 'Dark Akan 77', tag: 'sepia night', tagline: '밤이 깊을수록 선명해지는 기억.',
    story: ['가로등 아래, 늦은 술자리, 어두운 골목의 실루엣. 세피아빛 어둠이 소음을 지우고 사랑만 남깁니다.', '해가 진 뒤의 도시, 조명이 있는 실내에서 촬영해보세요.'],
    month: '2026-04', stamp: 'orange', frame: 'none', body: { kind: 'compact', color: '#4a3a30', accent: '#1e1a17' }, scenes: ['neon', 'street', 'room'],
    exposure: 0.08, contrast: 1.25, saturation: 0.15, temp: 0.75, tint: 0.05, fade: 0.08, shadows: [0.04, 0.02, -0.02], highlights: [0.06, 0.03, -0.02],
    grain: 0.12, grainSize: 1.7, vignette: 0.6, dust: 0.3, halation: 0.25 },
  { id: 'blue', name: 'Pocari Blue', tag: 'ocean gold', tagline: '여름의 끝을 붙잡는 빛.',
    story: ['쨍한 한낮의 해변, 편의점 앞 파란 하늘. 하늘은 깊은 시안으로, 스치는 얼굴은 따뜻한 골드로 남깁니다.', '한여름 야외의 강한 빛 아래에서 가장 아름답습니다.'],
    month: '2026-03', stamp: 'orange', frame: 'none', body: { kind: 'compact', color: '#d2d2cc', accent: '#2e2e2e' }, scenes: ['sea', 'field', 'sunwall'],
    exposure: 0.1, contrast: 1.1, saturation: 1.2, temp: -0.3, tint: -0.05, fade: 0.04, shadows: [-0.04, 0.03, 0.08], highlights: [0.07, 0.05, 0.0],
    grain: 0.05, vignette: 0.2 },
  { id: 'green', name: 'Nature Core', tag: 'dreamy green', tagline: '초록이 숨 쉬는 순간.',
    story: ['숲길, 공원, 잎사귀 사이로 떨어지는 빛. 초록은 깊게, 빛은 은은하게 번져 자연의 공기를 그대로 담습니다.', '나무와 풀이 있는 곳이라면 어디든 좋습니다.'],
    month: '2026-03', stamp: 'orange', frame: 'none', body: { kind: 'compact', color: '#7d9a6a', accent: '#d9d4c3' }, scenes: ['forest', 'field', 'blossom'],
    exposure: 0.15, contrast: 0.95, saturation: 1.05, temp: -0.05, tint: -0.3, fade: 0.08, shadows: [-0.02, 0.06, 0.03], highlights: [0.05, 0.08, 0.02],
    grain: 0.06, vignette: 0.35, soften: 0.45, halation: 0.4 },
  { id: 'lime', name: 'Lime Memory', tag: 'faded lime afternoon', tagline: '햇살이 스며든 오후의 기억.',
    story: ['빛이 바랜 오후, 연둣빛 그늘과 흐릿한 하이라이트. 오래 꺼내 본 사진처럼 살짝 물 빠진 색으로 남아요.', '나른한 주말, 창가와 공원 벤치에 잘 어울립니다.'],
    month: '2026-02', stamp: 'orange', frame: 'none', body: { kind: 'rangefinder', color: '#8fc23f', accent: '#cfcfc8' }, scenes: ['field', 'forest', 'room'],
    exposure: 0.15, contrast: 0.9, saturation: 0.88, temp: 0.12, tint: -0.22, fade: 0.12, shadows: [-0.01, 0.05, 0.02], highlights: [0.07, 0.07, 0.0],
    grain: 0.06, vignette: 0.35, soften: 0.2 },
  { id: 'summer', name: 'Ohio Summer', tag: 'neighborhood summer', tagline: '골목 끝, 우리 동네의 색.',
    story: ['파란 대문, 빨간 간판, 하늘을 가로지르는 전깃줄. 90년대 동네 사진관에서 뽑은 것처럼 진한 파랑과 따뜻한 오후색으로 우리 동네를 기록합니다.'],
    month: '2026-01', stamp: 'orange', frame: 'none', body: { kind: 'compact', color: '#7f9fd0', accent: '#e9e6dd' }, scenes: ['street', 'sea', 'field'],
    exposure: 0.08, contrast: 1.12, saturation: 1.22, temp: -0.05, tint: 0.03, fade: 0.05, shadows: [-0.03, 0.02, 0.09], highlights: [0.07, 0.04, -0.03],
    grain: 0.07, vignette: 0.3 },
  { id: 'disposable', name: 'Sunny Saver', tag: 'disposable 27exp', tagline: '오래된 앨범에서 방금 꺼낸 사진.',
    story: ['스물일곱 장짜리 일회용 카메라로 찍고 사진관에서 찾아온 날. 진한 노랑, 거친 입자, 모서리의 어둠과 플래시의 빛까지.', '여행지, 소풍, 친구들과의 하루에 꺼내 보세요.'],
    month: '2026-01', stamp: 'orange', frame: 'none', body: { kind: 'disposable', color: '#f2c230', accent: '#1d1d1d' }, scenes: ['field', 'sunwall', 'street'],
    exposure: 0.1, contrast: 1.12, saturation: 1.12, temp: 0.4, tint: -0.05, fade: 0.1, shadows: [0.04, 0.03, 0.0], highlights: [0.08, 0.05, -0.04],
    grain: 0.11, grainSize: 1.6, vignette: 0.55, dust: 0.2, leak: 0.4, leakColor: [1, 0.35, 0.1], leakPos: [1.05, 0.5] },
  { id: 'daily', name: 'Day Classic', tag: 'soft compact', tagline: '평범한 하루가 필름이 되는 순간.',
    story: ['출근길, 점심의 테이블, 창가의 오후. 힘주지 않은 색으로 일상을 담담하게 기록합니다.', '특별할 것 없는 날일수록 이 카메라가 어울립니다.'],
    month: '2025-12', stamp: 'orange', frame: 'none', body: { kind: 'compact', color: '#bdbdb8', accent: '#3a3a3a' }, scenes: ['room', 'street', 'sea'],
    exposure: 0.08, contrast: 1.0, saturation: 0.9, temp: 0.12, tint: 0.04, fade: 0.07, shadows: [0.0, 0.02, 0.04], highlights: [0.05, 0.02, -0.02],
    grain: 0.07, vignette: 0.25, halation: 0.15 },
  // 필터 없이 날짜·프레임만(불러온 사진용). Drop 목록에는 나오지 않는다.
  { id: 'plain', name: 'No Filter', tag: 'original', tagline: '색을 건드리지 않고 날짜와 프레임만', story: ['색은 그대로 두고 날짜와 프레임만 얹어요.'],
    stamp: 'orange', frame: 'none', body: { kind: 'compact', color: '#9a9a9a', accent: '#333' }, scenes: ['street'], grain: 0, vignette: 0 },
];

// 화면에서 쓰는 정보(색감 값이 아닌 것)
export const META_KEYS = ['id', 'name', 'tag', 'tagline', 'story', 'month', 'released', 'stamp', 'frame', 'body', 'scenes'];

export function resolve(filter) {
  return { ...BASE, ...filter };
}
