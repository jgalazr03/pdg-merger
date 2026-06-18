import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { rejectCrossOrigin } from '@/lib/api-guard';

export const runtime = 'nodejs';

/**
 * Autoriza subidas de cliente a Vercel Blob (el navegador sube el audio
 * DIRECTO a Blob, sin pasar por esta función, así que no aplica el límite de
 * ~4.5 MB de las funciones serverless: admite audios de cualquier tamaño).
 * El audio queda en un blob temporal que /api/transcribe borra al terminar.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  // Exigir origen propio solo en la generación de token (la pide el navegador).
  // El webhook 'blob.upload-completed' lo llama Vercel (sin nuestro Origin) y va
  // firmado: bloquearlo por origen lo rompería.
  if (body.type === 'blob.generate-client-token') {
    const blocked = rejectCrossOrigin(request);
    if (blocked) return blocked;
  }
  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          'audio/mpeg',
          'audio/mp3',
          'audio/wav',
          'audio/x-wav',
          'audio/mp4',
          'audio/x-m4a',
          'audio/aac',
          'audio/ogg',
          'audio/webm',
          'audio/flac',
          'video/mp4',
          'video/webm',
          'video/quicktime',
          'application/octet-stream',
        ],
        addRandomSuffix: true,
      }),
      // El borrado del blob lo hace /api/transcribe tras la transcripción.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
