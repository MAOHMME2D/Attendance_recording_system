# التقنيات وحزم التبعيات (Technologies & Dependencies)
## Attendance Recording System

---

### 1. المكدس التقني للنظام (Full Technical Stack)

تم اختيار تقنيات المشروع بعناية لتوفير نظام مؤسسي قوي، سريع، ومتوافق مع المعايير الحديثة في هندسة الويب:

| الطبقة (Layer) | التقنية الأساسية | الإصدار (Version) | الغرض والدور في النظام |
|---|---|---|---|
| **لغة البرمجة (Language)** | TypeScript | `^5.6.3` | كتابة النظام بالكامل بنمط كتابة صارم (Type-safe) يمنع أخطاء وقت التشغيل |
| **إطار الخادم (Backend)** | NestJS | `^10.4.15` | إطار عمل معياري ومنظم بنمط الـ Dependency Injection والموديلات |
| **محرك الويب (Server Platform)** | Express.js | `^5.0.0` / `@nestjs/platform-express` | توفير خادم HTTP السريع لمعالجة الطلبات وتمرير الترويسات والـ Cookies |
| **قناة الاتصال الحي (Real-time)** | Socket.IO | `^4.8.1` | بث تحديثات مسح الحضور وتدوير رموز QR لحظياً لقاعة المحاضرة |
| **طبقة البيانات (ORM)** | Prisma Client & CLI | `^6.1.0` | نمذجة الجداول، توليد استعلامات SQL مؤمنة، وإدارة الترحيلات (Migrations) |
| **محرك قاعدة البيانات** | PostgreSQL | `16.x` | تخزين البيانات الأكاديمية مع دعم القيود الصارمة والأقفال الاستشارية `pg_advisory_xact_lock` |
| **إطار الواجهة (Frontend)** | Next.js (App Router) | `14.2.20` | بناء صفحات تفاعلية بنمط Server & Client Components مع تحسين الأداء |
| **مكتبة واجهة المستخدم** | React | `^18.3.1` | بناء المكونات التفاعلية وإدارة حالة التطبيق |
| **نظام التنسيق (Styling)** | Tailwind CSS | `^3.4.16` | تنسيق مرن، دعم كامل لاتجاه اليمين إلى اليسار (RTL)، وتصميم متجاوب لجميع الشاشات |
| **قارئ الباركود والكاميرا** | html5-qrcode | `^2.3.8` | تشغيل كاميرا الهاتف أو الحاسوب وقراءة وتفكيك رموز QR بسرعة ودقة |
| **تشفير كلمات المرور** | bcryptjs | `^3.0.3` | تجزئة كلمات مرور الكادر التدريسي بـ 12 جولة تشفير مع حماية Timing Attacks |
| **التحقق من المدخلات** | class-validator & class-transformer | `^0.14.1` / `^0.5.1` | التحقق التلقائي الصارم من جميع الحقول القادمة في طلبات الـ API (DTOs) |
| **مدير الحزم (Package Manager)** | pnpm | `9.x` (Monorepo) | عزل التبعيات وتوفير مساحة التخزين وسرعة التثبيت عبر الروابط الرمزية |

---

### 2. تفكيك وتحليل ملفات التبعيات (Package Dependencies Analysis)

#### 2.1 الحزمة الجذرية (`package.json`)
تحتوي على التبعيات المشتركة وأوامر إدارة بيئة الـ Monorepo:
```json
{
  "name": "attendance-recording-system",
  "private": true,
  "scripts": {
    "dev": "pnpm --parallel run dev",
    "build": "pnpm --recursive run build",
    "start": "pnpm --parallel run start",
    "test": "pnpm --recursive run test",
    "typecheck": "pnpm --recursive run typecheck"
  }
}
```
- **الملاحظة**: أوامر الإدارة نظيفة جداً وتستفيد من قدرات pnpm لتشغيل الواجهتين بالتوازي في بيئة التطوير، وبنائهما تتابعياً في بيئة الإنتاج وخطوط CI.

#### 2.2 تبعيات خادم الواجهة الخلفية (`apps/api/package.json`)

| الحزمة (Package) | نوع التبعية | هل مستخدمة فعلياً؟ | الوظيفة ومكان الاستخدام |
|---|---|---|---|
| `@nestjs/common` | Runtime | نعم (أساسية) | الديكورات، الاستثناءات، الموديلات، الـ Pipes |
| `@nestjs/core` | Runtime | نعم (أساسية) | محرك إقلاع الخادم `NestFactory` والحراس العامين |
| `@nestjs/platform-express` | Runtime | نعم (أساسية) | وسيط Express الداخلي لإدارة الـ HTTP Request/Response |
| `@nestjs/platform-socket.io` | Runtime | نعم | مهايئ WebSocket لـ NestJS في `main.ts` |
| `@nestjs/websockets` | Runtime | نعم | ديكورات `@WebSocketGateway`, `@SubscribeMessage` في `attendance.gateway.ts` |
| `@prisma/client` | Runtime | نعم (حرجة) | عميل استعلامات قاعدة البيانات المولد |
| `bcryptjs` | Runtime | نعم (حرجة) | تجزئة والتحقق من كلمات المرور في `password.ts` و `auth.service.ts` |
| `class-validator` | Runtime | نعم (حرجة) | فحص صحة حقول الـ DTOs (`@IsString`, `@IsInt`, `@Min`, إلخ) |
| `class-transformer` | Runtime | نعم | تحويل أنواع البيانات القادمة تلقائياً في `ValidationPipe` |
| `dotenv` | Runtime | نعم | قراءة ملفات `.env` في `load-env.ts` قبل إقلاع الموديلات |
| `reflect-metadata` | Runtime | نعم | متطلب أساسي لعمل ديكورات TypeScript في NestJS |
| `rxjs` | Runtime | نعم | إدارة التدفقات غير المتزامنة والمحولات |
| `socket.io` | Runtime | نعم | مكتبة قنوات الاتصال الحي بالخادم |
| `@nestjs/cli` | Dev | نعم | بناء الخادم وتصريفه عبر `nest build` |
| `prisma` | Dev | نعم | أداة السطر والأوامر لترحيل قواعد البيانات `prisma migrate` |
| `tsx` | Dev | نعم | تنفيذ ملفات TypeScript مباشرة بدون بناء في الاختبارات ونصوص الصيانة |
| `typescript` | Dev | نعم | مترجم اللغة وفحص الأنواع البرمجية |

#### 2.3 تبعيات تطبيق الواجهة الأمامية (`apps/web/package.json`)

| الحزمة (Package) | نوع التبعية | هل مستخدمة فعلياً؟ | الوظيفة ومكان الاستخدام |
|---|---|---|---|
| `next` | Runtime | نعم (أساسية) | محرك التطبيق، التوجيه (App Router)، الـ SSR والـ Client Rendering |
| `react` & `react-dom` | Runtime | نعم (أساسية) | بناء عناصر واجهة المستخدم وإدارة الحالة |
| `html5-qrcode` | Runtime | نعم (حرجة) | محرك مسح بطاقات الـ QR في مكون `CameraScanner.tsx` |
| `lucide-react` | Runtime | نعم | مكتبة الأيقونات التفاعلية الموحدة لكافة أزرار وشاشات النظام |
| `socket.io-client` | Runtime | نعم | استقبال أحداث الـ WebSocket الحية لنتائج المسح وتدوير الرمز |
| `tailwindcss` | Dev | نعم | بناء وتوليد فئات التنسيق المخصصة والمتجاوبة |
| `postcss` & `autoprefixer` | Dev | نعم | معالجة ملفات التنسيق ودعم المتصفحات المختلفة |
| `typescript` | Dev | نعم | فحص الأنواع الصارم للواجهة |

---

### 3. تقييم بيئات التشغيل (Development vs. Production)

#### بيئة التطوير (Local Development Environment):
- **نظام التشغيل**: Windows (محلي لدى المطور).
- **الخادم المساعد**: Node.js v20+ مع مشغلات التطوير المتزامنة (`next dev` على منفذ 3000، و `nest start --watch` على منفذ 3001).
- **قاعدة البيانات المحلية**: محرك PostgreSQL 16 محلي مدمج في مجلد `postgresql/` يعمل كخدمة أو عبر تشغيل يدوي، ويتصل به الخادم عبر `attendance_user:Qamarnahda-1652_Xy20@localhost:5432/attendance`.
- **قواعد بيانات الاختبار المؤقتة**: تُنشأ وتُحذف ديناميكياً لكل تشغيل لاختبارات `node:test` باسم فريد مثل `att_test_phase2_<pid>_<timestamp>` عبر مستخدم الصلاحيات الإدارية `attendance_admin` لمنع أي تلوث لبيانات التطوير أو الإنتاج.

#### بيئة الإنتاج والاستضافة (Production Environment):
- **خادم الواجهة الخلفية (API Backend)**: مهيأ للنشر على منصة سحابية (Railway) مع إمكانية التشغيل المستقل عبر حاوية Docker أو عبر Node.js المباشر `node dist/main.js`.
- **الواجهة الأمامية (Web Frontend)**: مهيأة للنشر كخدمة ويب على منصة Vercel أو مع خادم Node.js مستقل عبر إخراج Next.js Standalone.
- **قاعدة بيانات الإنتاج**: قاعدة بيانات سحابية مدارة على منصة Railway / Neon، مؤمنة باتصال SSL إلزامي وعنوان IP عام، ومحفوظة بنسخ احتياطية دورية بصيغة pg_dump.

