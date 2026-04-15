import { useState, useEffect } from "react"

const UsersList = ({ onSelectUser }) => {
    const [users, setUsers] = useState([]);

    useEffect(() => {
        const token = localStorage.getItem("token");
        fetch('/api/users', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
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

    return (
        <div className="w-64 h-screen bg-gray-900 border-r border-gray-700 flex flex-col">
            <h2 className="text-white text-lg font-bold p-4 border-b border-gray-700">
                💬 Contacts
            </h2>
            <ul className="flex-1 overflow-y-auto">
                {users.map((user) => (
                    <li
                        key={user._id}
                        onClick={() => onSelectUser(user.username)}
                        className="flex items-center gap-3 p-4 border-b border-gray-800 cursor-pointer hover:bg-gray-700 text-white transition-colors"
                    >
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm">
                            {user.username[0].toUpperCase()}
                        </div>
                        {user.username}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default UsersList;
