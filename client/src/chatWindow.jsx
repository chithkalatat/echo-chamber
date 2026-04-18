import { useEffect, useState } from "react";

const ChatWindow = ({ currentUserId, targetUserId, socket }) => {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        if (!socket) return;
        fetch(`/api/messages/${currentUserId}/${targetUserId}`)
            .then(res => res.json())
            .then(history => {
                setMessages(history.map(msg => ({
                    from: msg.from == currentUserId ? 'Me' : msg.from,
                    message: msg.message
                })));
            });
        socket.on('new_message', (data) => {
            setMessages((prev) => [...prev, { from: data.from, message: data.message }]);
        });
        return () => socket.off('new_message');
    }, [currentUserId, targetUserId, socket]);

    function handleSend() {
        if (message.trim() && socket) {
            setMessages((prev) => [...prev, { from: 'Me', message }]);
            socket.emit('private_message', { toUserId: targetUserId, message, fromUserId: currentUserId });
            setMessage('');
        }
    }

    return (
        <div className="flex flex-col h-screen flex-1 bg-gray-950">
            <div className="p-4 border-b border-gray-700 bg-gray-900 text-white font-bold text-lg">
                💬 {targetUserId}
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.from === 'Me' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm text-white ${msg.from === 'Me' ? 'bg-indigo-600' : 'bg-gray-700'}`}>
                            {msg.from !== 'Me' && <p className="text-xs text-gray-400 mb-1">{msg.from}</p>}
                            {msg.message}
                        </div>
                    </div>
                ))}
            </div>
            <div className="p-4 bg-gray-900 border-t border-gray-700 flex gap-2">
                <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
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