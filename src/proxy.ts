import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  // Check environment variable
  const isMaintenanceMode = process.env.MAINTENANCE_MODE === 'true';

  // If in maintenance mode and NOT already on the maintenance page
  if (isMaintenanceMode && request.nextUrl.pathname !== '/maintenance') {
    // Redirect all paths to the maintenance page
    return NextResponse.redirect(new URL('/maintenance', request.url));
  }

  // If NOT in maintenance mode but trying to access the maintenance page directly
  // redirect them back to home
  if (!isMaintenanceMode && request.nextUrl.pathname === '/maintenance') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Apply middleware to all routes except API routes, Next.js static files, and public assets
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg).*)'],
}
