import { useState, useEffect } from "react"

const UsersList = ({ onSelectUser, socket, selectedUser }) => {
    const [users, setUsers] = useState([]);
    const [unreadCounts, setUnreadCounts] = useState(() => {
        const saved = localStorage.getItem('unreadCounts');
        return saved ? JSON.parse(saved) : {};
    });

    useEffect(() => {
        const token = localStorage.getItem("token");
        fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => {
                if (!res.ok) throw new Error("Failed to fetch");
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) setUsers(data);
                else setUsers([]);
            })
            .catch(err => {
                console.error(err);
                setUsers([]);
            });
    }, []);

    useEffect(() => {
        localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts));
    }, [unreadCounts]);

    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (data) => {
            const sender = data.from;
            if (sender === selectedUser) return;

            setUnreadCounts(prev => ({
                ...prev,
                [sender]: (prev[sender] || 0) + 1
            }));
        };

        socket.on('new_message', handleNewMessage);
        return () => socket.off('new_message', handleNewMessage);
    }, [socket, selectedUser]);

    const handleSelect = (username) => {
        setUnreadCounts(prev => ({ ...prev, [username]: 0 }));
        onSelectUser(username);
    };

    return (
        <div className="w-64 h-screen bg-gray-900 border-r border-gray-700 flex flex-col">
            <h2 className="text-white text-lg font-bold p-4 border-b border-gray-700">
                💬 Contacts
            </h2>
            <ul className="flex-1 overflow-y-auto">
                {users.map((user) => (
                    <li
                        key={user._id}
                        onClick={() => handleSelect(user.username)}
                        className="flex items-center gap-3 p-4 border-b border-gray-800 cursor-pointer hover:bg-gray-700 text-white transition-colors"
                    >
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm">
                            {user.username[0].toUpperCase()}
                        </div>
                        <span className="flex-1">{user.username}</span>
                        {unreadCounts[user.username] > 0 && (
                            <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                {unreadCounts[user.username]}
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default UsersList;
