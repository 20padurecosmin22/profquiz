export function mediaUrl(value) {
  if (!value) return null;
  if (/^https:\/\//i.test(value)) return value;
  return `/media/${value.split('/').map(encodeURIComponent).join('/')}`;
}
