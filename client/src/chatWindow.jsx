import { useEffect, useState, useRef, useLayoutEffect } from "react";

const ChatWindow = ({ currentUserId, targetUserId, socket, isOnline }) => {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const typingTimeoutRef = useRef(null);
    const scrollContainerRef = useRef(null);
    
    // Track scroll height and top to maintain scroll position when prepending messages
    const prevScrollHeightRef = useRef(0);
    const shouldRestoreScrollRef = useRef(false);

    // Initial load when target user changes
    useEffect(() => {
        if (!socket) return;
        setMessages([]);
        setHasMore(true);
        setLoadingOlder(false);

        const API_URL = import.meta.env.VITE_BACKEND_URL || "";
        const limit = 50;

        fetch(`${API_URL}/api/messages/${currentUserId}/${targetUserId}?limit=${limit}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
            .then(res => res.json())
            .then(history => {
                const loadedMessages = history.map(msg => ({
                    _id: msg._id,
                    from: msg.from === currentUserId ? 'Me' : msg.from,
                    message: msg.message,
                    status: msg.status,
                    createdAt: msg.createdAt
                }));
                setMessages(loadedMessages);
                
                if (history.length < limit) {
                    setHasMore(false);
                }

                // Scroll to bottom on initial load
                setTimeout(() => {
                    if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
                    }
                }, 50);

                // Read receipts
                const unreadIds = loadedMessages
                    .filter(msg => msg.from !== 'Me' && msg.status !== 'read')
                    .map(msg => msg._id);
                if (unreadIds.length > 0) {
                    socket.emit('message_read', { messageIds: unreadIds });
                }
            });

        const handleNewMessage = (data) => {
            if (data.from === currentUserId) return;
            if (data.from !== targetUserId) return;
            
            setMessages((prev) => {
                if (prev.some(m => m._id === data._id)) return prev;
                return [...prev, { _id: data._id, from: data.from, message: data.message, status: data.status, createdAt: data.createdAt }];
            });
            
            // Auto scroll to bottom for new incoming messages if the user is already near the bottom
            setTimeout(() => {
                if (scrollContainerRef.current) {
                    const c = scrollContainerRef.current;
                    const threshold = 150; // pixels from bottom
                    const isNearBottom = c.scrollHeight - c.scrollTop - c.clientHeight < threshold;
                    if (isNearBottom) {
                        c.scrollTop = c.scrollHeight;
                    }
                }
            }, 50);

            if (data.from === targetUserId) {
                socket.emit('message_read', { messageIds: [data._id] });
            }
        };

        const handleMessageSent = (data) => {
            setMessages((prev) => prev.map(msg => 
                msg.tempId === data.tempId ? { ...msg, _id: data._id, status: data.status, createdAt: data.createdAt } : msg
            ));
            
            // Auto scroll to bottom when we send a message
            setTimeout(() => {
                if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
                }
            }, 50);
        };

        const handleStatusUpdate = (data) => {
            if (data.messageId) {
                setMessages((prev) => prev.map(msg => 
                    msg._id === data.messageId ? { ...msg, status: data.status } : msg
                ));
            } else if (data.messageIds) {
                setMessages((prev) => prev.map(msg => 
                    data.messageIds.includes(msg._id) ? { ...msg, status: data.status } : msg
                ));
            }
        };

        const handleTyping = (data) => {
            if (data.fromUserId === targetUserId) {
                setIsTyping(data.isTyping);
            }
        };

        socket.on('new_message', handleNewMessage);
        socket.on('message_sent', handleMessageSent);
        socket.on('message_status_update', handleStatusUpdate);
        socket.on('typing', handleTyping);

        return () => {
            socket.off('new_message', handleNewMessage);
            socket.off('message_sent', handleMessageSent);
            socket.off('message_status_update', handleStatusUpdate);
            socket.off('typing', handleTyping);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, [currentUserId, targetUserId, socket]);

    // Handle scroll position restoration after prepending loaded messages
    useLayoutEffect(() => {
        if (shouldRestoreScrollRef.current && scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            container.scrollTop = container.scrollHeight - prevScrollHeightRef.current;
            shouldRestoreScrollRef.current = false;
        }
    }, [messages]);

    const loadMoreMessages = () => {
        if (loadingOlder || !hasMore || messages.length === 0) return;

        setLoadingOlder(true);
        const oldestMsg = messages.find(msg => msg._id); // find the first loaded message with a DB ID
        const beforeTime = oldestMsg?.createdAt || new Date().toISOString();
        const API_URL = import.meta.env.VITE_BACKEND_URL || "";
        const limit = 50;

        // Save scroll height before fetch/state update
        if (scrollContainerRef.current) {
            prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
            shouldRestoreScrollRef.current = true;
        }

        fetch(`${API_URL}/api/messages/${currentUserId}/${targetUserId}?before=${encodeURIComponent(beforeTime)}&limit=${limit}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
            .then(res => res.json())
            .then(history => {
                if (history.length < limit) {
                    setHasMore(false);
                }

                const olderMessages = history.map(msg => ({
                    _id: msg._id,
                    from: msg.from === currentUserId ? 'Me' : msg.from,
                    message: msg.message,
                    status: msg.status,
                    createdAt: msg.createdAt
                }));

                setMessages(prev => [...olderMessages, ...prev]);
            })
            .catch(err => {
                console.error(err);
                shouldRestoreScrollRef.current = false;
            })
            .finally(() => {
                setLoadingOlder(false);
            });
    };

    const handleScroll = (e) => {
        const container = e.target;
        // Trigger load if user scrolls near the top
        if (container.scrollTop <= 10) {
            loadMoreMessages();
        }
    };

    function handleSend() {
        if (message.trim() && socket) {
            const tempId = Date.now().toString() + Math.random().toString();
            setMessages((prev) => [...prev, { tempId, from: 'Me', message, status: 'sending...' }]);
            socket.emit('private_message', { toUserId: targetUserId, message, fromUserId: currentUserId, tempId });
            setMessage('');
            socket.emit('typing', { toUserId: targetUserId, fromUserId: currentUserId, isTyping: false });
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        }
    }

    function handleTypingInput(e) {
        setMessage(e.target.value);
        if (socket) {
            socket.emit('typing', { toUserId: targetUserId, fromUserId: currentUserId, isTyping: true });
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                socket.emit('typing', { toUserId: targetUserId, fromUserId: currentUserId, isTyping: false });
            }, 2000);
        }
    }

    const renderTicks = (msg) => {
        if (msg.from !== 'Me') return null;
        if (msg.status === 'sending...') return <span className="text-[10px] ml-1 text-gray-400">...</span>;
        if (msg.status === 'sent') return <span className="text-[10px] ml-1 text-gray-300">✓</span>;
        if (msg.status === 'delivered') return <span className="text-[10px] ml-1 text-gray-300">✓✓</span>;
        if (msg.status === 'read') return <span className="text-[10px] ml-1 text-blue-400">✓✓</span>;
        return null;
    };

    return (
        <div className="flex flex-col h-screen flex-1 bg-gray-950">
            <div className="p-4 border-b border-gray-700 bg-gray-900 text-white font-bold text-lg">
                <div>💬 {targetUserId}</div>
                <div className="text-xs text-gray-400 font-normal">{isOnline ? 'Online' : 'Offline'}</div>
            </div>
            
            <div 
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 flex flex-col gap-2"
            >
                {loadingOlder && (
                    <div className="text-center text-xs text-gray-500 my-2">
                        Loading older messages...
                    </div>
                )}
                {messages.map((msg, idx) => (
                    <div key={msg._id || msg.tempId || idx} className={`flex ${msg.from === 'Me' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm text-white ${msg.from === 'Me' ? 'bg-indigo-600' : 'bg-gray-700'}`}>
                            {msg.from !== 'Me' && <p className="text-xs text-gray-400 mb-1">{msg.from}</p>}
                            <div className="flex items-end justify-between gap-2">
                                <span>{msg.message}</span>
                                {renderTicks(msg)}
                            </div>
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="max-w-xs px-4 py-2 rounded-2xl text-sm text-white bg-gray-700">
                            <span className="text-gray-400 italic">typing...</span>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="p-4 bg-gray-900 border-t border-gray-700 flex gap-2">
                <input
                    value={message}
                    onChange={handleTypingInput}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    className="flex-1 bg-gray-800 text-white rounded-full px-4 py-2 outline-none"
                    placeholder="Type a message..."
                />
                <button
                    onClick={handleSend}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full transition-colors"
                >
                    Send
                </button>
            </div>
        </div>
    );
}

export default ChatWindow;