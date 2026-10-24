// 앱 안 앨범: IndexedDB 'shots' 저장소. 항목 = { id, type: 'photo'|'video', blob, thumb, w, h, filter, createdAt }
const DB = 'dajeong-film', STORE = 'shots';
let dbp;

function db() {
  dbp ??= new Promise((ok, fail) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  });
  return dbp;
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((ok, fail) => {
    const t = d.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => ok(req?.result);
    t.onerror = () => fail(t.error);
    t.onabort = () => fail(t.error || new Error('저장 공간이 부족할 수 있습니다'));
  });
}

export const addShot = shot => tx('readwrite', s => s.add({ ...shot, createdAt: shot.createdAt ?? Date.now() }));
export const getShot = id => tx('readonly', s => s.get(id));
export const deleteShot = id => tx('readwrite', s => s.delete(id));
// 최신순
export const listShots = async () => (await tx('readonly', s => s.getAll())).sort((a, b) => b.createdAt - a.createdAt);
export const countShots = () => tx('readonly', s => s.count());
