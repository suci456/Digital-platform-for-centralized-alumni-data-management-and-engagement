import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { Send, MessageCircle, Check, CheckCheck } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';

export default function ChatPanel({ currentUser, initialActiveUser = null }) {
    const [contacts, setContacts] = useState([]);
    const [activeContact, setActiveContact] = useState(initialActiveUser);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Use shared context
    const { socket, onlineUsers } = useSocket();
    const [typingUsers, setTypingUsers] = useState({});

    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (!socket) return;

        const handleReceiveMessage = (msg) => {
            setMessages(prev => [...prev, msg]);
            fetchContacts();
        };

        const handleTyping = ({ senderId }) => {
            setTypingUsers(prev => ({ ...prev, [senderId]: true }));
        };

        const handleStopTyping = ({ senderId }) => {
            setTypingUsers(prev => ({ ...prev, [senderId]: false }));
        };

        const handleMessageRead = ({ messageId }) => {
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_read: 1 } : m));
        };

        const handleMessageDeleted = ({ messageId }) => {
            setMessages(prev => prev.filter(m => m.id !== parseInt(messageId)));
        };

        socket.on('receiveMessage', handleReceiveMessage);
        socket.on('typing', handleTyping);
        socket.on('stopTyping', handleStopTyping);
        socket.on('messageRead', handleMessageRead);
        socket.on('messageDeleted', handleMessageDeleted);

        return () => {
            socket.off('receiveMessage', handleReceiveMessage);
            socket.off('typing', handleTyping);
            socket.off('stopTyping', handleStopTyping);
            socket.off('messageRead', handleMessageRead);
            socket.off('messageDeleted', handleMessageDeleted);
        };
    }, [socket, currentUser.id]);

    useEffect(() => {
        fetchContacts();
        if (activeContact) {
            fetchMessages(activeContact.id);
        }
    }, [activeContact]);

    useEffect(() => {
        // Auto-scroll to bottom of messages
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

        // If activeContact and we have unread messages from them, mark as read
        if (activeContact && socket && messages.length > 0) {
            let updated = false;
            messages.forEach(msg => {
                if (msg.sender_id === activeContact.id && !msg.is_read) {
                    socket.emit('markRead', { messageId: msg.id, senderId: msg.sender_id });
                    msg.is_read = 1; // Optimistically update local
                    updated = true;
                }
            });
            if (updated) setMessages([...messages]);
        }
    }, [messages, activeContact, socket]);

    const fetchContacts = async () => {
        try {
            const data = await api.getChatContacts();
            if (activeContact && !data.find(c => c.id === activeContact.id)) {
                setContacts([activeContact, ...data]);
            } else {
                setContacts(data);
            }
        } catch (err) {
            console.error('Failed to load contacts', err);
        }
    };

    const fetchMessages = async (userId) => {
        try {
            setLoading(true);
            const data = await api.getMessages(userId);
            setMessages(data);
        } catch (err) {
            console.error('Failed to load messages', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeContact) return;

        try {
            socket?.emit('stopTyping', { receiverId: activeContact.id });
            const res = await api.sendMessage({ receiverId: activeContact.id, content: newMessage });
            if (res.data) {
                setMessages(prev => [...prev, res.data]);
            }
            setNewMessage('');
            fetchContacts(); 
        } catch (err) {
            alert('Failed to send message');
        }
    };

    const handleTyping = (e) => {
        setNewMessage(e.target.value);
        if (activeContact && socket) {
            if (e.target.value.trim()) {
                socket.emit('typing', { receiverId: activeContact.id });
                // Reset timeout
                clearTimeout(window.typingTimeout);
                window.typingTimeout = setTimeout(() => {
                    socket.emit('stopTyping', { receiverId: activeContact.id });
                }, 2000);
            } else {
                socket.emit('stopTyping', { receiverId: activeContact.id });
            }
        }
    };

    return (
        <div className="glass-card" style={{ display: 'flex', height: '500px', padding: 0, overflow: 'hidden' }}>
            {/* Contacts Sidebar */}
            <div style={{ width: '250px', borderRight: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: 'bold' }}>
                    <MessageCircle size={18} style={{ display: 'inline', marginRight: '8px' }} /> Messages
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {contacts.length === 0 ? (
                        <div style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>No conversations yet.</div>
                    ) : (
                        contacts.map(c => {
                            const isOnline = onlineUsers.includes(String(c.id));
                            return (
                                <div
                                    key={c.id}
                                    onClick={() => setActiveContact(c)}
                                    style={{
                                        padding: '12px 16px',
                                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                                        cursor: 'pointer',
                                        background: activeContact?.id === c.id ? 'rgba(79, 70, 229, 0.2)' : 'transparent',
                                        transition: 'background 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{c.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {typingUsers[c.id] ? <span style={{ color: '#34D399', fontStyle: 'italic' }}>typing...</span> : c.role}
                                        </div>
                                    </div>
                                    {isOnline && (
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <div className="status-pulse"></div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)' }}>
                {activeContact ? (
                    <>
                        {/* Chat Header */}
                        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: 'bold', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {activeContact.name}
                                {onlineUsers.includes(String(activeContact.id)) && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
                                        <div className="status-pulse" style={{ width: '8px', height: '8px' }}></div>
                                        <span style={{ fontSize: '0.75rem', color: '#34D399', fontWeight: 'normal', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Online Now</span>
                                    </div>
                                )}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>
                                {activeContact.role}
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {loading && messages.length === 0 ? (
                                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>
                            ) : (
                                <>
                                    {messages.map(msg => {
                                        // Make sure it belongs to the active conversation
                                        if (msg.sender_id !== activeContact.id && msg.receiver_id !== activeContact.id) return null;

                                        const isMine = msg.sender_id === currentUser.id;
                                        const isSystem = false; // System messages from Admin removed

                                        return (
                                            <div key={msg.id} style={{
                                                alignSelf: isSystem ? 'center' : (isMine ? 'flex-end' : 'flex-start'),
                                                maxWidth: isSystem ? '90%' : '75%',
                                                background: isSystem ? 'rgba(251, 191, 36, 0.1)' : (isMine ? 'var(--primary-color)' : 'rgba(255,255,255,0.1)'),
                                                color: isMine ? 'white' : 'inherit',
                                                padding: '8px 12px',
                                                borderRadius: isSystem ? '8px' : (isMine ? '12px 12px 0 12px' : '12px 12px 12px 0'),
                                                fontSize: '0.95rem',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                border: isSystem ? '1px dashed rgba(251, 191, 36, 0.3)' : 'none',
                                                textAlign: isSystem ? 'center' : 'left'
                                            }}>
                                                {isSystem && <div style={{ fontSize: '0.7rem', color: '#FBBF24', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase' }}>System Message</div>}
                                                <span>{msg.content}</span>
                                                <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: isMine ? 'flex-end' : 'flex-start', gap: '4px' }}>
                                                    {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    {isMine && (
                                                        msg.is_read ? <CheckCheck size={12} color="#4ade80" /> : <Check size={12} />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    
                                    {/* Chat Limit Notification */}
                                    {messages.length >= 45 && (
                                        <div style={{ 
                                            margin: '12px 0', 
                                            padding: '10px', 
                                            background: messages.length >= 50 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(251, 191, 36, 0.1)', 
                                            border: `1px solid ${messages.length >= 50 ? '#EF4444' : '#FBBF24'}`,
                                            borderRadius: '8px',
                                            textAlign: 'center',
                                            fontSize: '0.85rem',
                                            color: messages.length >= 50 ? '#F87171' : '#FBBF24'
                                        }}>
                                            {messages.length >= 50 
                                                ? "Chat limit reached (50 messages)."
                                                : `Warning: ${50 - messages.length} messages remaining in this conversation limit.`
                                            }
                                        </div>
                                    )}
                                </>
                            )}
                            {typingUsers[activeContact.id] && (
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', alignSelf: 'flex-start' }}>
                                    {activeContact.name} is typing...
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSendMessage} style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)' }}>
                            <input
                                type="text"
                                className="form-control"
                                placeholder={messages.length >= 50 ? "Chat limit reached" : "Type a message..."}
                                value={newMessage}
                                onChange={handleTyping}
                                disabled={messages.length >= 50}
                                style={{ flex: 1, marginBottom: 0 }}
                            />
                            <button type="submit" className="btn btn-primary" disabled={!newMessage.trim() || messages.length >= 50}>
                                <Send size={18} />
                            </button>
                        </form>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                        Select a contact to start messaging
                    </div>
                )}
            </div>
            <style>{`
                .status-pulse {
                    width: 10px;
                    height: 10px;
                    background-color: #34D399;
                    border-radius: 50%;
                    box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7);
                    animation: pulse 1.5s infinite;
                }

                @keyframes pulse {
                    0% {
                        transform: scale(0.95);
                        box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7);
                    }
                    70% {
                        transform: scale(1);
                        box-shadow: 0 0 0 6px rgba(52, 211, 153, 0);
                    }
                    100% {
                        transform: scale(0.95);
                        box-shadow: 0 0 0 0 rgba(52, 211, 153, 0);
                    }
                }
            `}</style>
        </div>
    );
}
