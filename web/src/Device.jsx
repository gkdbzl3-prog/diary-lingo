import React, { useEffect, useRef, useState } from 'react';
import { getMe, switchDevice } from './api.js';

/**
 * 기기 코드. 비밀번호 없이 "이 기기 것"과 "남의 것"을 가른다.
 *
 * 처음 들어오면 서버가 코드를 만들어 쿠키에 심고, 일기는 전부 그 코드 밑에 저장된다.
 * 남이 들어오면 다른 코드를 받아 빈 화면에서 시작하므로 서로의 일기가 보이지 않는다.
 *
 * 기본은 접혀 있다. 평소에 볼 일이 없고, 쿠키를 잃었을 때와 다른 기기에서 이어서 쓸 때만 쓴다.
 */
export default function Device() {
  const [me, setMe] = useState(null);
  const [wanted, setWanted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    getMe().then(setMe).catch(() => {});
    return () => clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(me.device);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('복사가 안 된다. 코드를 직접 긁어서 쓰면 된다.');
    }
  };

  const go = async (e) => {
    e.preventDefault();
    const code = wanted.trim().toLowerCase();
    if (code === '' || busy) return;
    setBusy(true);
    setError('');
    try {
      await switchDevice(code);
      // 일기 목록부터 전부 달라지므로 그냥 다시 읽는다.
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (!me) return null;

  return (
    <details className="device">
      <summary>이 기기 코드</summary>
      <p className="device-help">
        일기는 이 코드 밑에 저장됩니다. 다른 기기에서 같은 일기를 보려면 그 기기에 이 코드를 넣으세요.
        코드를 잃으면 그 일기는 찾을 수 없습니다.
      </p>
      <div className="device-row">
        <code className="device-code">{me.device}</code>
        <button type="button" className="tab" onClick={copy}>
          {copied ? '복사됨' : '복사'}
        </button>
      </div>

      <form className="device-row" onSubmit={go}>
        <input
          value={wanted}
          onChange={(e) => setWanted(e.target.value)}
          placeholder="다른 기기 코드"
          spellCheck={false}
          autoComplete="off"
        />
        <button type="submit" className="tab" disabled={busy || wanted.trim() === ''}>
          {busy ? '…' : '들어가기'}
        </button>
      </form>

      {error ? <p className="device-error">{error}</p> : null}
    </details>
  );
}
