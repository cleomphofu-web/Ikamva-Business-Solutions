const SIGNUP_INQUIRY_SERVICE = 'signup_application';
const SIGNUP_INQUIRY_PLAN = 'application';

export const isMissingTableError = error =>
  error?.code === 'PGRST205' ||
  /schema cache/i.test(error?.message || '') ||
  /could not find the table/i.test(error?.message || '');

export const applicationStatusFromInquiryStatus = status => {
  switch (status) {
    case 'new':
    case 'in_review':
    case 'contacted':
      return 'pending';
    case 'converted':
      return 'approved';
    case 'closed':
      return 'rejected';
    default:
      return status || 'missing';
  }
};

export const inquiryStatusFromApplicationStatus = status => {
  switch (status) {
    case 'approved':
      return 'converted';
    case 'rejected':
      return 'closed';
    case 'pending':
    default:
      return 'new';
  }
};

export const parseMaybeJson = value => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const encodeSignupNotes = payload =>
  JSON.stringify({
    source: SIGNUP_INQUIRY_SERVICE,
    user_id: payload.user_id,
    email: payload.email,
    full_name: payload.full_name,
    company_name: payload.company_name || null,
    phone: payload.phone || null,
  });

export const decodeSignupNotes = notes => {
  const parsed = parseMaybeJson(notes);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  return parsed;
};

export const isSignupInquiry = row => {
  if (!row) return false;
  if (row.service === SIGNUP_INQUIRY_SERVICE) return true;
  const notes = decodeSignupNotes(row.notes);
  return notes?.source === SIGNUP_INQUIRY_SERVICE;
};

export const normalizeApplicationRecord = (record, source) => {
  if (!record) return null;

  if (source === 'inquiries') {
    const notes = decodeSignupNotes(record.notes) || {};
    return {
      id: record.id,
      user_id: notes.user_id || null,
      email: record.email || notes.email || '',
      full_name: notes.full_name || record.name || '',
      company_name: notes.company_name || record.company || null,
      phone: notes.phone || record.phone || null,
      status: applicationStatusFromInquiryStatus(record.status),
      reviewed_by: notes.reviewed_by || null,
      reviewed_at: notes.reviewed_at || null,
      created_at: record.created_date || null,
      updated_at: record.updated_date || null,
      notes: record.notes || null,
      source,
    };
  }

  return {
    id: record.id,
    user_id: record.user_id || null,
    email: record.email || '',
    full_name: record.full_name || '',
    company_name: record.company_name || null,
    phone: record.phone || null,
    status: record.status || 'missing',
    reviewed_by: record.reviewed_by || null,
    reviewed_at: record.reviewed_at || null,
    created_at: record.created_at || null,
    updated_at: record.updated_at || null,
    notes: record.notes || null,
    source,
  };
};

async function readClientApplicationByUserId(supabaseAdmin, userId) {
  const { data, error } = await supabaseAdmin
    .from('client_applications')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return { record: null, error };
  }

  return { record: data, error: null };
}

async function readInquiryByEmail(supabaseAdmin, email) {
  const { data, error } = await supabaseAdmin
    .from('inquiries')
    .select('*')
    .eq('email', email)
    .eq('service', SIGNUP_INQUIRY_SERVICE)
    .order('created_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { record: null, error };
  }

  return { record: data, error: null };
}

async function readClientApplicationById(supabaseAdmin, id) {
  const { data, error } = await supabaseAdmin
    .from('client_applications')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return { record: null, error };
  }

  return { record: data, error: null };
}

async function readInquiryById(supabaseAdmin, id) {
  const { data, error } = await supabaseAdmin
    .from('inquiries')
    .select('*')
    .eq('id', id)
    .eq('service', SIGNUP_INQUIRY_SERVICE)
    .maybeSingle();

  if (error) {
    return { record: null, error };
  }

  return { record: data, error: null };
}

async function upsertInquiryApplication(supabaseAdmin, payload) {
  const existing = await readInquiryByEmail(supabaseAdmin, payload.email);
  if (existing.error) {
    return { record: null, error: existing.error };
  }

  const baseValues = {
    name: payload.full_name,
    email: payload.email,
    phone: payload.phone || null,
    company: payload.company_name || null,
    service: SIGNUP_INQUIRY_SERVICE,
    plan: SIGNUP_INQUIRY_PLAN,
    message: 'Signup application submitted.',
    notes: encodeSignupNotes(payload),
  };

  if (existing.record) {
    const { data, error } = await supabaseAdmin
      .from('inquiries')
      .update({
        ...baseValues,
      })
      .eq('id', existing.record.id)
      .select('*')
      .maybeSingle();

    if (error) {
      return { record: null, error };
    }

    return { record: data, error: null };
  }

  const { data, error } = await supabaseAdmin
    .from('inquiries')
    .insert({
      ...baseValues,
      status: 'new',
    })
    .select('*')
    .maybeSingle();

  if (error) {
    return { record: null, error };
  }

  return { record: data, error: null };
}

async function updateInquiryStatus(supabaseAdmin, id, status, reviewerId) {
  const existing = await readInquiryById(supabaseAdmin, id);
  if (existing.error) {
    return { record: null, error: existing.error };
  }

  if (!existing.record) {
    return { record: null, error: null };
  }

  const notes = decodeSignupNotes(existing.record.notes) || {};
  const updatedNotes = JSON.stringify({
    ...notes,
    source: notes.source || SIGNUP_INQUIRY_SERVICE,
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
  });

  const { data, error } = await supabaseAdmin
    .from('inquiries')
    .update({
      status,
      notes: updatedNotes,
    })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    return { record: null, error };
  }

  return { record: data, error: null };
}

async function listInquiryApplications(supabaseAdmin, status) {
  let query = supabaseAdmin
    .from('inquiries')
    .select('*')
    .eq('service', SIGNUP_INQUIRY_SERVICE)
    .order('created_date', { ascending: false });

  if (status === 'pending') {
    query = query.in('status', ['new', 'in_review', 'contacted']);
  } else if (status === 'approved') {
    query = query.eq('status', 'converted');
  } else if (status === 'rejected') {
    query = query.eq('status', 'closed');
  } else if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) {
    return { records: null, error };
  }

  return { records: data ?? [], error: null };
}

export async function findApplicationForUser({ supabaseAdmin, userId, email }) {
  const primary = await readClientApplicationByUserId(supabaseAdmin, userId);
  if (primary.error && !isMissingTableError(primary.error)) {
    return { record: null, source: 'client_applications', error: primary.error };
  }

  if (primary.record) {
    return {
      record: normalizeApplicationRecord(primary.record, 'client_applications'),
      source: 'client_applications',
      error: null,
    };
  }

  if (!email) {
    return { record: null, source: 'client_applications', error: null };
  }

  const inquiry = await readInquiryByEmail(supabaseAdmin, email);
  if (inquiry.error) {
    return { record: null, source: 'inquiries', error: inquiry.error };
  }

  return {
    record: inquiry.record ? normalizeApplicationRecord(inquiry.record, 'inquiries') : null,
    source: 'inquiries',
    error: null,
  };
}

export async function loadApplicationById({ supabaseAdmin, id }) {
  const primary = await readClientApplicationById(supabaseAdmin, id);
  if (primary.error && !isMissingTableError(primary.error)) {
    return { record: null, source: 'client_applications', error: primary.error };
  }

  if (primary.record) {
    return {
      record: normalizeApplicationRecord(primary.record, 'client_applications'),
      source: 'client_applications',
      error: null,
    };
  }

  const inquiry = await readInquiryById(supabaseAdmin, id);
  if (inquiry.error) {
    return { record: null, source: 'inquiries', error: inquiry.error };
  }

  return {
    record: inquiry.record ? normalizeApplicationRecord(inquiry.record, 'inquiries') : null,
    source: 'inquiries',
    error: null,
  };
}

export async function listApplicationsFromStore({ supabaseAdmin, status }) {
  const primary = await supabaseAdmin
    .from('client_applications')
    .select('*')
    .order('created_at', { ascending: false });

  if (!primary.error) {
    const records = (status ? primary.data?.filter(row => row.status === status) : primary.data ?? []).map(row =>
      normalizeApplicationRecord(row, 'client_applications')
    );
    return { records, source: 'client_applications', error: null };
  }

  if (!isMissingTableError(primary.error)) {
    return { records: null, source: 'client_applications', error: primary.error };
  }

  const inquiry = await listInquiryApplications(supabaseAdmin, status);
  if (inquiry.error) {
    return { records: null, source: 'inquiries', error: inquiry.error };
  }

  return {
    records: inquiry.records.map(row => normalizeApplicationRecord(row, 'inquiries')),
    source: 'inquiries',
    error: null,
  };
}

export async function createApplicationInStore({ supabaseAdmin, payload }) {
  const primary = await supabaseAdmin
    .from('client_applications')
    .upsert({
      user_id: payload.user_id,
      email: payload.email,
      full_name: payload.full_name,
      company_name: payload.company_name || null,
      phone: payload.phone || null,
    }, { onConflict: 'user_id' })
    .select('*')
    .maybeSingle();

  if (!primary.error) {
    return { record: normalizeApplicationRecord(primary.data, 'client_applications'), source: 'client_applications', error: null };
  }

  if (!isMissingTableError(primary.error)) {
    return { record: null, source: 'client_applications', error: primary.error };
  }

  const inquiry = await upsertInquiryApplication(supabaseAdmin, payload);
  if (inquiry.error) {
    return { record: null, source: 'inquiries', error: inquiry.error };
  }

  return { record: normalizeApplicationRecord(inquiry.record, 'inquiries'), source: 'inquiries', error: null };
}

export async function reviewApplicationInStore({ supabaseAdmin, id, status, reviewerId, tenantFactory }) {
  const primary = await readClientApplicationById(supabaseAdmin, id);
  if (primary.error && !isMissingTableError(primary.error)) {
    return { record: null, source: 'client_applications', error: primary.error };
  }

  if (primary.record) {
    if (status === 'approved') {
      return { record: primary.record, source: 'client_applications', error: null, needsProvisioning: true };
    }

    const { data, error } = await supabaseAdmin
      .from('client_applications')
      .update({
        status: 'rejected',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      return { record: null, source: 'client_applications', error };
    }

    return { record: normalizeApplicationRecord(data, 'client_applications'), source: 'client_applications', error: null };
  }

  const inquiry = await readInquiryById(supabaseAdmin, id);
  if (inquiry.error && !isMissingTableError(inquiry.error)) {
    return { record: null, source: 'inquiries', error: inquiry.error };
  }

  if (!inquiry.record) {
    return { record: null, source: 'inquiries', error: null };
  }

  const nextStatus = status === 'approved' ? 'converted' : 'closed';
  const updated = await updateInquiryStatus(supabaseAdmin, id, nextStatus, reviewerId);
  if (updated.error) {
    return { record: null, source: 'inquiries', error: updated.error };
  }

  return {
    record: normalizeApplicationRecord(updated.record, 'inquiries'),
    source: 'inquiries',
    error: null,
  };
}
