'use client';

import { uploadImage as uploadAction } from '@/app/actions/quizzes';

const MAX_SIDE = 1600;

async function compress(file) {
  if (file.type === 'image/gif' || file.size < 250 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', 0.85));
    return blob && blob.size < file.size ? new File([blob], 'imagine.webp', { type: 'image/webp' }) : file;
  } catch {
    return file;
  }
}

export async function uploadImage(file, quizId) {
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) throw new Error('Sunt acceptate imagini PNG, JPG, WEBP sau GIF.');
  const ready = await compress(file);
  if (ready.size > 3.5 * 1024 * 1024) throw new Error('Imaginea este prea mare (maximum 3,5 MB).');
  const fd = new FormData();
  fd.append('file', ready);
  fd.append('quizId', quizId);
  const r = await uploadAction(fd);
  if (!r.ok) throw new Error(r.error);
  return r.path;
}
