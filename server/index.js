import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connect } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from './models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";
const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.use(express.json());

io.on('connection', (socket) => {
  console.log("New user connected with ID:", socket.id);

  socket.on('login', (userId) => {
    socket.join(userId);
    console.log("Socket joined the room", userId);
  })

  socket.on('private_message', (data) => {
    io.to(data.toUserId).emit('new_message', {
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


app.post("/api/register", async (req, res) => {
  try {
    const { username, password, publicKey } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      password: hashedPassword,
      publicKey,
    });

    await user.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user)
      return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const uname = await User.find({}).select('username')
    res.json(uname)
  }
  catch (err) {
    res.status(500).json({ error: err.message })
  }
})