import './App.css'
import ChatWindow from './chatWindow'

function App(){
  return (
    <>
    <div>
      <ChatWindow currentUserId = "UserA" targetUserId="UserB"/>
      <ChatWindow currentUserId="UserB" targetUserId="UserA" />
    </div>

    </>
  )
}

export default App
