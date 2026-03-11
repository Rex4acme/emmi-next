'use client';
// app/equipment/new/page.tsx — Add New Equipment Form

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { getCategories, addCategory, createEquipment } from '@/lib/db';
import AppShell from '@/components/layout/AppShell';
import PhotoPicker from '@/components/ui/PhotoPicker';
import { Save, Loader2, ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import type { Category } from '@/types';

export default function NewEquipmentPage() {
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [userId,     setUserId]     = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [photos,     setPhotos]     = useState<string[]>([]);
  const [newCatName, setNewCatName] = useState('');  // for adding new category inline
  const [showNewCat, setShowNewCat] = useState(false);

  // Form fields
  const [tagId,            setTagId]            = useState('');
  const [name,             setName]             = useState('');
  const [categoryId,       setCategoryId]       = useState('');
  const [status,           setStatus]           = useState<'operational'|'faulty'|'under_maintenance'>('operational');
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
      const cats = await getCategories(supabase, user.id);
      setCategories(cats);
    }
    load();
  }, []);

  // Add a new custom category without leaving the form
  async function handleAddCategory() {
    if (!newCatName.trim() || !userId) return;
    const newCat = await addCategory(supabase, userId, newCatName.trim());
    setCategories([...categories, newCat]);
    setCategoryId(newCat.id);
    setNewCatName('');
    setShowNewCat(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tagId.trim() || !name.trim() || !userId) return;
    setLoading(true);
    try {
      await createEquipment(supabase, userId, {
        tag_id:            tagId.trim().toUpperCase(),
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
      router.push('/equipment');
    } catch (err: any) {
      alert('Error: ' + err.message);
      setLoading(false);
    }
  }

  return (
    <AppShell title="Add Equipment">
      <Link href="/equipment" className="flex items-center gap-1 text-xs mb-4" style={{ color: 'var(--text-2)' }}>
        <ArrowLeft size={13}/> Back
      </Link>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Tag ID + Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label req">Tag ID</label>
            <input value={tagId} onChange={e => setTagId(e.target.value)}
              placeholder="e.g. TR-001" required className="form-input font-mono"/>
            <p className="form-hint">Unique equipment tag</p>
          </div>
          <div>
            <label className="form-label req">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)} className="form-input">
              <option value="operational">Operational</option>
              <option value="faulty">Faulty</option>
              <option value="under_maintenance">Under Maintenance</option>
            </select>
          </div>
        </div>

        {/* Equipment Name */}
        <div>
          <label className="form-label req">Equipment Name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Main HV Power Transformer" required className="form-input"/>
        </div>

        {/* Category */}
        <div>
          <label className="form-label">Category</label>
          <div className="flex gap-2">
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
              className="form-input flex-1">
              <option value="">— Select category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
            <button type="button" onClick={() => setShowNewCat(!showNewCat)}
              className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1"
              style={{ border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              <Plus size={12}/>New
            </button>
          </div>
          {/* Inline new category input */}
          {showNewCat && (
            <div className="flex gap-2 mt-2">
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                placeholder="New category name" className="form-input flex-1"/>
              <button type="button" onClick={handleAddCategory}
                className="px-3 py-2 rounded-lg text-xs font-semibold"
                style={{ background: 'var(--amber)', color: '#000' }}>
                Add
              </button>
            </div>
          )}
        </div>

        {/* Location + Area */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Substation A — Bay 1" className="form-input"/>
          </div>
          <div>
            <label className="form-label">Area / Zone</label>
            <input value={area} onChange={e => setArea(e.target.value)}
              placeholder="e.g. Zone A" className="form-input"/>
          </div>
        </div>

        {/* Manufacturer + Model */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Manufacturer</label>
            <input value={manufacturer} onChange={e => setManufacturer(e.target.value)}
              placeholder="e.g. ABB, Siemens" className="form-input"/>
          </div>
          <div>
            <label className="form-label">Model</label>
            <input value={model} onChange={e => setModel(e.target.value)}
              placeholder="Model number" className="form-input"/>
          </div>
        </div>

        {/* Serial + Voltage + Power */}
        <div>
          <label className="form-label">Serial Number</label>
          <input value={serialNumber} onChange={e => setSerialNumber(e.target.value)}
            placeholder="Serial number" className="form-input font-mono"/>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Voltage Rating</label>
            <input value={voltageRating} onChange={e => setVoltageRating(e.target.value)}
              placeholder="e.g. 11kV / 415V" className="form-input font-mono"/>
          </div>
          <div>
            <label className="form-label">Power Rating</label>
            <input value={powerRating} onChange={e => setPowerRating(e.target.value)}
              placeholder="e.g. 2.5 MVA" className="form-input font-mono"/>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Installation Date</label>
            <input type="date" value={installationDate} onChange={e => setInstallationDate(e.target.value)}
              className="form-input"/>
          </div>
          <div>
            <label className="form-label">Warranty Expiry</label>
            <input type="date" value={warrantyExpiry} onChange={e => setWarrantyExpiry(e.target.value)}
              className="form-input"/>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="form-label">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Additional notes, maintenance history, special considerations…"
            className="form-input" rows={3}/>
        </div>

        {/* Photos */}
        {userId && (
          <div>
            <label className="form-label">Equipment Photos</label>
            <PhotoPicker photos={photos} onChange={setPhotos} folder="equipment" userId={userId}/>
          </div>
        )}

        {/* Submit */}
        <button type="submit" disabled={loading || !tagId.trim() || !name.trim()}
          className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
          style={{ background: loading ? 'rgba(74,158,255,0.5)' : 'var(--blue)', color: '#fff' }}>
          {loading ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
          {loading ? 'Saving…' : 'Save Equipment'}
        </button>
      </form>
    </AppShell>
  );
}
