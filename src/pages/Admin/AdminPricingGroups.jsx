import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  Plus, Trash2, Edit2, Users, DollarSign, ChevronDown, ChevronRight,
  Search, X, Check, Save, RefreshCw, Tag, ArrowRightLeft,
} from 'lucide-react';
import { useToast } from '../../components/Toast';
import { formatMoney as fmt } from '../../lib/format';
import api from '../../lib/api';

const TRAFFIC_LABELS = {
  google_search: { label: 'Google Search', color: 'bg-blue-100 text-blue-700' },
  direct:        { label: 'Direct',         color: 'bg-violet-100 text-violet-700' },
  social:        { label: 'Social',         color: 'bg-pink-100 text-pink-700' },
};
const TYPE_ORDER = ['google_search', 'direct', 'social'];

// ── Create / Edit Group Modal ──────────────────────────────────────
function GroupModal({ group, onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState(group?.name || '');
  const [desc, setDesc] = useState(group?.description || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return toast.error('Nhập tên nhóm');
    setSaving(true);
    try {
      if (group) {
        await api.put(`/admin/pricing-groups/${group.id}`, { name, description: desc });
      } else {
        await api.post('/admin/pricing-groups', { name, description: desc });
      }
      toast.success(group ? 'Đã cập nhật nhóm' : 'Đã tạo nhóm mới');
      onSaved();
      onClose();
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">{group ? 'Sửa nhóm' : 'Tạo nhóm giá mới'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-600 mb-1 block">Tên nhóm *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="VD: VIP Group, Newbie, Premium..."
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-600 mb-1 block">Mô tả (tùy chọn)</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
              placeholder="Mô tả ngắn về nhóm này..."
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" />
          </div>
          <p className="text-xs text-slate-400">Sau khi tạo, bảng giá sẽ được clone từ giá mặc định. Bạn có thể chỉnh sau.</p>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">Hủy</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50">
            {saving ? 'Đang lưu...' : group ? 'Lưu thay đổi' : 'Tạo nhóm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Assign Member Modal (improved: can see all workers + current group) ──
function AssignModal({ group, allGroups, onClose, onSaved }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'unassigned'

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      const endpoint = filterMode === 'unassigned'
        ? `/admin/pricing-groups-unassigned?search=${encodeURIComponent(search)}`
        : `/admin/pricing-groups-all-workers?search=${encodeURIComponent(search)}`;
      api.get(endpoint)
        .then(d => setUsers(d.users || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [search, filterMode]);

  const toggle = (id) => setSelected(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const handleAssign = async () => {
    if (selected.length === 0) return toast.error('Chọn ít nhất 1 worker');
    setSaving(true);
    try {
      await api.post(`/admin/pricing-groups/${group.id}/members`, { userIds: selected });
      toast.success(`Đã thêm ${selected.length} worker vào nhóm "${group.name}"`);
      onSaved();
      onClose();
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  const getGroupBadge = (u) => {
    if (!u.pricing_group_id) return null;
    if (u.pricing_group_id === group.id) return { label: 'Nhóm này', color: 'bg-indigo-100 text-indigo-700' };
    const g = allGroups.find(x => x.id === u.pricing_group_id);
    return { label: g?.name || `Nhóm #${u.pricing_group_id}`, color: 'bg-amber-100 text-amber-700' };
  };

  const unassignedCount = users.filter(u => !u.pricing_group_id).length;
  const otherGroupCount = users.filter(u => u.pricing_group_id && u.pricing_group_id !== group.id).length;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Thêm worker vào nhóm</h3>
            <p className="text-xs text-slate-400 mt-0.5">Nhóm: <strong>{group.name}</strong></p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><X size={18} /></button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-0 border-b border-slate-100 flex-shrink-0 px-3 pt-2">
          {[
            { id: 'all', label: 'Tất cả worker' },
            { id: 'unassigned', label: 'Chưa có nhóm' },
          ].map(tab => (
            <button key={tab.id} onClick={() => { setFilterMode(tab.id); setSelected([]); }}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition ${filterMode === tab.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Info hint for "all" mode */}
        {filterMode === 'all' && (
          <div className="mx-4 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex-shrink-0">
            <p className="text-xs text-amber-700 flex items-center gap-1.5">
              <ArrowRightLeft size={11} />
              Worker đang ở nhóm khác sẽ được <strong>chuyển sang nhóm này</strong> khi thêm.
            </p>
          </div>
        )}

        <div className="px-6 py-3 border-b border-slate-100 flex-shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm worker theo tên hoặc email..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading ? (
            <div className="flex justify-center py-8"><RefreshCw size={18} className="animate-spin text-slate-400" /></div>
          ) : users.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">Không tìm thấy worker</p>
          ) : (
            <div className="space-y-1.5">
              {users.map(u => {
                const badge = getGroupBadge(u);
                const isCurrentGroup = u.pricing_group_id === group.id;
                return (
                  <label key={u.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition border
                      ${isCurrentGroup ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-100' :
                        selected.includes(u.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={selected.includes(u.id)}
                      onChange={() => !isCurrentGroup && toggle(u.id)} className="sr-only"
                      disabled={isCurrentGroup} />
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition
                      ${isCurrentGroup ? 'border-slate-200 bg-slate-100' :
                        selected.includes(u.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                      {selected.includes(u.id) && !isCurrentGroup && <Check size={12} className="text-white" />}
                      {isCurrentGroup && <Check size={12} className="text-slate-300" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{u.name}</p>
                      <p className="text-xs text-slate-400 truncate">{u.email}</p>
                    </div>
                    {badge && (
                      <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.color}`}>
                        {badge.label}
                      </span>
                    )}
                    {!u.pricing_group_id && (
                      <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        Mặc định
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <div className="text-xs text-slate-400 space-y-0.5">
            <p>{selected.length} đã chọn</p>
            {filterMode === 'all' && !loading && (
              <p className="text-[10px] text-slate-300">
                {unassignedCount} chưa có nhóm · {otherGroupCount} đang ở nhóm khác
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">Hủy</button>
            <button onClick={handleAssign} disabled={saving || selected.length === 0}
              className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50">
              {saving ? 'Đang thêm...' : `Thêm ${selected.length > 0 ? selected.length + ' worker' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Profit margin quick-set panel for a group ──────────────────────
function ProfitMarginPanel({ group, rates, editedRates, setRate }) {
  const [pct, setPct] = useState('');

  const preview = () => {
    if (!pct || isNaN(Number(pct))) return;
    const rate = (100 - Number(pct)) / 100;
    rates.forEach(t => {
      setRate(t.traffic_type, t.duration, 'v1_price', Math.round(t.v1_price * rate));
      setRate(t.traffic_type, t.duration, 'v2_price', Math.round(t.v2_price * rate));
    });
  };

  return (
    <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center gap-3 flex-wrap">
      <span className="text-xs font-bold text-emerald-700">Tính nhanh theo % lãi:</span>
      <div className="relative">
        <input type="number" value={pct} onChange={e => setPct(e.target.value)}
          placeholder="50" min="0" max="100"
          className="w-24 px-3 py-1.5 text-xs border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-400 text-center pr-6" />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
      </div>
      {pct && Number(pct) >= 0 && Number(pct) <= 100 && (
        <span className="text-xs text-emerald-600">Worker nhận <strong>{100 - Number(pct)}%</strong></span>
      )}
      <button onClick={preview} disabled={!pct || isNaN(Number(pct))}
        className="px-3 py-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition disabled:opacity-40">
        Xem trước
      </button>
    </div>
  );
}

// ── Group Card with Rates + Members ───────────────────────────────
function GroupCard({ group, allGroups, defaultTiers, onRefresh, onEdit, onDelete }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('rates'); // 'rates' | 'members'
  const [rates, setRates] = useState([]);
  const [members, setMembers] = useState([]);
  const [editedRates, setEditedRates] = useState({});
  const [loadingRates, setLoadingRates] = useState(false);
  const [savingRates, setSavingRates] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const fetchRates = useCallback(async () => {
    setLoadingRates(true);
    try {
      const [r, m] = await Promise.all([
        api.get(`/admin/pricing-groups/${group.id}/rates`),
        api.get(`/admin/pricing-groups/${group.id}/members`),
      ]);
      setRates(r.rates || []);
      setMembers(m.members || []);
    } catch { }
    setLoadingRates(false);
  }, [group.id]);

  useEffect(() => { if (open) fetchRates(); }, [open, fetchRates]);

  // Build editable rate map: key = `${traffic_type}_${duration}`
  const getRate = (traffic_type, duration, field) => {
    const key = `${traffic_type}_${duration}`;
    if (editedRates[key]?.[field] !== undefined) return editedRates[key][field];
    const found = rates.find(r => r.traffic_type === traffic_type && r.duration === duration);
    return found ? found[field] : 0;
  };
  const setRate = (traffic_type, duration, field, value) => {
    const key = `${traffic_type}_${duration}`;
    setEditedRates(prev => ({ ...prev, [key]: { ...prev[key], [field]: Number(value) || 0 } }));
  };
  const hasChanges = Object.keys(editedRates).length > 0;

  const saveRates = async () => {
    setSavingRates(true);
    try {
      // Build rate array from current rates merged with edits
      const rateArr = rates.map(t => ({
        traffic_type: t.traffic_type,
        duration: t.duration,
        v1_price: getRate(t.traffic_type, t.duration, 'v1_price'),
        v2_price: getRate(t.traffic_type, t.duration, 'v2_price'),
      }));
      await api.put(`/admin/pricing-groups/${group.id}/rates`, { rates: rateArr });
      toast.success('Đã lưu bảng giá nhóm');
      setEditedRates({});
      fetchRates();
    } catch (err) { toast.error(err.message); }
    setSavingRates(false);
  };

  const removeMember = async (userId) => {
    if (!window.confirm('Xóa worker khỏi nhóm này?')) return;
    setRemovingId(userId);
    try {
      await api.delete(`/admin/pricing-groups/${group.id}/members/${userId}`);
      toast.success('Đã xóa worker khỏi nhóm');
      fetchRates();
      onRefresh();
    } catch (err) { toast.error(err.message); }
    setRemovingId(null);
  };

  // Group rates by traffic_type (dùng rates của chính nhóm)
  const tiersGrouped = {};
  rates.forEach(t => { (tiersGrouped[t.traffic_type] = tiersGrouped[t.traffic_type] || []).push(t); });

  const inputCls = 'w-24 px-2 py-1.5 text-xs font-bold text-center border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-transparent';

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-200">
            <Tag size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 text-sm">{group.name}</p>
            {group.description && <p className="text-xs text-slate-400 truncate mt-0.5">{group.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              <Users size={11} /> {Number(group.member_count)} worker
            </span>
            <button onClick={e => { e.stopPropagation(); onEdit(group); }}
              className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition" title="Sửa tên">
              <Edit2 size={14} />
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(group); }}
              className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition" title="Xóa nhóm">
              <Trash2 size={14} />
            </button>
            {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
          </div>
        </div>

        {open && (
          <div className="border-t border-slate-100">
            {/* Tabs */}
            <div className="flex border-b border-slate-100 px-5 pt-3 gap-4">
              {[
                { id: 'rates', label: 'Bảng giá', icon: DollarSign },
                { id: 'members', label: `Thành viên (${members.length})`, icon: Users },
              ].map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 pb-2.5 text-xs font-bold border-b-2 transition ${tab === t.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                  <t.icon size={13} /> {t.label}
                </button>
              ))}
            </div>

            {loadingRates ? (
              <div className="flex justify-center py-8"><RefreshCw size={18} className="animate-spin text-slate-400" /></div>
            ) : tab === 'rates' ? (
              <>
                {/* Quick profit margin calculator */}
                <ProfitMarginPanel
                  group={group}
                  rates={rates}
                  editedRates={editedRates}
                  setRate={setRate}
                />

                <div className="p-5 space-y-4">
                  {Object.entries(tiersGrouped)
                    .sort(([a], [b]) => TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b))
                    .map(([tt, items]) => {
                      const info = TRAFFIC_LABELS[tt] || { label: tt, color: 'bg-slate-100 text-slate-600' };
                      return (
                        <div key={tt}>
                          <span className={`inline-block px-2.5 py-0.5 text-[11px] font-bold rounded-full mb-2 ${info.color}`}>{info.label}</span>
                          <div className="overflow-x-auto">
                            <table className="min-w-[520px] w-full text-xs">
                              <thead>
                                <tr className="bg-slate-50">
                                  <th className="px-4 py-2 text-left font-semibold text-slate-500">Thời gian</th>
                                  <th className="px-4 py-2 text-center font-semibold text-indigo-600">Giá V1 (đ)</th>
                                  <th className="px-4 py-2 text-center font-semibold text-indigo-600">Giá V2 (đ)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {items.map(tier => {
                                  const v1 = getRate(tt, tier.duration, 'v1_price');
                                  const v2 = getRate(tt, tier.duration, 'v2_price');
                                  const changed = editedRates[`${tt}_${tier.duration}`];
                                  return (
                                    <tr key={tier.id} className={changed ? 'bg-indigo-50/40' : 'hover:bg-slate-50'}>
                                      <td className="px-4 py-2 font-bold text-slate-700">{tier.duration}</td>
                                      <td className="px-4 py-2 text-center">
                                        <input type="number" value={v1}
                                          onChange={e => setRate(tt, tier.duration, 'v1_price', e.target.value)}
                                          className={`${inputCls} ${changed ? 'border-indigo-300 bg-white' : ''}`} />
                                      </td>
                                      <td className="px-4 py-2 text-center">
                                        <input type="number" value={v2}
                                          onChange={e => setRate(tt, tier.duration, 'v2_price', e.target.value)}
                                          className={`${inputCls} ${changed ? 'border-indigo-300 bg-white' : ''}`} />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}

                  {hasChanges && (
                    <div className="flex justify-end pt-2">
                      <button onClick={saveRates} disabled={savingRates}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50 shadow-lg shadow-indigo-200">
                        <Save size={14} /> {savingRates ? 'Đang lưu...' : `Lưu thay đổi (${Object.keys(editedRates).length})`}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Members tab */
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-500">{members.length} worker trong nhóm</p>
                  <button onClick={() => setShowAssign(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition">
                    <Plus size={13} /> Thêm / Chuyển worker
                  </button>
                </div>
                {members.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Users size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Chưa có worker nào trong nhóm</p>
                    <button onClick={() => setShowAssign(true)}
                      className="mt-2 text-xs text-indigo-600 font-bold hover:underline">Thêm ngay</button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {members.map(m => (
                      <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 rounded-xl">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-black text-white">{(m.name || '?')[0].toUpperCase()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800 truncate">{m.name}</p>
                          <p className="text-xs text-slate-400 truncate">{m.email}</p>
                        </div>
                        <button onClick={() => removeMember(m.id)} disabled={removingId === m.id}
                          className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition disabled:opacity-40" title="Xóa khỏi nhóm">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showAssign && (
        <AssignModal
          group={group}
          allGroups={allGroups}
          onClose={() => setShowAssign(false)}
          onSaved={() => { fetchRates(); onRefresh(); }}
        />
      )}
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function AdminPricingGroups() {
  usePageTitle('Admin - Nhóm giá Worker');
  const toast = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const gData = await api.get('/admin/pricing-groups');
      setGroups(gData.groups || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (group) => {
    if (!window.confirm(`Xóa nhóm "${group.name}"? Worker trong nhóm sẽ trở về giá mặc định.`)) return;
    try {
      await api.delete(`/admin/pricing-groups/${group.id}`);
      toast.success(`Đã xóa nhóm "${group.name}"`);
      fetchData();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Nhóm giá Worker</h1>
          <p className="text-sm text-slate-500 mt-1">Tạo nhóm giá riêng biệt, gán worker vào nhóm để áp dụng giá khác với mặc định</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-lg shadow-indigo-200 flex-shrink-0">
          <Plus size={15} /> Tạo nhóm mới
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-4 flex gap-3 items-start">
        <DollarSign size={18} className="text-indigo-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-indigo-700">
          <p className="font-bold mb-1">Cách hoạt động</p>
          <ul className="text-xs space-y-1 text-indigo-600">
            <li>• Mọi worker đều phải thuộc 1 nhóm giá — nhóm <strong>Thường</strong> là mặc định.</li>
            <li>• Worker được trả theo giá của nhóm mình đang thuộc.</li>
            <li>• Mỗi worker chỉ thuộc 1 nhóm — thêm vào nhóm mới sẽ tự động <strong>chuyển nhóm</strong>.</li>
            <li>• Khi tạo nhóm mới, giá được clone từ nhóm Thường, bạn chỉnh sau.</li>
          </ul>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-indigo-500" />
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Tag size={28} className="text-indigo-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">Chưa có nhóm giá nào</h3>
          <p className="text-sm text-slate-400 mb-5">Tạo nhóm giá để áp dụng mức thu nhập khác nhau cho từng nhóm worker</p>
          <button onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition">
            <Plus size={14} /> Tạo nhóm đầu tiên
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(g => (
            <GroupCard
              key={g.id}
              group={g}
              allGroups={groups}
              defaultTiers={defaultTiers}
              onRefresh={fetchData}
              onEdit={setEditingGroup}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <GroupModal onClose={() => setShowCreate(false)} onSaved={fetchData} />
      )}
      {editingGroup && (
        <GroupModal group={editingGroup} onClose={() => setEditingGroup(null)} onSaved={fetchData} />
      )}
    </div>
  );
}
