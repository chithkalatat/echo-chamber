import { useEffect } from "react";
import { useState } from "react";
import { io } from "socket.io-client";

const ChatWindow = ({ currentUserId, targetUserId }) => {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [socket, setSocket] = useState('');

    useEffect(() => {
        const newSocket = io('http://localhost:5000');
        setSocket(newSocket);
        newSocket.emit('login', currentUserId);
        newSocket.on('new_message', (data) => {
            setMessages([...messages, {
                from: data.from,
                message: data.message
            }]);
        })
    }, [currentUserId]);

    function handleSend() {

        if (message.length != 0) {
            setMessages([...messages, {
                from: 'Me',
                message: message
            }]);
            socket.emit('private_message', {
                toUserId: targetUserId,
                message: message
            });
            setMessage("");
        }

    }
    return (
        <>
            <h1>You are chatting with {targetUserId}</h1>
            <input value={message} onChange={(e) =>
                setMessage(e.target.value)
            } />
            <button onClick={handleSend}>Send</button>
            {messages.map((mess) => {
                return <p>{mess.from}:{mess.message}</p>
            })}
        </>
    )
}

export default ChatWindow