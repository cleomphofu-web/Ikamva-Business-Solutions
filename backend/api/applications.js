import supabaseAdmin from '../lib/supabase-admin.js';
import {
  createApplicationInStore,
  loadApplicationById,
  listApplicationsFromStore,
  parseMaybeJson,
} from './application-store.js';

const json = (res, statusCode, payload) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
};

const getRequestPath = req => new URL(req.url ?? '/', 'http://localhost').pathname;

const getBearerToken = req => (req.headers['authorization'] ?? '').replace(/^Bearer\s+/i, '').trim();

export async function authenticateRequest(req, { client = supabaseAdmin } = {}) {
  const jwt = getBearerToken(req);
  if (!jwt) throw Object.assign(new Error('Missing Authorization header'), { status: 401 });
  const { data: authData, error: authError } = await client.auth.getUser(jwt);
  if (authError || !authData?.user) throw Object.assign(new Error('Invalid or expired token'), { status: 401 });
  return authData.user;
}

async function getAuthenticatedUser(req) {
  return authenticateRequest(req);
}

const isAdminUser = user => {
  const role = user?.app_metadata?.role;
  return role === 'admin' || role === 'platform_admin';
};

const readJson = req =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });

const startOfMonth = date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
const addOneMonth = date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())).toISOString().slice(0, 10);

const slugify = value =>
  String(value || 'ikamva')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'ikamva';

export const tenantSlugForApplication = application =>
  `${slugify(application?.company_name || application?.full_name || application?.email)}-${String(application?.user_id || '').slice(0, 8)}`;

async function getAdminUser(req) {
  const user = await getAuthenticatedUser(req);
  if (!isAdminUser(user)) {
    throw Object.assign(new Error('Admin access required'), { status: 403 });
  }
  return user;
}

function logSupabaseFailure(context, error) {
  console.error(`[applications] ${context} failed:`, {
    message: error?.message,
    code: error?.code,
    status: error?.status,
    cause: error?.cause,
  });
}

async function createTenantResources(application, reviewerId) {
  const companyName = application.company_name || application.full_name || application.email || 'Ikamva Workspace';
  const slug = tenantSlugForApplication(application);
  const now = new Date();
  const billingCycleStart = startOfMonth(now);
  const billingCycleEnd = addOneMonth(now);

  const existingTenant = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (existingTenant.error) throw existingTenant.error;

  const insertedTenant = existingTenant.data
    ? { data: existingTenant.data, error: null }
    : await supabaseAdmin
      .from('tenants')
      .insert({ name: companyName, slug, status: 'active' })
      .select()
      .maybeSingle();

  if (insertedTenant.error) throw insertedTenant.error;
  const tenant = insertedTenant.data;

  if (!tenant) {
    throw new Error('Unable to provision tenant.');
  }

  const tenantUserResult = await supabaseAdmin
    .from('tenant_users')
    .upsert({
      tenant_id: tenant.id,
      user_id: application.user_id,
      email: application.email,
      full_name: application.full_name,
      role: 'owner',
      status: 'active',
    }, { onConflict: 'tenant_id,user_id' })
    .select()
    .maybeSingle();

  if (tenantUserResult.error) {
    throw tenantUserResult.error;
  }

  const clientProfileResult = await supabaseAdmin
    .from('client_profiles')
    .upsert({
      tenant_id: tenant.id,
      tenant_user_id: tenantUserResult.data?.id ?? null,
      client_email: application.email,
      company_name: application.company_name || application.full_name,
      monthly_task_limit: 100,
      tasks_used_this_month: 0,
      billing_cycle_start: billingCycleStart,
      billing_cycle_end: billingCycleEnd,
      status: 'active',
    }, { onConflict: 'tenant_id,client_email' })
    .select()
    .maybeSingle();

  if (clientProfileResult.error) {
    throw clientProfileResult.error;
  }

  return {
    tenant,
    tenant_user: tenantUserResult.data,
    client_profile: clientProfileResult.data,
  };
}

export async function handleApplicationsRequest(req, res) {
  const path = getRequestPath(req);
  const method = (req.method ?? 'GET').toUpperCase();

  if (method === 'POST' && path === '/api/v1/applications') {
    let authenticatedUser;
    try {
      authenticatedUser = await getAuthenticatedUser(req);
    } catch (error) {
      return json(res, error.status || 401, { error: error.message || 'Unauthorized' });
    }

    let body;
    try {
      body = await readJson(req);
    } catch {
      return json(res, 400, { error: 'Invalid JSON body' });
    }

    const { email, full_name, company_name, phone } = body ?? {};
    if (!email || !full_name) {
      return json(res, 400, { error: 'email and full_name are required' });
    }
    if (String(email).trim().toLowerCase() !== String(authenticatedUser.email || '').trim().toLowerCase()) {
      return json(res, 403, { error: 'Application email must match the authenticated account' });
    }

    const { record, error } = await createApplicationInStore({
      supabaseAdmin,
      payload: { user_id: authenticatedUser.id, email: authenticatedUser.email, full_name, company_name, phone },
    });

    if (error) {
      logSupabaseFailure('create application', error);
      return json(res, 500, { error: error.message || 'Failed to create application' });
    }

    return json(res, 201, { application: record });
  }

  if (method === 'GET' && path === '/api/v1/applications') {
    try {
      await getAdminUser(req);
    } catch (error) {
      return json(res, error.status || 401, { error: error.message || 'Unauthorized' });
    }

    const url = new URL(req.url ?? '/', 'http://localhost');
    const status = url.searchParams.get('status');

    const { records, error } = await listApplicationsFromStore({
      supabaseAdmin,
      status: status || undefined,
    });

    if (error) {
      logSupabaseFailure('list applications', error);
      return json(res, 500, { error: error.message || 'Failed to load applications' });
    }

    return json(res, 200, { applications: records ?? [] });
  }

  if (method === 'PATCH' && path.startsWith('/api/v1/applications/')) {
    const id = path.slice('/api/v1/applications/'.length);
    if (!id) {
      return json(res, 400, { error: 'Missing application id' });
    }

    let adminUser;
    try {
      adminUser = await getAdminUser(req);
    } catch (error) {
      return json(res, error.status || 401, { error: error.message || 'Unauthorized' });
    }

    let body;
    try {
      body = await readJson(req);
    } catch {
      return json(res, 400, { error: 'Invalid JSON body' });
    }

    const desiredStatus = body?.status;
    if (!['approved', 'rejected'].includes(desiredStatus)) {
      return json(res, 400, { error: 'status must be approved or rejected' });
    }

    const { record: application, source, error: applicationError } = await loadApplicationById({
      supabaseAdmin,
      id,
    });

    if (applicationError) {
      logSupabaseFailure('load application', applicationError);
      return json(res, 500, { error: applicationError.message || 'Failed to load application' });
    }

    if (!application) {
      return json(res, 404, { error: 'Application not found' });
    }

    if (desiredStatus === 'approved') {
      try {
        const result = await createTenantResources(application, adminUser.id);

        const reviewTimestamp = new Date().toISOString();
        if (source === 'client_applications') {
          const { error: updateError } = await supabaseAdmin
            .from('client_applications')
            .update({
              status: 'approved',
              reviewed_by: adminUser.id,
              reviewed_at: reviewTimestamp,
            })
            .eq('id', application.id);

          if (updateError) {
            throw updateError;
          }
        } else {
          const currentNotes = parseMaybeJson(application.notes) || {};
          const { error: updateError } = await supabaseAdmin
            .from('inquiries')
            .update({
              status: 'converted',
              notes: JSON.stringify({
                ...currentNotes,
                reviewed_by: adminUser.id,
                reviewed_at: reviewTimestamp,
              }),
            })
            .eq('id', application.id);

          if (updateError) {
            throw updateError;
          }
        }

        return json(res, 200, {
          application: {
            ...application,
            status: 'approved',
            reviewed_by: adminUser.id,
            reviewed_at: reviewTimestamp,
          },
          tenant: result.tenant,
          tenant_user: result.tenant_user,
          client_profile: result.client_profile,
        });
      } catch (error) {
        return json(res, 500, { error: error.message || 'Failed to approve application' });
      }
    }

    const reviewTimestamp = new Date().toISOString();
    let updatedApplication = application;
    let updateError = null;

    if (source === 'client_applications') {
      const result = await supabaseAdmin
        .from('client_applications')
        .update({
          status: 'rejected',
          reviewed_by: adminUser.id,
          reviewed_at: reviewTimestamp,
        })
        .eq('id', application.id)
        .select()
        .maybeSingle();

      updatedApplication = result.data;
      updateError = result.error;
    } else {
      const currentNotes = parseMaybeJson(application.notes) || {};
      const result = await supabaseAdmin
        .from('inquiries')
        .update({
          status: 'closed',
          notes: JSON.stringify({
            ...currentNotes,
            reviewed_by: adminUser.id,
            reviewed_at: reviewTimestamp,
          }),
        })
        .eq('id', application.id)
        .select()
        .maybeSingle();

      updatedApplication = result.data;
      updateError = result.error;
    }

    if (updateError) {
      logSupabaseFailure('reject application', updateError);
      return json(res, 500, { error: updateError.message || 'Failed to reject application' });
    }

    return json(res, 200, { application: updatedApplication });
  }

  return false;
}
