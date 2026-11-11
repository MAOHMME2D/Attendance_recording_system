# الدليل المرجعي الكامل لواجهات برمجة التطبيقات (API Reference)
## Attendance Recording System — REST Endpoints & WebSocket Protocol

---

### 1. جدول الفهرس الشامل لجميع مسارات الـ API (46 مساراً)

| # | Method | Endpoint | Controller | الصلاحيات المطلوبة | المدخلات الرئيسية | المخرجات ووظيفة المسار |
|---|---|---|---|---|---|---|
| 1 | `GET` | `/api/health` | `HealthController` | `@Public()` عام | لا يوجد | فحص سلامة الخادم وقاعدة البيانات (`{ status: 'ok', database: 'connected' }`) |
| 2 | `POST` | `/api/auth/login` | `AuthController` | `@Public()` عام | `LoginDto` (`staffId`, `password`) | تسجيل الدخول وإرجاع كوكي الجلسة وبيانات المستخدم |
| 3 | `POST` | `/api/auth/logout` | `AuthController` | جلسة نشطة | لا يوجد | إلغاء الجلسة ومسح الكوكي من المتصفح |
| 4 | `GET` | `/api/auth/me` | `AuthController` | جلسة نشطة | لا يوجد | جلب بيانات الموظف الحالي ومصفوفة صلاحياته |
| 5 | `POST` | `/api/auth/refresh` | `AuthController` | جلسة نشطة | لا يوجد | تجديد فترة صلاحية الجلسة الحالية |
| 6 | `POST` | `/api/lectures` | `LectureController` | `LECTURE_CREATE` | `CreateLectureDto` (`name`, `courseId`, `sectionIds`, `studyPeriod`) | إنشاء وبدء محاضرة جديدة وتوليد رمز QR |
| 7 | `GET` | `/api/lectures/active` | `LectureController` | `LECTURE_CONDUCT` | لا يوجد | جلب المحاضرة المفتوحة الخاصة بالمستخدم الحالي |
| 8 | `GET` | `/api/lectures` | `LectureController` | `LECTURE_CONDUCT` / `LECTURE_VIEW_ALL` | استعلامات اختيارية | جلب قائمة المحاضرات المسموح للمستخدم برؤيتها |
| 9 | `GET` | `/api/lectures/:id` | `LectureController` | `LECTURE_CONDUCT` / `LECTURE_VIEW_ALL` | مسار `:id` | جلب تفاصيل محاضرة وكشف الحضور المفرز |
| 10 | `POST` | `/api/lectures/:id/close` | `LectureController` | `LECTURE_CONDUCT` | مسار `:id` | الإغلاق الذري للمحاضرة واحتساب الغيابات |
| 11 | `DELETE`| `/api/lectures/:id` | `LectureController` | `LECTURE_DELETE` | مسار `:id` | أرشفة المحاضرة وحفظ سجلاتها (Soft-delete) |
| 12 | `POST` | `/api/lectures/validate-qr` | `LectureController` | جلسة نشطة | `ValidateQrDto` (`token`) | فحص صلاحية رمز QR المعروض للمحاضرة |
| 13 | `POST` | `/api/attendance/scan` | `AttendanceController` | `LECTURE_CONDUCT` | `ScanStudentDto` (`qrToken`) | مسح بطاقة الطالب وتسجيل حضوره فورياً |
| 14 | `GET` | `/api/attendance/lecture/:id`| `AttendanceController` | `LECTURE_CONDUCT` / `LECTURE_VIEW_ALL` | مسار `:id` | جلب كشف الحضور الكامل للمحاضرة |
| 15 | `POST` | `/api/attendance/toggle-status`| `AttendanceController` | `ATTENDANCE_MANUAL` | `recordId` | تبديل حالة الطالب (حاضر/غائب) أثناء الجلسة |
| 16 | `POST` | `/api/attendance/manual` | `AttendanceController` | `ATTENDANCE_MANUAL` | `AddManualAttendanceDto` (`lectureId`, `studentIdentifier`, `status`) | تسجيل طالب يدوياً بالاسم أو الكود |
| 17 | `GET` | `/api/students` | `StudentController` | `STUDENTS_VIEW` | استعلامات (`stage`, `sectionId`, `studyPeriod`, `search`) | جلب قائمة الطلاب وإحصائياتهم التراكمية |
| 18 | `GET` | `/api/students/options` | `StudentController` | `STUDENT_OPTIONS` | استعلامات (`courseId`, `stage`) | قائمة طلاب مختصرة للمحاضرين للبحث اليدوي |
| 19 | `GET` | `/api/students/:id` | `StudentController` | `STUDENTS_VIEW` | مسار `:id` | جلب السجل الكامل لطالب محدد وسجل محاضراته |
| 20 | `POST` | `/api/students` | `StudentController` | `STUDENTS_MANAGE` | `CreateStudentDto` (`name`, `stage`, `sectionId`, `studyPeriod`) | إضافة طالب جديد وتوليد رمزه الأكاديمي |
| 21 | `PUT` | `/api/students/:id` | `StudentController` | `STUDENTS_MANAGE` | `UpdateStudentDto` | تعديل بيانات الطالب الحالية |
| 22 | `DELETE`| `/api/students/:id` | `StudentController` | `STUDENTS_MANAGE` | مسار `:id` | حذف الطالب (نهائي أو أرشفة إذا وُجدت سجلات) |
| 23 | `POST` | `/api/students/import` | `StudentController` | `STUDENTS_MANAGE` | `ImportStudentsDto` (`rows[]`) | استيراد دفعة طلاب من ملف Excel/CSV |
| 24 | `POST` | `/api/students/:id/qr` | `StudentController` | `QR_ISSUE` | مسار `:id` | إصدار أو إعادة توليد بطاقة QR جديدة للطالب |
| 25 | `POST` | `/api/students/reset-absences`| `StudentController`| `ABSENCES_RESET` | `ResetAbsencesDto` (`stage`, `resetType`, `sectionId`, `studyPeriod`) | تصفير سجلات الغياب للمرحلة المحددة |
| 26 | `GET` | `/api/sections` | `SectionController` | `SECTIONS_VIEW` | استعلامات (`stage`, `studyPeriod`) | جلب الشعب الأكاديمية المفروزة |
| 27 | `POST` | `/api/sections` | `SectionController` | `SECTIONS_MANAGE` | `CreateSectionDto` (`name`, `stage`, `studyPeriod`) | إنشاء شعبة دراسية جديدة |
| 28 | `PUT` | `/api/sections/:id` | `SectionController` | `SECTIONS_MANAGE` | `UpdateSectionDto` | تعديل بيانات أو تسمية الشعبة |
| 29 | `DELETE`| `/api/sections/:id` | `SectionController` | `SECTIONS_MANAGE` | مسار `:id` | حذف شعبة فارغة غير مرتبطة بسجلات |
| 30 | `GET` | `/api/courses` | `CourseController` | `COURSES_VIEW` | استعلامات (`stage`) | جلب المقررات الدراسية (مقيدة بنطاق المدرس) |
| 31 | `POST` | `/api/courses` | `CourseController` | `COURSES_MANAGE` | `CreateCourseDto` (`code`, `name`, `stage`) | إضافة مادة أكاديمية جديدة |
| 32 | `PUT` | `/api/courses/:id` | `CourseController` | `COURSES_MANAGE` | `UpdateCourseDto` | تعديل رمز أو اسم المادة |
| 33 | `DELETE`| `/api/courses/:id` | `CourseController` | `COURSES_MANAGE` | مسار `:id` | حذف مادة أكاديمية |
| 34 | `GET` | `/api/assignments` | `AssignmentController` | `ASSIGNMENTS_VIEW` | استعلامات (`courseId`, `staffUserId`) | جلب جدول تعيينات المواد على التدريسيين |
| 35 | `POST` | `/api/assignments` | `AssignmentController` | `ASSIGNMENTS_MANAGE`| `CreateAssignmentDto` (`courseId`, `staffUserId`) | إسناد مادة لتدريسي أو فني |
| 36 | `DELETE`| `/api/assignments/:id` | `AssignmentController` | `ASSIGNMENTS_MANAGE`| مسار `:id` | فك ارتباط تدريسي بمادة |
| 37 | `GET` | `/api/followup` | `FollowupController` | `STUDENT_FOLLOWUP_VIEW`| استعلامات (`courseId`, `sectionId`, `page`, `sort`)| متابعة غيابات الطلاب ضمن المقررات المسندة |
| 38 | `GET` | `/api/followup/sections` | `FollowupController` | `STUDENT_FOLLOWUP_VIEW`| استعلامات (`courseId`) | جلب الشعب المتاحة لمتابعة مادة معينة |
| 39 | `GET` | `/api/followup/:studentId`| `FollowupController` | `STUDENT_FOLLOWUP_VIEW`| مسار `:studentId` واستعلام `courseId` | سجل الطالب التفصيلي في المقرر المسند |
| 40 | `GET` | `/api/timetable` | `TimetableController` | `TIMETABLE_VIEW` | استعلامات (`courseId`, `sectionId`, `day`) | جلب المواعيد الأسبوعية المجدولة |
| 41 | `POST` | `/api/timetable` | `TimetableController` | `TIMETABLE_MANAGE` | `CreateTimetableEntryDto` (`courseId`, `sectionId`, `dayOfWeek`, `startTime`, `endTime`) | إضافة توقيت أسبوعي للمقرر والشعبة |
| 42 | `PUT` | `/api/timetable/:id` | `TimetableController` | `TIMETABLE_MANAGE` | `UpdateTimetableEntryDto` | تعديل موعد مجدول |
| 43 | `DELETE`| `/api/timetable/:id` | `TimetableController` | `TIMETABLE_MANAGE` | مسار `:id` | إزالة موعد من الجدول الأسبوعي |
| 44 | `GET` | `/api/reports/dashboard` | `ReportsController` | `REPORTS_VIEW` | استعلامات النطاق والتاريخ | مؤشرات الأداء الإجمالية للوحة الرئيسية |
| 45 | `GET` | `/api/reports/students` | `ReportsController` | `REPORTS_VIEW` | استعلامات (`stage`, `sectionId`, `from`, `to`) | تقرير الطلاب التراكمي ونسب الالتزام |
| 46 | `GET` | `/api/reports/absentees` | `ReportsController` | `REPORTS_VIEW` | استعلامات (`threshold`, `stage`, `from`, `to`) | رادار الطلبة المهددين بالإنذار والحرمان |

---

### 2. بروتوكول قنوات الاتصال الحي (WebSocket / Socket.IO Events)

تعمل بوابة الاتصال الحي `AttendanceGateway` على المنفذ الموحد وتتيح المزامنة اللحظية بين شاشة القاعة وهاتف التدريسي عبر الغرفة المخصصة `lecture:${lectureId}`:

#### الأحداث الصادرة من العميل (Client Emitters):
1. `join_lecture`: ينضم العميل لغرفة المحاضرة للاستماع لتحديثاتها. يتحقق الخادم أولاً من صلاحية المستخدم للوصول للمحاضرة قبل إدخاله للغرفة.
2. `leave_lecture`: مغادرة الغرفة عند إغلاق المحاضرة أو الخروج من الصفحة.

#### الأحداث المبثوثة من الخادم (Server Broadcasts):
1. `qr_refreshed`: يُبث كل 22 ثانية عند تدوير رمز المحاضرة ويحمل الرمز الجديد وتاريخ انقضائه `{ token, expiresAt, lectureId }`.
2. `attendance_recorded`: يُبث فور مسح بطاقة طالب بنجاح ليظهر في قائمة الحاضرين في شاشة القاعة لحظياً `{ studentId, studentCode, name, status, registeredAt }`.
3. `stats_updated`: يُبث لتحديث العدادات الإجمالية `{ presentCount, absentCount, totalExpected }`.
4. `lecture_closed`: يُبث عند قيام التدريسي بإنهاء المحاضرة لإيقاف شاشات العرض وقفل واجهة المسح فوراً `{ lectureId, closedAt }`.

---

### 3. معايير استجابات الأخطاء في النظام (HTTP Error Codes)

تتبع الواجهات الخلفية معايير RESTful الصارمة في الاستجابات:
- **`200 OK` / `201 Created`**: نجاح العملية وإرجاع البيانات المطلوبة.
- **`400 Bad Request`**: خلل في المدخلات، أو محاولة تعديل محاضرة مغلقة، أو محاولة مسح طالب لا ينتمي للمرحلة أو الشعبة.
- **`401 Unauthorized`**: انتهاء صلاحية الجلسة أو غياب كوكي المصادقة.
- **`403 Forbidden`**: محاولة الوصول لمادة أو محاضرة أو شاشة خارج نطاق صلاحيات المستخدم.
- **`404 Not Found`**: العنصر المطلوب غير موجود أو محجوب لحماية النطاق (IDOR Defense).
- **`409 Conflict`**: تضارب في المواعيد أو تعارض في البيانات الفريدة.
- **`429 Too Many Requests`**: تجاوز سقف محاولات تسجيل الدخول المسموح بها (Rate Limit).

