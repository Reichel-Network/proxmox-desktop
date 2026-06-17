import { useState, useEffect } from 'react';
import { apiGet, apiPut } from '../utils/api';
import { useToast } from '../components/Toast';
import type { PveGuest } from '@shared/types';

export function GuestNotes({ guest }: { guest: PveGuest }) {
  const toast = useToast();
  const base = `/nodes/${guest.node}/${guest.type}/${guest.vmid}/config`;
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<Record<string, any>>(base)
      .then((cfg) => {
        setNotes(cfg.description || '');
        setTags((cfg.tags ? String(cfg.tags).split(/[;,]/) : []).filter(Boolean));
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guest.vmid]);

  function addTag() {
    const t = newTag.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setNewTag('');
  }

  async function save() {
    setSaving(true);
    try {
      const res = await apiPut(base, { description: notes, tags: tags.join(';') });
      if (res.ok) toast.success('Notes & tags saved');
      else toast.error(res.error || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading-center"><span className="spinner spinner-lg" /> Loading…</div>;

  return (
    <div className="flex-col" style={{ gap: 16 }}>
      <div className="card">
        <div className="card-head">🏷️ Tags</div>
        <div className="card-body">
          <div className="flex" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {tags.map((t) => (
              <span key={t} className="tag" style={{ fontSize: 12.5, padding: '3px 9px' }}>
                {t}
                <span style={{ cursor: 'pointer', marginLeft: 6, color: 'var(--text-faint)' }}
                  onClick={() => setTags(tags.filter((x) => x !== t))}>✕</span>
              </span>
            ))}
            {tags.length === 0 && <span className="text-dim" style={{ fontSize: 13 }}>No tags</span>}
          </div>
          <div className="flex" style={{ gap: 8 }}>
            <input value={newTag} placeholder="add-tag" onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()} />
            <button className="btn btn-sm" onClick={addTag}>+ Add</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">📝 Notes (Markdown)</div>
        <div className="card-body">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe this guest…"
            style={{
              width: '100%', minHeight: 160, resize: 'vertical',
              background: 'var(--bg)', border: '1px solid var(--border-light)',
              color: 'var(--text)', borderRadius: 5, padding: 11, fontSize: 13.5,
              fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>
      </div>

      <div className="flex" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-sm btn-primary" disabled={saving} onClick={save}>
          {saving ? <span className="spinner" /> : '💾 Save'}
        </button>
      </div>
    </div>
  );
}
