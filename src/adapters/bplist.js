/**
 * Minimal Apple binary property list ("bplist00") parser — no dependencies.
 * Supports: null/bool, int, real, date, data, ASCII/UTF-16 strings, UID, array, set, dict.
 * Dates are returned as JS milliseconds since epoch; data as Buffer; UID as {uid}.
 */
const APPLE_EPOCH_MS = 978307200000; // 2001-01-01T00:00:00Z

function parseBplist(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 40 || buf.toString('ascii', 0, 8) !== 'bplist00') throw new Error('not a bplist00');
  const t = buf.length - 32;
  const offsetSize = buf.readUInt8(t + 6);
  const refSize = buf.readUInt8(t + 7);
  const numObjects = Number(buf.readBigUInt64BE(t + 8));
  const topObject = Number(buf.readBigUInt64BE(t + 16));
  const tableOffset = Number(buf.readBigUInt64BE(t + 24));
  if (numObjects > 1e6 || tableOffset >= buf.length) throw new Error('corrupt bplist');

  const readUInt = (pos, size) => {
    let v = 0;
    for (let i = 0; i < size; i++) v = v * 256 + buf[pos + i];
    return v;
  };
  const offsets = new Array(numObjects);
  for (let i = 0; i < numObjects; i++) offsets[i] = readUInt(tableOffset + i * offsetSize, offsetSize);

  const depthLimit = 64;
  function parse(ref, depth) {
    if (depth > depthLimit) throw new Error('bplist too deep');
    const pos = offsets[ref];
    const marker = buf[pos];
    const type = marker >> 4;
    const info = marker & 0x0f;

    const length = () => {
      if (info !== 0x0f) return { len: info, start: pos + 1 };
      const intMarker = buf[pos + 1];
      const n = 1 << (intMarker & 0x0f);
      return { len: readUInt(pos + 2, n), start: pos + 2 + n };
    };

    switch (type) {
      case 0x0:
        if (marker === 0x00) return null;
        if (marker === 0x08) return false;
        if (marker === 0x09) return true;
        return null;
      case 0x1: {
        const n = 1 << info;
        if (n === 8) return Number(buf.readBigInt64BE(pos + 1));
        return readUInt(pos + 1, n);
      }
      case 0x2: {
        const n = 1 << info;
        return n === 4 ? buf.readFloatBE(pos + 1) : buf.readDoubleBE(pos + 1);
      }
      case 0x3:
        return APPLE_EPOCH_MS + buf.readDoubleBE(pos + 1) * 1000;
      case 0x4: { const { len, start } = length(); return buf.subarray(start, start + len); }
      case 0x5: { const { len, start } = length(); return buf.toString('latin1', start, start + len); }
      case 0x6: {
        const { len, start } = length();
        const swapped = Buffer.from(buf.subarray(start, start + len * 2));
        swapped.swap16();
        return swapped.toString('utf16le');
      }
      case 0x8: return { uid: readUInt(pos + 1, info + 1) };
      case 0xA: case 0xC: {
        const { len, start } = length();
        const out = [];
        for (let i = 0; i < len; i++) out.push(parse(readUInt(start + i * refSize, refSize), depth + 1));
        return out;
      }
      case 0xD: {
        const { len, start } = length();
        const out = {};
        for (let i = 0; i < len; i++) {
          const k = parse(readUInt(start + i * refSize, refSize), depth + 1);
          const v = parse(readUInt(start + (len + i) * refSize, refSize), depth + 1);
          out[String(k)] = v;
        }
        return out;
      }
      default:
        return null;
    }
  }
  return parse(topObject, 0);
}

module.exports = { parseBplist, APPLE_EPOCH_MS };
