import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connect } from 'mongoose';

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on('connection',(socket) =>{
  console.log("New user connected with ID:",socket.id);

  socket.on('login',(userId)=>{
    socket.join(userId);
    console.log("Socket joined the room",userId);
  })

  socket.on('private_message',(data)=>{
    io.to(data.toUserId).emit('new_message',{
      from: socket.id,
      message: data.message
    });
   })
  })

// Connect to MongoDB (The 'mongodb' name matches docker-compose)
connect(process.env.MONGO_URI || 'mongodb://mongodb:27017/echochamber')
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error(err));

app.get('/', (req, res) => res.send("EchoChamber Backend Running"));

server.listen(5000, () => console.log("Server listening on port 5000"));