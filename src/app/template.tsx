// template перемонтируется при каждом переходе — отсюда плавное появление страниц
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-rise">{children}</div>;
}
