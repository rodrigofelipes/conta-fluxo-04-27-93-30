import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const allowedBuckets = (Deno.env.get('MEDIA_PROXY_ALLOWED_BUCKETS') ?? 'chat-files')
  .split(',')
  .map((bucket) => bucket.trim())
  .filter(Boolean);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

function createSupabaseClient(authHeader: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
}

serve(async (req) => {
  console.log(`${req.method} ${req.url}`);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabase = createSupabaseClient(authHeader);

    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      console.error('❌ Failed to validate user session:', authError);
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders,
      });
    }

    const url = new URL(req.url);
    const filePath = url.searchParams.get('path');
    const bucket = url.searchParams.get('bucket') || 'chat-files';

    if (!filePath) {
      return new Response('Missing file path parameter', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    if (!allowedBuckets.includes(bucket)) {
      console.warn(`🚫 Attempt to access disallowed bucket: ${bucket}`);
      return new Response('Forbidden', {
        status: 403,
        headers: corsHeaders,
      });
    }

    console.log(`📥 Serving media file for user ${authData.user.id}: ${bucket}/${filePath}`);

    // Get file from Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (error) {
      console.error('❌ Error downloading file:', error);
      return new Response('File not found', { 
        status: 404,
        headers: corsHeaders 
      });
    }

    if (!data) {
      return new Response('File data not available', { 
        status: 404,
        headers: corsHeaders 
      });
    }

    // Determine content type based on file extension
    const extension = filePath.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';

    switch (extension) {
      case 'jpg':
      case 'jpeg':
        contentType = 'image/jpeg';
        break;
      case 'png':
        contentType = 'image/png';
        break;
      case 'gif':
        contentType = 'image/gif';
        break;
      case 'webp':
        contentType = 'image/webp';
        break;
      case 'mp4':
        contentType = 'video/mp4';
        break;
      case 'webm':
        contentType = 'video/webm';
        break;
      case 'mov':
        contentType = 'video/quicktime';
        break;
      case 'mp3':
        contentType = 'audio/mpeg';
        break;
      case 'wav':
        contentType = 'audio/wav';
        break;
      case 'ogg':
        contentType = 'audio/ogg';
        break;
      case 'oga':
        contentType = 'audio/ogg';
        break;
      case 'opus':
        contentType = 'audio/ogg';
        break;
      case 'm4a':
        contentType = 'audio/mp4';
        break;
      case 'aac':
        contentType = 'audio/aac';
        break;
      case 'pdf':
        contentType = 'application/pdf';
        break;
      case 'doc':
        contentType = 'application/msword';
        break;
      case 'docx':
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      case 'txt':
        contentType = 'text/plain';
        break;
    }

    const fileBlob = data as Blob;
    const arrayBuffer = await fileBlob.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);
    const fileSize = fileBuffer.byteLength;

    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      const matches = /bytes=(\d+)-(\d+)?/i.exec(rangeHeader);
      if (matches) {
        const start = Number(matches[1]);
        let end = matches[2] ? Number(matches[2]) : fileSize - 1;

        if (Number.isNaN(start) || start < 0 || start >= fileSize) {
          return new Response('Requested Range Not Satisfiable', {
            status: 416,
            headers: {
              ...corsHeaders,
              'Content-Range': `bytes */${fileSize}`,
            },
          });
        }

        end = Number.isNaN(end) ? fileSize - 1 : Math.min(end, fileSize - 1);

        if (start > end) {
          return new Response('Requested Range Not Satisfiable', {
            status: 416,
            headers: {
              ...corsHeaders,
              'Content-Range': `bytes */${fileSize}`,
            },
          });
        }

        const chunk = fileBuffer.slice(start, end + 1);
        return new Response(chunk, {
          status: 206,
          headers: {
            ...corsHeaders,
            'Content-Type': contentType,
            'Content-Length': String(chunk.byteLength),
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600',
            'Content-Disposition': `inline; filename="${filePath.split('/').pop() ?? 'file'}"`,
          },
        });
      }
    }

    // Return file with appropriate headers
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'Content-Disposition': `inline; filename="${filePath.split('/').pop() ?? 'file'}"`,
      },
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response('Internal server error', { 
      status: 500,
      headers: corsHeaders 
    });
  }
});