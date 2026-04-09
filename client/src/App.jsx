import { useState } from 'react';
import './App.css'
import ChatWindow from './chatWindow'
import UsersList from './UsersList';

function App(){

  const token = localStorage.getItem('token');
  const currentUserId = token ? JSON.parse(atob(token.split('.')[1])).username : null;

  const[selectedUser, setSelectedUser] = useState(null);

  return (
    <>
    <div>
      <UsersList onSelectUser={(username) => setSelectedUser(username)} />
      {selectedUser && (
        <ChatWindow currentUserId={currentUserId}
        targetUserId={selectedUser}
        />
      )}
    </div>

    </>
  )
}

export default App
