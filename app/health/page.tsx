'use client';
// app/health/page.tsx — Equipment Health Scores & Reliability Ranking
// Shows all equipment ranked by health score (worst first).
// Health score is computed from faults in last 30 days + downtime.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { getEquipmentByHealth, recomputeAllHealthScores } from '@/lib/db';
import AppShell from '@/components/layout/AppShell';
import { RefreshCw, Cpu, TrendingDown, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import type { Equipment } from '@/types';

// ── Health score display ──────────────────────────────────────
function HealthBar({ score }: { score: number }) {
  const color =
    score >= 75 ? 'var(--green)'  :
    score >= 40 ? 'var(--amber)'  : 'var(--red)';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: 'var(--border)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="text-xs font-bold font-mono flex-shrink-0" style={{ color, width: 36, textAlign: 'right' }}>
        {score}%
      </span>
    </div>
  );
}

function HealthBadge({ status }: { status: string }) {
  if (status === 'healthy')  return (
    <span className="chip text-xs" style={{ background: 'rgba(52,208,88,0.1)', color: 'var(--green)', border: '1px solid rgba(52,208,88,0.25)', fontSize: 9, padding: '1px 7px' }}>
      ✓ Healthy
    </span>
  );
  if (status === 'warning') return (
    <span className="chip text-xs" style={{ background: 'rgba(240,165,0,0.1)', color: 'var(--amber)', border: '1px solid rgba(240,165,0,0.25)', fontSize: 9, padding: '1px 7px' }}>
      ⚠ Warning
    </span>
  );
  return (
    <span className="chip text-xs" style={{ background: 'rgba(248,81,73,0.1)', color: 'var(--red)', border: '1px solid rgba(248,81,73,0.25)', fontSize: 9, padding: '1px 7px' }}>
      ✗ Critical
    </span>
  );
}

export default function HealthPage() {
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [equipment,   setEquipment]   = useState<Equipment[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function load(recompute = false) {
    if (recompute) setRefreshing(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth'); return; }

    if (recompute) {
      await recomputeAllHealthScores(supabase, user.id);
    }

    const eq = await getEquipmentByHealth(supabase, user.id);
    setEquipment(eq);
    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  // ── Summary counts ────────────────────────────────────────
  const withHealth   = equipment.filter(eq => eq.health);
  const critical     = withHealth.filter(eq => eq.health!.status === 'critical').length;
  const warning      = withHealth.filter(eq => eq.health!.status === 'warning').length;
  const healthy      = withHealth.filter(eq => eq.health!.status === 'healthy').length;
  const noData       = equipment.filter(eq => !eq.health).length;

  // Top worst equipment for quick summary
  const worstThree = withHealth.slice(0, 3);

  return (
    <AppShell
      title="Equipment Health"
      action={
        <button onClick={() => load(true)} disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
          style={{ background: 'var(--card)', color: 'var(--amber)', border: '1px solid rgba(240,165,0,0.25)' }}>
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''}/>
          Recompute
        </button>
      }
    >
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="card text-center py-3" style={{ borderTop: '2px solid var(--red)' }}>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--red)' }}>{critical}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Critical</p>
        </div>
        <div className="card text-center py-3" style={{ borderTop: '2px solid var(--amber)' }}>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--amber)' }}>{warning}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Warning</p>
        </div>
        <div className="card text-center py-3" style={{ borderTop: '2px solid var(--green)' }}>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--green)' }}>{healthy}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Healthy</p>
        </div>
      </div>

      {/* Most problematic */}
      {worstThree.length > 0 && worstThree[0].health?.status !== 'healthy' && (
        <div className="card mb-5" style={{ background: 'rgba(248,81,73,0.05)', border: '1px solid rgba(248,81,73,0.15)' }}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={16} style={{ color: 'var(--red)' }}/>
            <p className="text-sm font-bold" style={{ color: 'var(--red)' }}>Most Problematic This Month</p>
          </div>
          <div className="space-y-2">
            {worstThree
              .filter(eq => eq.health && eq.health.status !== 'healthy')
              .map((eq, i) => (
                <div key={eq.id} className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono" style={{ color: 'var(--text-3)', width: 16 }}>
                    {i + 1}.
                  </span>
                  <span className="tag-chip text-xs">{eq.tag_id}</span>
                  <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-2)' }}>{eq.name}</span>
                  <span className="text-xs font-bold font-mono" style={{ color: 'var(--red)' }}>
                    {eq.health?.fault_count_30d || 0} faults
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Last updated */}
      {lastUpdated && (
        <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>
          Scores based on last 30 days · Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      {/* Equipment list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="card animate-pulse" style={{ height: 90 }}/>
          ))}
        </div>
      ) : equipment.length === 0 ? (
        <div className="card text-center py-10">
          <Cpu size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }}/>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>No equipment yet</p>
          <Link href="/equipment/new">
            <button className="mt-3 px-4 py-2 rounded-xl text-xs font-bold"
              style={{ background: 'var(--amber)', color: '#000' }}>
              Add Equipment
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {equipment.map(eq => {
            const h = eq.health;
            const score = h?.health_score ?? 100;
            const statusColor =
              score >= 75 ? 'var(--green)'  :
              score >= 40 ? 'var(--amber)'  : 'var(--red)';

            return (
              <Link key={eq.id} href={`/equipment/${eq.id}`}>
                <div className="card hover:border-white/20 transition-all"
                  style={{ borderLeft: `3px solid ${statusColor}` }}>

                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="tag-chip text-xs">{eq.tag_id}</span>
                        {h && <HealthBadge status={h.status}/>}
                        {!h && (
                          <span className="text-xs" style={{ color: 'var(--text-3)' }}>No data yet</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{eq.name}</p>
                    </div>
                  </div>

                  <HealthBar score={score}/>

                  {h && (
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                        <span className="font-bold" style={{ color: h.fault_count_30d > 3 ? 'var(--red)' : 'var(--text-2)' }}>
                          {h.fault_count_30d}
                        </span> faults (30d)
                      </span>
                      {h.downtime_30d > 0 && (
                        <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                          <span className="font-bold" style={{ color: 'var(--amber)' }}>
                            {h.downtime_30d < 60
                              ? `${h.downtime_30d}min`
                              : `${(h.downtime_30d / 60).toFixed(1)}h`}
                          </span> downtime
                        </span>
                      )}
                      {h.last_fault_at && (
                        <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                          Last fault: {new Date(h.last_fault_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}

          {noData > 0 && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-3)' }}>
              {noData} equipment item{noData > 1 ? 's have' : ' has'} no fault history yet — click Recompute to initialise scores.
            </p>
          )}
        </div>
      )}
    </AppShell>
  );
}
