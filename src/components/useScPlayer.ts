'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { load, save } from '@/lib/local';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    SC?: any;
  }
}

let apiPromise: Promise<void> | null = null;
export const loadScApi = () =>
  (apiPromise ??= new Promise<void>((resolve, reject) => {
    if (window.SC?.Widget) return resolve();
    const s = document.createElement('script');
    s.src = 'https://w.soundcloud.com/player/api.js';
    s.onload = () => resolve();
    s.onerror = () => {
      apiPromise = null;
      reject();
    };
    document.head.append(s);
  }));

export type PlayerState = 'loading' | 'ready' | 'playing' | 'error';

// Беззвучный WAV на 10 с (Chromium не включает в медиасессию звуки короче 5 с).
function silentWav(sec = 10, rate = 8000) {
  const n = sec * rate;
  const v = new DataView(new ArrayBuffer(44 + n));
  const s = (o: number, str: string) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  s(0, 'RIFF'); v.setUint32(4, 36 + n, true); s(8, 'WAVE'); s(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  s(36, 'data'); v.setUint32(40, n, true);
  new Uint8Array(v.buffer, 44).fill(128); // 128 — тишина для 8-битного PCM
  return URL.createObjectURL(new Blob([v.buffer], { type: 'audio/wav' }));
}

// Официальный виджет SoundCloud + Widget API. limitSec — сколько секунд от начала трека можно слушать.
// masked — пока ответ не раскрыт, системная панель медиа (Windows и др.) не должна видеть название и обложку.
export function useScPlayer(soundcloudId: string | null, limitSec: number, masked = false) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const widget = useRef<any>(null);
  const limit = useRef(limitSec);
  limit.current = limitSec;
  const silent = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [state, setState] = useState<PlayerState>('loading');
  const [pos, setPos] = useState(0);
  const [reloads, setReloads] = useState(0);
  const [volume, setVol] = useState(80);

  const pause = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    widget.current?.pause();
  }, []);

  useEffect(() => {
    if (!soundcloudId) return;
    let dead = false;
    setState('loading');
    setPos(0);
    const vol = load('gt:volume', 80);
    setVol(vol);
    const giveUp = setTimeout(() => !dead && setState((s) => (s === 'loading' ? 'error' : s)), 15000);
    loadScApi()
      .then(() => {
        if (dead || !iframe.current) return;
        const E = window.SC.Widget.Events;
        const w = window.SC.Widget(iframe.current);
        w.bind(E.READY, () => {
          if (dead) return;
          clearTimeout(giveUp);
          widget.current = w;
          w.setVolume(vol);
          setState('ready');
        });
        w.bind(E.PLAY, () => !dead && setState('playing'));
        w.bind(E.PLAY_PROGRESS, (e: { currentPosition: number }) => {
          if (dead) return;
          setPos(e.currentPosition);
          const left = limit.current * 1000 - e.currentPosition;
          if (left <= 0) pause();
          // события прогресса редкие; последние миллисекунды отмеряем своим таймером
          else if (left < 500 && !timer.current) timer.current = setTimeout(pause, left);
        });
        const stopped = () => {
          if (dead) return;
          clearTimeout(timer.current);
          timer.current = undefined;
          setState('ready');
        };
        w.bind(E.PAUSE, stopped);
        w.bind(E.FINISH, stopped);
        w.bind(E.ERROR, () => !dead && setState('error'));
      })
      .catch(() => !dead && setState('error'));
    return () => {
      dead = true;
      clearTimeout(giveUp);
      clearTimeout(timer.current);
      timer.current = undefined;
      widget.current = null;
    };
  }, [soundcloudId, reloads, pause]);

  // Медиасессия достаётся верхнему кадру, если в нём тоже играет звук (Chromium выбирает самый верхний).
  // Поэтому на время раунда страница крутит тишину со своими нейтральными метаданными.
  const maskedRef = useRef(masked);
  maskedRef.current = masked;
  const mask = () => {
    if (!maskedRef.current) return;
    const a = (silent.current ??= Object.assign(new Audio(silentWav()), { loop: true }));
    a.play().catch(() => {});
    if ('mediaSession' in navigator)
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Угадай трек',
        artist: 'Glowtune',
        artwork: [{ src: '/api/icon?size=512&brand=1', sizes: '512x512', type: 'image/png' }],
      });
  };
  useEffect(() => {
    if (masked) return;
    silent.current?.pause();
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
  }, [masked]);
  useEffect(() => () => void silent.current?.pause(), []);

  // Перемотка внутри открытого фрагмента; дальше лимита не пускает обработчик PLAY_PROGRESS.
  const seek = useCallback((ms: number) => {
    const w = widget.current;
    if (!w) return;
    mask();
    clearTimeout(timer.current);
    timer.current = undefined;
    setPos(ms);
    w.seekTo(ms);
    w.play();
  }, []);
  // Прослушивание всегда с начала трека.
  const play = useCallback(() => seek(0), [seek]);

  // Кнопки медиа на клавиатуре и в системной панели управляют игрой.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !masked) return;
    navigator.mediaSession.setActionHandler('play', play);
    navigator.mediaSession.setActionHandler('pause', pause);
    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
    };
  }, [masked, play, pause]);

  const setVolume = useCallback((v: number) => {
    setVol(v);
    save('gt:volume', v);
    widget.current?.setVolume(v);
  }, []);

  const src = soundcloudId
    ? `https://w.soundcloud.com/player/?url=${encodeURIComponent(`https://api.soundcloud.com/tracks/${soundcloudId}`)}&auto_play=false&hide_related=true&show_comments=false&show_reposts=false&show_teaser=false&visual=false&color=%2339ff88`
    : undefined;

  return { iframe, src, frameKey: `${soundcloudId}:${reloads}`, state, pos, volume, play, seek, pause, setVolume, retry: () => setReloads((n) => n + 1) };
}
