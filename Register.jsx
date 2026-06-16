import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { UserPlus, Eye, EyeOff } from 'lucide-react';

export default function Register() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'Student'
    });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            if (user.role === 'Student') navigate('/student/dashboard');
            else if (user.role === 'Alumni') navigate('/alumni/dashboard');
            else if (user.role === 'Admin') navigate('/admin/dashboard');
        }
    }, [navigate]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await api.register(formData);
            localStorage.setItem('user', JSON.stringify({ id: res.id, name: res.name, email: res.email, role: res.role }));
            if (res.token) {
                localStorage.setItem('token', res.token);
            }

            if (res.role === 'Student') navigate('/student/dashboard');
            else if (res.role === 'Alumni') navigate('/alumni/dashboard');

        } catch (err) {
            setError(err.error || 'Registration failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="glass-panel auth-card">
                <div className="text-center mb-6">
                    <div className="nav-brand mb-4" style={{ fontSize: '2rem' }}>Alumni Connect</div>
                    <h2>Create Account</h2>
                    <p className="subtitle" style={{ marginBottom: 0 }}>Join our network of students and alumni</p>
                </div>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleRegister}>
                    <div className="form-group">
                        <label className="form-label">Full Name</label>
                        <input
                            type="text"
                            name="name"
                            className="form-control"
                            placeholder="John Doe"
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input
                            type="email"
                            name="email"
                            className="form-control"
                            placeholder="you@example.com"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                className="form-control"
                                placeholder="Create a strong password"
                                value={formData.password}
                                onChange={handleChange}
                                style={{ paddingRight: '40px' }}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    padding: '0',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="form-group mb-6">
                        <label className="form-label">I am a...</label>
                        <select
                            name="role"
                            className="form-control form-select"
                            value={formData.role}
                            onChange={handleChange}
                            required
                        >
                            <option value="Student">Student</option>
                            <option value="Alumni">Alumni</option>
                        </select>
                    </div>

                    <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                        <UserPlus size={20} />
                        {loading ? 'Creating Account...' : 'Register'}
                    </button>
                </form>

                <div className="text-center mt-6">
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Already have an account? <Link to="/" className="auth-link">Sign in here</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
