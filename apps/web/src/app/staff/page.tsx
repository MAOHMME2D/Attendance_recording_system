'use client';

import { useCallback, useEffect, useState } from 'react';
import Navbar from '../../components/layout/Navbar';
import { useAuth, PERMISSIONS, ROLE_LABELS } from '../../lib/auth';
import {
  ApiError,
  staffApi,
  type ManagedStaff,
  type StaffRole,
} from '../../lib/api';

type ManagedRole = Exclude<StaffRole, 'SYSTEM_OWNER'>;

const ALL_ROLE_OPTIONS: ManagedRole[] = [
  'HEAD_OF_DEPARTMENT',
  'REGISTRAR',
  'LECTURER',
  'TECHNICAL_LECTURER',
];

const REGISTRAR_ROLE_OPTIONS: ManagedRole[] = ['LECTURER', 'TECHNICAL_LECTURER'];

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'حدث خطأ غير متوقع';
}

function formatDate(value: string | null): string {
  if (!value) return 'لم يسجل الدخول بعد';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ar-IQ');
}

export default function StaffPage() {
  const { user, can } = useAuth();
  const canManage = can(PERMISSIONS.MANAGE_STAFF);
  const isRegistrar = user?.role === 'REGISTRAR';
  const roleOptions = isRegistrar ? REGISTRAR_ROLE_OPTIONS : ALL_ROLE_OPTIONS;

  const [staff, setStaff] = useState<ManagedStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    staffId: '',
    fullName: '',
    role: 'LECTURER' as ManagedRole,
    password: '',
  });

  const [editing, setEditing] = useState<ManagedStaff | null>(null);
  const [editForm, setEditForm] = useState({
    staffId: '',
    fullName: '',
    role: 'LECTURER' as ManagedRole,
  });

  const [resetTarget, setResetTarget] = useState<ManagedStaff | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStaff(await staffApi.list());
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    clearMessages();
    setBusy(true);
    try {
      const created = await staffApi.create({
        staffId: form.staffId.trim(),
        fullName: form.fullName.trim(),
        role: form.role,
        password: form.password,
      });
      setSuccess(`تم إنشاء حساب ${created.fullName} (${ROLE_LABELS[created.role]}).`);
      setForm({ staffId: '', fullName: '', role: form.role, password: '' });
      await load();
    } catch (createError) {
      setError(errorMessage(createError));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (member: ManagedStaff) => {
    clearMessages();
    setEditing(member);
    setEditForm({
      staffId: member.staffId,
      fullName: member.fullName,
      role: member.role as ManagedRole,
    });
  };

  const handleEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    clearMessages();
    setBusy(true);
    try {
      await staffApi.update(editing.id, {
        staffId: editForm.staffId.trim(),
        fullName: editForm.fullName.trim(),
        role: editForm.role,
      });
      setSuccess('تم تحديث بيانات الموظف.');
      setEditing(null);
      await load();
    } catch (editError) {
      setError(errorMessage(editError));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (member: ManagedStaff) => {
    clearMessages();
    const nextActive = !member.isActive;
    if (
      !nextActive &&
      !window.confirm(`تعطيل حساب ${member.fullName}؟ سيتم إنهاء جلساته الحالية.`)
    ) {
      return;
    }
    setBusy(true);
    try {
      await staffApi.setActive(member.id, nextActive);
      setSuccess(nextActive ? 'تم تفعيل الحساب.' : 'تم تعطيل الحساب وإنهاء جلساته.');
      await load();
    } catch (statusError) {
      setError(errorMessage(statusError));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resetTarget) return;
    clearMessages();
    setBusy(true);
    try {
      await staffApi.resetPassword(resetTarget.id, newPassword);
      setSuccess('تمت إعادة تعيين كلمة المرور وإنهاء جلسات الموظف.');
      setResetTarget(null);
      setNewPassword('');
    } catch (resetError) {
      setError(errorMessage(resetError));
    } finally {
      setBusy(false);
    }
  };

  const canEditMember = (member: ManagedStaff) =>
    member.role !== 'SYSTEM_OWNER' &&
    (isRegistrar
      ? member.role === 'LECTURER' || member.role === 'TECHNICAL_LECTURER'
      : true);

  const actionsFor = (member: ManagedStaff) => {
    const editable = canEditMember(member);
    const isOwner = member.role === 'SYSTEM_OWNER';
    const isSelf = member.id === user?.id;

    if (isOwner) {
      return (
        <span style={{ color: '#6B7280', fontSize: '12px' }}>
          حساب محمي — يُدار عبر CLI فقط
        </span>
      );
    }
    if (!editable) {
      return <span style={{ color: '#9CA3AF', fontSize: '12px' }}>خارج نطاق صلاحيتك</span>;
    }
    return (
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => startEdit(member)}
          disabled={busy}
        >
          تعديل
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            clearMessages();
            setResetTarget(member);
            setNewPassword('');
          }}
          disabled={busy}
        >
          كلمة المرور
        </button>
        <button
          type="button"
          className={member.isActive ? 'btn btn-danger btn-sm' : 'btn btn-success btn-sm'}
          onClick={() => toggleActive(member)}
          disabled={busy || isSelf}
          title={isSelf ? 'لا يمكنك تعطيل حسابك الحالي' : undefined}
        >
          {member.isActive ? 'تعطيل' : 'تفعيل'}
        </button>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ marginBottom: '22px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', marginBottom: '4px' }}>
            إدارة حسابات الموظفين
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            إنشاء المحاضرين والمحاضرين التقنيين، تعديل البيانات، تعطيل الحسابات، وإعادة تعيين
            كلمات المرور.
          </p>
        </div>

        {!canManage && (
          <div className="glass-card" style={{ padding: '16px', marginBottom: '18px', color: '#991B1B' }}>
            ليست لديك صلاحية إدارة الموظفين.
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              color: '#991B1B',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '16px',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            style={{
              background: '#ECFDF5',
              border: '1px solid #6EE7B7',
              color: '#065F46',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '16px',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            {success}
          </div>
        )}

        {canManage && (
          <section className="glass-card" style={{ padding: '20px', marginBottom: '22px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 800, marginBottom: '14px' }}>
              إنشاء حساب موظف
            </h2>
            <form
              onSubmit={handleCreate}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                gap: '12px',
                alignItems: 'end',
              }}
            >
              <label style={{ fontSize: '13px', fontWeight: 700 }}>
                معرف الموظف
                <input
                  className="input"
                  value={form.staffId}
                  onChange={(event) => setForm({ ...form, staffId: event.target.value })}
                  placeholder="مثال: lecturer2"
                  autoComplete="off"
                  required
                  style={{ marginTop: '6px', width: '100%' }}
                />
              </label>

              <label style={{ fontSize: '13px', fontWeight: 700 }}>
                الاسم الكامل
                <input
                  className="input"
                  value={form.fullName}
                  onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                  placeholder="اسم الموظف"
                  required
                  style={{ marginTop: '6px', width: '100%' }}
                />
              </label>

              <label style={{ fontSize: '13px', fontWeight: 700 }}>
                الصلاحية
                <select
                  className="input"
                  value={form.role}
                  onChange={(event) =>
                    setForm({ ...form, role: event.target.value as ManagedRole })
                  }
                  style={{ marginTop: '6px', width: '100%' }}
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ fontSize: '13px', fontWeight: 700 }}>
                كلمة المرور الأولية
                <input
                  className="input"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  placeholder="12 حرفًا مع رموز وأرقام"
                  autoComplete="new-password"
                  minLength={12}
                  required
                  style={{ marginTop: '6px', width: '100%' }}
                />
              </label>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy}
                style={{ height: '44px' }}
              >
                إنشاء الحساب
              </button>
            </form>
            <p style={{ marginTop: '10px', fontSize: '12px', color: '#6B7280' }}>
              كلمة المرور: 12 حرفًا على الأقل وتتضمن حرفًا كبيرًا وصغيرًا ورقمًا ورمزًا خاصًا.
              لا تُعرض كلمة المرور مرة أخرى بعد الحفظ.
            </p>
          </section>
        )}

        {editing && (
          <section className="glass-card" style={{ padding: '20px', marginBottom: '22px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 800, marginBottom: '14px' }}>
              تعديل: {editing.fullName}
            </h2>
            <form
              onSubmit={handleEdit}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                gap: '12px',
                alignItems: 'end',
              }}
            >
              <label style={{ fontSize: '13px', fontWeight: 700 }}>
                معرف الموظف
                <input
                  className="input"
                  value={editForm.staffId}
                  onChange={(event) =>
                    setEditForm({ ...editForm, staffId: event.target.value })
                  }
                  required
                  style={{ marginTop: '6px', width: '100%' }}
                />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 700 }}>
                الاسم الكامل
                <input
                  className="input"
                  value={editForm.fullName}
                  onChange={(event) =>
                    setEditForm({ ...editForm, fullName: event.target.value })
                  }
                  required
                  style={{ marginTop: '6px', width: '100%' }}
                />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 700 }}>
                الصلاحية
                <select
                  className="input"
                  value={editForm.role}
                  onChange={(event) =>
                    setEditForm({ ...editForm, role: event.target.value as ManagedRole })
                  }
                  style={{ marginTop: '6px', width: '100%' }}
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  حفظ
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setEditing(null)}
                  disabled={busy}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </section>
        )}

        {resetTarget && (
          <section className="glass-card" style={{ padding: '20px', marginBottom: '22px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 800, marginBottom: '14px' }}>
              إعادة تعيين كلمة مرور: {resetTarget.fullName}
            </h2>
            <form
              onSubmit={handleReset}
              style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'end' }}
            >
              <label style={{ fontSize: '13px', fontWeight: 700, flex: '1 1 240px' }}>
                كلمة المرور الجديدة
                <input
                  className="input"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={12}
                  required
                  style={{ marginTop: '6px', width: '100%' }}
                />
              </label>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                تعيين كلمة المرور
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setResetTarget(null);
                  setNewPassword('');
                }}
                disabled={busy}
              >
                إلغاء
              </button>
            </form>
            <p style={{ marginTop: '10px', fontSize: '12px', color: '#6B7280' }}>
              سيتم إنهاء جميع جلسات الموظف الحالية بعد إعادة التعيين.
            </p>
          </section>
        )}

        <section className="glass-card" style={{ padding: '8px 0' }}>
          {loading ? (
            <p style={{ padding: '24px', color: '#6B7280' }}>جارٍ تحميل الموظفين...</p>
          ) : staff.length === 0 ? (
            <p style={{ padding: '24px', color: '#6B7280' }}>لا توجد حسابات موظفين بعد.</p>
          ) : (
            <>
              <div className="staff-table-scroll">
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
                  <thead>
                    <tr style={{ textAlign: 'right', color: '#6B7280', fontSize: '12.5px' }}>
                      <th style={{ padding: '12px 18px', fontWeight: 700 }}>الاسم</th>
                      <th style={{ padding: '12px 10px', fontWeight: 700 }}>المعرف</th>
                      <th style={{ padding: '12px 10px', fontWeight: 700 }}>الصلاحية</th>
                      <th style={{ padding: '12px 10px', fontWeight: 700 }}>الحالة</th>
                      <th style={{ padding: '12px 10px', fontWeight: 700 }}>آخر دخول</th>
                      <th style={{ padding: '12px 10px', fontWeight: 700 }}>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((member) => {
                      const isSelf = member.id === user?.id;
                      return (
                        <tr
                          key={member.id}
                          style={{ borderTop: '1px solid #F3F4F6', fontSize: '13px' }}
                        >
                          <td style={{ padding: '14px 18px', fontWeight: 700 }}>
                            {member.fullName}
                            {isSelf && (
                              <span style={{ marginInlineStart: '6px', color: '#6B7280', fontWeight: 500 }}>
                                (حسابك)
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '14px 10px', direction: 'ltr', textAlign: 'right' }}>
                            {member.staffId}
                          </td>
                          <td style={{ padding: '14px 10px' }}>{ROLE_LABELS[member.role] || member.role}</td>
                          <td style={{ padding: '14px 10px' }}>
                            <span
                              className={`badge ${member.isActive ? 'badge-active' : 'badge-closed'}`}
                            >
                              {member.isActive ? 'فعّال' : 'معطّل'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 10px', color: '#6B7280' }}>
                            {formatDate(member.lastLoginAt)}
                          </td>
                          <td style={{ padding: '14px 10px' }}>{actionsFor(member)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Phones/tablets: a card per member instead of a clipped table. */}
              <div className="staff-mobile-list">
                {staff.map((member) => {
                  const isSelf = member.id === user?.id;
                  return (
                    <div
                      key={member.id}
                      style={{
                        border: '1px solid #E5E7EB',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        background: '#FFFFFF',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: '10px',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#111827' }}>
                            {member.fullName}
                            {isSelf && (
                              <span style={{ marginInlineStart: '6px', color: '#6B7280', fontWeight: 500, fontSize: '12px' }}>
                                (حسابك)
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              direction: 'ltr',
                              textAlign: 'right',
                              fontSize: '12px',
                              color: '#6B7280',
                              marginTop: '2px',
                            }}
                          >
                            {member.staffId}
                          </div>
                        </div>
                        <span
                          className={`badge ${member.isActive ? 'badge-active' : 'badge-closed'}`}
                        >
                          {member.isActive ? 'فعّال' : 'معطّل'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#4B5563', marginTop: '8px' }}>
                        {ROLE_LABELS[member.role] || member.role}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                        آخر دخول: {formatDate(member.lastLoginAt)}
                      </div>
                      <div style={{ marginTop: '10px' }}>{actionsFor(member)}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <p style={{ marginTop: '16px', fontSize: '12px', color: '#6B7280', lineHeight: 1.8 }}>
          جميع عمليات الإنشاء والتعديل والتعطيل وإعادة تعيين كلمة المرور محمية من جهة الخادم
          وتُسجَّل في سجل التدقيق. لا يمكن تعطيل آخر حساب رئيس قسم فعّال، ولا يمكن للمسجل إدارة
          حساب رئيس القسم أو حساب مالك النظام التجريبي.
        </p>
      </main>

      <style jsx>{`
        .staff-table-scroll {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .staff-mobile-list {
          display: none;
          flex-direction: column;
          gap: 10px;
          padding: 8px 12px;
        }
        @media (max-width: 720px) {
          .staff-table-scroll {
            display: none;
          }
          .staff-mobile-list {
            display: flex;
          }
        }
      `}</style>
    </div>
  );
}
