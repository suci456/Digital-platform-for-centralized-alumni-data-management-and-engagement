import { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import ChatPanel from '../components/ChatPanel';
import NotificationBell from '../components/NotificationBell';
import { LogOut, Upload, Briefcase, CheckCircle, FileText, Search, Filter, MessageCircle } from 'lucide-react';

export default function StudentDashboard() {
    const [user, setUser] = useState(null);
    const [alumni, setAlumni] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [applications, setApplications] = useState([]);
    const [jobApplications, setJobApplications] = useState([]);
    const [mentorships, setMentorships] = useState([]);
    const [resumeFile, setResumeFile] = useState(null);
    const [uploadMessage, setUploadMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ company: '', domain: '', experience: '' });
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
        fetchData(parsedUser.id);
    }, [navigate]);

    useEffect(() => {
        if (!socket || !user) return;

        const handleMentorshipResponse = () => {
            // Refresh mentorships to show new status
            api.getStudentMentorships().then(setMentorships).catch(() => {});
        };

        const handleJobsUpdated = () => {
            // Refresh jobs list when alumni post/delete jobs
            api.getJobs().then(setJobs).catch(() => {});
        };

        const handleNewNotification = () => {
            // Refresh all data when we get a notification (job deleted, mentorship update, etc.)
            fetchData(user.id);
        };

        const handleAdminDataUpdated = () => {
            fetchData(user.id);
        };

        socket.on('mentorshipResponse', handleMentorshipResponse);
        socket.on('jobsUpdated', handleJobsUpdated);
        socket.on('newNotification', handleNewNotification);
        socket.on('adminDataUpdated', handleAdminDataUpdated);

        return () => {
            socket.off('mentorshipResponse', handleMentorshipResponse);
            socket.off('jobsUpdated', handleJobsUpdated);
            socket.off('newNotification', handleNewNotification);
            socket.off('adminDataUpdated', handleAdminDataUpdated);
        };
    }, [socket, user]);

    const fetchData = async (studentId) => {
        try {
            const [alumniData, appsData, jobsList, studentJobsData, mentorshipData] = await Promise.all([
                api.getAlumniProfiles(),
                api.getStudentApplications(studentId),
                api.getJobs(),
                api.getStudentJobApplications(studentId).catch(() => []),
                api.getStudentMentorships().catch(() => [])
            ]);
            setAlumni(alumniData);
            setApplications(appsData);
            setJobs(jobsList);
            setJobApplications(studentJobsData);
            setMentorships(mentorshipData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        try {
            const data = await api.searchAlumni(filters);
            setAlumni(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        navigate('/');
    };

    const handleApply = async (alumniProfileId) => {
        try {
            await api.applyToAlumni({ studentId: user.id, alumniProfileId });
            await fetchData(user.id); // Force immediate refresh
        } catch (err) {
            alert(err.message || err.error || 'Failed to submit application');
        }
    };

    const handleMentorshipRequest = async (alumniProfileId) => {
        try {
            await api.requestMentorship({ alumniProfileId });
            await fetchData(user.id); // Force immediate refresh
            alert('Mentorship request sent successfully!');
        } catch (err) {
            alert(err.message || err.error || 'Failed to request mentorship');
        }
    };

    const handleApplyJob = async (jobId) => {
        try {
            await api.applyToJob({ jobId });
            await fetchData(user.id);
        } catch (err) {
            alert(err.message || err.error || 'Failed to apply for job');
        }
    };

    const hasApplied = (alumniProfileId) => {
        return applications.some(app => app.alumni_profile_id === alumniProfileId);
    };

    const hasAppliedJob = (jobId) => {
        return jobApplications.some(app => app.job_id === jobId);
    };

    const getMentorshipStatus = (alumniProfileId) => {
        const req = mentorships.find(m => m.alumni_profile_id === alumniProfileId);
        return req ? req.status : null;
    };

    const handleResumeUpload = async (e) => {
        e.preventDefault();
        if (!resumeFile) return;

        // Basic frontend validation
        const allowedExtensions = ['.pdf', '.doc', '.docx'];
        const fileExt = resumeFile.name.substring(resumeFile.name.lastIndexOf('.')).toLowerCase();
        if (!allowedExtensions.includes(fileExt)) {
            setUploadMessage('Error: Only PDF and DOC formats are allowed!');
            return;
        }

        if (resumeFile.size > 5 * 1024 * 1024) {
            setUploadMessage('Error: File size must be less than 5MB');
            return;
        }

        const formData = new FormData();
        formData.append('resume', resumeFile);
        formData.append('studentId', user.id);

        try {
            setUploadMessage('Uploading...');
            await api.uploadResume(formData);
            setUploadMessage('Resume uploaded successfully!');
            setResumeFile(null);
            setTimeout(() => setUploadMessage(''), 5000);
        } catch (err) {
            setUploadMessage(err.message || 'Upload failed');
        }
    };

    if (loading) return <div className="app-container"><div className="page-container text-center"><p>Loading student panel...</p></div></div>;
    
    if (!user) return <div className="app-container"><div className="page-container text-center"><p>Redirecting to login...</p></div></div>;

    return (
        <div className="app-container">
            <nav className="top-nav">
                <div className="nav-brand">Student Connect</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <NotificationBell user={user} />
                    <span>Welcome, {user?.name}</span>
                    <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '8px 16px' }}>
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </nav>

            <div className="page-container">
                <div className="glass-card mb-6" style={{ background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.1), rgba(16, 185, 129, 0.1))' }}>
                    <h2>Student Dashboard</h2>
                    <p className="subtitle">Explore alumni profiles, discover opportunities, and manage your applications.</p>

                    <div className="glass-panel" style={{ padding: '24px', marginTop: '24px', maxWidth: '600px' }}>
                        <h3><FileText size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} /> Manage Resume</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.9rem' }}>
                            Upload your resume to share it with alumni when you apply.
                        </p>

                        <form onSubmit={handleResumeUpload} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                                <input
                                    type="file"
                                    className="form-control"
                                    accept=".pdf,.doc,.docx"
                                    onChange={(e) => setResumeFile(e.target.files[0])}
                                    required
                                />
                                {uploadMessage && (
                                    <div style={{ marginTop: '8px', fontSize: '0.85rem', color: uploadMessage.includes('failed') ? '#FCA5A5' : '#34D399' }}>
                                        {uploadMessage}
                                    </div>
                                )}
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={!resumeFile}>
                                <Upload size={18} /> Upload
                            </button>
                        </form>
                    </div>
                </div>

                <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Briefcase size={24} /> Available Alumni Opportunities
                </h3>

                <div className="glass-card mb-6">
                    <form onSubmit={handleSearch} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 200px' }}>
                            <label className="form-label">Company</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-secondary)' }} />
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Search company..."
                                    style={{ paddingLeft: '40px' }}
                                    value={filters.company}
                                    onChange={(e) => setFilters({ ...filters, company: e.target.value })}
                                />
                            </div>
                        </div>
                        <div style={{ flex: '1 1 200px' }}>
                            <label className="form-label">Domain</label>
                            <div style={{ position: 'relative' }}>
                                <Filter size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-secondary)' }} />
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="e.g. IT, Finance"
                                    style={{ paddingLeft: '40px' }}
                                    value={filters.domain}
                                    onChange={(e) => setFilters({ ...filters, domain: e.target.value })}
                                />
                            </div>
                        </div>
                        <div style={{ flex: '1 1 200px' }}>
                            <label className="form-label">Min. Experience (Years)</label>
                            <input
                                type="number"
                                className="form-control"
                                placeholder="Years"
                                min="0"
                                value={filters.experience}
                                onChange={(e) => setFilters({ ...filters, experience: e.target.value })}
                            />
                        </div>
                        <button type="submit" className="btn btn-primary">
                            Apply Filters
                        </button>
                    </form>
                </div>

                {alumni.length === 0 ? (
                    <div className="glass-card text-center" style={{ padding: '40px' }}>
                        <p style={{ color: 'var(--text-secondary)' }}>No alumni profiles available at the moment.</p>
                    </div>
                ) : (
                    <div className="grid-cards">
                        {alumni.map(profile => (
                            <div key={profile.id} className="glass-card">
                                <div className="profile-header">
                                    <div>
                                        <h4 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>{profile.company_name}</h4>
                                        <span className="badge badge-info">{profile.domain}</span>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <div className="data-label">Posted By</div>
                                    <div style={{ fontWeight: 500 }}>{profile.alumni_name}</div>
                                </div>

                                <div style={{ flex: 1 }}>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                                        <strong>Description / Role:</strong> {profile.description} <br/>
                                        <strong>Experience:</strong> {profile.experience_years ? `${profile.experience_years} years` : 'Not Specified'} <br/>
                                        {profile.achievements && <><strong>Achievements:</strong> {profile.achievements}</>}
                                    </p>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {hasApplied(profile.id) ? (
                                        <button className="btn btn-success" disabled style={{ opacity: 0.8, flex: 1 }}>
                                            <CheckCircle size={18} style={{ display: 'inline', marginRight: '4px' }} /> Applied
                                        </button>
                                    ) : (
                                        <button
                                            className="btn btn-primary"
                                            style={{ flex: 1 }}
                                            onClick={() => handleApply(profile.id)}
                                        >
                                            Apply Now
                                        </button>
                                    )}

                                    {(() => {
                                        const status = getMentorshipStatus(profile.id);
                                        if (status) {
                                            return (
                                                <button className={`btn ${status === 'Accepted' ? 'btn-success' : 'btn-secondary'}`} disabled style={{ opacity: 0.8, flex: 1 }}>
                                                    {status === 'Accepted' ? 'Mentored' : status}
                                                </button>
                                            );
                                        }
                                        return (
                                            <button className="btn btn-info" style={{ flex: 1 }} onClick={() => handleMentorshipRequest(profile.id)}>
                                                Request Mentorship
                                            </button>
                                        );
                                    })()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <h3 className="mb-4 mt-8" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Briefcase size={24} /> Job & Internship Openings
                </h3>

                {jobs.length === 0 ? (
                    <div className="glass-card text-center" style={{ padding: '40px' }}>
                        <p style={{ color: 'var(--text-secondary)' }}>No jobs available right now.</p>
                    </div>
                ) : (
                    <div className="grid-cards">
                        {jobs.map(job => (
                            <div key={job.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                                <div className="profile-header">
                                    <div>
                                        <h4 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>{job.role}</h4>
                                        <span className="badge badge-info">{job.company_name}</span>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '12px', marginTop: '12px', flex: 1 }}>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                        📍 {job.location} | 💰 {job.salary || 'Not specified'}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                        <span className="data-label" style={{ display: 'inline', marginRight: '4px' }}>Posted by:</span> {job.posted_by}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        ⏰ Deadline: {new Date(job.application_deadline).toLocaleDateString()}
                                    </div>
                                </div>

                                <div style={{ marginTop: 'auto' }}>
                                    {hasAppliedJob(job.id) ? (
                                        <button className="btn btn-block btn-success mt-4" disabled style={{ opacity: 0.8 }}>
                                            <CheckCircle size={18} /> Applied
                                        </button>
                                    ) : (
                                        <button className="btn btn-block btn-primary mt-4" onClick={() => handleApplyJob(job.id)}>
                                            Apply for Job
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Chat Section */}
                <h3 className="mb-4 mt-8" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MessageCircle size={24} /> Messages
                </h3>
                <ChatPanel currentUser={user} />

            </div>
        </div>
    );
}
