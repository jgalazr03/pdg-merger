import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';

export const runtime = 'nodejs';

/**
 * Borra un blob temporal. Lo usa la transcripción del servidor cuando una
 * subida adelantada (especulativa) se descarta porque el usuario cambió al
 * modo local: así no queda basura en Blob. Solo borra la URL indicada (blobs
 * con nombre aleatorio, públicos y efímeros), no lista ni expone nada.
 */
export async function POST(request: Request) {
  let url: string | undefined;
  try {
    ({ url } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }
  if (url) {
    await del(url).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
