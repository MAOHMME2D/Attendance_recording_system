'use client';

import React from 'react';
import Link from 'next/link';
import Navbar from '../../components/layout/Navbar';

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        marginBottom: '10px',
        fontSize: '13.5px',
        lineHeight: 1.9,
        color: '#374151',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: '24px',
          height: '24px',
          marginTop: '2px',
          borderRadius: '50%',
          background: '#111827',
          color: '#FFFFFF',
          fontSize: '12px',
          fontWeight: '800',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function GuideCard({
  id,
  icon,
  title,
  subtitle,
  children,
}: {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '18px',
        padding: '20px 22px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        scrollMarginTop: '90px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <div
          aria-hidden="true"
          style={{
            width: '42px',
            height: '42px',
            flexShrink: 0,
            borderRadius: '12px',
            background: '#F9FAFB',
            border: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
          }}
        >
          {icon}
        </div>
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: '800', color: '#111827', margin: 0 }}>{title}</h2>
          {subtitle && (
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div style={{ marginTop: '12px' }}>{children}</div>
    </section>
  );
}

function Note({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' }) {
  const warn = tone === 'warn';
  return (
    <div
      style={{
        marginTop: '12px',
        padding: '10px 12px',
        borderRadius: '10px',
        background: warn ? '#FFFBEB' : '#EFF6FF',
        border: `1px solid ${warn ? '#FDE68A' : '#BFDBFE'}`,
        color: warn ? '#92400E' : '#1E40AF',
        fontSize: '12.5px',
        lineHeight: 1.8,
      }}
    >
      {warn ? '⚠️ ' : '💡 '}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

const QUICK_STEPS = [
  { icon: '📚', title: 'أنشئ المحاضرة', text: 'اختر المادة ونوع الدراسة والشعبة' },
  { icon: '📷', title: 'شغّل الكاميرا', text: 'امسح بطاقات QR للطلاب' },
  { icon: '✅', title: 'أنهِ المحاضرة', text: 'تُحتسب الغيابات تلقائياً' },
  { icon: '📊', title: 'راجع التقارير', text: 'حضور وغياب ونسب لكل طالب' },
];

const CONTENTS = [
  { id: 'create', label: 'إنشاء محاضرة' },
  { id: 'scan', label: 'تسجيل الحضور' },
  { id: 'manual', label: 'الإضافة اليدوية' },
  { id: 'close', label: 'إنهاء المحاضرة' },
  { id: 'reports', label: 'التقارير' },
  { id: 'timetable', label: 'الجدول الأسبوعي' },
  { id: 'followup', label: 'متابعة الطلاب' },
  { id: 'help', label: 'مشاكل شائعة' },
];

export default function GuidePage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />

      <div className="app-page-narrow">
        {/* Hero */}
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '22px',
            padding: '30px 28px',
            marginBottom: '20px',
            background: 'linear-gradient(135deg, #111827 0%, #1F2937 60%, #374151 100%)',
            border: '1.5px solid var(--gold)',
            boxShadow: '0 18px 40px rgba(17,24,39,0.18)',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '999px',
              background: 'rgba(212,175,55,0.16)',
              border: '1px solid rgba(212,175,55,0.5)',
              color: '#FDE68A',
              fontSize: '12px',
              fontWeight: '800',
              marginBottom: '12px',
            }}
          >
            🎓 دليل التدريسي
          </span>
          <h1 style={{ fontSize: '27px', fontWeight: '900', color: '#FFFFFF', margin: 0, lineHeight: 1.4 }}>
            كيف تستخدم نظام تسجيل الحضور؟
          </h1>
          <p
            style={{
              marginTop: '10px',
              maxWidth: '680px',
              fontSize: '14px',
              lineHeight: 1.9,
              color: 'rgba(255,255,255,0.82)',
            }}
          >
            كل ما تحتاجه لتسجيل حضور محاضراتك خطوة بخطوة: من إنشاء المحاضرة ومسح بطاقات
            الطلاب، إلى إنهاء المحاضرة واستخراج التقارير ومتابعة نسب الحضور.
          </p>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '18px' }}>
            <Link
              href="/"
              className="btn btn-primary"
              style={{ fontSize: '13.5px', fontWeight: '800', padding: '10px 20px' }}
            >
              🚀 ابدأ محاضرة الآن
            </Link>
            <Link
              href="/reports"
              className="btn btn-ghost"
              style={{
                fontSize: '13.5px',
                fontWeight: '800',
                padding: '10px 20px',
                color: '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.35)',
                background: 'rgba(255,255,255,0.06)',
              }}
            >
              📄 عرض التقارير
            </Link>
          </div>
        </div>

        {/* Quick overview */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '10px',
            marginBottom: '20px',
          }}
        >
          {QUICK_STEPS.map((item, index) => (
            <div
              key={item.title}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '14px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: '22px' }}>
                {item.icon}
              </span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#111827' }}>
                  {index + 1}. {item.title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  {item.text}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Table of contents */}
        <nav
          aria-label="محتويات الدليل"
          style={{
            background: '#F9FAFB',
            border: '1px solid #E5E7EB',
            borderRadius: '14px',
            padding: '12px 14px',
            marginBottom: '20px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#374151', padding: '4px 0' }}>
            المحتويات:
          </span>
          {CONTENTS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              style={{
                fontSize: '12px',
                fontWeight: '700',
                color: '#1F2937',
                textDecoration: 'none',
                padding: '5px 10px',
                borderRadius: '999px',
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 1. Create lecture */}
          <GuideCard
            id="create"
            icon="📚"
            title="١) إنشاء محاضرة جديدة"
            subtitle="من الصفحة الرئيسية «الحضور»"
          >
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <Step n={1}>
                اختر <strong>المادة</strong> من القائمة. إن لم تظهر مواد، اطلب من رئيس القسم
                إسناد موادك إليك.
              </Step>
              <Step n={2}>
                اختر <strong>نوع الدراسة</strong>: الصباحية أو المسائية.
              </Step>
              <Step n={3}>
                اختر <strong>شعبة واحدة أو أكثر</strong> للمحاضرة (يمكن جمع أكثر من شعبة في نفس
                المحاضرة).
              </Step>
              <Step n={4}>
                اكتب <strong>اسم المحاضرة</strong> (مثال: «محاضرة 1 — الكيمياء السريرية»).
              </Step>
              <Step n={5}>
                اضغط <strong>«بدء المحاضرة وتشغيل الكاميرا»</strong>. ستفتح المحاضرة وتظهر شاشة
                قارئ الباركود.
              </Step>
            </ul>
            <Note tone="warn">
              لا يمكن تشغيل أكثر من محاضرة مفتوحة في الوقت نفسه لنفس التدريسي. أنهِ المحاضرة
              الحالية أولاً قبل بدء محاضرة جديدة.
            </Note>
          </GuideCard>

          {/* 2. Scanning */}
          <GuideCard
            id="scan"
            icon="📷"
            title="٢) تسجيل الحضور عبر الكاميرا"
            subtitle="أسرع طريقة لتسجيل الطلاب"
          >
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <Step n={1}>
                اسمح للمتصفح باستخدام الكاميرا عند ظهور الطلب.
              </Step>
              <Step n={2}>
                اضغط <strong>«تشغيل»</strong> في بطاقة «قارئ الباركود التلقائي» إن كانت متوقفة.
              </Step>
              <Step n={3}>
                وجّه <strong>بطاقة QR الخاصة بالطالب</strong> نحو الكاميرا. يُسجَّل الحضور فوراً
                ويظهر اسم الطالب في الجدول.
              </Step>
              <Step n={4}>
                يمكنك متابعة مسح الطلاب تِباعاً دون إيقاف الكاميرا. العدّادات أعلى الشاشة تُظهر
                عدد الحاضرين والغائبين والإجمالي.
              </Step>
            </ul>
            <Note>
              إذا ظهرت رسالة «تم تسجيل الحضور مسبقاً» فالطالب مسجّل بالفعل في هذه المحاضرة. وإذا
              كان مسجّلاً غائباً فسيتم تعديل حالته إلى حاضر تلقائياً.
            </Note>
          </GuideCard>

          {/* 3. Manual */}
          <GuideCard
            id="manual"
            icon="⌨️"
            title="٣) الإضافة اليدوية"
            subtitle="حل بديل عند تعذّر المسح"
          >
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <Step n={1}>
                في حقل <strong>«إضافة حضور يدوي»</strong> اكتب اسم الطالب أو رقم الباركود.
              </Step>
              <Step n={2}>
                اختر الطالب من نتائج البحث. يُضاف إلى قائمة المحاضرة مباشرة.
              </Step>
              <Step n={3}>
                يمكنك تغيير حالة أي طالب (حاضر/غائب) من الجدول قبل إنهاء المحاضرة.
              </Step>
            </ul>
            <Note>استخدم الإضافة اليدوية إذا كانت البطاقة تالفة أو غير موجودة.</Note>
          </GuideCard>

          {/* 4. Close */}
          <GuideCard id="close" icon="🏁" title="٤) إنهاء المحاضرة">
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <Step n={1}>
                عند انتهاء الوقت اضغط <strong>«إنهاء المحاضرة»</strong> في أعلى الصفحة.
              </Step>
              <Step n={2}>
                أكّد العملية من نافذة <strong>«تأكيد إنهاء المحاضرة»</strong>.
              </Step>
              <Step n={3}>
                يحسب النظام الغياب تلقائياً للطلاب غير المسجّلين، ثم يقفل المحاضرة وتُحتسب
                إحصاءاتها.
              </Step>
              <Step n={4}>
                بعد الإنهاء يمكنك <strong>تصدير كشف الحضور والغياب بصيغة PDF</strong> من نفس
                الشاشة.
              </Step>
            </ul>
            <Note tone="warn">
              لا تُنهِ المحاضرة قبل انتهاء الوقت الفعلي، لأن الإنهاء يقفل السجلات ولا تُقبل
              إضافات بعدها.
            </Note>
          </GuideCard>

          {/* 5. Reports */}
          <GuideCard
            id="reports"
            icon="📄"
            title="٥) تقارير المحاضرات"
            subtitle="من صفحة «التقارير» — تبويب «تقارير المحاضرات»"
          >
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <Step n={1}>
                افتح صفحة <strong>التقارير</strong> من شريط التنقل العلوي.
              </Step>
              <Step n={2}>
                استعرض محاضراتك، واضغط على أي محاضرة لعرض تفاصيل الحضور والغياب والنسب
                والملاحظات.
              </Step>
              <Step n={3}>
                استخدم أزرار <strong>التصدير إلى Excel</strong> أو <strong>PDF</strong> لحفظ كشف
                رسمي.
              </Step>
              <Step n={4}>
                الإحصاءات تُحسب على <strong>المحاضرات المنتهية فقط</strong>، لذلك لن تتغير أرقام
                المحاضرة قبل إنهائها.
              </Step>
            </ul>
          </GuideCard>

          {/* 6. Timetable */}
          <GuideCard
            id="timetable"
            icon="🗓️"
            title="٦) الجدول الأسبوعي"
            subtitle="تبويب «الجدول الأسبوعي» داخل صفحة التقارير"
          >
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <Step n={1}>
                يعرض الجدول حصصك حسب اليوم والوقت والقاعة ونوع الدراسة.
              </Step>
              <Step n={2}>
                استخدمه لمعرفة المحاضرة القادمة والشعبة المستهدفة قبل بدء التسجيل.
              </Step>
            </ul>
            <Note>
              تعديل الجدول من صلاحية الإدارة. إذا لاحظت خطأً في حصة أو قاعة، راجع المقرر.
            </Note>
          </GuideCard>

          {/* 7. Followup */}
          <GuideCard
            id="followup"
            icon="👥"
            title="٧) متابعة الطلاب"
            subtitle="رابط «متابعة الطلاب» في شريط التنقل"
          >
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <Step n={1}>
                اختر <strong>المادة</strong> (وإن أردت: المرحلة والشعبة) ثم استعرض القائمة.
              </Step>
              <Step n={2}>
                يظهر لكل طالب: عدد مرات <strong>الحضور</strong> و<strong>الغياب</strong> و
                <strong>إجمالي المحاضرات</strong> و<strong>نسبة الحضور</strong>.
              </Step>
              <Step n={3}>
                اضغط على اسم الطالب لعرض سجل محاضراته التفصيلي.
              </Step>
            </ul>
            <Note>
              إذا كنت تُدرّس أكثر من مادة، اختر المادة أولاً لأن النظام لا يدمج إحصاءات مواد
              مختلفة في رقم واحد.
            </Note>
          </GuideCard>

          {/* 8. Troubleshooting */}
          <GuideCard id="help" icon="🛠️" title="٨) مشاكل شائعة وحلولها">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                {
                  q: 'لا تظهر أي مادة عند إنشاء المحاضرة',
                  a: 'لم تُسند إليك مواد بعد. اطلب من رئيس القسم أو المقرر إسناد المادة من إدارة التعيينات.',
                },
                {
                  q: 'الكاميرا لا تعمل',
                  a: 'اسمح للمتصفح بالوصول للكاميرا، استخدم Chrome أو Edge، وتأكد أن كاميرا أخرى لا تستخدمها. أعد تحميل الصفحة ثم اضغط «تشغيل».',
                },
                {
                  q: 'الباركود لا يُقرأ',
                  a: 'حسّن الإضاءة، ثبّت البطاقة، ونظّفها من الانحناء أو الخدوش. وإذا استمرت المشكلة أضف الحضور يدوياً.',
                },
                {
                  q: 'لا أستطيع بدء محاضرة جديدة',
                  a: 'لديك محاضرة مفتوحة بالفعل. أنهِ المحاضرة الحالية ثم ابدأ الجديدة.',
                },
                {
                  q: 'الأرقام لا تتغير بعد المسح',
                  a: 'الإحصاءات الرسمية تُحتسب فقط بعد إنهاء المحاضرة. عدّادات الشاشة الحالية تظهر التسجيلات الفورية.',
                },
                {
                  q: 'نسيت كلمة المرور',
                  a: 'اطلب من المقرر إعادة تعيينها من صفحة الموظفين.',
                },
              ].map((item) => (
                <div
                  key={item.q}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#111827', marginBottom: '4px' }}>
                    ❓ {item.q}
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#4B5563', lineHeight: 1.85 }}>{item.a}</div>
                </div>
              ))}
            </div>
          </GuideCard>
        </div>

        {/* Footer CTA */}
        <div
          style={{
            marginTop: '20px',
            padding: '20px 22px',
            borderRadius: '18px',
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#111827' }}>
              جاهز لبدء محاضرتك؟
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '3px' }}>
              ارجع إلى الصفحة الرئيسية وابدأ التسجيل بخطوات بسيطة.
            </div>
          </div>
          <Link
            href="/"
            className="btn btn-primary"
            style={{ fontSize: '13.5px', fontWeight: '800', padding: '10px 22px' }}
          >
            الانتقال إلى الحضور
          </Link>
        </div>
      </div>
    </div>
  );
}
