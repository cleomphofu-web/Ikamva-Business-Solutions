import appServices from '@/lib/app-services';

const FROM = 'Aura Virtual Assistants';

function fmtMoney(n) {
  return `R ${(parseFloat(n) || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return d; }
}

function emailWrapper(title, body) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr>
          <td style="background:#0f0f0f;padding:28px 36px;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">Aura</p>
            <p style="margin:4px 0 0;font-size:12px;color:#aaaaaa;">Virtual Assistant Services</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f0f0f;">${title}</h1>
            ${body}
            <p style="margin:32px 0 0;font-size:13px;color:#888888;">
              If you have any questions, reply to this email or contact us at
              <a href="mailto:support@aura-va.com" style="color:#0f0f0f;">support@aura-va.com</a>.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;padding:20px 36px;border-top:1px solid #eeeeee;">
            <p style="margin:0;font-size:11px;color:#bbbbbb;text-align:center;">
              © 2026 Aura Virtual Assistants · Cape Town, South Africa
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

/** Notify client that a new invoice has been issued */
export async function notifyInvoiceCreated(invoice) {
  const body = `
    <p style="color:#444;font-size:15px;line-height:1.6;">Hi there,</p>
    <p style="color:#444;font-size:15px;line-height:1.6;">
      A new invoice has been generated for your account. Here are the details:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #eeeeee;border-radius:8px;overflow:hidden;font-size:14px;">
      <tr style="background:#f9f9f9;">
        <td style="padding:12px 16px;color:#888;font-weight:600;">Invoice #</td>
        <td style="padding:12px 16px;color:#0f0f0f;font-weight:700;">${invoice.invoice_number || '—'}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;color:#888;font-weight:600;">Billing Period</td>
        <td style="padding:12px 16px;color:#0f0f0f;">${invoice.month || '—'}</td>
      </tr>
      <tr style="background:#f9f9f9;">
        <td style="padding:12px 16px;color:#888;font-weight:600;">Hours Billed</td>
        <td style="padding:12px 16px;color:#0f0f0f;">${invoice.hours_billed || '—'} hrs @ ${fmtMoney(invoice.rate_per_hour)}/hr</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;color:#888;font-weight:600;">Subtotal</td>
        <td style="padding:12px 16px;color:#0f0f0f;">${fmtMoney(invoice.subtotal)}</td>
      </tr>
      <tr style="background:#f9f9f9;">
        <td style="padding:12px 16px;color:#888;font-weight:600;">VAT / Tax</td>
        <td style="padding:12px 16px;color:#0f0f0f;">${fmtMoney(invoice.tax)}</td>
      </tr>
      <tr style="background:#0f0f0f;">
        <td style="padding:14px 16px;color:#fff;font-weight:700;font-size:15px;">Total Due</td>
        <td style="padding:14px 16px;color:#fff;font-weight:700;font-size:15px;">${fmtMoney(invoice.total)}</td>
      </tr>
    </table>
    <p style="color:#444;font-size:15px;line-height:1.6;">
      <strong>Due Date:</strong> ${fmtDate(invoice.due_date)}
    </p>
    ${invoice.notes ? `<p style="color:#444;font-size:14px;line-height:1.6;background:#f9f9f9;padding:14px;border-radius:8px;"><strong>Note:</strong> ${invoice.notes}</p>` : ''}
    <p style="color:#444;font-size:15px;line-height:1.6;">
      Please use the invoice number as your payment reference.
    </p>
  `;

  await appServices.email.send({
    from_name: FROM,
    to: invoice.client_email,
    subject: `Invoice ${invoice.invoice_number || ''} – ${fmtMoney(invoice.total)} due ${fmtDate(invoice.due_date)}`,
    body: emailWrapper('Your Invoice is Ready', body),
  });
}

/** Notify client that their invoice has been marked paid */
export async function notifyInvoicePaid(invoice) {
  const body = `
    <p style="color:#444;font-size:15px;line-height:1.6;">Hi there,</p>
    <p style="color:#444;font-size:15px;line-height:1.6;">
      Great news — your invoice has been marked as <strong style="color:#16a34a;">Paid</strong>. Thank you for your payment!
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #eeeeee;border-radius:8px;overflow:hidden;font-size:14px;">
      <tr style="background:#f9f9f9;">
        <td style="padding:12px 16px;color:#888;font-weight:600;">Invoice #</td>
        <td style="padding:12px 16px;color:#0f0f0f;font-weight:700;">${invoice.invoice_number || '—'}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;color:#888;font-weight:600;">Period</td>
        <td style="padding:12px 16px;color:#0f0f0f;">${invoice.month || '—'}</td>
      </tr>
      <tr style="background:#16a34a;">
        <td style="padding:14px 16px;color:#fff;font-weight:700;">Amount Paid</td>
        <td style="padding:14px 16px;color:#fff;font-weight:700;">${fmtMoney(invoice.total)}</td>
      </tr>
    </table>
    <p style="color:#444;font-size:15px;line-height:1.6;">
      We appreciate your business and look forward to continuing to support you.
    </p>
  `;

  await appServices.email.send({
    from_name: FROM,
    to: invoice.client_email,
    subject: `Payment Confirmed – Invoice ${invoice.invoice_number || ''} (${fmtMoney(invoice.total)})`,
    body: emailWrapper('Payment Received ✓', body),
  });
}

/** Notify client that a new document has been shared with them */
export async function notifyDocumentShared(doc) {
  const body = `
    <p style="color:#444;font-size:15px;line-height:1.6;">Hi there,</p>
    <p style="color:#444;font-size:15px;line-height:1.6;">
      Your virtual assistant has shared a new document with you:
    </p>
    <div style="margin:24px 0;border:1px solid #eeeeee;border-radius:8px;overflow:hidden;">
      <div style="background:#0f0f0f;padding:16px 20px;">
        <p style="margin:0;font-size:16px;font-weight:700;color:#ffffff;">${doc.title}</p>
        ${doc.category ? `<p style="margin:4px 0 0;font-size:12px;color:#aaaaaa;text-transform:capitalize;">${doc.category}</p>` : ''}
      </div>
      <div style="padding:20px;font-size:14px;">
        ${doc.description ? `<p style="color:#444;margin:0 0 12px;line-height:1.6;">${doc.description}</p>` : ''}
        ${doc.file_name ? `<p style="color:#888;margin:0;"><strong style="color:#0f0f0f;">File:</strong> ${doc.file_name}</p>` : ''}
        ${doc.shared_by ? `<p style="color:#888;margin:8px 0 0;"><strong style="color:#0f0f0f;">Shared by:</strong> ${doc.shared_by}</p>` : ''}
      </div>
    </div>
    <p style="color:#444;font-size:15px;line-height:1.6;">
      Log in to your <a href="${window.location.origin}/dashboard/documents" style="color:#0f0f0f;font-weight:600;">client dashboard</a> to view and download this document.
    </p>
  `;

  await appServices.email.send({
    from_name: FROM,
    to: doc.client_email,
    subject: `New Document Shared: ${doc.title}`,
    body: emailWrapper('A Document Has Been Shared With You', body),
  });
}

/** Notify client of a project status change */
export async function notifyProjectStatusChanged(project, oldStatus) {
  const statusLabels = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    on_hold: 'On Hold',
    completed: 'Completed ✓',
    cancelled: 'Cancelled',
  };
  const statusColors = {
    not_started: '#6b7280',
    in_progress: '#2563eb',
    on_hold: '#d97706',
    completed: '#16a34a',
    cancelled: '#dc2626',
  };
  const newLabel = statusLabels[project.status] || project.status;
  const color = statusColors[project.status] || '#0f0f0f';

  const body = `
    <p style="color:#444;font-size:15px;line-height:1.6;">Hi there,</p>
    <p style="color:#444;font-size:15px;line-height:1.6;">
      The status of your project has been updated by your virtual assistant:
    </p>
    <div style="margin:24px 0;border:1px solid #eeeeee;border-radius:8px;overflow:hidden;">
      <div style="background:#0f0f0f;padding:16px 20px;">
        <p style="margin:0;font-size:16px;font-weight:700;color:#ffffff;">${project.title}</p>
        ${project.type ? `<p style="margin:4px 0 0;font-size:12px;color:#aaaaaa;text-transform:capitalize;">${project.type.replace('_', ' ')}</p>` : ''}
      </div>
      <div style="padding:20px;font-size:14px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="color:#888;padding:8px 0;width:140px;">New Status</td>
            <td><span style="background:${color}20;color:${color};padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;">${newLabel}</span></td>
          </tr>
          ${project.due_date ? `<tr><td style="color:#888;padding:8px 0;">Due Date</td><td style="color:#0f0f0f;font-weight:600;">${fmtDate(project.due_date)}</td></tr>` : ''}
          ${project.va_name ? `<tr><td style="color:#888;padding:8px 0;">VA</td><td style="color:#0f0f0f;">${project.va_name}</td></tr>` : ''}
          ${project.hours_logged != null && project.estimated_hours ? `<tr><td style="color:#888;padding:8px 0;">Progress</td><td style="color:#0f0f0f;">${project.hours_logged} / ${project.estimated_hours} hrs</td></tr>` : ''}
        </table>
        ${project.notes ? `<p style="color:#444;margin:16px 0 0;font-size:14px;line-height:1.6;background:#f9f9f9;padding:14px;border-radius:8px;"><strong>Notes:</strong> ${project.notes}</p>` : ''}
      </div>
    </div>
    <p style="color:#444;font-size:15px;line-height:1.6;">
      View full project details in your <a href="${window.location.origin}/dashboard/projects" style="color:#0f0f0f;font-weight:600;">client dashboard</a>.
    </p>
  `;

  await appServices.email.send({
    from_name: FROM,
    to: project.client_email,
    subject: `Project Update: "${project.title}" is now ${newLabel}`,
    body: emailWrapper('Project Status Updated', body),
  });
}

/** Notify client that a new project has been created for them */
export async function notifyProjectCreated(project) {
  const body = `
    <p style="color:#444;font-size:15px;line-height:1.6;">Hi there,</p>
    <p style="color:#444;font-size:15px;line-height:1.6;">
      Your virtual assistant has set up a new project on your account:
    </p>
    <div style="margin:24px 0;border:1px solid #eeeeee;border-radius:8px;overflow:hidden;">
      <div style="background:#0f0f0f;padding:16px 20px;">
        <p style="margin:0;font-size:16px;font-weight:700;color:#ffffff;">${project.title}</p>
        ${project.type ? `<p style="margin:4px 0 0;font-size:12px;color:#aaaaaa;text-transform:capitalize;">${project.type.replace('_', ' ')}</p>` : ''}
      </div>
      <div style="padding:20px;font-size:14px;">
        ${project.description ? `<p style="color:#444;margin:0 0 16px;line-height:1.6;">${project.description}</p>` : ''}
        <table width="100%" cellpadding="0" cellspacing="0">
          ${project.estimated_hours ? `<tr><td style="color:#888;padding:6px 0;width:140px;">Estimated Hours</td><td style="color:#0f0f0f;">${project.estimated_hours} hrs</td></tr>` : ''}
          ${project.due_date ? `<tr><td style="color:#888;padding:6px 0;">Due Date</td><td style="color:#0f0f0f;font-weight:600;">${fmtDate(project.due_date)}</td></tr>` : ''}
          ${project.va_name ? `<tr><td style="color:#888;padding:6px 0;">Assigned VA</td><td style="color:#0f0f0f;">${project.va_name}</td></tr>` : ''}
          ${project.priority ? `<tr><td style="color:#888;padding:6px 0;">Priority</td><td style="color:#0f0f0f;text-transform:capitalize;">${project.priority}</td></tr>` : ''}
        </table>
      </div>
    </div>
    <p style="color:#444;font-size:15px;line-height:1.6;">
      You can track milestones and progress in your <a href="${window.location.origin}/dashboard/projects" style="color:#0f0f0f;font-weight:600;">client dashboard</a>.
    </p>
  `;

  await appServices.email.send({
    from_name: FROM,
    to: project.client_email,
    subject: `New Project Started: "${project.title}"`,
    body: emailWrapper('A New Project Has Been Created for You', body),
  });
}

/** Notify client that a new task has been assigned to them */
export async function notifyTaskAssigned(task) {
  const priorityColors = { high: '#dc2626', medium: '#d97706', low: '#6b7280' };
  const pColor = priorityColors[task.priority] || '#6b7280';

  const body = `
    <p style="color:#444;font-size:15px;line-height:1.6;">Hi there,</p>
    <p style="color:#444;font-size:15px;line-height:1.6;">
      Your virtual assistant has assigned a new task to your account:
    </p>
    <div style="margin:24px 0;border:1px solid #eeeeee;border-radius:8px;overflow:hidden;">
      <div style="background:#0f0f0f;padding:16px 20px;">
        <p style="margin:0;font-size:16px;font-weight:700;color:#ffffff;">${task.title}</p>
        ${task.category ? `<p style="margin:4px 0 0;font-size:12px;color:#aaaaaa;text-transform:capitalize;">${task.category.replace(/_/g, ' ')}</p>` : ''}
      </div>
      <div style="padding:20px;font-size:14px;">
        ${task.description ? `<p style="color:#444;margin:0 0 16px;line-height:1.6;">${task.description}</p>` : ''}
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="color:#888;padding:6px 0;">Priority</td>
            <td><span style="background:${pColor}20;color:${pColor};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;text-transform:capitalize;">${task.priority || 'medium'}</span></td>
          </tr>
          ${task.due_date ? `<tr><td style="color:#888;padding:6px 0;">Due Date</td><td style="color:#0f0f0f;font-weight:600;">${fmtDate(task.due_date)}</td></tr>` : ''}
          ${task.va_name ? `<tr><td style="color:#888;padding:6px 0;">Assigned By</td><td style="color:#0f0f0f;">${task.va_name}</td></tr>` : ''}
        </table>
      </div>
    </div>
    <p style="color:#444;font-size:15px;line-height:1.6;">
      You can view and track this task in your <a href="${window.location.origin}/dashboard/tasks" style="color:#0f0f0f;font-weight:600;">client dashboard</a>.
    </p>
  `;

  await appServices.email.send({
    from_name: FROM,
    to: task.client_email,
    subject: `New Task Assigned: ${task.title}`,
    body: emailWrapper('New Task from Your VA', body),
  });
}