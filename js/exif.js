// JPEG의 EXIF에서 찍은 날짜(DateTimeOriginal, 없으면 DateTime)만 읽는다. 없으면 null.
export function exifDate(buf) {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null;
  let o = 2;
  while (o + 4 <= v.byteLength) {
    const marker = v.getUint16(o), size = v.getUint16(o + 2);
    if ((marker & 0xff00) !== 0xff00) return null;
    if (marker === 0xffe1 && v.getUint32(o + 4) === 0x45786966) return readTiff(v, o + 10); // 'Exif'
    if (marker === 0xffda) return null; // 그림 데이터 시작: 더 없음
    o += 2 + size;
  }
  return null;
}

function readTiff(v, t) {
  if (t + 8 > v.byteLength) return null;
  const le = v.getUint16(t) === 0x4949;
  const u16 = p => v.getUint16(p, le), u32 = p => v.getUint32(p, le);
  const tags = ifd => {
    const out = {}, start = t + ifd;
    if (start + 2 > v.byteLength) return out;
    const n = u16(start);
    for (let i = 0; i < n; i++) {
      const e = start + 2 + i * 12;
      if (e + 12 > v.byteLength) break;
      out[u16(e)] = { type: u16(e + 2), count: u32(e + 4), value: e + 8 };
    }
    return out;
  };
  const ascii = tag => {
    if (!tag || tag.type !== 2) return null;
    const p = t + u32(tag.value);
    let s = '';
    for (let i = 0; i < tag.count - 1 && p + i < v.byteLength; i++) s += String.fromCharCode(v.getUint8(p + i));
    return s;
  };
  const ifd0 = tags(u32(t + 4));
  const sub = ifd0[0x8769] ? tags(u32(ifd0[0x8769].value)) : {};
  const s = ascii(sub[0x9003]) || ascii(ifd0[0x0132]);
  const m = s && /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return isNaN(d) || +m[1] < 1900 ? null : d;
}
