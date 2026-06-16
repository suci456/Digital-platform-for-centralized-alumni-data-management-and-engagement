import { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import ChatPanel from '../components/ChatPanel';
import NotificationBell from '../components/NotificationBell';
import { LogOut, PlusCircle, ShieldAlert, CheckCircle, Download, MessageCircle, Clock } from 'lucide-react';

export default function AlumniDashboard() {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [formData, setFormData] = useState({ companyName: '', domain: '', description: '', experienceYears: '', achievements: '', companyHistory: '' });
    const [jobForm, setJobForm] = useState({ companyName: '', role: '', salary: '', location: '', applicationDeadline: '' });
    const [applications, setApplications] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [mentorships, setMentorships] = useState([]);
    const [permissionStatus, setPermissionStatus] = useState(null);
    const [permissionError, setPermissionError] = useState('');
    const [message, setMessage] = useState('');
    const [jobMessage, setJobMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const { socket } = useSocket();
    const navigate = useNavigate();

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (!userData) {
            navigate('/');
            return;
        }
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
    }, [navigate]);

    useEffect(() => {
        if (!socket || !user) return;

        const handleNewMentorship = () => {
            fetchApplicationsAndJobs(user.id);
        };

        const handleNewJobApp = () => {
            fetchApplicationsAndJobs(user.id);
        };

        const handlePermissions = (data) => {
            // Immediately update the profile state to reflect new permissions
            setProfile(prev => prev ? { ...prev, can_view_students: data.can_view_students, can_message_students: data.can_message_students } : prev);
            // Also re-fetch profile from server to get the authoritative state
            fetchProfile();
            fetchApplicationsAndJobs(user.id);
        };

        const handleNewNotification = () => {
            // Re-fetch profile to check if permissions changed via notification
            fetchProfile();
            fetchApplicationsAndJobs(user.id);
        };

        const handleAdminDataUpdated = () => {
            fetchProfile();
            fetchApplicationsAndJobs(user.id);
        };

        socket.on('newMentorshipRequest', handleNewMentorship);
        socket.on('newJobApplication', handleNewJobApp);
        socket.on('permissionsUpdated', handlePermissions);
        socket.on('newNotification', handleNewNotification);
        socket.on('adminDataUpdated', handleAdminDataUpdated);

        return () => {
            socket.off('newMentorshipRequest', handleNewMentorship);
            socket.off('newJobApplication', handleNewJobApp);
            socket.off('permissionsUpdated', handlePermissions);
            socket.off('newNotification', handleNewNotification);
            socket.off('adminDataUpdated', handleAdminDataUpdated);
        };
    }, [socket, user]);

    const fetchProfile = async () => {
        try {
            const data = await api.getAlumniProfile();
            setProfile(data);
            setFormData({
                companyName: data.company_name || '',
                domain: data.domain || '',
                description: data.description || '',
                experienceYears: data.experience_years || '',
                achievements: data.achievements || '',
                companyHistory: data.company_history || ''
            });
        } catch (err) {
            console.log("No profile found - Add mode active");
        }
    };

    const fetchApplicationsAndJobs = async (alumniId) => {
        try {
            // Fetch Jobs and Mentorships safely
            const jobsData = await api.getAlumniJobs(alumniId).catch(() => []);
            const mentorshipData = await api.getAlumniMentorships().catch(() => []);
            
            setJobs(jobsData);
            setMentorships(mentorshipData);

            // Fetch Applications which might throw 403 Forbidden
            try {
                const apps = await api.getAlumniApplications(alumniId);
                setApplications(apps);
            } catch (appErr) {
                console.log("Access restricted to student details:", appErr.message);
                setApplications([]);
            }

        } catch (err) {
            console.error("DEBUG: Fatal error in fetchApplicationsAndJobs:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchProfile();
            fetchApplicationsAndJobs(user.id);
        }
    }, [user]);

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        navigate('/');
    };

    const handlePostProfile = async (e) => {
        e.preventDefault();
        try {
            if (profile) {
                await api.updateAlumniProfile(formData);
                setMessage('Profile updated successfully!');
            } else {
                await api.createAlumniProfile(formData);
                setMessage('Profile completely setup! Students can now submit mentorship requests.');
                fetchProfile();
            }
            setTimeout(() => setMessage(''), 5000);
        } catch (err) {
            setMessage(`Error: ${err.error || 'Failed to save profile'}`);
        }
    };

    const handlePostJob = async (e) => {
        e.preventDefault();
        try {
            await api.createJob(jobForm);
            setJobMessage('Job posted successfully!');
            setJobForm({ companyName: '', role: '', salary: '', location: '', applicationDeadline: '' });
            if (user) fetchApplicationsAndJobs(user.id);
            setTimeout(() => setJobMessage(''), 5000);
        } catch (err) {
            setJobMessage(`Error: ${err.error || 'Failed to post job'}`);
        }
    };

    const handleMentorshipResponse = async (requestId, status) => {
        try {
            await api.respondMentorship({ requestId, status });
            const mentorshipData = await api.getAlumniMentorships();
            setMentorships(mentorshipData);
            await fetchApplicationsAndJobs(user.id); // Aggressive sync
        } catch (err) {
            alert(err.message || err.error || 'Failed to respond to mentorship request');
        }
    };

    const requestPermission = async () => {
        try {
            await api.requestAdminPermission({ alumniId: user.id });
            setPermissionStatus('Pending');
            setPermissionError('Permission requested. Waiting for admin approval.');
            await fetchProfile(); // Sync profile state
        } catch (err) {
            setPermissionError(err.message || err.error || 'Failed to request permission');
        }
    };

    if (loading) return <div className="app-container"><div className="page-container text-center"><p>Loading dashboard...</p></div></div>;

    return (
        <div className="app-container">
            <nav className="top-nav">
                <div className="nav-brand">Alumni Connect</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <NotificationBell user={user} />
                    <span>Welcome, {user?.name}</span>
                    <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '8px 16px' }}>
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </nav>

            <div className="page-container">
                <div className="grid-cards" style={{ gridTemplateColumns: '1fr 1fr', gap: '32px' }}>

                    {/* Post Profile Section */}
                    <div className="glass-card">
                        <h3 className="mb-6" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <PlusCircle size={24} /> Complete Your Professional Profile
                        </h3>

                        {message && (
                            <div className="mb-4" style={{
                                padding: '12px', borderRadius: '8px', fontSize: '0.9rem',
                                background: message.includes('Error') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                color: message.includes('Error') ? '#FCA5A5' : '#34D399',
                                border: message.includes('Error') ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)'
                            }}>
                                {message}
                            </div>
                        )}

                        <form onSubmit={handlePostProfile}>
                            <div className="form-group">
                                <label className="form-label">Company Name</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="e.g. Google, Startup Inc."
                                    value={formData.companyName}
                                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Domain / Industry</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="e.g. Software Engineering"
                                    value={formData.domain}
                                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group mb-6">
                                <label className="form-label">Description / Bio</label>
                                <textarea
                                    className="form-control"
                                    placeholder="Describe your role and expertise..."
                                    rows="3"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    required
                                ></textarea>
                            </div>
                            
                            <div className="form-group">
                                <label className="form-label">Years of Experience</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    placeholder="e.g. 5"
                                    value={formData.experienceYears}
                                    onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Key Achievements (Optional)</label>
                                <textarea
                                    className="form-control"
                                    placeholder="List your career highlights..."
                                    rows="2"
                                    value={formData.achievements}
                                    onChange={(e) => setFormData({ ...formData, achievements: e.target.value })}
                                ></textarea>
                            </div>

                            <div className="form-group mb-6">
                                <label className="form-label">Company History (Optional)</label>
                                <textarea
                                    className="form-control"
                                    placeholder="Where have you worked before?"
                                    rows="2"
                                    value={formData.companyHistory}
                                    onChange={(e) => setFormData({ ...formData, companyHistory: e.target.value })}
                                ></textarea>
                            </div>

                            <button type="submit" className="btn btn-primary btn-block">
                                Save Profile
                            </button>
                        </form>
                    </div>

                    {/* Applications View Section */}
                    <div className="glass-card">
                        <h3 className="mb-6" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Student Applications
                        </h3>

                        {(!profile || !profile.can_view_students) ? (
                            <div className="text-center" style={{ padding: '24px 16px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '8px', border: '1px dashed rgba(245, 158, 11, 0.3)' }}>
                                <Clock size={32} style={{ color: '#FBBF24', margin: '0 auto 12px' }} />
                                <h4 className="mb-2" style={{ color: '#FBBF24', fontSize: '1.1rem' }}>Access Restricted</h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0' }}>
                                    Admin approval is required to view student details. Please ensure your profile is complete and wait for authorization.
                                </p>
                            </div>
                        ) : applications.length === 0 ? (
                            <div className="text-center" style={{ padding: '32px 16px' }}>
                                <p style={{ color: 'var(--text-secondary)' }}>No students have applied to your opportunities yet.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '500px', overflowY: 'auto', paddingRight: '8px' }}>
                                {applications.map(app => (
                                    <div key={`${app.type}-${app.application_id}`} className="glass-panel" style={{ padding: '16px' }}>
                                        <div className="profile-header" style={{ marginBottom: '12px', alignItems: 'flex-start' }}>
                                            <div>
                                                <h4 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>{app.student_name}</h4>
                                                {app.type === 'Job' ? (
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                        Applied for Job: <strong style={{ color: 'var(--text-primary)' }}>{app.job_role}</strong>
                                                    </div>
                                                ) : (
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>General Application</div>
                                                )}
                                            </div>
                                            <span className="badge badge-success" style={{ marginTop: '4px' }}><CheckCircle size={12} style={{ display: 'inline', marginRight: '4px' }} /> {app.status}</span>
                                        </div>

                                        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                            <div>
                                                <div className="data-label">Email</div>
                                                <div style={{ wordBreak: 'break-all' }}>{app.student_email}</div>
                                            </div>
                                            {app.linkedin_url && (
                                                <div>
                                                    <div className="data-label">LinkedIn</div>
                                                    <a href={app.linkedin_url} target="_blank" rel="noreferrer" className="text-primary" style={{ fontSize: '0.9rem' }}>View Profile</a>
                                                </div>
                                            )}
                                        </div>

                                        {app.skills && (
                                            <div style={{ marginBottom: '12px' }}>
                                                <div className="data-label">Skills</div>
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                                                    {app.skills.split(',').map((skill, i) => (
                                                        <span key={i} className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>{skill.trim()}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {app.projects && (
                                            <div style={{ marginBottom: '12px' }}>
                                                <div className="data-label">Projects</div>
                                                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>{app.projects}</div>
                                            </div>
                                        )}

                                        {app.resume_path ? (
                                            <a
                                                href={`/uploads/${app.resume_path}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="btn btn-secondary"
                                                style={{ width: '100%', fontSize: '0.9rem', padding: '8px' }}
                                            >
                                                <Download size={16} /> View Resume
                                            </a>
                                        ) : (
                                            <div style={{ padding: '8px', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                                No resume uploaded
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid-cards mt-6" style={{ gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                    {/* Post Job Section */}
                    <div className="glass-card">
                        <h3 className="mb-6" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <PlusCircle size={24} /> Post a Job/Internship
                        </h3>

                        {jobMessage && (
                            <div className="mb-4" style={{
                                padding: '12px', borderRadius: '8px', fontSize: '0.9rem',
                                background: jobMessage.includes('Error') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                color: jobMessage.includes('Error') ? '#FCA5A5' : '#34D399',
                                border: jobMessage.includes('Error') ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)'
                            }}>
                                {jobMessage}
                            </div>
                        )}

                        <form onSubmit={handlePostJob}>
                            <div className="form-group">
                                <label className="form-label">Company Name</label>
                                <input type="text" className="form-control" placeholder="Company Name" required
                                    value={jobForm.companyName} onChange={e => setJobForm({ ...jobForm, companyName: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Role/Position</label>
                                <input type="text" className="form-control" placeholder="e.g. Frontend Developer" required
                                    value={jobForm.role} onChange={e => setJobForm({ ...jobForm, role: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Salary (Optional)</label>
                                <input type="text" className="form-control" placeholder="e.g. $80k - $100k"
                                    value={jobForm.salary} onChange={e => setJobForm({ ...jobForm, salary: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Location</label>
                                <input type="text" className="form-control" placeholder="e.g. Remote, New York" required
                                    value={jobForm.location} onChange={e => setJobForm({ ...jobForm, location: e.target.value })} />
                            </div>
                            <div className="form-group mb-6">
                                <label className="form-label">Application Deadline</label>
                                <input type="date" className="form-control" required
                                    value={jobForm.applicationDeadline} onChange={e => setJobForm({ ...jobForm, applicationDeadline: e.target.value })} />
                            </div>
                            <button type="submit" className="btn btn-primary btn-block">Post Job</button>
                        </form>
                    </div>

                    {/* Job Postings View Section */}
                    <div className="glass-card">
                        <h3 className="mb-6">Your Job Postings</h3>
                        {jobs.length === 0 ? (
                            <div className="text-center" style={{ padding: '32px 16px' }}>
                                <p style={{ color: 'var(--text-secondary)' }}>You haven't posted any jobs yet.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {jobs.map(job => (
                                    <div key={job.id} className="glass-panel" style={{ padding: '16px' }}>
                                        <h4 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>{job.role} at {job.company_name}</h4>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                            📍 {job.location} | 💰 {job.salary || 'Not specified'} | ⏰ {new Date(job.application_deadline).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Mentorship Requests Section */}
                <div className="grid-cards mt-6" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="glass-card">
                        <h3 className="mb-6">Mentorship Requests</h3>
                        {(!profile || !profile.can_view_students) ? (
                            <div className="text-center" style={{ padding: '24px 16px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '8px', border: '1px dashed rgba(245, 158, 11, 0.3)' }}>
                                <Clock size={32} style={{ color: '#FBBF24', margin: '0 auto 12px' }} />
                                <h4 className="mb-2" style={{ color: '#FBBF24', fontSize: '1.1rem' }}>Access Restricted</h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0' }}>
                                    Mentorship requests are hidden until an administrator approves your account's data access.
                                </p>
                            </div>
                        ) : mentorships.length === 0 ? (
                            <div className="text-center" style={{ padding: '32px 16px' }}>
                                <p style={{ color: 'var(--text-secondary)' }}>No mentorship requests yet.</p>
                            </div>
                        ) : (
                            <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                                {mentorships.map(req => (
                                    <div key={req.id} className="glass-panel" style={{ padding: '16px' }}>
                                        <div className="profile-header" style={{ marginBottom: '12px' }}>
                                            <h4 style={{ fontSize: '1.1rem' }}>{req.student_name}</h4>
                                            <span className={`badge ${req.status === 'Accepted' ? 'badge-success' : req.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>
                                                {req.status}
                                            </span>
                                        </div>
                                        <div style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                            Email: {req.student_email}
                                        </div>
                                        {req.status === 'Pending' && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className="btn btn-success" style={{ flex: 1, padding: '8px' }} onClick={() => handleMentorshipResponse(req.id, 'Accepted')}>Accept</button>
                                                <button className="btn btn-danger" style={{ flex: 1, padding: '8px' }} onClick={() => handleMentorshipResponse(req.id, 'Rejected')}>Reject</button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Chat Section */}
                {(!profile || !profile.can_message_students) ? (
                    <div className="glass-card text-center" style={{ padding: '48px 24px', border: '1px dashed rgba(239, 68, 68, 0.3)' }}>
                        <ShieldAlert size={48} style={{ color: '#EF4444', margin: '0 auto 16px' }} />
                        <h3 style={{ color: '#EF4444', marginBottom: '12px' }}>Messaging Locked</h3>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto' }}>
                            You are not yet authorized to send direct messages to students. 
                            The Administrator must grant "Messaging Permission" before you can start conversations.
                        </p>
                    </div>
                ) : (
                    <ChatPanel currentUser={user} />
                )}

            </div>
        </div>
    );
}
