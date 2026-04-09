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
        <div>
            <UsersList onSelectUser={(username) => setSelectedUser(username)} />
            {selectedUser && (
                <ChatWindow 
                    currentUserId={currentUserId}
                    targetUserId={selectedUser}
                />
            )}
        </div>
    );
}
