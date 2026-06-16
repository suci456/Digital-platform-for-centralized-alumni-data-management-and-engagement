const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000/api' 
    : '/api';

const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const apiService = {
    async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        
        const headers = {
            ...getAuthHeader(),
            ...options.headers,
        };

        // Only set Content-Type to JSON if we're not sending FormData
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        const config = {
            ...options,
            headers,
        };

        if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
            config.body = JSON.stringify(config.body);
        }

        const response = await fetch(url, config);
        
        if (response.status === 204) return null;

        let data;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            data = await response.json();
        } else {
            const text = await response.text();
            throw new Error(`Server Error: ${response.status} - ${text.substring(0, 100)}...`);
        }

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                if (data.error === 'Invalid or expired token' || data.error === 'Access token required') {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '/';
                    throw new Error('SESSION_EXPIRED');
                }
            }
            throw new Error(data.error || 'Something went wrong');
        }

        return data;
    },

    // Auth
    register: (data) => apiService.request('/auth/register', { method: 'POST', body: data }),
    login: (data) => apiService.request('/auth/login', { method: 'POST', body: data }),

    // Alumni
    createAlumniProfile: (data) => apiService.request('/alumni/profile', { method: 'POST', body: data }),
    updateAlumniProfile: (data) => apiService.request('/alumni/profile', { method: 'PUT', body: data }),
    getAlumniProfile: () => apiService.request('/alumni/profile'),
    getAlumniProfiles: () => apiService.request('/alumni/profiles'),
    searchAlumni: (params) => {
        const queryParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value) queryParams.append(key, value);
        }
        return apiService.request(`/alumni/search?${queryParams.toString()}`);
    },
    requestAdminPermission: (data) => apiService.request('/alumni/permission', { method: 'POST', body: data }),
    getAlumniApplications: (alumniId) => apiService.request(`/alumni/${alumniId}/applications`),

    // Student
    applyToAlumni: (data) => apiService.request('/student/apply', { method: 'POST', body: data }),
    getStudentApplications: (studentId) => apiService.request(`/student/${studentId}/applications`),
    uploadResume: (formData) => apiService.request('/student/resume', { 
        method: 'POST', 
        body: formData,
        headers: {} // Let browser set boundary for FormData
    }),

    // Admin
    getAdminData: () => apiService.request('/admin/data'),
    updatePermissionStatus: (data) => apiService.request('/admin/permission/status', { method: 'PUT', body: data }),
    getAdminMessages: () => apiService.request('/admin/messages'),
    deleteAdminMessage: (id) => apiService.request(`/admin/messages/${id}`, { method: 'DELETE' }),
    toggleAdminMessageRead: (id) => apiService.request(`/admin/messages/${id}/toggle-read`, { method: 'PUT' }),

    // Jobs
    createJob: (data) => apiService.request('/jobs', { method: 'POST', body: data }),
    getJobs: () => apiService.request('/jobs'),
    applyToJob: (data) => apiService.request('/jobs/apply', { method: 'POST', body: data }),
    getStudentJobApplications: (studentId) => apiService.request(`/jobs/applications/${studentId}`),
    getAlumniJobs: (alumniId) => apiService.request(`/jobs/${alumniId}/jobs`),
    getJobApplicants: (jobId) => apiService.request(`/jobs/${jobId}/applications`),

    // Mentorship
    requestMentorship: (data) => apiService.request('/mentorship/request', { method: 'POST', body: data }),
    respondMentorship: (data) => apiService.request('/mentorship/respond', { method: 'POST', body: data }),
    getStudentMentorships: () => apiService.request('/mentorship/student'),
    getAlumniMentorships: () => apiService.request('/mentorship/alumni'),

    // Messaging
    sendMessage: (data) => apiService.request('/messages/send', { method: 'POST', body: data }),
    getMessages: (userId) => apiService.request(`/messages/${userId}`),
    getChatContacts: () => apiService.request('/messages/contacts/list'),

    // Notifications
    getNotifications: () => apiService.request('/notifications'),
    markNotificationRead: (id) => apiService.request(`/notifications/${id}/read`, { method: 'PUT' }),
    deleteNotification: (id) => apiService.request(`/notifications/${id}`, { method: 'DELETE' }),
    deletePermission: (id) => apiService.request(`/admin/permission/${id}`, { method: 'DELETE' }),
    deleteUser: (id) => apiService.request(`/admin/users/${id}`, { method: 'DELETE' }),
    updateAlumniPermissions: (alumniId, data) => apiService.request(`/admin/alumni/${alumniId}/permissions`, { method: 'PATCH', body: data }),
};

export default apiService;
