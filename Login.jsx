import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { LogIn, Eye, EyeOff } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
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

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await api.login({ email, password });
            localStorage.setItem('user', JSON.stringify(res.user));
            if (res.token) {
                localStorage.setItem('token', res.token);
            }

            if (res.user.role === 'Student') navigate('/student/dashboard');
            else if (res.user.role === 'Alumni') navigate('/alumni/dashboard');
            else if (res.user.role === 'Admin') navigate('/admin/dashboard');

        } catch (err) {
            setError(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="glass-panel auth-card">
                <div className="text-center mb-6">
                    <div className="nav-brand mb-4" style={{ fontSize: '2rem' }}>Alumni Connect</div>
                    <h2>Welcome Back</h2>
                    <p className="subtitle" style={{ marginBottom: 0 }}>Sign in to continue to your dashboard</p>
                </div>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input
                            type="email"
                            className="form-control"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group mb-6">
                        <label className="form-label">Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? "text" : "password"}
                                className="form-control"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
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

                    <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                        <LogIn size={20} />
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="text-center mt-6">
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Don't have an account? <Link to="/register" className="auth-link">Register here</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
