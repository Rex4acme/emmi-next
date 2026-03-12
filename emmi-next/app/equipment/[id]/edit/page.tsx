'use client';
// app/equipment/[id]/edit/page.tsx — Edit Equipment Page
// Pre-fills all fields from existing equipment record.

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { getEquipmentById, getCategories, updateEquipment } from '@/lib/db';
import AppShell from '@/components/layout/AppShell';
import PhotoPicker from '@/components/ui/PhotoPicker';
import { Save, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { Category } from '@/types';

export default function EditEquipmentPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [userId,     setUserId]     = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [initLoad,   setInitLoad]   = useState(true);
  const [photos,     setPhotos]     = useState<string[]>([]);

  // Form fields
  const [tagId,            setTagId]            = useState('');
  const [name,             setName]             = useState('');
  const [categoryId,       setCategoryId]       = useState('');
  const [status,           setStatus]           = useState<'operational'|'faulty'|'under_maintenance'|'decommissioned'>('operational');
  const [location,         setLocation]         = useState('');
  const [area,             setArea]             = useState('');
  const [manufacturer,     setManufacturer]     = useState('');
  const [model,            setModel]            = useState('');
  const [serialNumber,     setSerialNumber]     = useState('');
  const [voltageRating,    setVoltageRating]    = useState('');
  const [powerRating,      setPowerRating]      = useState('');
  const [installationDate, setInstallationDate] = useState('');
  const [warrantyExpiry,   setWarrantyExpiry]   = useState('');
  const [notes,            setNotes]            = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [eq, cats] = await Promise.all([
        getEquipmentById(supabase, id),
        getCategories(supabase, user.id),
      ]);

      if (!eq) { router.push('/equipment'); return; }

      // Pre-fill all fields
      setTagId(eq.tag_id);
      setName(eq.name);
      setCategoryId(eq.category_id || '');
      setStatus(eq.status);
      setLocation(eq.location || '');
      setArea(eq.area || '');
      setManufacturer(eq.manufacturer || '');
      setModel(eq.model || '');
      setSerialNumber(eq.serial_number || '');
      setVoltageRating(eq.voltage_rating || '');
      setPowerRating(eq.power_rating || '');
      setInstallationDate(eq.installation_date || '');
      setWarrantyExpiry(eq.warranty_expiry || '');
      setNotes(eq.notes || '');
      setPhotos(eq.photo_urls || []);
      setCategories(cats);
      setInitLoad(false);
    }
    load();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await updateEquipment(supabase, id, {
        name:              name.trim(),
        category_id:       categoryId       || undefined,
        status,
        location:          location         || undefined,
        area:              area             || undefined,
        manufacturer:      manufacturer     || undefined,
        model:             model            || undefined,
        serial_number:     serialNumber     || undefined,
        voltage_rating:    voltageRating    || undefined,
        power_rating:      powerRating      || undefined,
        installation_date: installationDate || undefined,
        warranty_expiry:   warrantyExpiry   || undefined,
        notes:             notes            || undefined,
        photo_urls:        photos,
      });
      router.push(`/equipment/${id}`);
    } catch (err: any) {
      alert('Error: ' + err.message);
      setLoading(false);
    }
  }

  if (initLoad) {
    return (
      <AppShell title="Edit Equipment">
        <div className="flex justify-center py-12">
          <div className="loading-dots"><span/><span/><span/></div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Edit Equipment">
      <Link href={`/equipment/${id}`} className="flex items-center gap-1 text-xs mb-4" style={{ color: 'var(--text-2)' }}>
        <ArrowLeft size={13}/> Back
      </Link>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Tag ID (read-only — can't change a tag) */}
        <div>
          <label className="form-label">Tag ID (read-only)</label>
          <div className="form-input font-mono" style={{ color: 'var(--text-3)', cursor: 'not-allowed' }}>{tagId}</div>
          <p className="form-hint">Tag IDs cannot be changed after creation</p>
        </div>

        {/* Status */}
        <div>
          <label className="form-label req">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value as any)} className="form-input">
            <option value="operational">Operational</option>
            <option value="faulty">Faulty</option>
            <option value="under_maintenance">Under Maintenance</option>
            <option value="decommissioned">Decommissioned</option>
          </select>
        </div>

        {/* Name */}
        <div>
          <label className="form-label req">Equipment Name</label>
          <input value={name} onChange={e => setName(e.target.value)} required className="form-input"/>
        </div>

        {/* Category */}
        <div>
          <label className="form-label">Category</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="form-input">
            <option value="">— Select category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>

        {/* Location + Area */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)} className="form-input"/>
          </div>
          <div>
            <label className="form-label">Area</label>
            <input value={area} onChange={e => setArea(e.target.value)} className="form-input"/>
          </div>
        </div>

        {/* Manufacturer + Model */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Manufacturer</label>
            <input value={manufacturer} onChange={e => setManufacturer(e.target.value)} className="form-input"/>
          </div>
          <div>
            <label className="form-label">Model</label>
            <input value={model} onChange={e => setModel(e.target.value)} className="form-input"/>
          </div>
        </div>

        <div>
          <label className="form-label">Serial Number</label>
          <input value={serialNumber} onChange={e => setSerialNumber(e.target.value)} className="form-input font-mono"/>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Voltage Rating</label>
            <input value={voltageRating} onChange={e => setVoltageRating(e.target.value)} className="form-input font-mono"/>
          </div>
          <div>
            <label className="form-label">Power Rating</label>
            <input value={powerRating} onChange={e => setPowerRating(e.target.value)} className="form-input font-mono"/>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Installation Date</label>
            <input type="date" value={installationDate} onChange={e => setInstallationDate(e.target.value)} className="form-input"/>
          </div>
          <div>
            <label className="form-label">Warranty Expiry</label>
            <input type="date" value={warrantyExpiry} onChange={e => setWarrantyExpiry(e.target.value)} className="form-input"/>
          </div>
        </div>

        <div>
          <label className="form-label">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} className="form-input" rows={3}/>
        </div>

        {/* Photos */}
        {userId && (
          <div>
            <label className="form-label">Photos</label>
            <PhotoPicker photos={photos} onChange={setPhotos} folder="equipment" userId={userId}/>
          </div>
        )}

        <button type="submit" disabled={loading || !name.trim()}
          className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
          style={{ background: loading ? 'rgba(74,158,255,0.5)' : 'var(--blue)', color: '#fff' }}>
          {loading ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
          {loading ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </AppShell>
  );
}
