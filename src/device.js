// 기기 코드. 비밀번호 없이 "이 기기 것"과 "남의 것"을 가른다.
//
// 처음 들어오면 서버가 임의의 32자리 코드를 만들어 쿠키에 심는다(10년).
// 일기는 전부 그 코드 밑에 저장되므로, 남이 들어오면 다른 코드를 받아 빈 화면에서 시작한다.
//
// 쿠키는 HttpOnly다. 화면에서 코드를 보여 줄 때는 `GET /api/me`로 받아 간다.
// 자바스크립트가 못 읽게 해 두면 남의 스크립트가 끼어들어 코드를 긁어 가기 어렵다.
//
// **코드를 아는 사람은 그 일기를 본다.** 폰과 노트북에서 같은 일기를 보려면
// 코드를 옮겨야 하는데(`PUT /api/me`), 그 말은 코드가 곧 열쇠라는 뜻이다.
// 그래서 128비트 난수로 만든다 — 찍어서 맞힐 수 없다.

import crypto from 'node:crypto';

const COOKIE = 'dl_device';
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

/** 코드 모양 검사. 저장소 id 규칙(경로로 쓸 수 있는 글자)과 결을 맞춘다. */
export function isValidDevice(code) {
  return typeof code === 'string' && /^[a-f0-9]{32}$/.test(code);
}

export function newDevice() {
  return crypto.randomBytes(16).toString('hex');
}

function readCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

/** fly는 https로 받아 내부로 http로 넘긴다. 원래 무엇이었는지는 헤더에 있다. */
function isHttps(req) {
  return req.headers['x-forwarded-proto'] === 'https' || req.protocol === 'https';
}

export function setDeviceCookie(req, res, code) {
  const bits = [
    `${COOKIE}=${code}`,
    'Path=/',
    `Max-Age=${TEN_YEARS}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isHttps(req)) bits.push('Secure');
  res.setHeader('Set-Cookie', bits.join('; '));
}

/**
 * 요청마다 기기 코드를 붙인다. 없으면 만들어 쿠키를 심는다.
 * 로컬에서 특정 기기인 척하려면 DIARY_LINGO_DEVICE로 못 박는다(개발·테스트용).
 */
export function device(req, res, next) {
  const forced = process.env.DIARY_LINGO_DEVICE;
  if (forced && isValidDevice(forced)) {
    req.device = forced;
    next();
    return;
  }

  const fromCookie = readCookie(req, COOKIE);
  if (isValidDevice(fromCookie)) {
    req.device = fromCookie;
    next();
    return;
  }

  const fresh = newDevice();
  req.device = fresh;
  setDeviceCookie(req, res, fresh);
  next();
}
