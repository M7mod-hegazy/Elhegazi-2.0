import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationContextValue {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Provider component
interface NotificationProviderProps {
  children: React.ReactNode;
  maxNotifications?: number;
}

export const NotificationProvider = ({ 
  children, 
  maxNotifications = 5 
}: NotificationProviderProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration ?? 5000,
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      // Limit the number of notifications
      return updated.slice(0, maxNotifications);
    });

    // Auto-remove non-persistent notifications
    if (!notification.persistent && newNotification.duration! > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }, [maxNotifications, removeNotification]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      removeNotification,
      clearAll
    }}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
};

// Notification Container (renders the notifications)
const NotificationContainer = () => {
  const { notifications, removeNotification } = useNotifications();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRemove={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
};

// Individual notification item
interface NotificationItemProps {
  notification: Notification;
  onRemove: () => void;
}

const NotificationItem = ({ notification, onRemove }: NotificationItemProps) => {
  const { type, title, message, action } = notification;

  const typeConfig = {
    success: {
      icon: CheckCircle,
      colors: 'bg-green-50/95 border-green-200 text-green-800',
      iconColors: 'text-green-600'
    },
    error: {
      icon: AlertCircle,
      colors: 'bg-red-50/95 border-red-200 text-red-800',
      iconColors: 'text-red-600'
    },
    warning: {
      icon: AlertTriangle,
      colors: 'bg-yellow-50/95 border-yellow-200 text-yellow-800',
      iconColors: 'text-yellow-600'
    },
    info: {
      icon: Info,
      colors: 'bg-primary/5 border-primary/20 text-primary',
      iconColors: 'text-primary'
    }
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div className={cn(
      'backdrop-blur-xl border rounded-2xl shadow-lg p-4 transform transition-all duration-300 animate-in slide-in-from-right-5',
      config.colors
    )}>
      <div className="flex items-start gap-3">
        <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', config.iconColors)} />
        
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm">{title}</h4>
          {message && (
            <p className="text-sm mt-1 opacity-90 leading-relaxed">{message}</p>
          )}
          
          {action && (
            <button
              onClick={action.onClick}
              className="text-sm font-medium underline mt-2 hover:no-underline transition-all"
            >
              {action.label}
            </button>
          )}
        </div>
        
        <button
          onClick={onRemove}
          className="flex-shrink-0 p-1 hover:bg-black/10 rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Convenience hooks for different notification types
export const useNotificationHelpers = () => {
  const { addNotification } = useNotifications();

  return {
    success: (title: string, message?: string, options?: Partial<Notification>) =>
      addNotification({ ...options, type: 'success', title, message }),
    
    error: (title: string, message?: string, options?: Partial<Notification>) =>
      addNotification({ ...options, type: 'error', title, message }),
    
    warning: (title: string, message?: string, options?: Partial<Notification>) =>
      addNotification({ ...options, type: 'warning', title, message }),
    
    info: (title: string, message?: string, options?: Partial<Notification>) =>
      addNotification({ ...options, type: 'info', title, message }),
  };
};