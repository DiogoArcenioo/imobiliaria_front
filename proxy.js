import { NextResponse } from 'next/server';

const PROTECTED_PREFIX = '/app';

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;
  const isProtected = pathname.startsWith(PROTECTED_PREFIX);

  if (!token && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.set('login', '1');
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = token ? '/app' : '/';
    if (!token) url.searchParams.set('login', '1');
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api-proxy).*)',
  ],
};
