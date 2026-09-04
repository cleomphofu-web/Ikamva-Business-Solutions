import appServices from '@/lib/app-services';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { UserCog, Shield, Mail, Loader2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format } from 'date-fns';

const ROLE_CONFIG = {
  admin: { label: 'Admin', color: 'bg-indigo-100 text-indigo-700', icon: Shield },
  user: { label: 'User', color: 'bg-slate-100 text-slate-600', icon: UserCog },
};

function InviteModal({ onClose }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
    if (!email) return;
    setLoading(true);
    try {
      await db.users.inviteUser(email, role);
      toast.success(`Invitation sent to ${email}`);
      onClose();
    } catch (e) {
      toast.error('Failed to send invitation');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-900">Invite User</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Email Address *</label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Role</label>
            <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white" value={role} onChange={e => setRole(e.target.value)}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!email || loading} className="bg-indigo-600 hover:bg-indigo-700" onClick={handleInvite}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Send Invite
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CRMUsers() {
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [search, setSearch] = useState('');

  const { data: users = [], isLoading } = useQuery({ queryKey: ['crm-users'], queryFn: () => appServices.records.User.list() });
  const { data: services = [] } = useQuery({ queryKey: ['crm-all-services'], queryFn: () => appServices.records.ClientService.list() });

  const updateRole = useMutation({
    mutationFn: ({ id, role }) => appServices.records.User.update(id, { role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-users'] }); toast.success('Role updated'); },
  });

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const admins = users.filter(u => u.role === 'admin').length;
  const regularUsers = users.filter(u => u.role !== 'admin').length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">{users.length} total · {admins} admins · {regularUsers} users</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 gap-1.5" onClick={() => setShowInvite(true)}>
          <UserPlus className="w-4 h-4" /> Invite User
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <Input className="h-8 text-sm" placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Role</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Service</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase hidden lg:table-cell">Joined</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const role = ROLE_CONFIG[u.role] || ROLE_CONFIG.user;
                const Icon = role.icon;
                const service = services.find(s => s.client_email === u.email && s.status === 'active');
                return (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center">
                          <span className="text-xs font-bold text-white">{(u.full_name || u.email)[0].toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{u.full_name || '—'}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <select value={u.role || 'user'} onChange={e => updateRole.mutate({ id: u.id, role: e.target.value })}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border cursor-pointer bg-transparent ${role.color}`}>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      {service ? (
                        <span className="text-xs text-slate-600 capitalize">{service.plan} · {service.hours_used || 0}h/{service.hours_allocated}h</span>
                      ) : <span className="text-xs text-slate-300">No active service</span>}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-xs text-slate-400">
                      {u.created_date ? format(new Date(u.created_date), 'dd MMM yyyy') : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs ${role.color} px-2 py-0.5 rounded-full`}>
                        <Icon className="w-3 h-3" />{role.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}