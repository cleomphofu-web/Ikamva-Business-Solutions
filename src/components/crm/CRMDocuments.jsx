const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Plus, X, Save, Loader2, FolderOpen, Trash2, Upload, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const CATEGORY_CONFIG = {
  report: { label: 'Report', color: 'bg-blue-100 text-blue-700' },
  proposal: { label: 'Proposal', color: 'bg-violet-100 text-violet-700' },
  contract: { label: 'Contract', color: 'bg-amber-100 text-amber-700' },
  presentation: { label: 'Presentation', color: 'bg-pink-100 text-pink-700' },
  other: { label: 'Other', color: 'bg-slate-100 text-slate-600' },
};

function DocModal({ onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', description: '', client_email: '', category: 'other', file_url: '', file_name: '' });
  const [uploading, setUploading] = useState(false);

  const { data: users = [] } = useQuery({ queryKey: ['crm-users'], queryFn: () => db.entities.User.list() });
  const clients = users.filter(u => u.role !== 'admin');

  const create = useMutation({
    mutationFn: data => db.entities.SharedDocument.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-docs'] }); toast.success('Document shared'); onClose(); },
  });

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, file_url, file_name: file.name }));
      if (!form.title) setForm(f => ({ ...f, title: file.name.replace(/\.[^.]+$/, '') }));
    } catch { toast.error('Upload failed'); }
    setUploading(false);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const clearFile = () => { setForm(f => ({ ...f, file_url: '', file_name: '' })); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white">
          <h3 className="font-bold text-slate-900">Share Document</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Title *</label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Document title" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Client</label>
            <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white" value={form.client_email} onChange={e => set('client_email', e.target.value)}>
              <option value="">Select client…</option>
              {clients.map(c => <option key={c.id} value={c.email}>{c.full_name || c.email}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Category</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white" value={form.category} onChange={e => set('category', e.target.value)}>
                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Description</label>
              <Input value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="Brief description" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">File *</label>
            {form.file_url ? (
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <FileText className="w-4 h-4 text-indigo-500" />
                <span className="text-sm text-slate-700 flex-1 truncate">{form.file_name}</span>
                <button onClick={clearFile} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-indigo-300 transition-colors">
                {uploading ? <Loader2 className="w-5 h-5 text-slate-400 animate-spin" /> : <Upload className="w-5 h-5 text-slate-400" />}
                <span className="text-xs text-slate-500">{uploading ? 'Uploading…' : 'Click to upload'}</span>
                <input type="file" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
              </label>
            )}
          </div>
        </div>
        <div className="flex gap-2 justify-end p-5 border-t border-slate-200">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!form.title || !form.file_url || create.isPending} className="bg-indigo-600 hover:bg-indigo-700" onClick={() => create.mutate(form)}>
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Share Document
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CRMDocuments() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [filterCat, setFilterCat] = useState('all');

  const { data: docs = [], isLoading } = useQuery({ queryKey: ['crm-docs'], queryFn: () => db.entities.SharedDocument.list('-created_date') });

  const deleteDoc = useMutation({
    mutationFn: id => db.entities.SharedDocument.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-docs'] }); toast.success('Document deleted'); },
  });

  const filtered = filterCat === 'all' ? docs : docs.filter(d => d.category === filterCat);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Documents</h1>
          <p className="text-sm text-slate-500 mt-0.5">{docs.length} shared documents</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 gap-1.5" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" /> Share Document
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {['all', ...Object.keys(CATEGORY_CONFIG)].map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${filterCat === c ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {c === 'all' ? 'All Categories' : CATEGORY_CONFIG[c].label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <FolderOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No documents found</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doc => {
            const cat = CATEGORY_CONFIG[doc.category] || CATEGORY_CONFIG.other;
            return (
              <div key={doc.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cat.color}`}>{cat.label}</span>
                </div>
                <p className="font-semibold text-slate-900 truncate mb-1">{doc.title}</p>
                {doc.description && <p className="text-xs text-slate-400 mb-2 line-clamp-2">{doc.description}</p>}
                {doc.client_email && <p className="text-xs text-slate-500 mb-3">{doc.client_email}</p>}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex-1 text-xs text-indigo-600 hover:underline flex items-center gap-1">
                    <Download className="w-3 h-3" /> Download
                  </a>
                  <button className="p-1 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteDoc.mutate(doc.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && <DocModal onClose={() => setShowModal(false)} />}
    </div>
  );
}