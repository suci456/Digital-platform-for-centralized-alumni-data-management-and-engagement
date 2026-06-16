import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import NotificationBell from '../components/NotificationBell';
import { Users, GraduationCap, Briefcase, FileText, CircleCheck, CircleX, LogOut, Clock } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';

export default function AdminDashboard() {
    const [user, setUser] = useState(null);
    const [data, setData] = useState({
        users: [],
        profiles: [],
        permissions: [],
        applications: []
    });
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('permissions');
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { socket } = useSocket();
    const navigate = useNavigate();

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (!userData) {
            navigate('/');
            return;
        }
        const parsedUser = JSON.parse(userData);
        if (parsedUser.role !== 'Admin') {
            navigate('/');
            return;
        }
        setUser(parsedUser);
        fetchData();
    }, [navigate]);

    useEffect(() => {
        if (!socket || !user || user.role !== 'Admin') return;

        const handleAdminMonitorMessage = (msg) => {
            setMessages(prev => [msg, ...prev]);
        };

        socket.on('adminMonitorMessage', handleAdminMonitorMessage);
        socket.on('userStatus', fetchData); // Refresh if someone comes online/offline
        socket.on('adminDataUpdated', fetchData); // New event for real-time sync

        return () => {
            socket.off('adminMonitorMessage', handleAdminMonitorMessage);
            socket.off('userStatus', fetchData);
            socket.off('adminDataUpdated', fetchData);
        };
    }, [socket, user]);

    const fetchData = async () => {
        try {
            const adminData = await api.getAdminData();
            if (adminData) setData(adminData);
        } catch (err) {
            if (err.message === 'SESSION_EXPIRED') return;
            console.error('Failed to fetch admin data', err);
            alert(`CRITICAL ERROR: Failed to load Admin Dashboard data. ${err.message || 'Please check your connection.'}`);
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async () => {
        try {
            const msgs = await api.getAdminMessages();
            setMessages(msgs);
        } catch (err) {
            console.error('Failed to fetch messages', err);
        }
    };

    useEffect(() => {
        if (activeTab === 'monitoring') {
            fetchMessages();
        }
    }, [activeTab]);

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        navigate('/');
    };

    const handleUpdatePermissionStatus = async (permissionId, status) => {
        try {
            await api.updatePermissionStatus({ permissionId, status });
            await fetchData(); // Force immediate refresh
        } catch (err) {
            alert(err.message || err.error || `Failed to update permission to ${status}`);
            await fetchData(); // Refresh to original state if failed
        }
    };

    const handleDeleteMessage = async (id) => {
        if (!window.confirm("Remove this message from logs?")) return;
        try {
            await api.deleteAdminMessage(id);
            setMessages(prev => prev.filter(m => m.id !== id));
        } catch (err) {
            alert('Failed to delete message');
        }
    };

    // User requested removal of user deletion functionality
    // Using handleUpdatePermissionStatus instead to manage access


    const handleDeletePermission = async (id) => {
        if (!window.confirm("Are you sure you want to remove this permission record? This will not delete the user.")) return;
        try {
            await api.deletePermission(id);
            // fetchData() will be called via socket or we can do it manually
            fetchData();
        } catch (err) {
            alert('Failed to delete permission record');
        }
    };

    const handleDeleteUser = async (id, name) => {
        if (!window.confirm(`PERMANENT DELETION: Are you sure you want to delete ${name} and ALL their related data (jobs, applications, messages)? This cannot be undone.`)) return;
        try {
            await api.deleteUser(id);
            fetchData();
        } catch (err) {
            alert(err.message || 'Failed to delete user');
        }
    };

    const handleToggleAlumniPermission = async (alumniId, field, value) => {
        try {
            // Optimistic update to immediately toggle the checkbox
            setData(prevData => {
                const newProfiles = prevData.profiles.map(p => {
                    if (p.user_id === alumniId) {
                        return { ...p, [field]: value ? 1 : 0 };
                    }
                    return p;
                });
                return { ...prevData, profiles: newProfiles };
            });

            const profile = data.profiles.find(p => p.user_id === alumniId);
            const permissions = {
                can_view_students: profile.can_view_students,
                can_message_students: profile.can_message_students,
                [field]: value
            };
            await api.updateAlumniPermissions(alumniId, permissions);
            await fetchData(); // Sync thoroughly after backend confirmation
        } catch (err) {
            alert(err.message || err.error || 'Failed to update permissions');
            await fetchData(); // Revert back to original state if failed
        }
    };

    if (loading) return <div className="app-container"><div className="page-container text-center"><p>Loading admin panel...</p></div></div>;

    return (
        <div className="app-container">
            <nav className="top-nav" style={{ background: 'rgba(79, 70, 229, 0.9)', borderBottom: 'none' }}>
                <div className="nav-brand" style={{ color: 'white', textFillColor: 'initial', WebkitTextFillColor: 'initial', background: 'none' }}>
                    Admin Portal
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'white' }}>
                    <NotificationBell user={user} />
                    <span>Welcome, {user?.name}</span>
                    <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '8px 16px', color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}>
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </nav>

            <div className="page-container">
                <h2 className="mb-6">System Dashboard</h2>

                {/* Stats Grid */}
                <div className="grid-cards mb-6" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                    <div className="glass-card text-center" style={{ padding: '24px 16px' }}>
                        <Users size={32} style={{ color: '#818CF8', margin: '0 auto 12px' }} />
                        <div className="data-value" style={{ fontSize: '2rem', marginBottom: '4px' }}>{data.users.length}</div>
                        <div className="data-label">Total Users</div>
                    </div>
                    <div className="glass-card text-center" style={{ padding: '24px 16px' }}>
                        <Briefcase size={32} style={{ color: '#34D399', margin: '0 auto 12px' }} />
                        <div className="data-value" style={{ fontSize: '2rem', marginBottom: '4px' }}>{data.profiles.length}</div>
                        <div className="data-label">Alumni Profiles</div>
                    </div>
                    <div className="glass-card text-center" style={{ padding: '24px 16px' }}>
                        <FileText size={32} style={{ color: '#FBBF24', margin: '0 auto 12px' }} />
                        <div className="data-value" style={{ fontSize: '2rem', marginBottom: '4px' }}>{data.applications.length}</div>
                        <div className="data-label">Total Applications</div>
                    </div>
                    <div className="glass-card text-center" style={{ padding: '24px 16px' }}>
                        <Clock size={32} style={{ color: '#F87171', margin: '0 auto 12px' }} />
                        <div className="data-value" style={{ fontSize: '2rem', marginBottom: '4px' }}>
                            {data.permissions.filter(p => p.status === 'Pending').length}
                        </div>
                        <div className="data-label">Pending Requests</div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                    <button
                        className={`btn ${activeTab === 'permissions' ? 'btn-primary' : 'btn-secondary'} `}
                        onClick={() => setActiveTab('permissions')}
                    >
                        Access Requests
                        {data.permissions.filter(p => p.status === 'Pending').length > 0 && (
                            <span style={{ background: '#EF4444', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', marginLeft: '8px' }}>
                                {data.permissions.filter(p => p.status === 'Pending').length}
                            </span>
                        )}
                    </button>
                    <button
                        className={`btn ${activeTab === 'alumni' ? 'btn-primary' : 'btn-secondary'} `}
                        onClick={() => setActiveTab('alumni')}
                    >
                        Alumni Profiles
                    </button>
                    <button
                        className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'} `}
                        onClick={() => setActiveTab('users')}
                    >
                        All Users
                    </button>
                    <button
                        className={`btn ${activeTab === 'monitoring' ? 'btn-primary' : 'btn-secondary'} `}
                        onClick={() => setActiveTab('monitoring')}
                    >
                        Communication Monitoring
                    </button>
                </div>

                {/* Tab Content */}
                <div className="glass-card">
                    {activeTab === 'permissions' && (
                        <div>
                            <h3 className="mb-4">Alumni Access Requests</h3>
                            <p className="subtitle" style={{ fontSize: '0.9rem' }}>Review and approve requests from alumni to view student application data.</p>

                            <div className="table-container">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Alumni Name</th>
                                            <th>Email</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.permissions.length === 0 ? (
                                            <tr><td colSpan="4" className="text-center">No permission requests found.</td></tr>
                                        ) : (
                                            data.permissions.map(perm => (
                                                <tr key={perm.id}>
                                                    <td>{perm.name}</td>
                                                    <td>{perm.email}</td>
                                                    <td>
                                                        {perm.status === 'Granted' && <span className="badge badge-success">Granted</span>}
                                                        {perm.status === 'Pending' && <span className="badge badge-warning">Pending</span>}
                                                        {perm.status === 'Rejected' && <span className="badge" style={{background: '#FEE2E2', color: '#EF4444'}}>Rejected</span>}
                                                        {perm.status === 'Revoked' && <span className="badge" style={{background: '#F3F4F6', color: '#6B7280'}}>Revoked</span>}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                            {perm.status !== 'Granted' && (
                                                                <button
                                                                    className="btn btn-success"
                                                                    style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                                                                    onClick={() => handleUpdatePermissionStatus(perm.id, 'Granted')}
                                                                >
                                                                    <CircleCheck size={14} /> {perm.status === 'Pending' ? 'Approve' : 'Re-grant'}
                                                                </button>
                                                            )}
                                                            
                                                            {perm.status === 'Pending' && (
                                                                <button
                                                                    className="btn btn-secondary"
                                                                    style={{ padding: '6px 12px', fontSize: '0.85rem', color: '#EF4444', borderColor: '#FCA5A5' }}
                                                                    onClick={() => handleUpdatePermissionStatus(perm.id, 'Rejected')}
                                                                >
                                                                    <CircleX size={14} /> Reject
                                                                </button>
                                                            )}

                                                            {perm.status === 'Granted' && (
                                                                <button
                                                                    className="btn btn-secondary"
                                                                    style={{ padding: '6px 12px', fontSize: '0.85rem', color: '#EF4444' }}
                                                                    onClick={() => handleUpdatePermissionStatus(perm.id, 'Revoked')}
                                                                >
                                                                    Revoke Access
                                                                </button>
                                                            )}

                                                            {(perm.status === 'Revoked' || perm.status === 'Rejected') && (
                                                                <button
                                                                    className="btn btn-secondary"
                                                                    style={{ padding: '6px 12px', fontSize: '0.85rem', color: '#EF4444', background: '#FEE2E2', borderColor: '#FCA5A5' }}
                                                                    onClick={() => handleDeleteUser(perm.alumni_id, perm.name)}
                                                                >
                                                                    <CircleX size={14} /> Remove User
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'alumni' && (
                        <div>
                            <h3 className="mb-4">Alumni Profiles</h3>
                            <p className="subtitle" style={{ fontSize: '0.9rem' }}>Detailed list of all registered alumni and their professional information.</p>
                            <div className="table-container">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Company</th>
                                            <th>Domain</th>
                                            <th>View Details</th>
                                            <th>Messaging</th>
                                            <th style={{ width: '80px' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.profiles.length === 0 ? (
                                            <tr><td colSpan="7" className="text-center">No alumni profiles found.</td></tr>
                                        ) : (
                                            data.profiles.map(p => (
                                                <tr key={p.id}>
                                                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                                                    <td>{p.email}</td>
                                                    <td>{p.company_name}</td>
                                                    <td>{p.domain}</td>
                                                    <td>
                                                        <div className="flex items-center">
                                                            <input 
                                                                type="checkbox" 
                                                                id={`view-${p.user_id}`}
                                                                checked={!!p.can_view_students} 
                                                                onChange={(e) => handleToggleAlumniPermission(p.user_id, 'can_view_students', e.target.checked)}
                                                                style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                                            />
                                                            <label htmlFor={`view-${p.user_id}`} style={{ marginLeft: '8px', fontSize: '0.8rem', color: p.can_view_students ? '#34D399' : '#6B7280' }}>
                                                                {p.can_view_students ? 'Allowed' : 'Blocked'}
                                                            </label>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="flex items-center">
                                                            <input 
                                                                type="checkbox" 
                                                                id={`msg-${p.user_id}`}
                                                                checked={!!p.can_message_students} 
                                                                onChange={(e) => handleToggleAlumniPermission(p.user_id, 'can_message_students', e.target.checked)}
                                                                style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                                            />
                                                            <label htmlFor={`msg-${p.user_id}`} style={{ marginLeft: '8px', fontSize: '0.8rem', color: p.can_message_students ? '#34D399' : '#6B7280' }}>
                                                                {p.can_message_students ? 'Allowed' : 'Blocked'}
                                                            </label>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <button 
                                                            className="btn btn-secondary" 
                                                            style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                                                            onClick={() => { setSelectedProfile(p); setIsModalOpen(true); }}
                                                        >
                                                            Details
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div>
                            <h3 className="mb-4">System Users</h3>
                            <p className="subtitle" style={{ fontSize: '0.9rem' }}>Manage all registered users in the platform.</p>
                            <div className="table-container">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Role</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.users.map(u => (
                                            <tr key={u.id}>
                                                <td style={{ color: 'var(--text-secondary)' }}>#{u.id}</td>
                                                <td style={{ fontWeight: 500 }}>{u.name}</td>
                                                <td>{u.email}</td>
                                                <td>
                                                    <span className={`badge ${u.role === 'Admin' ? 'badge-info' :
                                                            u.role === 'Student' ? 'badge-success' : 'badge-warning'
                                                        } `}>
                                                        {u.role}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'monitoring' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3>Communication Monitoring</h3>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }}></div>
                                    Live Stream Active
                                </div>
                            </div>
                            <p className="subtitle" style={{ fontSize: '0.9rem' }}>Passive oversight of platform communications. Admins monitor for safety and moderation only.</p>
                            
                            <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Time</th>
                                            <th>Participants</th>
                                            <th>Message</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {messages.length === 0 ? (
                                            <tr><td colSpan="4" className="text-center">No recent communication recorded.</td></tr>
                                        ) : (
                                            messages.map(m => (
                                                <tr key={m.id}>
                                                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                        {new Date(m.sent_at).toLocaleTimeString()}
                                                    </td>
                                                    <td>
                                                        <div style={{ fontSize: '0.85rem' }}>
                                                            <span style={{ fontWeight: 600 }}>{m.sender_name}</span>
                                                            <span style={{ margin: '0 4px', color: 'var(--text-secondary)' }}>→</span>
                                                            <span style={{ fontWeight: 600 }}>{m.receiver_name}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ maxWidth: '400px' }}>
                                                        <div style={{ 
                                                            padding: '8px 12px', 
                                                            background: 'rgba(255,255,255,0.05)', 
                                                            borderRadius: '8px',
                                                            fontSize: '0.9rem',
                                                            border: '1px solid rgba(255,255,255,0.1)'
                                                        }}>
                                                            {m.content}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <button 
                                                            className="btn btn-secondary" 
                                                            style={{ color: '#EF4444', borderColor: '#FCA5A5', padding: '4px 8px' }}
                                                            onClick={() => handleDeleteMessage(m.id)}
                                                        >
                                                            <CircleX size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* Alumni Detail Modal */}
            {isModalOpen && selectedProfile && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div className="glass-card" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                            <div>
                                <h3 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{selectedProfile.name}</h3>
                                <p style={{ color: 'var(--text-secondary)' }}>{selectedProfile.email}</p>
                            </div>
                            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)} style={{ padding: '4px 10px' }}>
                                <CircleX size={20} />
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                            <div className="glass-panel" style={{ padding: '12px' }}>
                                <div className="data-label">Current Company</div>
                                <div style={{ fontWeight: 500 }}>{selectedProfile.company_name}</div>
                            </div>
                            <div className="glass-panel" style={{ padding: '12px' }}>
                                <div className="data-label">Professional Domain</div>
                                <div style={{ fontWeight: 500 }}>{selectedProfile.domain}</div>
                            </div>
                        </div>

                        <div className="mb-6">
                            <h4 style={{ fontSize: '1rem', marginBottom: '8px', color: 'var(--text-primary)' }}>Biography</h4>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{selectedProfile.description}</p>
                        </div>

                        {selectedProfile.achievements && (
                            <div className="mb-6">
                                <h4 style={{ fontSize: '1rem', marginBottom: '8px', color: 'var(--text-primary)' }}>Career Achievements</h4>
                                <div style={{ padding: '12px', background: 'rgba(52, 211, 153, 0.05)', borderRadius: '8px', borderLeft: '4px solid #34D399', color: 'var(--text-secondary)' }}>
                                    {selectedProfile.achievements}
                                </div>
                            </div>
                        )}

                        {selectedProfile.company_history && (
                            <div className="mb-6">
                                <h4 style={{ fontSize: '1rem', marginBottom: '8px', color: 'var(--text-primary)' }}>Company History</h4>
                                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{selectedProfile.company_history}</p>
                            </div>
                        )}

                        <button className="btn btn-primary btn-block" onClick={() => setIsModalOpen(false)}>Close View</button>
                    </div>
                </div>
            )}
        </div>
    );
}
