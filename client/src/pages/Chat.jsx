import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import UsersList from '../UsersList';
import ChatWindow from '../chatWindow';

export default function Chat() {
    const token = localStorage.getItem('token');
    const currentUserId = token
        ? JSON.parse(atob(token.split('.')[1])).username
        : null;
    const [selectedUser, setSelectedUser] = useState(null);
    const [socket, setSocket] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const navigate = useNavigate();

    const lastSyncDate = useRef(new Date().toISOString());

    useEffect(() => {
        const newSocket = io(import.meta.env.VITE_BACKEND_URL || "", {
            auth: {
                token: localStorage.getItem('token')
            }
        });
        
        newSocket.on('connect', () => {
            newSocket.emit('resync', { lastDate: lastSyncDate.current, userId: currentUserId });
        });
        
        newSocket.on('new_message', (data) => {
            if (data.createdAt && data.createdAt > lastSyncDate.current) {
                lastSyncDate.current = data.createdAt;
            }
        });

        newSocket.on('online_users', (usersList) => {
            setOnlineUsers(usersList);
        });

        newSocket.on('spam_warning', (data) => {
            alert(data.message || 'Rate limit exceeded. Disconnected.');
        });

        setSocket(newSocket);
        return () => newSocket.disconnect();
    }, [currentUserId]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-gray-950 relative">
            <div className="absolute top-4 right-4 flex gap-2 z-10">
                <button
                    onClick={() => navigate('/settings')}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded shadow-md transition-colors"
                    title="Settings"
                >
                    ⚙️
                </button>
                <button
                    onClick={handleLogout}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow-md transition-colors"
                >
                    Logout
                </button>
            </div>
            <UsersList
                onSelectUser={(username) => setSelectedUser(username)}
                socket={socket}
                selectedUser={selectedUser}
                currentUserId={currentUserId}
                onlineUsers={onlineUsers}
            />
            {selectedUser
                ? <ChatWindow 
                    currentUserId={currentUserId} 
                    targetUserId={selectedUser} 
                    socket={socket} 
                    isOnline={onlineUsers.includes(selectedUser)} 
                  />
                : <div className="flex-1 flex items-center justify-center text-gray-500 text-lg">
                    Select a contact to start chatting
                </div>
            }
        </div>
    );
}