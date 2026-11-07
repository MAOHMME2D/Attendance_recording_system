import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../lib/auth';

export const metadata: Metadata = {
  title: 'كلية البوليتكنك | قسم تقنيات المختبرات الطبية',
  description: 'نظام تسجيل الحضور الذكي - كلية البوليتكنك | قسم تقنيات المختبرات الطبية - تطوير: Mohammed Redha',
  icons: {
    icon: [{ url: '/favicon.ico', sizes: '64x64' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        {/* Cairo is served from public/fonts - no internet connection required */}
        <link
          rel="preload"
          href="/fonts/cairo-arabic.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/cairo-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AuthProvider>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {children}
          </div>
          <footer
            className="no-print"
            style={{
              marginTop: 'auto',
              padding: '18px 16px',
              textAlign: 'center',
              borderTop: '1px solid #E5E7EB',
              background: '#FFFFFF',
              color: '#6B7280',
              fontSize: '12px',
            }}
          >
            <div>
              نظام تسجيل الحضور الذكي • كلية البوليتكنك | قسم تقنيات المختبرات الطبية
            </div>
            <div style={{ marginTop: '5px', fontSize: '12px', color: '#374151' }}>
              تطوير وبرمجة: <strong style={{ color: '#111827', fontWeight: '800' }}>Mohammed Redha (محمد رضا)</strong> • جميع الحقوق محفوظة © 2026
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
