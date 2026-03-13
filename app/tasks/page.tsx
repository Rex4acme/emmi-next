'use client';
// app/tasks/page.tsx — Maintenance Task Management
// Engineers assign tasks to each other. All tasks visible org-wide.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { getProfile, getOrgTasks, getOrgMembers, updateTask, createTask, getEquipment } from '@/lib/db';
import { fmtRelative } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import {
  Plus, CheckCircle, Clock, AlertCircle,
  ChevronDown, User, Cpu, X, ClipboardList,
} from 'lucide-react';
import type { Task, Profile, Equipment, TaskPriority, TaskStatus } from '@/types';

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  critical: 'var(--red)',
  high:     'var(--amber)',
  medium:   '#d29922',
  low:      'var(--green)',
};

const STATUS_ICON: Record<TaskStatus, React.ReactNode> = {
  open:        <Clock size={13}/>,
  in_progress: <AlertCircle size={13}/>,
  completed:   <CheckCircle size={13}/>,
  cancelled:   <X size={13}/>,
};

export default function TasksPage() {
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [profile,    setProfile]    = useState<any>(null);
  const [tasks,      setTasks]      = useState<Task[]>([]);
  const [members,    setMembers]    = useState<Profile[]>([]);
  const [equipment,  setEquipment]  = useState<Equipment[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showNew,    setShowNew]    = useState(false);
  const [filter,     setFilter]     = useState<'all' | 'mine'>('all');
  const [currentUid, setCurrentUid] = useState('');

  // New task form
  const [newTitle,      setNewTitle]      = useState('');
  const [newDesc,       setNewDesc]       = useState('');
  const [newPriority,   setNewPriority]   = useState<TaskPriority>('medium');
  const [newAssignee,   setNewAssignee]   = useState('');
  const [newEquipment,  setNewEquipment]  = useState('');
  const [newDueDate,    setNewDueDate]    = useState('');
  const [saving,        setSaving]        = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth'); return; }
    setCurrentUid(user.id);

    const p = await getProfile(supabase, user.id) as any;
    setProfile(p);

    if (p?.org_id) {
      const [t, m] = await Promise.all([
        getOrgTasks(supabase, p.org_id),
        getOrgMembers(supabase, p.org_id),
      ]);
      setTasks(t as Task[]);
      setMembers(m);
    }

    const eq = await getEquipment(supabase, user.id);
    setEquipment(eq);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.org_id || !newTitle.trim()) return;
    setSaving(true);
    try {
      const assigneeMember = members.find(m => m.id === newAssignee);
      await createTask(supabase, currentUid, {
        org_id:           profile.org_id,
        title:            newTitle.trim(),
        description:      newDesc.trim() || undefined,
        priority:         newPriority,
        status:           'open',
        assigned_to:      newAssignee || undefined,
        equipment_id:     newEquipment || undefined,
        due_date:         newDueDate || undefined,
        assigned_to_name: assigneeMember?.full_name || undefined,
      });

      setNewTitle(''); setNewDesc(''); setNewPriority('medium');
      setNewAssignee(''); setNewEquipment(''); setNewDueDate('');
      setShowNew(false);
      await load();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setSaving(false);
  }

  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    await updateTask(supabase, taskId, {
      status:       newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : undefined,
    });
    await load();
  }

  const filtered = filter === 'mine'
    ? tasks.filter(t => t.assigned_to === currentUid || t.created_by === currentUid)
    : tasks;

  const openCount = tasks.filter(t => t.status === 'open' || t.status === 'in_progress').length;

  return (
    <AppShell
      title="Tasks"
      action={
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
          style={{ background: 'var(--amber)', color: '#000' }}>
          <Plus size={14}/> New Task
        </button>
      }
    >
      {/* No org warning */}
      {!profile?.org_id && !loading && (
        <div className="card mb-4"
          style={{ background: 'rgba(240,165,0,0.06)', border: '1px solid rgba(240,165,0,0.2)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--amber)' }}>Set Plant ID to use Tasks</p>
          <p className="text-xs mb-2" style={{ color: 'var(--text-2)' }}>
            Tasks are shared with your plant colleagues. Add your Plant ID in your profile first.
          </p>
          <Link href="/profile">
            <button className="text-xs px-3 py-1.5 rounded-lg font-bold"
              style={{ background: 'rgba(240,165,0,0.15)', color: 'var(--amber)', border: '1px solid rgba(240,165,0,0.3)' }}>
              Go to Profile →
            </button>
          </Link>
        </div>
      )}

      {/* Summary */}
      {openCount > 0 && (
        <div className="card mb-4 flex items-center gap-3"
          style={{ background: 'rgba(248,81,73,0.05)', border: '1px solid rgba(248,81,73,0.15)' }}>
          <AlertCircle size={18} style={{ color: 'var(--red)', flexShrink: 0 }}/>
          <p className="text-sm">
            <span className="font-bold" style={{ color: 'var(--red)' }}>{openCount}</span>
            <span style={{ color: 'var(--text-2)' }}> open tasks in your plant</span>
          </p>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {(['all', 'mine'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
            style={{
              background: filter === f ? 'var(--amber)' : 'var(--card)',
              color:      filter === f ? '#000'         : 'var(--text-2)',
              border:     filter === f ? 'none'         : '1px solid var(--border)',
            }}>
            {f === 'all' ? 'All Tasks' : 'My Tasks'}
          </button>
        ))}
      </div>

      {/* New task form */}
      {showNew && (
        <div className="card mb-4" style={{ border: '1px solid rgba(240,165,0,0.25)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold">New Maintenance Task</p>
            <button onClick={() => setShowNew(false)} style={{ color: 'var(--text-3)' }}>
              <X size={16}/>
            </button>
          </div>
          <form onSubmit={handleCreateTask} className="space-y-3">
            <input className="form-input" placeholder="Task title *" required
              value={newTitle} onChange={e => setNewTitle(e.target.value)}/>

            <textarea className="form-input" rows={2} placeholder="Description (optional)"
              value={newDesc} onChange={e => setNewDesc(e.target.value)}/>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="form-label">Priority</label>
                <select className="form-input" value={newPriority}
                  onChange={e => setNewPriority(e.target.value as TaskPriority)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="form-label">Due Date</label>
                <input type="date" className="form-input" value={newDueDate}
                  onChange={e => setNewDueDate(e.target.value)}/>
              </div>
            </div>

            <div>
              <label className="form-label">Assign To</label>
              <select className="form-input" value={newAssignee}
                onChange={e => setNewAssignee(e.target.value)}>
                <option value="">— Unassigned —</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} {m.id === currentUid ? '(You)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Equipment (optional)</label>
              <select className="form-input" value={newEquipment}
                onChange={e => setNewEquipment(e.target.value)}>
                <option value="">— No equipment —</option>
                {equipment.map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.tag_id} — {eq.name}</option>
                ))}
              </select>
            </div>

            <button type="submit" disabled={saving}
              className="w-full py-2.5 rounded-xl font-bold text-sm"
              style={{ background: 'var(--amber)', color: '#000' }}>
              {saving ? 'Creating…' : 'Create Task'}
            </button>
          </form>
        </div>
      )}

      {/* Task list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="card animate-pulse" style={{ height: 90 }}/>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-10">
          <ClipboardList size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }}/>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>No tasks yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(task => (
            <div key={task.id} className="card"
              style={{ borderLeft: `3px solid ${PRIORITY_COLOR[task.priority]}` }}>

              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  {/* Priority + status */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="chip text-xs"
                      style={{
                        background: `${PRIORITY_COLOR[task.priority]}18`,
                        color:      PRIORITY_COLOR[task.priority],
                        border:     `1px solid ${PRIORITY_COLOR[task.priority]}40`,
                        fontSize: 9, padding: '1px 6px', textTransform: 'uppercase',
                      }}>
                      {task.priority}
                    </span>
                    {task.due_date && (
                      <span className="text-xs" style={{ color: new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'var(--red)' : 'var(--text-3)' }}>
                        Due {new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-semibold mb-1"
                    style={{ color: 'var(--text)', textDecoration: task.status === 'completed' ? 'line-through' : 'none' }}>
                    {task.title}
                  </p>

                  {task.description && (
                    <p className="text-xs mb-1.5 leading-relaxed" style={{ color: 'var(--text-3)' }}>
                      {task.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3 flex-wrap">
                    {(task as any).equipment && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-3)' }}>
                        <Cpu size={11}/> {(task as any).equipment.tag_id}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-3)' }}>
                      <User size={11}/>
                      {task.assigned_to_name
                        ? (task.assigned_to === currentUid ? 'You' : task.assigned_to_name)
                        : 'Unassigned'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                      {fmtRelative(task.created_at!)}
                    </span>
                  </div>
                </div>

                {/* Status changer */}
                <div className="flex-shrink-0">
                  <select
                    value={task.status}
                    onChange={e => handleStatusChange(task.id, e.target.value as TaskStatus)}
                    className="text-xs px-2 py-1 rounded-lg font-bold"
                    style={{
                      background: `${PRIORITY_COLOR[task.priority]}15`,
                      color:      PRIORITY_COLOR[task.priority],
                      border:     `1px solid ${PRIORITY_COLOR[task.priority]}30`,
                    }}>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
