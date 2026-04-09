import { useState } from 'react';
import UsersList from '../UsersList';
import ChatWindow from '../chatWindow';

export default function Chat() {
    const token = localStorage.getItem('token');
    const currentUserId = token
        ? JSON.parse(atob(token.split('.')[1])).username
        : null;

    const [selectedUser, setSelectedUser] = useState(null);

    return (
        <div className="flex h-screen bg-gray-950">
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
