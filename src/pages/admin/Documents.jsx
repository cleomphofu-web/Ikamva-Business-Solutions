const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifyDocumentShared } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Upload, Trash2, FileText, File, FileSpreadsheet, Presentation,
  Plus, Search, ExternalLink, Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import AdminLayout from '@/components/admin/AdminLayout';

const CATEGORIES = ['report', 'proposal', 'contract', 'presentation', 'other'];

const categoryColors = {
  report: 'bg-blue-100 text-blue-700',
  proposal: 'bg-violet-100 text-violet-700',
  contract: 'bg-orange-100 text-orange-700',
  presentation: 'bg-pink-100 text-pink-700',
  other: 'bg-gray-100 text-gray-600',
};

function fileIcon(type) {
  if (!type) return <FileText className="w-5 h-5 text-muted-foreground" />;
  if (type.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
  if (type.includes('xls') || type.includes('csv')) return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
  if (type.includes('ppt') || type.includes('pres')) return <Presentation className="w-5 h-5 text-orange-500" />;
  return <File className="w-5 h-5 text-blue-500" />;
}

const EMPTY_FORM = {
  client_email: '', title: '', description: '',
  category: 'other', shared_by: '', file: null,
};

export default function AdminDocuments() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['admin-documents'],
    queryFn: () => db.entities.SharedDocument.list('-created_date', 200),
  });

  const createMut = useMutation({
    mutationFn: async (data) => {
      const { file, ...rest } = data;
      let file_url = '';
      let file_name = '';
      let file_type = '';
      if (file) {
        const { file_url: url } = await db.integrations.Core.UploadFile({ file });
        file_url = url;
        file_name = file.name;
        file_type = file.name.split('.').pop().toLowerCase();
      }
      return db.entities.SharedDocument.create({ ...rest, file_url, file_name, file_type });
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['admin-documents'] });
      setModal(false);
      setForm(EMPTY_FORM);
      if (created?.client_email) notifyDocumentShared(created);
    },
  });

  const deleteMut = useMutation({
    mutationFn: id => db.entities.SharedDocument.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-documents'] }),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.file) return alert('Please select a file to upload.');
    if (!form.client_email || !form.title) return alert('Client email and title are required.');
    setUploading(true);
    createMut.mutate(form);
    setUploading(false);
  };

  const filtered = documents.filter(doc =>
    doc.title?.toLowerCase().includes(search.toLowerCase()) ||
    doc.client_email?.toLowerCase().includes(search.toLowerCase()) ||
    doc.shared_by?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-muted-foreground mt-1">Upload and manage files shared with clients.</p>
        </div>
        <Button onClick={() => setModal(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Upload Document
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by title, client, VA…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="bg-card rounded-2xl border border-border/50 p-12 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-semibold text-lg">No documents found</p>
          <p className="text-muted-foreground text-sm mt-1">Upload a document to share it with a client.</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(doc => (
          <div key={doc.id} className="bg-card rounded-2xl border border-border/50 p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                {fileIcon(doc.file_type)}
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${categoryColors[doc.category] || categoryColors.other}`}>
                {doc.category || 'other'}
              </span>
            </div>
            <h3 className="font-semibold text-sm mb-1 leading-tight">{doc.title}</h3>
            {doc.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{doc.description}</p>}
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Client:</span> {doc.client_email}
            </p>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
              <div>
                <p className="text-xs text-muted-foreground">{doc.shared_by || '—'}</p>
                {doc.created_date && (
                  <p className="text-xs text-muted-foreground">{format(new Date(doc.created_date), 'dd MMM yyyy')}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                  title="View file"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => { if (window.confirm('Delete this document?')) deleteMut.mutate(doc.id); }}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Upload Modal */}
      <Dialog open={modal} onOpenChange={v => { setModal(v); if (!v) setForm(EMPTY_FORM); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div>
              <Label>Client Email *</Label>
              <Input
                className="mt-1"
                placeholder="client@example.com"
                value={form.client_email}
                onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>Title *</Label>
              <Input
                className="mt-1"
                placeholder="Document title"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                className="mt-1"
                placeholder="Brief description (optional)"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Shared By (VA Name)</Label>
                <Input
                  className="mt-1"
                  placeholder="Your name"
                  value={form.shared_by}
                  onChange={e => setForm(f => ({ ...f, shared_by: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>File *</Label>
              <label className="mt-1 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition-colors">
                <Upload className="w-6 h-6 text-muted-foreground" />
                {form.file ? (
                  <span className="text-sm font-medium text-foreground">{form.file.name}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">Click to browse or drag & drop</span>
                )}
                <input
                  type="file"
                  className="hidden"
                  onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] || null }))}
                />
              </label>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => { setModal(false); setForm(EMPTY_FORM); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMut.isPending || uploading} className="gap-2">
                {(createMut.isPending || uploading) && <Loader2 className="w-4 h-4 animate-spin" />}
                Upload & Notify Client
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}