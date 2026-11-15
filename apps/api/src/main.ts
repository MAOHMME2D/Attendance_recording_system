import { loadEnvironment } from './common/utils/load-env';

// Load env before AppModule (and its datasource configuration) is evaluated.
loadEnvironment();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ValidationPipe } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import * as os from 'os';
import { getAllowedOrigins, isAllowedOrigin } from './common/utils/origins';

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  const list: { ip: string; name: string }[] = [];
  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();
    if (
      lowerName.includes('loopback') ||
      lowerName.includes('tailscale') ||
      lowerName.includes('virtual') ||
      lowerName.includes('vmware') ||
      lowerName.includes('vethernet')
    ) {
      continue;
    }
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (iface.address.startsWith('169.254.')) continue;
        list.push({ ip: iface.address, name });
      }
    }
  }

  list.sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    const isAPrio =
      aName.includes('wi-fi') ||
      aName.includes('wlan') ||
      aName.includes('wireless') ||
      aName === 'ethernet';
    const isBPrio =
      bName.includes('wi-fi') ||
      bName.includes('wlan') ||
      bName.includes('wireless') ||
      bName === 'ethernet';
    if (isAPrio && !isBPrio) return -1;
    if (!isAPrio && isBPrio) return 1;
    return 0;
  });

  return list[0]?.ip || '127.0.0.1';
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Restrict CORS to explicitly configured origins. No wildcards.
  app.enableCors({
    origin: getAllowedOrigins(),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Basic security headers (helmet-free, no extra runtime dependency).
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=()');
    next();
  });

  // Reject state-changing requests from unknown browser origins (CSRF defense).
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.headers.origin;
    if (!isAllowedOrigin(origin)) {
      res.status(403).json({ message: 'Origin غير مسموح به' });
      return;
    }
    next();
  });

  // Socket.IO adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // Global validation: strip unknown fields, reject non-whitelisted ones.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global prefix for API routes
  app.setGlobalPrefix('api');

  const port = Number(process.env.PORT || process.env.API_PORT || 3001);
  await app.listen(port, '0.0.0.0');

  const localIP = getLocalIP();
  console.log('\n========================================');
  console.log('  QR Attendance System - API Server');
  console.log('========================================');
  console.log(`  Local:   http://localhost:${port}`);
  console.log(`  Network: http://${localIP}:${port}`);
  console.log(`  CORS:    ${getAllowedOrigins().join(', ')}`);
  console.log('========================================\n');
}

bootstrap();
