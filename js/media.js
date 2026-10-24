// 브라우저마다 다른 부분: 녹화 형식 고르기, 휴대폰에 저장(공유 시트 → 안 되면 다운로드)

// 아이폰 사파리는 mp4만, 크롬은 webm(최근 버전은 mp4도). 앞에서부터 되는 것을 쓴다.
export const RECORD_TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

export function pickMime(isSupported) {
  return RECORD_TYPES.find(t => { try { return isSupported(t); } catch { return false; } }) || '';
}

export const extFor = mime => (mime.startsWith('video/mp4') ? 'mp4' : mime.startsWith('video/webm') ? 'webm' : mime === 'image/png' ? 'png' : 'jpg');

export function fileName(shot) {
  const d = new Date(shot.createdAt);
  const p = n => String(n).padStart(2, '0');
  return `dajeong-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${extFor(shot.blob.type)}`;
}

// 반드시 탭 직후에 부른다(사파리는 사용자 동작 없이 공유 시트를 열지 않음). 파일은 미리 만들어 둔 Blob을 쓴다.
// 결과: 'shared' | 'cancelled' | 'downloaded'
export async function saveToDevice(shot) {
  const file = new File([shot.blob], fileName(shot), { type: shot.blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
      // 그 밖의 실패(권한 등)는 다운로드로 넘어간다
    }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}
