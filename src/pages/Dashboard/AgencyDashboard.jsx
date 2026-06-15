import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ArrowRight, ExternalLink } from 'lucide-react';
import api from '../../lib/api';

export default function AgencyDashboard() {
  const navigate = useNavigate();
  const [agency, setAgency] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/agencies/my').then(d => setAgency(d || {})).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">Đang tải...</div>;

  const domain = agency?.domain;

  if (domain) {
    window.location.href = `https://${domain}/agency-admin`;
    return (
      <div className="max-w-md mx-auto mt-12 p-8 bg-white rounded-xl shadow-sm border border-slate-200 text-center">
        <Store className="mx-auto text-indigo-600 mb-3" size={32} />
        <h2 className="text-lg font-bold text-slate-800 mb-2">Đang chuyển hướng...</h2>
        <p className="text-slate-500 text-sm mb-4">Quản lý đại lý đã chuyển đến trang admin riêng.</p>
        <a href={`https://${domain}/agency-admin`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
          Đến trang quản lý <ArrowRight size={16} />
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-12 p-8 bg-white rounded-xl shadow-sm border border-slate-200 text-center">
      <Store className="mx-auto text-slate-400 mb-3" size={32} />
      <h2 className="text-lg font-bold text-slate-800 mb-2">Chưa cấu hình web con</h2>
      <p className="text-slate-500 text-sm mb-4">Bạn cần tạo và cấu hình web con trước khi quản lý.</p>
      <button onClick={() => navigate('/buyer/dashboard')}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium">
        Quay lại Dashboard
      </button>
    </div>
  );
}
