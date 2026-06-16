import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { Bell, Check } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';

export default function NotificationBell({ user }) {
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const fetchNotifications = async () => {
        try {
            if (!user) return;
            const data = await api.getNotifications();
            setNotifications(data);
        } catch (err) {
            console.error('Failed to load notifications', err);
        }
    };

    const { socket } = useSocket();

    useEffect(() => {
        fetchNotifications();
        
        if (!socket) return;

        const handleRealtimeUpdate = () => {
            fetchNotifications();
        };

        socket.on('newNotification', handleRealtimeUpdate);
        socket.on('receiveMessage', handleRealtimeUpdate);
        socket.on('newMentorshipRequest', handleRealtimeUpdate);
        socket.on('mentorshipResponse', handleRealtimeUpdate);
        socket.on('newJobApplication', handleRealtimeUpdate);
        socket.on('jobsUpdated', handleRealtimeUpdate);
        socket.on('adminDataUpdated', handleRealtimeUpdate);
        socket.on('permissionsUpdated', handleRealtimeUpdate);

        return () => {
            socket.off('newNotification', handleRealtimeUpdate);
            socket.off('receiveMessage', handleRealtimeUpdate);
            socket.off('newMentorshipRequest', handleRealtimeUpdate);
            socket.off('mentorshipResponse', handleRealtimeUpdate);
            socket.off('newJobApplication', handleRealtimeUpdate);
            socket.off('jobsUpdated', handleRealtimeUpdate);
            socket.off('adminDataUpdated', handleRealtimeUpdate);
            socket.off('permissionsUpdated', handleRealtimeUpdate);
        };
    }, [user, socket]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [showAll, setShowAll] = useState(false);

    const getCategoryStyles = (category) => {
        switch (category) {
            case 'Chat': return { bg: 'rgba(52, 211, 153, 0.2)', color: '#34D399', label: 'Message' };
            case 'Permission': return { bg: 'rgba(251, 191, 36, 0.2)', color: '#FBBF24', label: 'Access' };
            case 'Delete': return { bg: 'rgba(239, 68, 68, 0.2)', color: '#EF4444', label: 'Removed' };
            case 'System': return { bg: 'rgba(96, 165, 250, 0.2)', color: '#60A5FA', label: 'System' };
            default: return { bg: 'rgba(255, 255, 255, 0.1)', color: 'white', label: 'General' };
        }
    };

    const handleMarkAsRead = async (id, e) => {
        e.stopPropagation();
        try {
            await api.markNotificationRead(id);
            setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: 1 } : n));
        } catch (err) {
            console.error('Failed to mark notification as read', err);
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        try {
            await api.deleteNotification(id);
            setNotifications(notifications.filter(n => n.id !== id));
        } catch (err) {
            console.error('Failed to delete notification', err);
        }
    };

    const filteredNotifications = showAll ? notifications : notifications.filter(n => !n.is_read);
    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
                className="btn btn-secondary"
                style={{ padding: '8px', position: 'relative', borderRadius: '50%' }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        background: '#EF4444',
                        color: 'white',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        borderRadius: '10px',
                        padding: '2px 6px',
                        minWidth: '20px',
                        textAlign: 'center'
                    }}>
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="glass-panel" style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    width: '380px',
                    maxHeight: '500px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    padding: 0,
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                        <span style={{ fontWeight: 'bold' }}>Notifications</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                                onClick={() => setShowAll(!showAll)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
                            >
                                {showAll ? 'Show Unread' : 'Show All'}
                            </button>
                        </div>
                    </div>

                    {filteredNotifications.length === 0 ? (
                        <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <Bell size={32} style={{ opacity: 0.2, marginBottom: '12px' }} />
                            <p style={{ margin: 0 }}>No {showAll ? '' : 'unread '}notifications yet.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {filteredNotifications.map(notification => {
                                const cat = getCategoryStyles(notification.category);
                                return (
                                    <div
                                        key={notification.id}
                                        style={{
                                            padding: '16px',
                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            background: notification.is_read ? 'transparent' : 'rgba(79, 70, 229, 0.08)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px',
                                            transition: 'background 0.2s',
                                            position: 'relative'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ 
                                                fontSize: '0.65rem', 
                                                padding: '2px 8px', 
                                                background: cat.bg, 
                                                color: cat.color, 
                                                borderRadius: '10px',
                                                fontWeight: 'bold',
                                                textTransform: 'uppercase'
                                            }}>
                                                {cat.label}
                                            </span>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {!notification.is_read && (
                                                    <button
                                                        onClick={(e) => handleMarkAsRead(notification.id, e)}
                                                        style={{ background: 'transparent', border: 'none', color: '#10B981', cursor: 'pointer', padding: '4px' }}
                                                        title="Mark as read"
                                                    >
                                                        <Check size={16} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => handleDelete(notification.id, e)}
                                                    style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px', opacity: 0.6 }}
                                                    title="Remove"
                                                >
                                                    <span style={{ fontSize: '1.2rem', lineHeight: '14px' }}>&times;</span>
                                                </button>
                                            </div>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.4', opacity: notification.is_read ? 0.7 : 1 }}>
                                            {notification.message}
                                        </p>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                                            {new Date(notification.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
