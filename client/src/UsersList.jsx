import { useState, useEffect, useRef } from "react"

const UsersList = ({ onSelectUser, socket, selectedUser, currentUserId, onlineUsers }) => {
    const [conversations, setConversations] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [unreadCounts, setUnreadCounts] = useState(() => {
        const saved = localStorage.getItem('unreadCounts');
        return saved ? JSON.parse(saved) : {};
    });
    const searchTimeout = useRef(null);

    // Fetch existing conversations on mount
    const fetchConversations = () => {
        const token = localStorage.getItem("token");
        const API_URL = import.meta.env.VITE_BACKEND_URL || "";
        fetch(`${API_URL}/api/conversations`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => {
                if (!res.ok) throw new Error("Failed to fetch");
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) setConversations(data);
                else setConversations([]);
            })
            .catch(err => {
                console.error(err);
                setConversations([]);
            });
    };

    useEffect(() => {
        fetchConversations();
    }, []);

    // Persist unread counts
    useEffect(() => {
        localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts));
    }, [unreadCounts]);

    // Listen for incoming messages to update unread counts & conversation list
    useEffect(() => {
        if (!socket) return;
        const handleNewMessage = (data) => {
            const sender = data.from;
            if (sender === currentUserId) return;
            if (sender === selectedUser) return;

            if (data._id) {
                socket.emit('message_delivered', { messageId: data._id });
            }

            setUnreadCounts(prev => ({
                ...prev,
                [sender]: (prev[sender] || 0) + 1
            }));

            // Bubble this conversation to the top (or add it if new)
            setConversations(prev => {
                const existing = prev.find(c => c.username === sender);
                const updated = {
                    username: sender,
                    lastMessage: data.message || '',
                    lastMessageTime: data.createdAt || new Date().toISOString(),
                };
                if (existing) {
                    return [updated, ...prev.filter(c => c.username !== sender)];
                } else {
                    return [updated, ...prev];
                }
            });
        };
        socket.on('new_message', handleNewMessage);
        return () => socket.off('new_message', handleNewMessage);
    }, [socket, selectedUser, currentUserId]);

    // Debounced search
    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        if (!searchQuery.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        searchTimeout.current = setTimeout(() => {
            const token = localStorage.getItem("token");
            const API_URL = import.meta.env.VITE_BACKEND_URL || "";
            fetch(`${API_URL}/api/users/search?username=${encodeURIComponent(searchQuery.trim())}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setSearchResults(data.filter(u => u.username !== currentUserId));
                    } else {
                        setSearchResults([]);
                    }
                })
                .catch(() => setSearchResults([]));
        }, 300);

        return () => {
            if (searchTimeout.current) clearTimeout(searchTimeout.current);
        };
    }, [searchQuery, currentUserId]);

    const handleSelect = (username) => {
        setUnreadCounts(prev => ({ ...prev, [username]: 0 }));
        setSearchQuery("");
        setSearchResults([]);
        setIsSearching(false);
        onSelectUser(username);

        // Add to conversations if not already there
        setConversations(prev => {
            if (prev.find(c => c.username === username)) return prev;
            return [{ username, lastMessage: '', lastMessageTime: null }, ...prev];
        });
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return d.toLocaleDateString([], { weekday: 'short' });
        }
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const truncate = (str, maxLen = 30) => {
        if (!str) return '';
        return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
    };

    // Decide what to render in the list area
    const showSearch = isSearching || searchQuery.trim().length > 0;

    return (
        <div className="w-72 h-screen bg-gray-900 border-r border-gray-700 flex flex-col">
            <h2 className="text-white text-lg font-bold p-4 border-b border-gray-700">
                💬 Chats
            </h2>

            {/* Search bar */}
            <div className="p-3 border-b border-gray-800">
                <input
                    type="text"
                    placeholder="Search users…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 transition-all"
                />
            </div>

            {/* Search results */}
            {showSearch ? (
                <ul className="flex-1 overflow-y-auto">
                    {searchResults.length === 0 && searchQuery.trim().length > 0 ? (
                        <li className="p-4 text-gray-500 text-sm text-center">
                            No users found
                        </li>
                    ) : (
                        searchResults.map((user) => (
                            <li
                                key={user._id}
                                onClick={() => handleSelect(user.username)}
                                className="flex items-center gap-3 p-4 border-b border-gray-800 cursor-pointer hover:bg-gray-700 text-white transition-colors"
                            >
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm">
                                        {user.username[0].toUpperCase()}
                                    </div>
                                    <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-900 ${onlineUsers.includes(user.username) ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                                </div>
                                <span className="flex-1 text-sm">{user.username}</span>
                            </li>
                        ))
                    )}
                </ul>
            ) : (
                /* Conversation list */
                <ul className="flex-1 overflow-y-auto">
                    {conversations.length === 0 ? (
                        <li className="p-6 text-gray-500 text-sm text-center">
                            No conversations yet.<br />
                            <span className="text-gray-600 text-xs">Search for a user above to start chatting.</span>
                        </li>
                    ) : (
                        conversations.map((conv) => (
                            <li
                                key={conv.username}
                                onClick={() => handleSelect(conv.username)}
                                className={`flex items-center gap-3 p-3 border-b border-gray-800 cursor-pointer hover:bg-gray-700 text-white transition-colors ${selectedUser === conv.username ? 'bg-gray-800' : ''}`}
                            >
                                <div className="relative flex-shrink-0">
                                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm">
                                        {conv.username[0].toUpperCase()}
                                    </div>
                                    <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-900 ${onlineUsers.includes(conv.username) ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium truncate">
                                            {conv.username}
                                        </span>
                                        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                                            {formatTime(conv.lastMessageTime)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-0.5">
                                        <span className="text-xs text-gray-400 truncate">
                                            {truncate(conv.lastMessage)}
                                        </span>
                                        {unreadCounts[conv.username] > 0 && (
                                            <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ml-2">
                                                {unreadCounts[conv.username]}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
}

export default UsersList;