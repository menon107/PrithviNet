import React, { useState } from 'react';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { SectionHeader, Modal, AlertBanner, Spinner } from '../../components/common/UI';
import { authAPI, regionsAPI, industriesAPI } from '../../services/api';
import { ROLE_LABELS, ROLE_COLORS } from '../../utils/helpers';

export default function AdminUsers() {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: 'TempPass@123', role: 'regional_officer', region_id: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true); setError(''); setSuccess('');
    try {
      await authAPI.createUser(form);
      setSuccess(`User ${form.name} (${ROLE_LABELS[form.role]}) created successfully.`);
      setShowModal(false);
      setForm({ name: '', email: '', password: 'TempPass@123', role: 'regional_officer', region_id: '', phone: '' });
    } catch (err) { setError(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="User Management" subtitle="Create officer and admin accounts"
        actions={<button className="btn-primary text-sm" onClick={() => setShowModal(true)}>+ Create User</button>} />
      <PageContent>
        {success && <AlertBanner type="success" message={success} />}
        <div className="card p-8 flex flex-col items-center justify-center text-center mt-8">
          <div className="text-4xl mb-3">👥</div>
          <p style={{ fontFamily: 'Syne', fontWeight: 700, color: 'var(--text-primary)', fontSize: 18 }}>User Management</p>
          <p className="text-sm mt-2 max-w-md" style={{ color: 'var(--text-secondary)' }}>
            Create Regional Officer and admin accounts. Industry users and citizens self-register.
            Use the button above to create a new account.
          </p>
        </div>
      </PageContent>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create User Account">
        <form onSubmit={handleCreate} className="space-y-4">
          {error && <AlertBanner type="error" message={error} />}
          <div>
            <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>Role</label>
            <select className="input" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
              <option value="regional_officer">Regional Officer</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          {[{k:'name',l:'Full Name',t:'text'},{k:'email',l:'Email',t:'email'},{k:'password',l:'Temp Password',t:'text'},{k:'phone',l:'Phone',t:'tel'}].map(({k,l,t}) => (
            <div key={k}>
              <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>{l}</label>
              <input className="input" type={t} required={k!=='phone'} value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})} />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">{saving ? <Spinner size="sm"/> : 'Create Account'}</button>
            <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
