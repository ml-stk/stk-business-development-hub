import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Clock, AlertTriangle, Briefcase, ExternalLink } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../config/firebase';
import { notificationService } from '../../services/notificationService';
import { taskService } from '../../services/taskService';
import { AppNotification } from '../../types';
import { useNavigate } from 'react-router-dom';

export const NotificationDropdown: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    if (!currentUser) return;
    try {
      if (auth.currentUser) {
        const tasks = await taskService.getTasksForUser(currentUser);
        await notificationService.checkTaskAlerts(currentUser.uid, tasks);
        const list = await notificationService.getForUser(currentUser.uid);
        setNotifications(list);
      } else {
        const tasks = await taskService.getTasksForUser(currentUser);
        const userTasks = tasks.filter(
          (t) =>
            t.assignedTo === currentUser.uid &&
            t.status !== 'COMPLETED'
        );
        const alerts: AppNotification[] = userTasks.slice(0, 5).map((t) => ({
          id: `alert-${t.id}`,
          userId: currentUser.uid,
          type: 'TASK_OVERDUE',
          title: `Action: ${t.title}`,
          message: `Priority action due ${new Date(t.dueDate).toLocaleDateString()}`,
          relatedEntityType: 'task',
          relatedEntityId: t.id,
          read: false,
          createdAt: t.updatedAt || new Date().toISOString(),
        }));
        setNotifications(alerts);
      }
    } catch (e) {
      console.warn('Notice loading notifications:', e);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [currentUser?.uid]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    if (!currentUser) return;
    await notificationService.markAllAsRead(currentUser.uid, notifications);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.read) {
      await notificationService.markAsRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
    }
    setIsOpen(false);

    if (notif.relatedEntityType === 'task') {
      navigate('/worklist');
    } else if (notif.relatedEntityType === 'organisation') {
      navigate(`/organisations/${notif.relatedEntityId}`);
    } else if (notif.relatedEntityType === 'opportunity') {
      navigate('/opportunities');
    } else if (notif.relatedEntityType === 'engagement') {
      navigate('/engagements');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse shadow-md shadow-rose-500/50">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#141418] rounded-2xl shadow-2xl border border-white/10 py-2 z-50 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-xl">
          <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
                Notifications
              </h4>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-400">
                No notifications right now.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 hover:bg-white/5 transition-colors cursor-pointer flex items-start gap-3 ${
                    !notif.read ? 'bg-indigo-500/10' : ''
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      notif.type === 'TASK_OVERDUE'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : notif.type === 'TASK_DUE_TODAY'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                    }`}
                  >
                    {notif.type === 'TASK_OVERDUE' ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : notif.type === 'TASK_DUE_TODAY' ? (
                      <Clock className="w-3.5 h-3.5" />
                    ) : (
                      <Briefcase className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={`text-xs font-semibold truncate ${
                          !notif.read ? 'text-white' : 'text-neutral-300'
                        }`}
                      >
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 shadow-xs shadow-indigo-500/50" />
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-2">
                      {notif.message}
                    </p>
                    <span className="text-[10px] text-neutral-400 mt-1 block">
                      {new Date(notif.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
