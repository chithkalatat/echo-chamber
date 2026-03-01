const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Connect to MongoDB (The 'mongodb' name matches docker-compose)
mongoose.connect(process.env.MONGO_URI || 'mongodb://mongodb:27017/echochamber')
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error(err));

app.get('/', (req, res) => res.send("EchoChamber Backend Running"));

server.listen(5000, () => console.log("Server listening on port 5000"));