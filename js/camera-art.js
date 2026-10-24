// Drop 목록의 작은 카메라 그림(SVG 문자열). 원래 앱 그림을 쓰지 않고 몸체 종류·색만 받아 직접 그린다.
// kind: compact(필름 똑딱이) | digicam | camcorder | instant | disposable | rangefinder
export function cameraSvg({ kind, color, accent }) {
  const lens = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="#1b1b1b"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#gl)"/><circle cx="${cx - r * 0.35}" cy="${cy - r * 0.35}" r="${r * 0.18}" fill="rgba(255,255,255,.55)"/>`;
  let body;
  if (kind === 'camcorder') {
    body = `<rect x="18" y="26" width="70" height="38" rx="9" fill="${color}"/><rect x="18" y="26" width="70" height="38" rx="9" fill="url(#sh)"/>
      <rect x="84" y="31" width="22" height="28" rx="6" fill="${accent}"/>${lens(98, 45, 9)}
      <rect x="24" y="16" width="26" height="12" rx="3" fill="${accent}"/><rect x="58" y="34" width="20" height="5" rx="2" fill="${accent}" opacity=".6"/>
      <rect x="12" y="38" width="8" height="18" rx="3" fill="#222"/>`;
  } else if (kind === 'instant') {
    body = `<rect x="16" y="18" width="88" height="56" rx="12" fill="${color}"/><rect x="16" y="18" width="88" height="56" rx="12" fill="url(#sh)"/>
      ${lens(64, 48, 15)}<circle cx="32" cy="34" r="6" fill="${accent}"/><rect x="82" y="26" width="14" height="9" rx="2" fill="#2a2a2a"/>
      <rect x="28" y="66" width="64" height="4" rx="2" fill="#bdb5a3"/>`;
  } else if (kind === 'disposable') {
    body = `<rect x="14" y="22" width="92" height="46" rx="5" fill="${color}"/><rect x="14" y="22" width="44" height="46" rx="5" fill="${accent}"/>
      <rect x="14" y="22" width="92" height="46" rx="5" fill="url(#sh)"/>${lens(78, 47, 10)}
      <rect x="22" y="30" width="24" height="10" rx="2" fill="#f2c230"/><rect x="92" y="28" width="9" height="7" rx="1" fill="#eee"/>
      <rect x="18" y="16" width="14" height="7" rx="2" fill="#1d1d1d"/>`;
  } else if (kind === 'rangefinder') {
    body = `<rect x="12" y="24" width="96" height="46" rx="6" fill="${color}"/><rect x="12" y="24" width="96" height="16" rx="6" fill="${accent}"/>
      <rect x="12" y="24" width="96" height="46" rx="6" fill="url(#sh)"/>${lens(60, 50, 13)}
      <rect x="20" y="28" width="14" height="8" rx="1" fill="#333"/><rect x="86" y="28" width="14" height="8" rx="1" fill="#333"/><rect x="24" y="17" width="12" height="7" rx="1" fill="#555"/>`;
  } else if (kind === 'digicam') {
    body = `<rect x="16" y="22" width="88" height="48" rx="9" fill="${color}"/><rect x="16" y="22" width="88" height="48" rx="9" fill="url(#sh)"/>
      ${lens(70, 46, 12)}<rect x="24" y="28" width="16" height="9" rx="2" fill="${accent}"/><circle cx="32" cy="56" r="3" fill="#e05a3a"/>
      <rect x="84" y="17" width="14" height="6" rx="2" fill="${accent}"/>`;
  } else { // compact 필름 똑딱이
    body = `<rect x="12" y="22" width="96" height="50" rx="8" fill="${color}"/><rect x="12" y="50" width="96" height="22" rx="8" fill="${accent}" opacity=".85"/>
      <rect x="12" y="22" width="96" height="50" rx="8" fill="url(#sh)"/>${lens(60, 50, 13)}
      <rect x="20" y="27" width="16" height="9" rx="2" fill="#2b2b2b"/><rect x="84" y="27" width="16" height="9" rx="2" fill="#5a5a5a"/>
      <rect x="76" y="16" width="16" height="7" rx="2" fill="#3a3a3a"/>`;
  }
  return `<svg viewBox="0 0 120 84" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>
    <radialGradient id="gl" cx=".4" cy=".4"><stop offset="0" stop-color="#5d7180"/><stop offset="1" stop-color="#0d1013"/></radialGradient>
    <linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
    </defs>${body}</svg>`.replace(/\n\s*/g, '');
}
