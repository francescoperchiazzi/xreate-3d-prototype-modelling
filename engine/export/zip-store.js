export function crc32(data) {
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return t;
  })());
  const bytes = data instanceof Uint8Array
    ? data
    : (data instanceof ArrayBuffer)
      ? new Uint8Array(data)
      : (() => {
        const off = data.byteOffset ?? 0;
        const len = data.byteLength ?? (data.buffer.byteLength - off);
        return new Uint8Array(data.buffer, off, len);
      })();
  let crc = 0xFFFFFFFF;
  for (const b of bytes) crc = table[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function toDosDateTime(date) {
  const d = date instanceof Date ? date : new Date();
  let year = d.getFullYear();
  if (year < 1980) year = 1980;
  const month = (d.getMonth() + 1) & 0x0f;
  const day = d.getDate() & 0x1f;
  const hours = d.getHours() & 0x1f;
  const minutes = d.getMinutes() & 0x3f;
  const seconds = Math.floor(d.getSeconds() / 2) & 0x1f;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  return { dosDate, dosTime };
}

function u16(v) {
  const b = new Uint8Array(2);
  b[0] = v & 0xff;
  b[1] = (v >>> 8) & 0xff;
  return b;
}
function u32(v) {
  const b = new Uint8Array(4);
  b[0] = v & 0xff;
  b[1] = (v >>> 8) & 0xff;
  b[2] = (v >>> 16) & 0xff;
  b[3] = (v >>> 24) & 0xff;
  return b;
}
function concatParts(parts) {
  let total = 0;
  for (const p of parts) total += p.byteLength;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.byteLength;
  }
  return out;
}

export function buildZip(files) {
  const list = Array.isArray(files) ? files : [];
  const encoder = new TextEncoder();
  const toBytes = (data) => {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (data && data.buffer instanceof ArrayBuffer) {
      const off = data.byteOffset ?? 0;
      const len = data.byteLength ?? (data.buffer.byteLength - off);
      return new Uint8Array(data.buffer, off, len);
    }
    return new Uint8Array(0);
  };
  const normFiles = [];
  for (const f of list) {
    const name = String(f?.name ?? '');
    const bytes = toBytes(f?.data);
    normFiles.push({ name, bytes });
  }

  const { dosDate, dosTime } = toDosDateTime(new Date());
  const LOCAL_FIXED = 30;
  const CENTRAL_FIXED = 46;
  const GPBF_UTF8 = 0x0800;

  const parts = [];
  const cd = [];
  let offset = 0;

  for (const f of normFiles) {
    const nameBytes = encoder.encode(f.name);
    const crc = crc32(f.bytes);
    const compSize = f.bytes.byteLength >>> 0;
    const uncompSize = f.bytes.byteLength >>> 0;

    const lfHeaderNoExtraLen = LOCAL_FIXED + nameBytes.length;
    const dataStartUnaligned = offset + lfHeaderNoExtraLen;
    const pad = (64 - (dataStartUnaligned % 64)) % 64;
    const extraLen = pad;

    parts.push(u32(0x04034b50));
    parts.push(u16(20));
    parts.push(u16(GPBF_UTF8));
    parts.push(u16(0));
    parts.push(u16(dosTime));
    parts.push(u16(dosDate));
    parts.push(u32(crc));
    parts.push(u32(compSize));
    parts.push(u32(uncompSize));
    parts.push(u16(nameBytes.length));
    parts.push(u16(extraLen));
    parts.push(nameBytes);
    if (extraLen) parts.push(new Uint8Array(extraLen));

    const localHeaderOffset = offset;
    offset += LOCAL_FIXED + nameBytes.length + extraLen;

    parts.push(f.bytes);
    offset += f.bytes.byteLength;

    const cdEntry = [];
    cdEntry.push(u32(0x02014b50));
    cdEntry.push(u16(20));
    cdEntry.push(u16(20));
    cdEntry.push(u16(GPBF_UTF8));
    cdEntry.push(u16(0));
    cdEntry.push(u16(dosTime));
    cdEntry.push(u16(dosDate));
    cdEntry.push(u32(crc));
    cdEntry.push(u32(compSize));
    cdEntry.push(u32(uncompSize));
    cdEntry.push(u16(nameBytes.length));
    cdEntry.push(u16(0));
    cdEntry.push(u16(0));
    cdEntry.push(u16(0));
    cdEntry.push(u16(0));
    cdEntry.push(u32(0));
    cdEntry.push(u32(localHeaderOffset));
    cdEntry.push(nameBytes);
    cd.push(concatParts(cdEntry));
  }

  const centralDir = concatParts(cd);
  const cdSize = centralDir.byteLength;
  const cdOffset = offset;

  parts.push(centralDir);

  const eocd = [];
  eocd.push(u32(0x06054b50));
  eocd.push(u16(0));
  eocd.push(u16(0));
  eocd.push(u16(normFiles.length));
  eocd.push(u16(normFiles.length));
  eocd.push(u32(cdSize));
  eocd.push(u32(cdOffset));
  eocd.push(u16(0));
  parts.push(concatParts(eocd));

  return concatParts(parts).buffer;
}

