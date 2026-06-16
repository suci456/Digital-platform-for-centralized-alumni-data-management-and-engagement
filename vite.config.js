import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        host: true, // Listen on all local IPs
        allowedHosts: true, // Bypasses host checks for Ngrok tunneling
        proxy: {
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true
            },
            '/socket.io': {
                target: 'http://localhost:5000',
                ws: true
            }
        }
    }
});
