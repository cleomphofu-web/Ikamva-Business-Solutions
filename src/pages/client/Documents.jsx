import authService from '@/lib/auth-service';
import appServices from '@/lib/app-services';
import React, { useEffect, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '@/components/client/DashboardLayout';
import { FileText, Download, Search, File, Presentation, FileSpreadsheet, Sparkles } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { format, isWithinInterval, subHours } from 'date-fns';

const categoryColors = {
  report: 'bg-blue-100 text-blue-700',
  proposal: 'bg-violet-100 text-violet-700',
  contract: 'bg-orange-100 text-orange-700',
  presentation: 'bg-pink-100 text-pink-700',
  other: 'bg-gray-100 text-gray-600',
};

const fileIcon = (type) => {
  if (!type) return <FileText className="w-5 h-5 text-muted-foreground" />;
  if (type.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
  if (type.includes('xls') || type.includes('csv')) return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
  if (type.includes('ppt') || type.includes('pres')) return <Presentation className="w-5 h-5 text-orange-500" />;
  return <File className="w-5 h-5 text-blue-500" />;
};

function isNew(doc) {
  if (!doc.created_date) return false;
  try {
    return isWithinInterval(new Date(doc.created_date), { start: subHours(new Date(), 48), end: new Date() });
  } catch { return false; }
}

export default function Documents() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');

  useEffect(() => {
    authService.getCurrentUser().then(setUser);
  }, []);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['client-documents', user?.email],
    queryFn: () => appServices.records.SharedDocument.filter({ client_email: user.email }, '-created_date'),
    enabled: !!user?.email,
  });

  const filtered = documents.filter(doc => {
    const matchSearch = doc.title?.toLowerCase().includes(search.toLowerCase()) || doc.description?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || doc.category === filterCat;
    return matchSearch && matchCat;
  });

  const categories = ['all', ...Array.from(new Set(documents.map(d => d.category).filter(Boolean)))];
  const newCount = documents.filter(isNew).length;

  return (
    <DashboardLayout user={user}>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Documents</h1>
          <p className="text-muted-foreground mt-1">Files and documents shared by your virtual assistant.</p>
        </div>
        {newCount > 0 && (
          <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-full px-4 py-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">{newCount} new document{newCount > 1 ? 's' : ''} in the last 48 hours</span>
          </div>
        )}
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                filterCat === cat ? 'bg-primary text-primary-foreground' : 'bg-card border border-border/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="bg-card rounded-2xl border border-border/50 p-12 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-semibold text-lg">{documents.length === 0 ? 'No documents yet' : 'No results found'}</p>
          <p className="text-muted-foreground text-sm mt-1">
            {documents.length === 0 ? 'Documents shared by your VA will appear here.' : 'Try adjusting your search or filter.'}
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(doc => (
          <div
            key={doc.id}
            className={`bg-card rounded-2xl border p-5 hover:shadow-md transition-shadow group relative ${
              isNew(doc) ? 'border-primary/30 ring-1 ring-primary/10' : 'border-border/50'
            }`}
          >
            {isNew(doc) && (
              <span className="absolute top-3 right-3 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                New
              </span>
            )}
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                {fileIcon(doc.file_type)}
              </div>
              {!isNew(doc) && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${categoryColors[doc.category] || categoryColors.other}`}>
                  {doc.category || 'other'}
                </span>
              )}
            </div>
            <h3 className="font-semibold text-sm mb-1 leading-tight">{doc.title}</h3>
            {doc.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{doc.description}</p>}
            {doc.file_name && (
              <p className="text-xs text-muted-foreground mb-2 truncate">
                📎 {doc.file_name}
              </p>
            )}
            <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50">
              <div>
                <p className="text-xs text-muted-foreground">{doc.shared_by || 'Your VA'}</p>
                {doc.created_date && (
                  <p className="text-xs text-muted-foreground">{format(new Date(doc.created_date), 'dd MMM yyyy')}</p>
                )}
              </div>
              <a
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-full hover:bg-primary/90 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}