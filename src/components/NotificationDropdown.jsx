import { useState, useMemo, useRef, useEffect } from 'react';
import { Bell, X, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '../lib/api';

const initialNotifications = [
  {
    id: 1,
    title: 'Chiến dịch mới được tạo',
    message: 'Chiến dịch "Tết 2026 - Traffic Social" đã được tạo thành công.',
    time: '5 phút trước',
    type: 'success',
    isRead: false,
  },
  {
    id: 2,
    title: 'Ngân sách sắp hết',
    message: 'Ngân sách của chiến dịch "Remarketing CPC" còn dưới 10%.',
    time: '30 phút trước',
    type: 'warning',
    isRead: false,
  },
  {
    id: 3,
    title: 'Báo cáo hàng ngày đã sẵn sàng',
    message: 'Báo cáo hiệu suất lưu lượng ngày hôm qua đã được cập nhật.',
    time: 'Hôm nay, 08:30',
    type: 'info',
    isRead: true,
  },
];

export default function NotificationDropdown({ isWorker = false }) {
  const role = isWorker ? 'worker' : 'buyer';
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const bellRef = useRef(null);
  const wrapperRef = useRef(null);

  // Fetch notifications from API
  useEffect(() => {
    api.get(`/notifications?role=${role}`).then(data => {
      setNotifications((data.notifications || []).map(n => ({
        ...n,
        title: n.title?.replace(/[✅🎉]/g, '')?.replace('✅', '')?.replace('🎉', '')?.trim(),
        message: n.message?.replace(/[✅🎉]/g, '')?.replace('✅', '')?.replace('🎉', '')?.trim(),
        isRead: !!n.is_read,
        time: new Date(n.created_at).toLocaleString('vi-VN'),
      })));
    }).catch(() => {});
  }, []);

  const getDropdownTop = () => {
    if (!bellRef.current) return 0;
    const rect = bellRef.current.getBoundingClientRect();
    return rect.bottom + 8;
  };

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  const hasUnread = useMemo(
    () => notifications.some((item) => !item.isRead),
    [notifications],
  );

  const handleMarkAllRead = () => {
    api.put(`/notifications/read-all?role=${role}`).catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleSelectNotification = (notification) => {
    api.put(`/notifications/${notification.id}/read`).catch(() => {});
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notification.id ? { ...n, isRead: true } : n,
      ),
    );
    setSelectedNotification(notification);
    setIsDropdownOpen(false);
  };

  const closeModal = () => {
    setSelectedNotification(null);
  };

  const renderTypeIcon = (type, size = 'md') => {
    const base = 'flex items-center justify-center rounded-full';
    if (type === 'success') {
      return (
        <div
          className={`${base} ${
            size === 'lg'
              ? 'w-16 h-16 bg-emerald-50'
              : 'w-9 h-9 bg-emerald-50'
          }`}
        >
          <CheckCircle2
            className={size === 'lg' ? 'w-10 h-10 text-emerald-500' : 'w-5 h-5 text-emerald-500'}
          />
        </div>
      );
    }
    if (type === 'warning') {
      return (
        <div
          className={`${base} ${
            size === 'lg' ? 'w-16 h-16 bg-amber-50' : 'w-9 h-9 bg-amber-50'
          }`}
        >
          <AlertTriangle
            className={size === 'lg' ? 'w-10 h-10 text-amber-500' : 'w-5 h-5 text-amber-500'}
          />
        </div>
      );
    }
    return (
      <div
        className={`${base} ${
          size === 'lg' ? 'w-16 h-16 bg-blue-50' : 'w-9 h-9 bg-blue-50'
        }`}
      >
        <Info
          className={size === 'lg' ? 'w-10 h-10 text-blue-500' : 'w-5 h-5 text-blue-500'}
        />
      </div>
    );
  };

  return (
    <>
      <div className="relative" ref={wrapperRef}>
        <button
          ref={bellRef}
          type="button"
          onClick={() => setIsDropdownOpen((prev) => !prev)}
          className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-slate-100"
        >
          <Bell className="w-5 h-5 text-slate-600" />
          {hasUnread && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
          )}
        </button>
        {isDropdownOpen && (
          <div
            className="notification-dropdown"
            style={{ top: getDropdownTop() }}
          >
            <div
              className="px-4 py-3 border-b border-slate-100 dark:border-slate-700"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <p className="text-sm font-semibold text-slate-900">Thông báo</p>
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
                style={{ whiteSpace: 'nowrap', marginLeft: '12px' }}
              >
                Đánh dấu tất cả đã đọc
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-slate-500">
                  Không có thông báo nào
                </div>
              )}
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleSelectNotification(notification)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                    notification.isRead
                      ? 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'
                      : 'bg-blue-50/50 dark:bg-blue-900/20 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                  }`}
                >
                  <div className="mt-0.5">
                    {renderTypeIcon(notification.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">
                        {notification.title}
                      </p>
                      {!notification.isRead && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {notification.time}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {selectedNotification && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-xl shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-900">
                Chi tiết thông báo
              </p>
              <button
                type="button"
                onClick={closeModal}
                className="p-1 rounded-full hover:bg-slate-100"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="px-6 py-6 flex flex-col items-center text-center">
              {renderTypeIcon(selectedNotification.type, 'lg')}
              <p className="mt-4 text-xl font-bold text-slate-800">
                {selectedNotification.title}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {selectedNotification.message}
              </p>
              <p className="mt-4 text-sm text-slate-400">
                {selectedNotification.time}
              </p>
            </div>
            <div className="px-4 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <button
                type="button"
                onClick={closeModal}
                className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

