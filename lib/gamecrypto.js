'use client';

const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' };
const ECDH = { name: 'ECDH', namedCurve: 'P-256' };
const SIGN = { name: 'ECDSA', hash: 'SHA-256' };
const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(buf) {
  let s = '';
  new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s);
}

function unb64(s) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

const pubOnly = ({ kty, crv, x, y }) => ({ kty, crv, x, y });

export function validJwk(j) {
  return !!j && j.kty === 'EC' && j.crv === 'P-256' && typeof j.x === 'string' && typeof j.y === 'string' && j.x.length <= 64 && j.y.length <= 64;
}

export function sameJwk(a, b) {
  return validJwk(a) && validJwk(b) && a.x === b.x && a.y === b.y;
}

export async function createHostKeys() {
  const sign = await crypto.subtle.generateKey(ECDSA, false, ['sign', 'verify']);
  const dh = await crypto.subtle.generateKey(ECDH, false, ['deriveKey']);
  const signPub = pubOnly(await crypto.subtle.exportKey('jwk', sign.publicKey));
  const dhPub = pubOnly(await crypto.subtle.exportKey('jwk', dh.publicKey));
  return { signKey: sign.privateKey, dhKey: dh.privateKey, publicKeys: { sign: signPub, dh: dhPub } };
}

export async function signMessage(privateKey, obj) {
  const d = JSON.stringify(obj);
  const s = await crypto.subtle.sign(SIGN, privateKey, enc.encode(d));
  return { d, s: b64(s) };
}

export async function importVerifyKey(jwk) {
  if (!validJwk(jwk)) throw new Error('invalid key');
  return crypto.subtle.importKey('jwk', { ...pubOnly(jwk), ext: true }, ECDSA, false, ['verify']);
}

export async function openSigned(verifyKey, msg) {
  if (!verifyKey || !msg || typeof msg.d !== 'string' || typeof msg.s !== 'string' || msg.d.length > 300000 || msg.s.length > 200) return null;
  try {
    const ok = await crypto.subtle.verify(SIGN, verifyKey, unb64(msg.s), enc.encode(msg.d));
    return ok ? JSON.parse(msg.d) : null;
  } catch {
    return null;
  }
}

export async function loadPlayerKeys(saved) {
  if (saved && saved.priv && validJwk(saved.pub)) {
    try {
      const privateKey = await crypto.subtle.importKey('jwk', saved.priv, ECDH, true, ['deriveKey']);
      return { privateKey, pub: saved.pub, priv: saved.priv };
    } catch {}
  }
  const pair = await crypto.subtle.generateKey(ECDH, true, ['deriveKey']);
  const priv = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const pub = pubOnly(await crypto.subtle.exportKey('jwk', pair.publicKey));
  return { privateKey: pair.privateKey, pub, priv };
}

export async function sharedKey(privateKey, peerJwk) {
  if (!validJwk(peerJwk)) throw new Error('invalid key');
  const peer = await crypto.subtle.importKey('jwk', { ...pubOnly(peerJwk), ext: true }, ECDH, false, []);
  return crypto.subtle.deriveKey({ name: 'ECDH', public: peer }, privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function seal(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return { iv: b64(iv), ct: b64(ct) };
}

export async function unseal(key, box) {
  if (!key || !box || typeof box.iv !== 'string' || typeof box.ct !== 'string' || box.ct.length > 4000) return null;
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct));
    return JSON.parse(dec.decode(pt));
  } catch {
    return null;
  }
}
