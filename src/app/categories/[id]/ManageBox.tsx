'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { load } from '@/lib/local';

// Виден только в браузере создателя: токен управления лежит в localStorage.
export default function ManageBox({ id, justCreated }: { id: string; justCreated: boolean }) {
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => setToken(load<Record<string, string>>('gt:tokens', {})[id] ?? ''), [id]);
  if (!token) return null;
  const copy = async () => {
    await navigator.clipboard.writeText(`${location.origin}/manage/${id}#${token}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="glass flex flex-col gap-3 !rounded-2xl p-4 text-sm sm:flex-row sm:items-center">
      <p className="muted flex-1">
        {justCreated
          ? 'Сохраните приватную ссылку управления: без неё изменить плейлист с другого устройства не получится.'
          : 'Это ваш плейлист — вы можете им управлять с этого устройства.'}
      </p>
      <button className="btn !min-h-10" onClick={copy}>
        {copied ? 'Скопировано ✓' : 'Скопировать ссылку управления'}
      </button>
      <Link href={`/manage/${id}`} className="btn !min-h-10">
        Управлять
      </Link>
    </div>
  );
}
