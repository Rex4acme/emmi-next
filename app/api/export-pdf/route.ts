// app/api/export-pdf/route.ts
// Generates a professional PDF fault report or activity report.
// Uses @react-pdf/renderer via a text-based HTML approach that Vercel can render.
// Called from fault detail page: GET /api/export-pdf?type=fault&id={faultId}

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'fault'; // fault | activity | kpi
  const id   = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  // Fetch the data to include in the report
  let reportData: any = null;
  let title = 'EMMI Report';

  if (type === 'fault') {
    const { data } = await supabase
      .from('faults')
      .select(`
        *, equipment:equipment(tag_id, name, location, voltage_rating),
        fault_category:fault_categories(name, icon),
        resolutions(outcome, root_cause, actions_taken, resolved_at)
      `)
      .eq('id', id)
      .single();
    reportData = data;
    title = `Fault Report — ${data?.fault_code || data?.title}`;
  } else if (type === 'activity') {
    const { data } = await supabase
      .from('activities')
      .select(`*, equipment:equipment(tag_id, name), activity_type:activity_types(name, icon)`)
      .eq('id', id)
      .single();
    reportData = data;
    title = `Activity Report — ${data?.title}`;
  }

  if (!reportData) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 });
  }

  // Get engineer profile for report header
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, title, employee_id, organization, department')
    .eq('id', user.id)
    .single();

  // Generate HTML that renders as a printable PDF
  const html = generateReportHTML(type, reportData, profile, title);

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Report-Title': encodeURIComponent(title),
    },
  });
}

function generateReportHTML(type: string, data: any, profile: any, title: string): string {
  const now = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const faultHTML = type === 'fault' ? `
    <table>
      <tr><td class="label">Fault Code</td><td>${data.fault_code || '—'}</td></tr>
      <tr><td class="label">Title</td><td>${data.title}</td></tr>
      <tr><td class="label">Severity</td><td><span class="badge badge-${data.severity}">${data.severity?.toUpperCase()}</span></td></tr>
      <tr><td class="label">Status</td><td>${data.status?.replace('_', ' ')}</td></tr>
      <tr><td class="label">Equipment</td><td>${data.equipment?.tag_id || '—'} — ${data.equipment?.name || '—'}</td></tr>
      <tr><td class="label">Location</td><td>${data.fault_location || data.equipment?.location || '—'}</td></tr>
      <tr><td class="label">Category</td><td>${data.fault_category?.icon || ''} ${data.fault_category?.name || '—'}</td></tr>
      <tr><td class="label">Detected</td><td>${data.detected_at ? new Date(data.detected_at).toLocaleString('en-GB') : '—'}</td></tr>
      <tr><td class="label">Downtime</td><td>${data.downtime_minutes ? data.downtime_minutes + ' minutes' : '—'}</td></tr>
      <tr><td class="label">Recurring</td><td>${data.is_recurring ? 'Yes' : 'No'}</td></tr>
    </table>

    ${data.description ? `<h3>Description</h3><p>${data.description}</p>` : ''}
    ${data.symptoms?.length ? `<h3>Symptoms</h3><ul>${data.symptoms.map((s: string) => `<li>${s}</li>`).join('')}</ul>` : ''}

    ${data.resolutions?.length ? `
      <h3>Resolution</h3>
      ${data.resolutions.map((r: any) => `
        <table>
          <tr><td class="label">Outcome</td><td>${r.outcome}</td></tr>
          <tr><td class="label">Root Cause</td><td>${r.root_cause || '—'}</td></tr>
          <tr><td class="label">Actions Taken</td><td>${r.actions_taken || '—'}</td></tr>
          <tr><td class="label">Resolved At</td><td>${r.resolved_at ? new Date(r.resolved_at).toLocaleString('en-GB') : '—'}</td></tr>
        </table>
      `).join('')}
    ` : ''}
  ` : `
    <table>
      <tr><td class="label">Title</td><td>${data.title}</td></tr>
      <tr><td class="label">Type</td><td>${data.activity_type?.icon || ''} ${data.activity_type?.name || '—'}</td></tr>
      <tr><td class="label">Status</td><td>${data.status?.replace('_', ' ')}</td></tr>
      <tr><td class="label">Equipment</td><td>${data.equipment?.tag_id || '—'} — ${data.equipment?.name || '—'}</td></tr>
      <tr><td class="label">Scheduled</td><td>${data.scheduled_date ? new Date(data.scheduled_date).toLocaleDateString('en-GB') : '—'}</td></tr>
      <tr><td class="label">Work Order</td><td>${data.work_order_ref || '—'}</td></tr>
      <tr><td class="label">Permit Ref</td><td>${data.permit_ref || '—'}</td></tr>
    </table>
    ${data.findings ? `<h3>Findings</h3><p>${data.findings}</p>` : ''}
    ${data.actions_taken ? `<h3>Actions Taken</h3><p>${data.actions_taken}</p>` : ''}
    ${data.recommendations ? `<h3>Recommendations</h3><p>${data.recommendations}</p>` : ''}
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1a1a2e; background: #fff; padding: 32px; }
    
    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #f0a500; padding-bottom: 16px; margin-bottom: 24px; }
    .logo { font-size: 22px; font-weight: 900; color: #f0a500; letter-spacing: 4px; }
    .logo-sub { font-size: 9px; color: #888; letter-spacing: 2px; text-transform: uppercase; margin-top: 2px; }
    .report-meta { text-align: right; font-size: 10px; color: #666; }
    .report-meta strong { font-size: 13px; color: #1a1a2e; display: block; margin-bottom: 4px; }
    
    /* Engineer info */
    .engineer-box { background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; display: flex; gap: 40px; }
    .engineer-box div { font-size: 11px; }
    .engineer-box .eng-label { color: #888; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
    .engineer-box .eng-value { color: #1a1a2e; font-weight: 600; }

    /* Report title */
    .report-title { font-size: 17px; font-weight: 800; color: #1a1a2e; margin-bottom: 20px; padding-bottom: 8px; border-bottom: 1px solid #e0e0e0; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; font-size: 12px; vertical-align: top; }
    td.label { font-weight: 700; color: #555; width: 30%; background: #fafafa; white-space: nowrap; }
    
    /* Section headings */
    h3 { font-size: 12px; font-weight: 700; color: #f0a500; text-transform: uppercase; letter-spacing: 1px; margin: 20px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #f0a500; }
    p { line-height: 1.6; margin-bottom: 12px; color: #333; }
    ul { padding-left: 20px; }
    li { margin-bottom: 4px; line-height: 1.6; }

    /* Badges */
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; }
    .badge-critical { background: #ffe0e0; color: #c0392b; }
    .badge-high     { background: #fff3cd; color: #856404; }
    .badge-medium   { background: #fff8e1; color: #7d600a; }
    .badge-low      { background: #e8f5e9; color: #2e7d32; }

    /* Footer */
    .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-between; font-size: 10px; color: #aaa; }
    
    /* Print */
    @media print {
      body { padding: 16px; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">⚡ EMMI</div>
      <div class="logo-sub">Electrical Maintenance Intelligence</div>
    </div>
    <div class="report-meta">
      <strong>${title}</strong>
      Generated: ${now}
    </div>
  </div>

  <div class="engineer-box">
    <div><div class="eng-label">Engineer</div><div class="eng-value">${profile?.full_name || '—'}</div></div>
    <div><div class="eng-label">Title</div><div class="eng-value">${profile?.title || '—'}</div></div>
    <div><div class="eng-label">Employee ID</div><div class="eng-value">${profile?.employee_id || '—'}</div></div>
    <div><div class="eng-label">Organisation</div><div class="eng-value">${profile?.organization || '—'}</div></div>
  </div>

  <div class="report-title">${title}</div>

  ${faultHTML}

  <div class="footer">
    <span>EMMI — Electrical Maintenance Intelligence Platform</span>
    <span>Printed: ${now}</span>
  </div>

  <script>
    // Auto-trigger print dialog
    window.onload = () => window.print();
  </script>
</body>
</html>`;
}