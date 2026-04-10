import { NextRequest, NextResponse, userAgent } from 'next/server';

import { DEVICE_TYPE } from './types/device';

export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const { device } = userAgent(request);
  const viewport = device.type === DEVICE_TYPE.mobile ? DEVICE_TYPE.mobile : DEVICE_TYPE.desktop;
  url.searchParams.set('viewport', viewport);
  return NextResponse.rewrite(url);
}

export const config = { matcher: ['/dashboard/:path*'] };
