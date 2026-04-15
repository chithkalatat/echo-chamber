import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UsersList from '../UsersList';
import ChatWindow from '../chatWindow';
export default function Chat() {
    const token = localStorage.getItem('token');
    const currentUserId = token
        ? JSON.parse(atob(token.split('.')[1])).username
        : null;
    const [selectedUser, setSelectedUser] = useState(null);
    const navigate = useNavigate();
    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };
    return (
        <div className="flex h-screen bg-gray-950 relative">
            <button
                onClick={handleLogout}
                className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow-md z-10"
            >
                Logout
            </button>
            <UsersList onSelectUser={(username) => setSelectedUser(username)} />
            {selectedUser
                ? <ChatWindow currentUserId={currentUserId} targetUserId={selectedUser} />
                : <div className="flex-1 flex items-center justify-center text-gray-500 text-lg">
                    Select a contact to start chatting
                </div>
            }
        </div>
    );
}
