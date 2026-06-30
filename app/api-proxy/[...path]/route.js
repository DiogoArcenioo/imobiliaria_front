import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TOKEN_COOKIE = 'auth_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

function backendBaseUrl() {
  return (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001/api').replace(/\/$/, '');
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  };
}

function buildUrl(path = [], search = '') {
  const suffix = path.map(encodeURIComponent).join('/');
  return `${backendBaseUrl()}/${suffix}${search || ''}`;
}

function copyRequestHeaders(request, token) {
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  const accept = request.headers.get('accept');
  const authorization = request.headers.get('authorization');
  const empresaId = request.headers.get('x-empresa-id');

  if (contentType) headers.set('content-type', contentType);
  if (accept) headers.set('accept', accept);
  if (empresaId) headers.set('x-empresa-id', empresaId);

  if (authorization) {
    headers.set('authorization', authorization);
  } else if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  return headers;
}

async function proxyRequest(request, context) {
  const params = await context.params;
  const path = params?.path || [];
  const route = path.join('/');

  if (route === 'auth/logout') {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(TOKEN_COOKIE, '', { ...cookieOptions(), maxAge: 0 });
    return response;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  const url = new URL(request.url);
  const method = request.method;
  const init = {
    method,
    headers: copyRequestHeaders(request, token),
    cache: 'no-store',
  };

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  const targetUrl = buildUrl(path, url.search);
  let upstream;
  try {
    upstream = await fetch(targetUrl, init);
  } catch (err) {
    return NextResponse.json(
      {
        message: `Não foi possível conectar ao backend em ${targetUrl}`,
        detail: err?.message || 'fetch failed',
      },
      { status: 502 },
    );
  }
  const contentType = upstream.headers.get('content-type') || '';
  const bodyBuffer = await upstream.arrayBuffer();

  const response = new NextResponse(bodyBuffer, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: {
      'content-type': contentType || 'application/octet-stream',
    },
  });

  if (upstream.ok && (route === 'auth/login' || route === 'auth/register') && contentType.includes('application/json')) {
    try {
      const payload = JSON.parse(Buffer.from(bodyBuffer).toString('utf8'));
      if (payload?.access_token) {
        response.cookies.set(TOKEN_COOKIE, payload.access_token, cookieOptions());
      }
    } catch {
      // Keep the successful upstream response even if token parsing fails.
    }
  }

  if (upstream.status === 401) {
    response.cookies.set(TOKEN_COOKIE, '', { ...cookieOptions(), maxAge: 0 });
  }

  return response;
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const OPTIONS = proxyRequest;
