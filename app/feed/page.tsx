'use client';
// app/feed/page.tsx — delete own posts, flag others, admin can delete any

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { getProfile, getPlantFeed } from '@/lib/db';
import { fmtRelative } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import Image from 'next/image';
import {
  User, Zap, Users, Sun, Sunset, Moon,
  Send, Loader2, MessageSquare, X, RefreshCw,
  Trash2, Flag, MoreVertical, AlertOctagon,
} from 'lucide-react';
import type { FeedItem } from '@/types';

const SEV_COLOR: Record<string,string> = { critical:'var(--red)', high:'var(--amber)', medium:'#d29922', low:'var(--green)' };
const FAULT_SC:  Record<string,string> = { open:'var(--red)', under_investigation:'var(--amber)', resolved:'var(--green)', recurring:'#a371f7' };
const ACT_SC:    Record<string,string> = { planned:'var(--blue)', in_progress:'var(--amber)', completed:'var(--green)', cancelled:'var(--text-3)' };
const SHIFT_ICON: Record<string,React.ReactNode> = { day:<Sun size={13}/>, afternoon:<Sunset size={13}/>, night:<Moon size={13}/> };

function Avatar({ profile, size=28 }: { profile?: any; size?: number }) {
  if (profile?.avatar_url)
    return <Image src={profile.avatar_url} alt={profile.full_name||'Engineer'} width={size} height={size}
      className="rounded-full object-cover flex-shrink-0" style={{ width:size, height:size, border:'1.5px solid var(--border)' }}/>;
  return <div className="rounded-full flex items-center justify-center flex-shrink-0"
    style={{ width:size, height:size, background:'var(--card)', border:'1.5px solid var(--border)' }}>
    <User size={size*0.45} style={{ color:'var(--amber)' }}/></div>;
}

// ── Three-dot menu per card ────────────────────────────────────
function CardMenu({ item, currentUserId, userRole, onDelete, onFlag }:
  { item:FeedItem; currentUserId:string; userRole:string; onDelete:(i:FeedItem)=>void; onFlag:(i:FeedItem)=>void }) {
  const [open,open_] = useState(false);
  const [conf,conf_] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isOwn   = item.user_id === currentUserId;
  const isAdmin = ['admin','senior_engineer'].includes(userRole);
  const canDel  = isOwn || isAdmin;
  const canFlag = !isOwn;
  const hideMenu = !canDel && !canFlag;

  useEffect(() => {
    if (hideMenu) return;
    const h = (e:MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        open_(false);
        conf_(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [hideMenu]);

  if (hideMenu) return null;

  return (
    <div ref={ref} style={{ position:'relative',flexShrink:0 }}>
      <button onClick={()=>{open_(v=>!v);conf_(false);}}
        style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',padding:4,borderRadius:6 }}>
        <MoreVertical size={14}/>
      </button>
      {open && (
        <div style={{ position:'absolute',top:'100%',right:0,zIndex:100,background:'var(--card)',
          border:'1px solid var(--border)',borderRadius:10,padding:'6px 0',minWidth:160,boxShadow:'0 8px 24px rgba(0,0,0,0.4)' }}>
          {canDel && !conf && (
            <button onClick={()=>conf_(true)} style={{ display:'flex',alignItems:'center',gap:8,width:'100%',
              padding:'8px 14px',background:'none',border:'none',cursor:'pointer',color:'var(--red)',fontSize:13 }}>
              <Trash2 size={13}/> {isOwn ? 'Delete my post' : 'Delete (admin)'}
            </button>
          )}
          {conf && (
            <div style={{ padding:'8px 14px' }}>
              <p style={{ fontSize:11,color:'var(--text-2)',marginBottom:8 }}>Delete this post?</p>
              <div style={{ display:'flex',gap:6 }}>
                <button onClick={()=>{onDelete(item);open_(false);conf_(false);}}
                  style={{ flex:1,padding:'5px 0',background:'var(--red)',color:'#fff',border:'none',borderRadius:6,fontSize:11,cursor:'pointer',fontWeight:700 }}>
                  Yes, delete
                </button>
                <button onClick={()=>conf_(false)}
                  style={{ flex:1,padding:'5px 0',background:'var(--surface)',color:'var(--text-2)',border:'1px solid var(--border)',borderRadius:6,fontSize:11,cursor:'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {canFlag && !conf && (
            <button onClick={()=>{onFlag(item);open_(false);}}
              style={{ display:'flex',alignItems:'center',gap:8,width:'100%',
                padding:'8px 14px',background:'none',border:'none',cursor:'pointer',color:'var(--amber)',fontSize:13 }}>
              <Flag size={13}/> Flag as incorrect
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Feed card ──────────────────────────────────────────────────
function FeedCard({ item, currentUserId, userRole, onDelete, onFlag, flagged }:
  { item:FeedItem; currentUserId:string; userRole:string; onDelete:(i:FeedItem)=>void; onFlag:(i:FeedItem)=>void; flagged:boolean }) {
  const isOwn=item.user_id===currentUserId, name=item.profile?.full_name||'Engineer', ptitle=item.profile?.title||'';

  const hdr = (
    <div className="flex items-center gap-2 mb-2">
      <Avatar profile={item.profile} size={28}/>
      <div style={{ flex:1,minWidth:0 }}>
        <span className="text-xs font-semibold" style={{ color:'var(--text)' }}>{isOwn?'You':name}</span>
        {ptitle && <span className="text-xs ml-1.5" style={{ color:'var(--text-3)' }}>{ptitle}</span>}
      </div>
      <span className="text-xs flex-shrink-0" style={{ color:'var(--text-3)' }}>{fmtRelative(item.created_at)}</span>
      <CardMenu item={item} currentUserId={currentUserId} userRole={userRole} onDelete={onDelete} onFlag={onFlag}/>
    </div>
  );
  const flagBadge = flagged && (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg mb-2"
      style={{ background:'rgba(240,165,0,0.08)',border:'1px solid rgba(240,165,0,0.2)' }}>
      <AlertOctagon size={11} style={{ color:'var(--amber)',flexShrink:0 }}/>
      <p style={{ fontSize:10,color:'var(--amber)' }}>Flagged for admin review</p>
    </div>
  );

  if (item.type==='fault' && item.fault) {
    const f=item.fault, sev=SEV_COLOR[f.severity]||'var(--border)';
    return (
      <div className="card" style={{ borderLeft:`3px solid ${sev}`,opacity:flagged?0.75:1 }}>
        {hdr}{flagBadge}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span style={{ background:'rgba(248,81,73,0.1)',color:'var(--red)',border:'1px solid rgba(248,81,73,0.2)',fontSize:9,padding:'1px 6px',borderRadius:20,fontWeight:700 }}>⚡ FAULT</span>
          <span style={{ background:`${sev}18`,color:sev,border:`1px solid ${sev}40`,fontSize:9,padding:'1px 6px',borderRadius:20,fontWeight:700,textTransform:'uppercase' }}>{f.severity}</span>
        </div>
        <Link href={`/faults/${f.id}`}><p className="text-sm font-semibold mb-1 hover:underline" style={{ color:'var(--text)' }}>{f.title}</p></Link>
        <div className="flex items-center gap-2 flex-wrap">
          {f.equipment && <span className="tag-chip text-xs">{f.equipment.tag_id}</span>}
          {f.fault_category && <span className="text-xs" style={{ color:'var(--text-3)' }}>{f.fault_category.icon} {f.fault_category.name}</span>}
          <span className="ml-auto text-xs font-medium capitalize" style={{ color:FAULT_SC[f.status]||'var(--text-3)' }}>{f.status.replace('_',' ')}</span>
        </div>
      </div>
    );
  }
  if (item.type==='activity' && item.activity) {
    const a=item.activity, sc=ACT_SC[a.status]||'var(--text-3)';
    return (
      <div className="card" style={{ borderLeft:`3px solid ${sc}`,opacity:flagged?0.75:1 }}>
        {hdr}{flagBadge}
        <span style={{ background:'rgba(74,158,255,0.1)',color:'var(--blue)',border:'1px solid rgba(74,158,255,0.2)',fontSize:9,padding:'1px 6px',borderRadius:20,fontWeight:700,display:'inline-block',marginBottom:6 }}>🔧 ACTIVITY</span>
        <Link href={`/activities/${a.id}`}><p className="text-sm font-semibold mb-1 hover:underline" style={{ color:'var(--text)' }}>{a.activity_type?.icon||'🔧'} {a.title}</p></Link>
        <div className="flex items-center gap-2 flex-wrap">
          {a.equipment && <span className="tag-chip text-xs">{a.equipment.tag_id}</span>}
          {a.activity_type && <span className="text-xs" style={{ color:'var(--text-3)' }}>{a.activity_type.name}</span>}
          <span className="ml-auto text-xs font-medium capitalize" style={{ color:sc }}>{a.status.replace('_',' ')}</span>
        </div>
      </div>
    );
  }
  if (item.type==='shift_log' && item.shift_log) {
    const s=item.shift_log;
    return (
      <div className="card" style={{ borderLeft:'3px solid var(--purple)',opacity:flagged?0.75:1 }}>
        {hdr}{flagBadge}
        <div className="flex items-center gap-1.5 mb-2">
          <span style={{ background:'rgba(163,113,247,0.1)',color:'var(--purple)',border:'1px solid rgba(163,113,247,0.2)',fontSize:9,padding:'1px 6px',borderRadius:20,fontWeight:700,display:'inline-flex',alignItems:'center',gap:4 }}>
            {SHIFT_ICON[s.shift_type]} SHIFT LOG
          </span>
          <span className="text-xs capitalize" style={{ color:'var(--text-3)' }}>{s.shift_type} · {new Date(s.shift_date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>
        </div>
        {s.summary && <p className="text-xs mb-2 leading-relaxed" style={{ color:'var(--text-2)' }}>{s.summary}</p>}
        {s.open_issues?.length>0 && (
          <div className="mb-2">
            <p className="text-xs font-bold mb-1" style={{ color:'var(--amber)' }}>Open Issues</p>
            {s.open_issues.map((iss:string,i:number) => <p key={i} className="text-xs" style={{ color:'var(--text-2)' }}>• {iss}</p>)}
          </div>
        )}
        {s.handover_notes && (
          <div className="rounded-lg p-2.5" style={{ background:'rgba(163,113,247,0.08)',border:'1px solid rgba(163,113,247,0.15)' }}>
            <p className="text-xs font-bold mb-0.5" style={{ color:'var(--purple)' }}>Handover →</p>
            <p className="text-xs leading-relaxed" style={{ color:'var(--text-2)' }}>{s.handover_notes}</p>
          </div>
        )}
      </div>
    );
  }
  return null;
}

// ── Page ───────────────────────────────────────────────────────
export default function FeedPage() {
  const router=useRouter(), supabase=createBrowserClient();
  const [feed,setFeed]             = useState<FeedItem[]>([]);
  const [myProfile,setMyProfile]   = useState<any>(null);
  const [currentUserId,setCUID]    = useState('');
  const [userRole,setUserRole]     = useState('engineer');
  const [orgId,setOrgId]           = useState<string|null>(null);
  const [loading,setLoading]       = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const [filter,setFilter]         = useState<'all'|'faults'|'activities'|'shifts'>('all');
  const [postText,setPostText]     = useState('');
  const [posting,setPosting]       = useState(false);
  const [showComposer,setComposer] = useState(false);
  const [flagToast,setFlagToast]   = useState('');
  const [flaggedIds,setFlaggedIds] = useState<Set<string>>(() => {
    if(typeof window==='undefined') return new Set();
    try { return new Set(JSON.parse(sessionStorage.getItem('emmi-flagged')||'[]')); } catch { return new Set(); }
  });

  async function load(spin=false) {
    if(spin) setRefreshing(true);
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.push('/auth');return;}
    setCUID(user.id);
    const p=await getProfile(supabase,user.id) as any;
    setMyProfile(p); setOrgId(p?.org_id||null); setUserRole(p?.role||'engineer');
    setFeed(await getPlantFeed(supabase,40));
    setLoading(false); setRefreshing(false);
  }

  useEffect(()=>{load();},[]);
  useEffect(()=>{
    const ch=supabase.channel('feed-rt')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'faults'},()=>load())
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'activities'},()=>load())
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'shift_logs'},()=>load())
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'shift_logs'},()=>load())
      .subscribe();
    return ()=>{supabase.removeChannel(ch);};
  },[]);

  async function handleDelete(item:FeedItem) {
    const tbl=item.type==='fault'?'faults':item.type==='activity'?'activities':'shift_logs';
    const {error}=await supabase.from(tbl).delete().eq('id',item.id);
    if(error){alert('Delete failed: '+error.message);return;}
    setFeed(prev=>prev.filter(i=>!(i.type===item.type&&i.id===item.id)));
  }

  async function handleFlag(item:FeedItem) {
    const next=new Set(flaggedIds); next.add(item.id); setFlaggedIds(next);
    try{sessionStorage.setItem('emmi-flagged',JSON.stringify([...next]));}catch{}
    if(orgId) {
      const who=myProfile?.full_name||'An engineer';
      const what=item.type==='fault'?`fault: "${item.fault?.title}"`:item.type==='activity'?`activity: "${item.activity?.title}"`:`shift log`;
      await supabase.from('shift_logs').insert({
        user_id:currentUserId, org_id:orgId, shift_type:'day',
        shift_date:new Date().toISOString().slice(0,10),
        summary:`🚩 FLAG — ${who} flagged ${what} as incorrect. Admin please review.`,
        logged_by_name:'System',
      });
    }
    setFlagToast('Flagged. Plant admin has been notified.');
    setTimeout(()=>setFlagToast(''),4000);
  }

  async function handlePost(e:React.FormEvent) {
    e.preventDefault(); if(!postText.trim()||!orgId) return; setPosting(true);
    const {data:{user}}=await supabase.auth.getUser(); if(!user){setPosting(false);return;}
    await supabase.from('shift_logs').insert({
      user_id:user.id, org_id:orgId, shift_type:'day',
      shift_date:new Date().toISOString().slice(0,10),
      summary:postText.trim(), logged_by_name:myProfile?.full_name||'Engineer',
    });
    setPostText(''); setComposer(false); setPosting(false); await load();
  }

  const counts={all:feed.length,faults:feed.filter(i=>i.type==='fault').length,activities:feed.filter(i=>i.type==='activity').length,shifts:feed.filter(i=>i.type==='shift_log').length};
  const filtered=filter==='faults'?feed.filter(i=>i.type==='fault'):filter==='activities'?feed.filter(i=>i.type==='activity'):filter==='shifts'?feed.filter(i=>i.type==='shift_log'):feed;
  const TABS=[{key:'all' as const,label:'All'},{key:'faults' as const,label:'⚡ Faults'},{key:'activities' as const,label:'🔧 Activities'},{key:'shifts' as const,label:'📋 Shifts'}];

  return (
    <AppShell title="Plant Feed"
      action={<button onClick={()=>load(true)} disabled={refreshing} className="p-2 rounded-lg"
        style={{ color:'var(--text-2)',background:'var(--card)',border:'1px solid var(--border)' }}>
        <RefreshCw size={16} className={refreshing?'animate-spin':''}/></button>}>

      {/* Flag toast */}
      {flagToast && (
        <div style={{ position:'fixed',bottom:80,left:'50%',transform:'translateX(-50%)',zIndex:999,
          background:'var(--card)',border:'1px solid rgba(240,165,0,0.3)',borderRadius:12,
          padding:'10px 16px',display:'flex',alignItems:'center',gap:8,
          boxShadow:'0 8px 24px rgba(0,0,0,0.4)',whiteSpace:'nowrap' }}>
          <AlertOctagon size={14} style={{ color:'var(--amber)',flexShrink:0 }}/>
          <span style={{ fontSize:12,color:'var(--text)' }}>{flagToast}</span>
        </div>
      )}

      {/* Org / Live banner */}
      {!orgId ? (
        <div className="card mb-4 flex items-start gap-3" style={{ background:'rgba(240,165,0,0.06)',border:'1px solid rgba(240,165,0,0.2)' }}>
          <Users size={18} style={{ color:'var(--amber)',flexShrink:0,marginTop:2 }}/>
          <div>
            <p className="text-sm font-semibold mb-0.5" style={{ color:'var(--amber)' }}>Set your Plant ID to see colleagues</p>
            <p className="text-xs mb-2" style={{ color:'var(--text-2)' }}>Add your Plant ID in your profile to share data.</p>
            <Link href="/profile"><button className="text-xs px-3 py-1.5 rounded-lg font-bold"
              style={{ background:'rgba(240,165,0,0.15)',color:'var(--amber)',border:'1px solid rgba(240,165,0,0.3)' }}>Set Plant ID →</button></Link>
          </div>
        </div>
      ) : (
        <div className="card mb-4 flex items-center gap-2 py-2.5" style={{ background:'rgba(52,208,88,0.05)',border:'1px solid rgba(52,208,88,0.15)' }}>
          <div className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background:'var(--green)' }}/>
          <p className="text-xs" style={{ color:'var(--green)' }}>Live — Plant <span className="font-bold font-mono">{orgId}</span></p>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={()=>setComposer(v=>!v)} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-bold"
              style={{ background:'rgba(74,158,255,0.12)',color:'var(--blue)',border:'1px solid rgba(74,158,255,0.25)' }}>
              <MessageSquare size={11}/> Post Update
            </button>
            <Link href="/shift-log/new"><button className="text-xs px-2.5 py-1 rounded-lg font-bold"
              style={{ background:'rgba(163,113,247,0.15)',color:'var(--purple)',border:'1px solid rgba(163,113,247,0.25)' }}>+ Shift Log</button></Link>
          </div>
        </div>
      )}

      {/* Composer */}
      {showComposer && orgId && (
        <div className="card mb-4" style={{ border:'1px solid rgba(74,158,255,0.25)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold" style={{ color:'var(--blue)' }}>Post update to plant</p>
            <button onClick={()=>{setComposer(false);setPostText('');}} style={{ color:'var(--text-3)',background:'none',border:'none',cursor:'pointer' }}><X size={14}/></button>
          </div>
          <form onSubmit={handlePost} className="flex flex-col gap-2">
            <textarea value={postText} onChange={e=>setPostText(e.target.value)} placeholder="Post update, parts request, safety alert…" rows={3} className="form-input" style={{ resize:'none',fontSize:13 }}/>
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color:'var(--text-3)' }}>Visible to all plant engineers</p>
              <button type="submit" disabled={posting||!postText.trim()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold"
                style={{ background:posting?'rgba(74,158,255,0.3)':'var(--blue)',color:'#fff' }}>
                {posting?<Loader2 size={12} className="animate-spin"/>:<Send size={12}/>}{posting?'Posting…':'Post'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth:'none' }}>
        {TABS.map(tab=>{
          const count=counts[tab.key],active=filter===tab.key;
          return <button key={tab.key} onClick={()=>setFilter(tab.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0 transition-all"
            style={{ background:active?'var(--amber)':'var(--card)',color:active?'#000':'var(--text-2)',border:active?'none':'1px solid var(--border)' }}>
            {tab.label}
            {count>0 && <span style={{ background:active?'rgba(0,0,0,0.2)':'var(--surface)',color:active?'#000':'var(--text-3)',borderRadius:999,padding:'0 5px',fontSize:9,fontWeight:800 }}>{count}</span>}
          </button>;
        })}
      </div>

      {/* Feed list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="card animate-pulse" style={{ height:100 }}/>)}</div>
      ) : filtered.length===0 ? (
        <div className="card text-center py-12">
          <Zap size={32} style={{ color:'var(--text-3)',margin:'0 auto 12px' }}/>
          <p className="text-sm font-semibold mb-1" style={{ color:'var(--text-2)' }}>{filter==='all'?'No entries yet':`No ${filter} yet`}</p>
          <p className="text-xs mb-4" style={{ color:'var(--text-3)' }}>{!orgId?'Set your Plant ID in Profile':'Log a fault or activity to get started'}</p>
          {orgId && filter==='all' && (
            <div className="flex gap-2 justify-center flex-wrap">
              <Link href="/faults/new"><button className="px-3 py-2 rounded-lg text-xs font-bold" style={{ background:'rgba(248,81,73,0.15)',color:'var(--red)',border:'1px solid rgba(248,81,73,0.2)' }}>⚡ Log Fault</button></Link>
              <Link href="/activities/new"><button className="px-3 py-2 rounded-lg text-xs font-bold" style={{ background:'rgba(74,158,255,0.12)',color:'var(--blue)',border:'1px solid rgba(74,158,255,0.2)' }}>🔧 Log Activity</button></Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item=>(
            <FeedCard key={`${item.type}-${item.id}`} item={item} currentUserId={currentUserId}
              userRole={userRole} onDelete={handleDelete} onFlag={handleFlag} flagged={flaggedIds.has(item.id)}/>
          ))}
        </div>
      )}
    </AppShell>
  );
}
