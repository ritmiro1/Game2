export async function invoke<T = any>(action: string, args: unknown = {}): Promise<T> {
  if (window.lifeos) return window.lifeos.invoke<T>(action, args);
  const response = await fetch('/api/rpc', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, args }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error || `Ошибка ${response.status}`);
  return payload.data as T;
}
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const formatDate = (
  date: string,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
) => {
  try {
    return new Intl.DateTimeFormat('ru-RU', opts).format(
      new Date(date.length === 10 ? date + 'T12:00:00' : date),
    );
  } catch {
    return 'Дата неизвестна';
  }
};
export function readableError(error: unknown) {
  return error instanceof Error ? error.message : 'Не удалось выполнить действие';
}
export function downloadJson(data: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
