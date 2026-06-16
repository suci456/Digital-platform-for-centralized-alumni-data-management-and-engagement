import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (!userData) return;
        const user = JSON.parse(userData);

        const SOCKET_URL = window.location.hostname === 'localhost' 
            ? 'http://localhost:5000' 
            : '/';
        const newSocket = io(SOCKET_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Socket connected, registering user:', user.id);
            newSocket.emit('register', user.id);
        });

        newSocket.on('initialOnlineUsers', (users) => {
            setOnlineUsers(users);
        });

        newSocket.on('userStatus', ({ userId, status }) => {
            setOnlineUsers(prev => {
                if (status === 'online' && !prev.includes(userId)) return [...prev, userId];
                if (status === 'offline') return prev.filter(id => id !== userId);
                return prev;
            });
        });

        return () => {
            newSocket.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket, onlineUsers }}>
            {children}
        </SocketContext.Provider>
    );
};
