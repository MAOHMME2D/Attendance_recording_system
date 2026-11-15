import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE = 'attendance_session';

/**
 * Coarse edge guard: pages require the presence of a session cookie.
 *
 * This is NOT the authorization boundary. The API validates the opaque session
 * token, the staff account status, the role and the permissions on every
 * request; the UI guard only avoids rendering protected pages to anonymous
 * visitors.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === '/login' || pathname === '/attend') {
    return NextResponse.next();
  }

  // Socket.IO handshakes are authenticated by the gateway itself (cookie or
  // bearer token). Proxying them must not be turned into an HTML redirect.
  if (pathname.startsWith('/socket.io')) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  if (pathname !== '/') {
    loginUrl.searchParams.set('next', `${pathname}${search}`);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Protect application pages, but never intercept static assets, the API
     * rewrite, images, fonts, or the disabled student attendance page.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|fonts|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf)$).*)',
  ],
};
