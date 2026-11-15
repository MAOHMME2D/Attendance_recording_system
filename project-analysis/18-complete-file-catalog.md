# الفهرس الشامل لجميع ملفات المشروع (Complete Individual File Catalog)
## Attendance Recording System — مسح وفهرسة تفصيلية لكل ملف

---

### 1. إحصائيات التغطية الشاملة
- **إجمالي الملفات المفحوصة والمفهرسة فردياً**: **163 ملفاً برمجياً وتكوينياً**.
- **نسبة التغطية الميدانية للتحليل**: **100% من الكود المصدري الأصلي** (تم استبعاد مجلدات الحزم المولدة تلقائياً `node_modules`, `.next`, `dist`, ومحرك `postgresql/` المدمج).

---

### 2. ملفات الجذر والتهيئة العامة (Root Configurations)

#### 1. `package.json`
- **المسار الكامل**: `package.json`
- **الوظيفة**: الحزمة الجذرية لتعريف بيئة العمل المشتركة `pnpm workspaces` وأوامر التشغيل الموحدة (`dev`, `build`, `test`, `typecheck`).
- **لماذا يحتاجه النظام؟**: إدارة مشروعي الواجهة والخلفية كمنظومة واحدة وتنسيق التبعيات المشتركة.
- **أهم المحتويات**: أوامر التشغيل المتوازي والمتكرر عبر `pnpm`.
- **هل مستخدم؟**: نعم، أساسي وحرج.

#### 2. `pnpm-workspace.yaml`
- **المسار الكامل**: `pnpm-workspace.yaml`
- **الوظيفة**: تحديد مسارات الحزم الفرعية المندرجة تحت المنظومة (`apps/*`).
- **لماذا يحتاجه النظام؟**: تمكين مدير الحزم `pnpm` من ربط `apps/api` و `apps/web` كحزم شقيقة.
- **هل مستخدم؟**: نعم، إلزامي لعمل الـ Monorepo.

#### 3. `.npmrc`
- **المسار الكامل**: `.npmrc`
- **الوظيفة**: ضبط سلوك تثبيت وتوزيع الحزم في `pnpm` (مثل تفعيل `node-linker` و `shamefully-hoist`).
- **لماذا يحتاجه النظام؟**: منع مشاكل عزل الحزم في بيئات Windows مع NestJS و Prisma.
- **هل مستخدم؟**: نعم، مهم جداً لتفادي أخطاء استيراد التبعيات.

#### 4. `.gitignore`
- **المسار الكامل**: `.gitignore`
- **الوظيفة**: استثناء الملفات المؤقتة، وحزم الـ node_modules، وملفات البناء، وملفات البيئة الحساسة `.env` من مستودع Git.
- **لماذا يحتاجه النظام؟**: حماية الأسرار وكلمات المرور ومنع تضخم مستودع الأكواد.
- **هل مستخدم؟**: نعم، إلزامي.

#### 5. `.env`
- **المسار الكامل**: `.env`
- **الوظيفة**: تخزين المتغيرات البيئية العامة وروابط الاتصال بقواعد البيانات.
- **لماذا يحتاجه النظام؟**: عزل إعدادات التشغيل الحساسة عن الكود البرمجي المصدري.
- **هل مستخدم؟**: نعم، يتم تحميله عند إقلاع الخدمات.

#### 6. `.github/workflows/ci.yml`
- **المسار الكامل**: `.github/workflows/ci.yml`
- **الوظيفة**: إعدادات سير العمل المؤتمت في سحابة GitHub Actions لبناء وفحص واختبار المشروع عند كل Push أو PR.
- **لماذا يحتاجه النظام؟**: ضمان جودة الكود البرمجي واكتشاف أي أخطاء أو تراجعات قبل دمج الأكواد.
- **أهم الخطوات**: تشغيل PostgreSQL 16، تثبيت التبعيات، بناء الـ API، فحص أنواع الويب، وتشغيل الاختبارات.
- **هل مستخدم؟**: نعم، مفعل على الفرعين `main` و `online-foundation`.

---

### 3. خادم الواجهة الخلفية — البنية المشتركة (`apps/api/src/common/`)

#### 7. `apps/api/src/main.ts`
- **الوظيفة**: نقطة الدخول الرئيسية لإقلاع خادم NestJS وضبط الترويسات والـ CORS والـ Pipes.
- **لماذا يحتاجه النظام؟**: تشغيل خادم الـ API وضبط المنافذ وترويسات الحماية وحماية الـ CSRF.
- **أهم الدوال**: `bootstrap()`, `getLocalIP()`.
- **الاعتماديات**: `@nestjs/core`, `AppModule`, `IoAdapter`, `ValidationPipe`, `origins.ts`.
- **هل مستخدم؟**: نعم، الملف التنفيذي الأساسي للخادم.

#### 8. `apps/api/src/app.module.ts`
- **الوظيفة**: الموديل الجذري الجامع لجميع وحدات وحراس الواجهة الخلفية.
- **لماذا يحتاجه النظام؟**: تعريف شجرة حقن الاعتماديات (Dependency Injection) وتفعيل الحراس العامين `AuthGuard` و `PermissionsGuard`.
- **الاعتماديات**: يجمع كافة الموديلات الـ 13 وموديل الـ Prisma.
- **هل مستخدم؟**: نعم، أساسي لإقلاع NestJS.

#### 9. `apps/api/src/health.controller.ts`
- **الوظيفة**: مسار التحقق من صحة الخادم وقاعدة البيانات (`GET /api/health`).
- **لماذا يحتاجه النظام؟**: تستخدمه منصات الاستضافة السحابية (Railway / Render) لمراقبة جاهزية الخادم (Healthchecks).
- **المدخلات والمخرجات**: استدعاء بدون مدخلات؛ يرجع `{ status: 'ok', database: 'connected' }` أو استثناء 503 إذا سقطت قاعدة البيانات.
- **هل مستخدم؟**: نعم، عام ومتاح للمراقبة.

#### 10. `apps/api/src/common/constants/roles.ts`
- **الوظيفة**: تعريف الأدوار الأكاديمية الـ 5 ومصفوفة الـ 21 صلاحية ودوال التحقق من الصلاحيات.
- **لماذا يحتاجه النظام؟**: المرجع الأمني الحاكم لكافة عمليات التخويل في النظام.
- **أهم الصادرات**: `STAFF_ROLES`, `PERMISSIONS`, `ROLE_PERMISSIONS`, `roleHasPermission()`, `isAdministrativeRole()`.
- **هل مستخدم؟**: نعم، مستخدم في كافة الحراس والخدمات والواجهة.

#### 11. `apps/api/src/common/constants/academics.ts`
- **الوظيفة**: تعريف المراحل الأكاديمية الأربع (1-4) وبوادئ أرقام الطلاب وقواعد التطبيع.
- **أهم الصادرات**: `ACADEMIC_STAGES`, `STAGE_LABELS`, `normalizeStage()`, `stageCodePrefix()`.
- **هل مستخدم؟**: نعم، ينظم الترقيم والفلترة عبر المنظومة.

#### 12. `apps/api/src/common/constants/coverage.ts`
- **الوظيفة**: تعريف بادئة ملاحظة الحضور التبادلي بين الشعب.
- **أهم الصادرات**: `COVER_NOTE_PREFIX = 'حاضر عبر'` و `isCoverageNote()`.
- **هل مستخدم؟**: نعم، يميز سجلات الحضور الشكلي عن الحضور الفعلي.

#### 13. `apps/api/src/common/guards/auth.guard.ts`
- **الوظيفة**: حارس المصادقة العالمي؛ يفحص صلاحية جلسات الموظفين ويستخرج هوية المستخدم.
- **الاعتماديات**: `AuthService`, `Reflector`, `cookies.ts`.
- **هل مستخدم؟**: نعم، يعمل كـ `APP_GUARD` عام على مستوى النظام كاملاً.

#### 14. `apps/api/src/common/guards/permissions.guard.ts`
- **الوظيفة**: حارس الصلاحيات العالمي؛ يطابق دور المستخدم مع متطلبات المسار.
- **الاعتماديات**: `Reflector`, `roles.ts`.
- **هل مستخدم؟**: نعم، يعمل كـ `APP_GUARD` عام بعد حارس المصادقة.

#### 15. `apps/api/src/common/decorators/current-user.decorator.ts`
- **الوظيفة**: مزخرف مخصص لحقن بيانات المستخدم الحالي المسجل `AuthenticatedUser` داخل دوال الـ Controller.
- **هل مستخدم؟**: نعم، مستخدم في كافة وحدات التحكم.

#### 16. `apps/api/src/common/decorators/permissions.decorator.ts`
- **الوظيفة**: مزخرف `@RequirePermissions(...)` لتحديد الصلاحيات المطلوبة لكل دالة.
- **هل مستخدم؟**: نعم، أساس تفعيل الـ RBAC.

#### 17. `apps/api/src/common/decorators/public.decorator.ts`
- **الوظيفة**: مزخرف `@Public()` لاستثناء مسارات معينة من حارس المصادقة (مثل تسجيل الدخول وفحص الصحة).
- **هل مستخدم؟**: نعم، على مسارات `/login` و `/health`.

#### 18. `apps/api/src/common/utils/cookies.ts`
- **الوظيفة**: قراءة وكتابة كوكيز الجلسات المشفرة واستخراج رموز Bearer.
- **أهم الصادرات**: `SESSION_COOKIE_NAME`, `buildSessionCookie()`, `readCookie()`, `readBearerToken()`.
- **هل مستخدم؟**: نعم، عصب إدارة الجلسات الآمنة.

#### 19. `apps/api/src/common/utils/origins.ts`
- **الوظيفة**: إدارة النطاقات المسموحة للـ CORS وحماية الـ CSRF ومطابقتها.
- **أهم الصادرات**: `getAllowedOrigins()`, `isAllowedOrigin()`.
- **هل مستخدم؟**: نعم، في ترويسات الخادم ووسيط مكافحة التزوير.

#### 20. `apps/api/src/common/utils/password.ts`
- **الوظيفة**: تجزئة كلمات المرور والتحقق منها باستخدام خوارزمية bcrypt بـ 12 جولة تشفير.
- **أهم الصادرات**: `hashPassword()`, `verifyPassword()`.
- **هل مستخدم؟**: نعم، في وحدة المصادقة وإدارة الكادر.

#### 21. `apps/api/src/common/utils/section.util.ts`
- **الوظيفة**: تطبيع وتنسيق أسماء الشعب الأكاديمية (مثل إزالة الفراغات الزائدة والتعامل مع الأرقام والرموز).
- **أهم الصادرات**: `normalizeSection()`.
- **هل مستخدم؟**: نعم، لتوحيد مسميات الشعب ومنع تضارب النصوص.

#### 22. `apps/api/src/common/utils/student-stats.util.ts`
- **الوظيفة**: إعادة احتساب إحصائيات حضور وغياب الطلاب وتحديث العدادات ونسب الالتزام التراكمية في قاعدة البيانات من واقع السجلات المغلقة فقط.
- **أهم الصادرات**: `recomputeStudentStats()`.
- **هل مستخدم؟**: نعم، يُستدعى داخل المعاملات عند إغلاق المحاضرات أو تصفير الغيابات أو الأرشفة.

#### 23. `apps/api/src/common/utils/coverage.util.ts`
- **الوظيفة**: توفير استعلام Prisma لاستثناء سجلات التغطية الشكلية ("حاضر عبر الشعبة") من تضخيم عدادات الحضور الفيزيائي.
- **أهم الصادرات**: `notCoveredWhere()`.
- **هل مستخدم؟**: نعم، في حساب الإحصائيات والمتابعة والتقارير.

#### 24. `apps/api/src/common/utils/load-env.ts`
- **الوظيفة**: قراءة وتحميل ملفات `.env` قبل إقلاع إطار NestJS لضمان توفر إعدادات قاعدة البيانات.
- **هل مستخدم؟**: نعم، في السطر الأول من `main.ts`.

#### 25. `apps/api/src/common/types/authenticated-user.ts`
- **الوظيفة**: تعريف بنية كائن المستخدم المصادق عليه داخل النظام وأنواع الصلاحيات المرتبطة به.
- **هل مستخدم؟**: نعم، في كافة حراس وخدمات النظام.

---

### 4. خادم الواجهة الخلفية — الوحدات الوظيفية (`apps/api/src/modules/`)

#### 26–30. وحدة المصادقة (`modules/auth/`)
- `auth.module.ts`: تصدير الموديل والخدمات.
- `auth.controller.ts`: مسارات الدخول والخروج ومعلومات المستخدم.
- `auth.service.ts`: إدارة الجلسات المشفرة ومكافحة التخمين ومقاومة Timing Attacks.
- `authorization.service.ts`: حساب النطاق الأكاديمي وصلاحيات الوصول للمواد والمحاضرات.
- `dto/login.dto.ts`: نموذج التحقق من مدخلات الدخول.
- **التقييم**: ممتازة، محكمة، وتؤدي دوراً أمنياً مركزياً وحرجاً.

#### 31–35. وحدة المحاضرات (`modules/lecture/`)
- `lecture.module.ts`: الربط مع الموديلات الأخرى.
- `lecture.controller.ts`: مسارات المحاضرات (إنشاء، جلب، إغلاق، أرشفة، فحص QR).
- `lecture.service.ts`: دورة حياة المحاضرة، تدوير الـ QR، الإغلاق الذري، وحساب التغطية الأسبوعية.
- `attendance.gateway.ts`: بوابة الـ WebSocket لبث أحداث مسح الحضور وتدوير الرمز.
- `dto/create-lecture.dto.ts` و `dto/validate-qr.dto.ts`: نماذج البيانات.
- **التقييم**: حجر الزاوية للنظام؛ مكتملة ومحمية بالأقفال الاستشارية.

#### 36–39. وحدة الحضور (`modules/attendance/`)
- `attendance.module.ts`: الربط وتوفير الخدمة.
- `attendance.controller.ts`: مسارات المسح بالكاميرا، كشف الحضور، التبديل، والتسجيل اليدوي.
- `attendance.service.ts`: معالجة المسح الميداني، التحقق من الشعبة والجدول، ومنع التعديل على المحاضرات المغلقة.
- `dto/scan-student.dto.ts` و `dto/add-manual-attendance.dto.ts`: نماذج التحقق.
- **التقييم**: حيوية جداً وعالية الأداء.

#### 40–47. وحدة الطلاب (`modules/student/`)
- `student.module.ts`, `student.controller.ts`, `student.service.ts`.
- الـ DTOs الخمسة: `create-student.dto.ts`, `update-student.dto.ts`, `import-students.dto.ts`, `batch-students.dto.ts`, `reset-absences.dto.ts`.
- **التقييم**: متكاملة؛ وتتضمن الترقيم الأكاديمي وإصدار كروت الـ QR وتصفير الغيابات.

#### 48–51. وحدة الشعب (`modules/section/`)
- `section.module.ts`, `section.controller.ts`, `section.service.ts`, `create-section.dto.ts`, `update-section.dto.ts`.
- **التقييم**: تدير الشعب بدقة حسب المرحلة والدراسة وتمنع كسر العلاقات.

#### 52–55. وحدة المواد (`modules/course/`)
- `course.module.ts`, `course.controller.ts`, `course.service.ts`, `create-course.dto.ts`, `update-course.dto.ts`.
- **التقييم**: إدارة المقررات الدراسية وربطها بالمراحل.

#### 56–59. وحدة التعيينات التدريسية (`modules/assignment/`)
- `assignment.module.ts`, `assignment.controller.ts`, `assignment.service.ts`, `create-assignment.dto.ts`.
- **التقييم**: ربط المدرسين بالمواد الأكاديمية لحصر صلاحيات فتح المحاضرات والمتابعة.

#### 60–62. وحدة المتابعة الأكاديمية (`modules/followup/`)
- `followup.module.ts`, `followup.controller.ts`, `followup.service.ts`.
- **التقييم**: تمكن التدريسي من تتبع طلاب مواده فقط؛ محصنة تماماً ضد ثغرات IDOR.

#### 63–66. وحدة الجدول الدراسي (`modules/timetable/`)
- `timetable.module.ts`, `timetable.controller.ts`, `timetable.service.ts`, `create-timetable-entry.dto.ts`, `update-timetable-entry.dto.ts`.
- **التقييم**: تضبط مواعيد الشعب أسبوعياً وتتحكم في ميزة الحضور التبادلي بين الشعب المتوازية.

#### 67–70. وحدة التقارير والتحليلات (`modules/reports/`)
- `reports.module.ts`, `reports.controller.ts`, `reports.service.ts`, `report-types.ts`.
- **التقييم**: توليد التحليلات الشاملة ورادار الغائبين والإنذارات استناداً للمحاضرات المغلقة حصراً.

#### 71–76. وحدة إدارة الكادر والمستخدمين (`modules/staff/`)
- `staff.module.ts`, `staff.controller.ts`, `staff.service.ts`, و 4 نماذج DTOs للإنشاء والتعديل والحالة وتغيير كلمة المرور.
- **التقييم**: توفر إدارة كاملة للموظفين مع حماية المسجل من تصعيد الصلاحيات وحماية رئيس القسم الأخير.

#### 77–78. وحدة التدقيق والمراقبة (`modules/audit/`)
- `audit.module.ts`, `audit.service.ts`: توثيق العمليات الحساسة في جدول `AuditLog`.
- **التقييم**: ركيزة الشفافية والأمان في النظام.

#### 79–80. وحدة التهيئة الأولية (`modules/setup/`)
- `setup.module.ts`, `initial-setup.service.ts`: فحص التهيئة الأولى وإنشاء حساب المالك التجريبي.

#### 81–83. وحدة وتكامل قاعدة البيانات (`prisma/`)
- `prisma.module.ts`, `prisma.service.ts`: إدارة الاتصال وإغلاقه النظيف مع PostgreSQL.
- `database-url.ts`: استخراج وضبط روابط الاتصال.

---

### 5. نصوص الصيانة والترحيلات والاختبارات (`apps/api/`)

#### نصوص التهيئة في `apps/api/scripts/`:
- 84. `initial-setup.ts`: تشغيل الإعداد الأولي وتوليد حساب المالك.
- 85. `create-staff.ts`: إنشاء حساب موظف جديد من سطر الأوامر.
- 86. `disable-owner.ts`: تعطيل حساب المالك التجريبي قبل النشر للإنتاج.
- 87. `seed-lecturers.ts` و 88. `check-lecturers.ts`: نصوص مساعدة لحقن وفحص بيانات التدريسيين أثناء الاختبار.

#### ترحيلات قاعدة البيانات في `apps/api/prisma/migrations/`:
- 89. `0001_init/migration.sql`: الجداول الأساسية الأولى.
- 90. `0002_online_foundation/migration.sql`: ضبط الجلسات والأمان.
- 91. `0003_staff_management/migration.sql`: جداول وحقول إدارة الكادر.
- 92. `0004_phase2_academics/migration.sql`: الشعب والمواد والتعيينات وتحديث أكواد الطلاب لـ S2-.
- 93. `0005_attendance_identity_and_lecture_archive/migration.sql`: هوية الحضور بـ studentId وأرشفة المحاضرات.
- 94. `0006_lecture_section_identity/migration.sql`: ربط المحاضرة بالشعبة بالمفتاح الأجنبي.
- 95. `0007_multi_section_lectures_timetable/migration.sql`: المحاضرات متعددة الشعب والجدول الدراسي الأسبوعي.
- 96. `migration_lock.toml`: قفل محرك Prisma على PostgreSQL.
- 97. `apps/api/prisma/schema.prisma`: الملف الجامع لكافة النماذج والقيود والعلاقات.

#### أجنحة الاختبارات في `apps/api/test/`:
- 98. `security.test.ts`: 33 اختباراً للمصادقة والصلاحيات ومكافحة التخمين.
- 99. `staff-management.test.ts`: اختبارات إدارة الكادر ومنع تصعيد الصلاحيات.
- 100. `phase2.test.ts`: 67 اختباراً لسيناريوهات الانحدار والمحاضرات المتعددة والحضور عبر الشعب.
- 101. `reports.test.ts`: اختبارات دقة استعلامات التقارير والإنذارات.

---

### 6. تطبيق الواجهة الأمامية (`apps/web/`)

#### المسارات والصفحات في `apps/web/src/app/`:
- 102. `layout.tsx`: التخطيط الجذري الموحد للواجهة وتضمين الخطوط والـ RTL والـ AuthProvider.
- 103. `globals.css`: التنسيقات العامة وقواعد اتجاه القراءة والطباعة `@media print`.
- 104. `page.tsx`: صفحة لوحة المحاضرات وإدارة الجلسة الحية ومسح الكاميرا.
- 105. `login/page.tsx`: صفحة تسجيل دخول الكادر.
- 106. `students/page.tsx` و 107. `students/layout.tsx`: إدارة شؤون الطلاب والبطاقات وتصفير الغياب.
- 108. `academics/page.tsx` و 109. `academics/layout.tsx`: إدارة الشعب والمواد والتعيينات والجدول.
- 110. `followup/page.tsx` و 111. `followup/layout.tsx`: متابعة نسب غياب المقررات للتدريسيين.
- 112. `followup/[studentId]/page.tsx`: كشف تفاصيل حضور وغياب الطالب في المقرر.
- 113. `reports/page.tsx` و 114. `reports/layout.tsx`: لوحة التقارير المركزية والتحليلات.
- 115. `reports/students/[studentId]/page.tsx`: الملف الأكاديمي الشامل للطالب عبر كافة المواد.
- 116. `staff/page.tsx` و 117. `staff/layout.tsx`: إدارة حسابات الموظفين والصلاحيات.
- 118. `attend/page.tsx`: مسار تجريبي سابق لتسجيل الحضور الذاتي (غير مستخدم حالياً).
- 119. `middleware.ts`: وسيط حماية المسارات وتوجيه غير المسجلين لصفحة الدخول.

#### المكونات القابلة لإعادة الاستخدام في `apps/web/src/components/`:
- 120. `auth/RequireAuth.tsx`: حارس مكونات الواجهة الأمامية للتحقق من الصلاحيات.
- 121. `camera/CameraScanner.tsx`: قارئ بطاقات الـ QR والتحكم في الكاميرات ومسح الإطارات.
- 122. `cards/StudentQrCardModal.tsx`: نافذة معاينة وطباعة بطاقة الطالب الفردية.
- 123. `cards/BulkStudentCardsModal.tsx`: نافذة معاينة وطباعة بطاقات الشعبة مجمعة بنمط شبكي.
- 124. `charts/Charts.tsx`: مكونات الرسوم البيانية التفاعلية المخصصة لعرض نسب الحضور.
- 125. `layout/Navbar.tsx`: شريط التنقل العلوي الموحد للشاشات وعرض هوية المستخدم.
- 126. `modals/AttendancePdfReportModal.tsx`: نافذة استخراج وطباعة كشف الحضور الورقي.
- 127. `modals/ResetAbsencesModal.tsx`: نافذة تصفير الغيابات الأكاديمية بنطاق محدد.
- 128. `modals/SectionManagerModal.tsx`: نافذة إدارة الشعب الأكاديمية.
- 129. `reports/ReportFilters.tsx`: شريط فلاتر التقارير (التواريخ، المراحل، الشعب، المقررات).
- 130. `reports/ReportExport.tsx`: أزرار التصدير لـ Excel والطباعة الرسمية.
- 131. `reports/StatCard.tsx`: بطاقة عرض المؤشرات الإحصائية والأرقام الرئيسية.
- 132. `reports/LectureReportsPanel.tsx`: لوحة تقارير المحاضرات.
- 133. `reports/tabs/DashboardTab.tsx`: لوحة المؤشرات والرسوم البيانية.
- 134. `reports/tabs/StudentsReportTab.tsx`: كشف تفاصيل التزام الطلاب.
- 135. `reports/tabs/AbsenteesReportTab.tsx`: رادار الطلبة المنذرين والمحرومين.
- 136. `reports/tabs/CoursesReportTab.tsx`: تقرير أداء ونسب المقررات الدراسية.
- 137. `reports/tabs/LecturersReportTab.tsx`: تقرير التزام المحاضرين والفنيين.
- 138. `reports/tabs/SectionsStagesReportTab.tsx`: تقرير مقارنة الشعب والدراسة الصباحية والمسائية.
- 139. `ui/CollapsibleSection.tsx`: مكون الأقسام القابلة للطي والتوسيع لتنظيم الواجهة.

#### المكتبات والعملاء المساعدين في `apps/web/src/lib/`:
- 140. `api.ts`: عميل HTTP الموحد لكافة استدعاءات الـ Backend وإدارة استثناءات `ApiError`.
- 141. `auth.tsx`: مزود سياق المصادقة `AuthContext` وحفظ بيانات الجلسة للمتصفح.
- 142. `camera-errors.js` و 143. `camera-errors.d.ts`: وحدة ترجمة وتصنيف استثناءات الكاميرا للعربية.
- 144. `formatTime.ts`: دوال مساعدة لتنسيق الوقت والتواريخ بنمط عربي مفهوم.
- 145. `sounds.ts`: تشغيل النغمات الصوتية التفاعلية عند نجاح المسح أو رفضه.
- 146. `test/camera-errors.test.mjs`: 8 اختبارات نَقية لمعالجة أخطاء الكاميرا.

---

### 7. الوثائق ونصوص النسخ الاحتياطي (`docs/` & `scripts/`)
- 147. `docs/BACKUP_RESTORE.md`: دليل إجراءات النسخ الاحتياطي والاستعادة.
- 148. `docs/PHASE1_REPORT.md` و 149. `docs/PHASE1_FINAL_FIXES_REPORT.md`: تقارير المرحلة الأولى.
- 150. `docs/PHASE3_FINAL_REPORT.md`: التقرير الهندسي الشامل للمرحلة الثالثة وميزات 3b.
- 151. `docs/POSTGRES_MIGRATION.md`: دليل الانتقال إلى محرك PostgreSQL.
- 152. `docs/STAFF_MANAGEMENT.md`: توثيق نظام إدارة الكادر والصلاحيات.
- 153. `scripts/backup/backup-postgres.ps1`: نص أخذ النسخة الاحتياطية الثنائية تلقائياً.
- 154. `scripts/backup/register-backup-task.ps1`: نص جدولة النسخ في Windows Task Scheduler كل 6 ساعات.
- 155. `scripts/backup/restore-postgres-test.ps1`: نص فحص واختبار استعادة النسخ الاحتياطية.
- 156. `backups/prod-railway-20261110-095812.dump` و 157. `.sql`: نسخة الإنتاج الاحتياطية المعتمدة (297 طالباً، 11 شعبة).
- 158. `LICENSE`: رخصة المشروع (MIT License).
- 159. `apps/api/package.json`, 160. `apps/web/package.json`: ملفات تعريف الحزم الفرعية.
- 161. `apps/api/tsconfig.json`, 162. `apps/web/tsconfig.json`: إعدادات مترجم TypeScript الصارمة.
- 163. `apps/web/tailwind.config.js`: إعدادات التنسيق ونقاط التجاوب (Responsive Breakpoints).

