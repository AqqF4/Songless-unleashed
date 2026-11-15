'use client';
import { Empty } from '@/components/ui';

export default function Error({ reset }: { reset: () => void }) {
  return (
    <Empty title="Что-то пошло не так" text="Не удалось загрузить страницу. Проверьте соединение и попробуйте ещё раз.">
      <button className="btn btn-neon" onClick={reset}>
        Повторить
      </button>
    </Empty>
  );
}
