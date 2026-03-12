'use client';
// app/kpi/page.tsx — KPI Appraisal Tracker
// Tracks faults and activities for annual performance review.
// AI generates professional appraisal writeup.
// Download as Word (.docx) or PDF.

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { getKPIData } from '@/lib/db';
import AppShell from '@/components/layout/AppShell';
import {
  Loader2, Sparkles, Copy, Check, Trophy,
  Zap, ClipboardList, Clock, TrendingUp,
  AlertTriangle, FileText, Download,
} from 'lucide-react';

export default function KPIPage() {
  const supabase    = createBrowserClient();
  const currentYear = new Date().getFullYear();

  const [year,        setYear]        = useState(currentYear);
  const [kpiData,     setKpiData]     = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiReport,    setAiReport]    = useState('');
  const [copied,      setCopied]      = useState(false);
  const [downloading, setDownloading] = useState<'word'|'pdf'|null>(null);
  const [profile,     setProfile]     = useState<any>(null);

  useEffect(() => { loadData(); }, [year]);

  async function loadData() {
    setLoading(true);
    setAiReport('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [data, profileRes] = await Promise.all([
      getKPIData(supabase, user.id, year),
      supabase.from('profiles').select('full_name, title, organization, employee_id').eq('id', user.id).single(),
    ]);

    setKpiData(data);
    setProfile(profileRes.data);
    setLoading(false);
  }

  // ── Generate AI appraisal report ─────────────────────────
  async function generateAIReport() {
    if (!kpiData) return;
    setAiLoading(true);

    const { stats, faults, activities } = kpiData;
    const topFaults = faults
      .filter((f: any) => f.status === 'resolved').slice(0, 6)
      .map((f: any) => `- ${f.title} on ${f.equipment?.name || 'N/A'} (${f.severity} severity)`)
      .join('\n');
    const topActivities = activities
      .filter((a: any) => a.status === 'completed').slice(0, 6)
      .map((a: any) => `- ${a.title} on ${a.equipment?.name || 'N/A'}`)
      .join('\n');

    const prompt = `Write a formal KPI appraisal statement for an electrical engineer's annual performance review for ${year}.

Engineer: ${profile?.full_name || 'Senior Electrical Engineer'}
Title: ${profile?.title || 'Electrical Engineer'}
Organisation: ${profile?.organization || ''}

PERFORMANCE DATA FOR ${year}:
- Faults logged and managed: ${stats.totalFaults}
- Faults resolved: ${stats.resolvedFaults} (${stats.resolutionRate}% resolution rate)
- Critical faults resolved: ${stats.criticalResolved}
- Total downtime managed: ${Math.round(stats.totalDowntimeMins / 60)} hours
- Maintenance activities completed: ${stats.completedActivities} of ${stats.totalActivities}

KEY FAULTS RESOLVED:
${topFaults || 'Fault management activities carried out throughout the year'}

KEY ACTIVITIES COMPLETED:
${topActivities || 'Maintenance and commissioning activities completed'}

Write exactly 4 paragraphs in formal first-person engineering language:
Paragraph 1: Overview of fault management achievements with specific numbers
Paragraph 2: Key technical interventions and critical fault resolutions
Paragraph 3: Maintenance activities and reliability improvements
Paragraph 4: Value delivered to organisation and professional development

Make it impressive, factual, and suitable for a formal appraisal. Plain text only, no bullet points, no JSON.`;

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: 'You are a professional engineering career coach. Write formal impressive KPI appraisal statements. Always respond in plain paragraphs only. Never use JSON, bullet points, or markdown.',
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data  = await response.json();
      const text  = data.content?.[0]?.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      setAiReport(clean);
    } catch (err: any) {
      setAiReport('AI unavailable. Please try again.');
    }
    setAiLoading(false);
  }

  // ── Copy to clipboard ─────────────────────────────────────
  async function copyReport() {
    await navigator.clipboard.writeText(aiReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // ── Download as Word (.docx) ──────────────────────────────
  // Uses pure JavaScript to create a valid .docx (Open XML) file
  async function downloadWord() {
    if (!aiReport) return;
    setDownloading('word');
    try {
      const name  = profile?.full_name || 'Engineer';
      const title = `${name} — KPI Appraisal ${year}`;

      // Build simple Word XML document
      const paragraphs = aiReport.split('\n\n').filter(p => p.trim());
      const paraXml = paragraphs.map(p =>
        `<w:p><w:pPr><w:spacing w:after="200"/></w:pPr><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${escapeXml(p.trim())}</w:t></w:r></w:p>`
      ).join('\n');

      const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>
  <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="100"/></w:pPr>
    <w:r><w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="C87A00"/></w:rPr><w:t>${escapeXml(title)}</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="400"/></w:pPr>
    <w:r><w:rPr><w:sz w:val="20"/><w:color w:val="888888"/></w:rPr><w:t>Generated by EMMI — Electrical Maintenance Intelligence</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:spacing w:after="100"/></w:pPr>
    <w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>Performance Summary ${year}</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:spacing w:after="200"/></w:pPr>
    <w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>Faults Resolved: ${kpiData?.stats.resolvedFaults} / ${kpiData?.stats.totalFaults} | Resolution Rate: ${kpiData?.stats.resolutionRate}% | Activities Completed: ${kpiData?.stats.completedActivities}</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:spacing w:after="300"/></w:pPr>
    <w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>Appraisal Statement</w:t></w:r>
  </w:p>
  ${paraXml}
  <w:sectPr><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
</w:body>
</w:document>`;

      // Build minimal .docx zip structure
      const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

      const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

      const wordRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

      // Use JSZip-style manual zip creation via fetch to a service
      // Since we can't import JSZip easily, we create a simple blob download
      // by encoding the docx as a base64 string built from scratch
      const { default: JSZip } = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm' as any);
      const zip = new JSZip();
      zip.file('[Content_Types].xml', contentTypes);
      zip.file('_rels/.rels', relsXml);
      zip.file('word/document.xml', docXml);
      zip.file('word/_rels/document.xml.rels', wordRels);

      const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      triggerDownload(blob, `EMMI_KPI_${name.replace(/\s+/g,'_')}_${year}.docx`);
    } catch (err) {
      // Fallback: download as plain text .doc
      const blob = new Blob([buildPlainText()], { type: 'application/msword' });
      triggerDownload(blob, `EMMI_KPI_${year}.doc`);
    }
    setDownloading(null);
  }

  // ── Download as PDF ───────────────────────────────────────
  async function downloadPDF() {
    if (!aiReport) return;
    setDownloading('pdf');
    try {
      const name = profile?.full_name || 'Engineer';

      // Build a styled HTML page then print to PDF
      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'DM Sans',sans-serif; color:#1a1a2e; background:#fff; padding:48px; max-width:800px; margin:0 auto; }
  .header { border-bottom:3px solid #f0a500; padding-bottom:20px; margin-bottom:28px; }
  .logo { color:#f0a500; font-size:28px; font-weight:700; letter-spacing:4px; }
  .subtitle { color:#888; font-size:12px; margin-top:4px; letter-spacing:2px; text-transform:uppercase; }
  h1 { font-size:20px; font-weight:700; color:#1a1a2e; margin-top:12px; }
  .stats { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin:24px 0; }
  .stat { background:#f8f9fa; border-radius:8px; padding:14px; text-align:center; border-left:3px solid #f0a500; }
  .stat-val { font-size:24px; font-weight:700; color:#f0a500; }
  .stat-lbl { font-size:11px; color:#666; margin-top:4px; text-transform:uppercase; letter-spacing:1px; }
  h2 { font-size:14px; font-weight:700; color:#333; margin:24px 0 12px; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid #eee; padding-bottom:6px; }
  p { font-size:13px; line-height:1.8; color:#333; margin-bottom:14px; }
  .footer { margin-top:40px; padding-top:16px; border-top:1px solid #eee; font-size:11px; color:#aaa; text-align:center; }
</style>
</head>
<body>
<div class="header">
  <div class="logo">EMMI</div>
  <div class="subtitle">Electrical Maintenance Intelligence</div>
  <h1>${name} — KPI Appraisal Report ${year}</h1>
  ${profile?.title ? `<p style="color:#666;font-size:13px;margin-top:6px">${profile.title}${profile.organization ? ' · ' + profile.organization : ''}</p>` : ''}
</div>
<div class="stats">
  <div class="stat"><div class="stat-val">${kpiData?.stats.resolvedFaults}</div><div class="stat-lbl">Faults Resolved</div></div>
  <div class="stat"><div class="stat-val">${kpiData?.stats.resolutionRate}%</div><div class="stat-lbl">Resolution Rate</div></div>
  <div class="stat"><div class="stat-val">${kpiData?.stats.completedActivities}</div><div class="stat-lbl">Activities Done</div></div>
</div>
<h2>Appraisal Statement</h2>
${aiReport.split('\n\n').map(p => `<p>${p.trim()}</p>`).join('')}
<div class="footer">Generated by EMMI — ${new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}</div>
</body>
</html>`;

      // Open in new window and trigger print dialog (saves as PDF)
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        setTimeout(() => {
          win.focus();
          win.print();
        }, 800);
      }
    } catch (err) {
      alert('PDF download failed. Please try again.');
    }
    setDownloading(null);
  }

  function buildPlainText() {
    const name = profile?.full_name || 'Engineer';
    return `EMMI — KPI APPRAISAL REPORT ${year}\n${name}\n${profile?.title || ''}\n\n` +
      `PERFORMANCE SUMMARY\nFaults Resolved: ${kpiData?.stats.resolvedFaults}/${kpiData?.stats.totalFaults}\n` +
      `Resolution Rate: ${kpiData?.stats.resolutionRate}%\nActivities Completed: ${kpiData?.stats.completedActivities}\n\n` +
      `APPRAISAL STATEMENT\n\n${aiReport}`;
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function escapeXml(str: string) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  }

  const fmtHours = (mins: number) => `${Math.round(mins / 60)}h`;

  return (
    <AppShell title="KPI Appraisal">

      {/* Year selector */}
      <div className="flex items-center gap-3 mb-5">
        <p className="text-sm font-bold">Year:</p>
        <div className="flex gap-2">
          {[currentYear - 1, currentYear].map(y => (
            <button key={y} onClick={() => setYear(y)}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
              style={{
                background: year === y ? 'var(--amber)' : 'var(--card)',
                color:      year === y ? '#000' : 'var(--text-2)',
                border:     year === y ? 'none' : '1px solid var(--border)',
              }}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="loading-dots"><span/><span/><span/></div>
        </div>
      ) : kpiData ? (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
            {[
              { icon: <AlertTriangle size={16}/>, label: 'Faults Logged',     value: kpiData.stats.totalFaults,         color: 'var(--red)'   },
              { icon: <Check size={16}/>,         label: 'Faults Resolved',   value: kpiData.stats.resolvedFaults,      color: 'var(--green)' },
              { icon: <Zap size={16}/>,           label: 'Critical Resolved', value: kpiData.stats.criticalResolved,    color: 'var(--amber)' },
              { icon: <Clock size={16}/>,         label: 'Downtime Managed',  value: fmtHours(kpiData.stats.totalDowntimeMins), color: 'var(--blue)'  },
              { icon: <ClipboardList size={16}/>, label: 'Activities Done',   value: kpiData.stats.completedActivities, color: 'var(--purple)'},
              { icon: <TrendingUp size={16}/>,    label: 'Resolution Rate',   value: `${kpiData.stats.resolutionRate}%`,color: 'var(--green)' },
            ].map(stat => (
              <div key={stat.label} className="card flex items-center gap-3"
                style={{ borderLeft: `3px solid ${stat.color}` }}>
                <div className="p-2 rounded-lg flex-shrink-0" style={{ background: `${stat.color}20`, color: stat.color }}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-xl font-bold font-mono" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-xs" style={{ color: 'var(--text-2)' }}>{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Top faults + activities side by side on desktop */}
          <div className="md:grid md:grid-cols-2 md:gap-4 mb-5 space-y-4 md:space-y-0">

            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={15} style={{ color: 'var(--amber)' }}/>
                <h3 className="text-sm font-bold">Top Resolved Faults</h3>
              </div>
              {kpiData.faults.filter((f: any) => f.status === 'resolved').length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>No resolved faults this year yet.</p>
              ) : (
                <div className="space-y-2">
                  {kpiData.faults.filter((f: any) => f.status === 'resolved').slice(0, 6).map((f: any) => (
                    <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--surface)' }}>
                      <span className="text-xs">{f.severity === 'critical' ? '🔴' : f.severity === 'high' ? '🟠' : '🟡'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{f.title}</p>
                        <p className="text-xs" style={{ color: 'var(--text-3)' }}>{f.equipment?.name || '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList size={15} style={{ color: 'var(--blue)' }}/>
                <h3 className="text-sm font-bold">Key Activities</h3>
              </div>
              {kpiData.activities.filter((a: any) => a.status === 'completed').length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>No completed activities this year yet.</p>
              ) : (
                <div className="space-y-2">
                  {kpiData.activities.filter((a: any) => a.status === 'completed').slice(0, 6).map((a: any) => (
                    <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--surface)' }}>
                      <span className="text-base">{a.activity_type?.icon || '🔧'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{a.title}</p>
                        <p className="text-xs" style={{ color: 'var(--text-3)' }}>{a.equipment?.name || '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* AI Report generator */}
          <div className="card" style={{ border: '1px solid rgba(163,113,247,0.2)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(163,113,247,0.15)' }}>
                <Sparkles size={14} style={{ color: 'var(--purple)' }}/>
              </div>
              <div>
                <p className="text-sm font-bold">AI KPI Report Generator</p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>Professional appraisal writeup in one tap</p>
              </div>
            </div>

            <button onClick={generateAIReport} disabled={aiLoading}
              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 mb-4"
              style={{ background: aiLoading ? 'rgba(163,113,247,0.3)' : 'rgba(163,113,247,0.2)', color: 'var(--purple)', border: '1px solid rgba(163,113,247,0.3)' }}>
              {aiLoading ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}
              {aiLoading ? 'Writing your appraisal…' : aiReport ? 'Regenerate Report' : 'Generate KPI Appraisal'}
            </button>

            {aiReport && (
              <>
                {/* Report text */}
                <div className="p-4 rounded-xl mb-4 text-sm leading-relaxed"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                  {aiReport}
                </div>

                {/* Download + Copy buttons */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">

                  {/* Copy */}
                  <button onClick={copyReport}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold"
                    style={{ background: copied ? 'var(--green)' : 'var(--card)', color: copied ? '#fff' : 'var(--text-2)', border: '1px solid var(--border)' }}>
                    {copied ? <><Check size={13}/> Copied</> : <><Copy size={13}/> Copy Text</>}
                  </button>

                  {/* Download Word */}
                  <button onClick={downloadWord} disabled={downloading === 'word'}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold"
                    style={{ background: 'rgba(74,158,255,0.1)', color: 'var(--blue)', border: '1px solid rgba(74,158,255,0.2)' }}>
                    {downloading === 'word' ? <Loader2 size={13} className="animate-spin"/> : <FileText size={13}/>}
                    Word (.doc)
                  </button>

                  {/* Download PDF */}
                  <button onClick={downloadPDF} disabled={downloading === 'pdf'}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold"
                    style={{ background: 'rgba(248,81,73,0.1)', color: 'var(--red)', border: '1px solid rgba(248,81,73,0.2)' }}>
                    {downloading === 'pdf' ? <Loader2 size={13} className="animate-spin"/> : <Download size={13}/>}
                    PDF / Print
                  </button>

                  {/* Share (mobile) */}
                  <button onClick={async () => {
                    if (navigator.share) {
                      await navigator.share({ title: `KPI Report ${year}`, text: aiReport });
                    } else {
                      copyReport();
                    }
                  }}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold"
                    style={{ background: 'rgba(52,208,88,0.1)', color: 'var(--green)', border: '1px solid rgba(52,208,88,0.2)' }}>
                    <Trophy size={13}/> Share
                  </button>
                </div>

                <p className="text-xs text-center mt-3" style={{ color: 'var(--text-3)' }}>
                  Word opens in Microsoft Word · PDF opens print dialog — choose Save as PDF
                </p>
              </>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-center py-12" style={{ color: 'var(--text-3)' }}>No data found for {year}</p>
      )}
    </AppShell>
  );
}

// Re-export Check so it resolves (used above)
function Check({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
