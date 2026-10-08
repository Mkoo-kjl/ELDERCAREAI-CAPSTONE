export type Keyset = {
  key?: { keyId?: number; status?: string; keyData?: { value?: string } }[];
};

function base64Bytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function readVarint(bytes: Uint8Array, position: number) {
  let value = 0;
  let offset = position;
  let shift = 0;
  while (offset < bytes.length && shift <= 28) {
    const byte = bytes[offset++];
    value += (byte & 0x7f) * 2 ** shift;
    if (!(byte & 0x80)) return { value, offset };
    shift += 7;
  }
  throw new Error('Invalid Google Health public key.');
}

function publicCoordinates(bytes: Uint8Array) {
  let offset = 0;
  let x: Uint8Array | undefined;
  let y: Uint8Array | undefined;
  while (offset < bytes.length) {
    const tag = readVarint(bytes, offset);
    offset = tag.offset;
    const field = tag.value >> 3;
    const wireType = tag.value & 7;
    if (wireType === 0) {
      offset = readVarint(bytes, offset).offset;
    } else if (wireType === 2) {
      const length = readVarint(bytes, offset);
      offset = length.offset;
      if (offset + length.value > bytes.length) throw new Error('Invalid Google Health public key.');
      if (field === 3) x = bytes.slice(offset, offset + length.value);
      if (field === 4) y = bytes.slice(offset, offset + length.value);
      offset += length.value;
    } else {
      throw new Error('Invalid Google Health public key.');
    }
  }
  if (!x || !y || x.length !== 32 || y.length !== 32) throw new Error('Invalid Google Health public key.');
  return { x, y };
}

function derSignatureToRaw(der: Uint8Array) {
  if (der[0] !== 0x30 || der[1] !== der.length - 2 || der[2] !== 0x02) throw new Error('Invalid Google Health signature.');
  const rLength = der[3];
  const sTag = 4 + rLength;
  if (der[sTag] !== 0x02) throw new Error('Invalid Google Health signature.');
  const sLength = der[sTag + 1];
  if (sTag + 2 + sLength !== der.length) throw new Error('Invalid Google Health signature.');
  const raw = new Uint8Array(64);
  for (const [source, length, destination] of [[4, rLength, 0], [sTag + 2, sLength, 32]]) {
    const integer = der.slice(source, source + length);
    const stripped = integer[0] === 0 ? integer.slice(1) : integer;
    if (!stripped.length || stripped.length > 32) throw new Error('Invalid Google Health signature.');
    raw.set(stripped, destination + 32 - stripped.length);
  }
  return raw;
}

export async function verifyHealthSignature(rawBody: string, encodedSignature: string | null, keyset: Keyset, subtle: SubtleCrypto = crypto.subtle) {
  if (!encodedSignature) return false;
  try {
    const signature = base64Bytes(encodedSignature);
    if (signature.length < 13 || signature[0] !== 1) return false;
    const keyId = new DataView(signature.buffer, signature.byteOffset + 1, 4).getUint32(0);
    const matchingKey = keyset.key?.find((key) => key.keyId === keyId && key.status === 'ENABLED');
    if (!matchingKey?.keyData?.value) return false;
    const { x, y } = publicCoordinates(base64Bytes(matchingKey.keyData.value));
    const publicKey = await subtle.importKey('jwk', {
      kty: 'EC', crv: 'P-256', x: btoa(String.fromCharCode(...x)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
      y: btoa(String.fromCharCode(...y)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), ext: true,
    }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, derSignatureToRaw(signature.slice(5)), new TextEncoder().encode(rawBody));
  } catch {
    return false;
  }
}
