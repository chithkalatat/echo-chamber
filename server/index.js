import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connect } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import User from './models/User.js';
import Message from './models/Message.js';
import cors from 'cors';
import session from 'express-session';
import RedisStore from 'connect-redis';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

const JWT_SECRET = process.env.JWT_SECRET;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per 15 minutes
  message: { message: "Too many attempts from this IP. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9._]+$/, "Username can only contain alphanumeric characters, dots, and underscores")
    .trim(),
  email: z.string().email("A valid email is required").toLowerCase().trim(),
  password: z.string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password is too long"),
  publicKey: z.string().optional()
});

const loginSchema = z.object({
  username: z.string().min(1, "Username or email is required").trim(),
  password: z.string().min(1, "Password is required")
});

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: result.error.issues?.[0]?.message || "Invalid input data" });
  }
  // Replace req.body with parsed/sanitized version (handles trim, lowerCase, etc.)
  req.body = result.data;
  next();
};

function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Redis setup
// ---------------------------------------------------------------------------
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const pubClient = createClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();

// Explicit error listeners — runtime disconnects are logged but non-fatal;
// the adapter will automatically resync once Redis comes back.
pubClient.on('error', (err) => console.error('Redis pubClient error:', err.message));
subClient.on('error', (err) => console.error('Redis subClient error:', err.message));

// ---------------------------------------------------------------------------
// Express + Socket.io
// ---------------------------------------------------------------------------
const app = express();
const server = createServer(app);

// Use FRONTEND_URL from environment, or fallback to localhost
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost";

const corsOptions = {
  origin: FRONTEND_URL,
  optionsSuccessStatus: 200
};

// Apply CORS to both Express HTTP routes and Socket.io
app.use(cors(corsOptions));
app.use(express.json());

// ---------------------------------------------------------------------------
// Main — async so we can await Redis connect before accepting connections
// ---------------------------------------------------------------------------
async function main() {
  // Connect both Redis clients; if Redis is unreachable the process exits.
  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    console.log('Connected to Redis at', REDIS_URL);
  } catch (err) {
    console.error('FATAL: Could not connect to Redis —', err.message);
    process.exit(1);
  }

  // Create Socket.io server with the Redis adapter
  const io = new Server(server, {
    cors: corsOptions,
    adapter: createAdapter(pubClient, subClient),
  });

  // -------------------------------------------------------------------------
  // Email transporter (nodemailer)
  // -------------------------------------------------------------------------
  let emailTransporter = null;
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    emailTransporter.verify()
      .then(() => console.log('Email transporter ready'))
      .catch((err) => console.warn('Email transporter failed to verify:', err.message));
  } else {
    console.warn('EMAIL_USER/EMAIL_PASS not set — password reset codes will be shown in-app (dev mode)');
  }

  // -------------------------------------------------------------------------
  // Redis-backed online-users (Hash: online_users  field=userId  value=socketId)
  // -------------------------------------------------------------------------
  const ONLINE_KEY = 'online_users';

  /**
   * Broadcast the full online-user list to every connected client
   * (across all instances via the adapter).
   */
  async function broadcastOnlineUsers() {
    const userIds = await pubClient.hKeys(ONLINE_KEY);
    io.emit('online_users', userIds);
  }

  // -------------------------------------------------------------------------
  // Socket.io JWT Authentication Middleware
  // -------------------------------------------------------------------------
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error('Authentication error: Invalid token'));
      socket.userId = decoded.username;
      next();
    });
  });

  const socketSpamMap = new Map();

  io.on('connection', async (socket) => {
    console.log("Socket connected & authenticated:", socket.userId);

    // Automatically join the user to their own room and update presence
    socket.join(socket.userId);
    await pubClient.hSet(ONLINE_KEY, socket.userId, socket.id);
    await broadcastOnlineUsers();

    socket.on('disconnect', async () => {
      socketSpamMap.delete(socket.id);
      // O(1) removal since we now have socket.userId verified
      if (socket.userId) {
        await pubClient.hDel(ONLINE_KEY, socket.userId);
        await broadcastOnlineUsers();
      }
      console.log("User Disconnected:", socket.userId);
    });

    socket.on('private_message', async (data) => {
      // Input validation and sanitization
      if (!data || typeof data.message !== 'string' || typeof data.fromUserId !== 'string' || typeof data.toUserId !== 'string') {
        return;
      }

      const cleanMessage = escapeHTML(data.message.trim());
      if (cleanMessage.length === 0 || cleanMessage.length > 2000) {
        socket.emit('message_error', { error: 'Invalid message length (max 2000 characters)' });
        return;
      }

      // Spam protection: Max 10 messages per 10 seconds per connection
      const now = Date.now();
      const limitWindow = 10000; // 10 seconds
      const maxMsgs = 10;

      let rateData = socketSpamMap.get(socket.id);
      if (!rateData || (now - rateData.windowStart) > limitWindow) {
        rateData = { count: 1, windowStart: now };
        socketSpamMap.set(socket.id, rateData);
      } else {
        rateData.count++;
        if (rateData.count > maxMsgs) {
          console.warn(`Spam detected from socket ${socket.id} (${socket.userId}). Disconnecting.`);
          socket.emit('spam_warning', { message: 'Rate limit exceeded. Disconnected.' });
          socket.disconnect(true);
          return;
        }
      }

      const newMessage = new Message({
        from: data.fromUserId,
        to: data.toUserId,
        message: cleanMessage,
        status: 'sent'
      });
      await newMessage.save();

      socket.emit('message_sent', { tempId: data.tempId, _id: newMessage._id, status: 'sent', createdAt: newMessage.createdAt });

      io.to(data.toUserId).emit('new_message', {
        _id: newMessage._id,
        from: data.fromUserId,
        message: cleanMessage,
        status: 'sent',
        createdAt: newMessage.createdAt
      });
    });

    socket.on('resync', async ({ lastDate, userId }) => {
      if (!lastDate || !userId) return;
      const missed = await Message.find({ to: userId, createdAt: { $gt: new Date(lastDate) } }).sort({ createdAt: 1 });
      for (const msg of missed) {
        socket.emit('new_message', {
          _id: msg._id,
          from: msg.from,
          message: msg.message,
          status: msg.status,
          createdAt: msg.createdAt
        });
      }
    });

    socket.on('typing', ({ toUserId, fromUserId, isTyping }) => {
      io.to(toUserId).emit('typing', { fromUserId, isTyping });
    });

    socket.on('message_delivered', async ({ messageId }) => {
      const msg = await Message.findByIdAndUpdate(messageId, { status: 'delivered' }, { new: true });
      if (msg) {
        io.to(msg.from).emit('message_status_update', { messageId: msg._id, status: 'delivered' });
      }
    });

    socket.on('message_read', async ({ messageIds }) => {
      await Message.updateMany({ _id: { $in: messageIds } }, { $set: { status: 'read' } });
      const msgs = await Message.find({ _id: { $in: messageIds } });
      const senders = [...new Set(msgs.map(m => m.from))];
      for (const sender of senders) {
        const ids = msgs.filter(m => m.from === sender).map(m => m._id);
        io.to(sender).emit('message_status_update', { messageIds: ids, status: 'read' });
      }
    });
  });

  // -------------------------------------------------------------------------
  // MongoDB
  // -------------------------------------------------------------------------
  connect(process.env.MONGO_URI || 'mongodb://mongodb:27017/echochamber')
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => console.error(err));

  // -------------------------------------------------------------------------
  // HTTP routes & OAuth
  // -------------------------------------------------------------------------
  
  app.use(session({
    store: new RedisStore({ client: pubClient }),
    secret: JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'mock_id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'mock_secret',
    callbackURL: `/api/auth/google/callback`,
    proxy: true
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      console.error('GOOGLE_PROFILE_ID:', profile.id);
      console.error('GOOGLE_PROFILE_EMAILS:', JSON.stringify(profile.emails));
      console.error('GOOGLE_PROFILE_JSON:', JSON.stringify(profile._json));
      
      const rawEmail = profile.emails?.[0]?.value || profile._json?.email;
      const email = rawEmail ? rawEmail.toLowerCase() : null;
      console.error('RESOLVED_GOOGLE_EMAIL:', email);

      // 1. Check if there is an existing account created normally (or already registered) with this email
      if (email) {
        const userWithEmail = await User.findOne({ email });
        console.error('USER_WITH_EMAIL:', userWithEmail ? userWithEmail.username : 'not found');
        if (userWithEmail) {
          if (userWithEmail.googleId !== profile.id) {
            // Unset googleId from any other account to avoid duplicate key index collision
            await User.updateMany(
              { googleId: profile.id, _id: { $ne: userWithEmail._id } },
              { $unset: { googleId: "" } }
            );
            userWithEmail.googleId = profile.id;
            await userWithEmail.save();
            console.error(`Linked existing user ${userWithEmail.username} (email: ${email}) with Google ID ${profile.id}`);
          }
          return done(null, userWithEmail);
        }
      }

      // 2. Otherwise, look up by googleId
      const user = await User.findOne({ googleId: profile.id });
      console.error('USER_WITH_GOOGLEID:', user ? user.username : 'not found');
      if (user) {
        // If the user document doesn't have the email set, let's update it now
        if (email && user.email !== email) {
          user.email = email;
          await user.save();
          console.error(`Updated email to ${email} for Google user ${user.username}`);
        }
        return done(null, user);
      }

      // 3. Truly new user — pass profile info so callback can issue a setup token
      return done(null, { isNew: true, googleId: profile.id, email });
    } catch (err) {
      console.error('Error in Google Strategy callback:', err);
      return done(err, null);
    }
  }));

  const cleanFrontendUrl = FRONTEND_URL.replace(/\/$/, "");

  app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  app.get('/api/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: `${cleanFrontendUrl}/login` }),
    (req, res) => {
      if (req.user.isNew) {
        // New Google user — issue a short-lived setup token for username selection
        const setupToken = jwt.sign(
          { googleId: req.user.googleId, email: req.user.email, purpose: 'setup' },
          JWT_SECRET,
          { expiresIn: '10m' }
        );
        return res.redirect(`${cleanFrontendUrl}/set-username?setup_token=${setupToken}`);
      }

      // Existing user — issue normal JWT
      const token = jwt.sign(
        { id: req.user._id, username: req.user.username },
        JWT_SECRET,
        { expiresIn: "1d" }
      );
      res.redirect(`${cleanFrontendUrl}/login?token=${token}`);
    }
  );

  // POST /api/auth/set-username — new Google user picks their username
  app.post('/api/auth/set-username', async (req, res) => {
    try {
      const { setupToken, username } = req.body;
      if (!setupToken || !username) {
        return res.status(400).json({ message: 'Setup token and username are required' });
      }

      // Validate setup token
      let decoded;
      try {
        decoded = jwt.verify(setupToken, JWT_SECRET);
      } catch (err) {
        return res.status(401).json({ message: 'Setup token expired or invalid. Please sign in with Google again.' });
      }
      if (decoded.purpose !== 'setup') {
        return res.status(400).json({ message: 'Invalid token type' });
      }

      // Validate username format
      const trimmed = username.trim();
      if (trimmed.length < 3 || trimmed.length > 30) {
        return res.status(400).json({ message: 'Username must be 3-30 characters' });
      }
      if (!/^[a-zA-Z0-9._]+$/.test(trimmed)) {
        return res.status(400).json({ message: 'Username can only contain letters, numbers, dots, and underscores' });
      }

      // Check if username is taken
      const existing = await User.findOne({ username: trimmed });
      if (existing) {
        return res.status(409).json({ message: 'Username is already taken' });
      }

      // Check if this googleId already registered (race condition guard)
      const existingGoogle = await User.findOne({ googleId: decoded.googleId });
      if (existingGoogle) {
        const token = jwt.sign(
          { id: existingGoogle._id, username: existingGoogle.username },
          JWT_SECRET,
          { expiresIn: '1d' }
        );
        return res.json({ token });
      }

      // Create user
      const user = new User({
        username: trimmed,
        googleId: decoded.googleId,
        email: decoded.email,
      });
      await user.save();

      const token = jwt.sign(
        { id: user._id, username: user.username },
        JWT_SECRET,
        { expiresIn: '1d' }
      );
      res.json({ token });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/', (req, res) => res.send("EchoChamber Backend Running"));

  const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ message: 'No token provided' });

    const token = authHeader.split(' ')[1] || authHeader;
    if (!token) return res.status(403).json({ message: 'No token provided' });

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
  };

  app.get('/api/messages/:userId1/:userId2', verifyToken, async (req, res) => {
    try {
      const { userId1, userId2 } = req.params;
      const before = req.query.before ? new Date(req.query.before) : new Date();
      const limit = parseInt(req.query.limit, 10) || 50;

      const messages = await Message.find({
        $or: [
          { from: userId1, to: userId2 },
          { from: userId2, to: userId1 }
        ],
        createdAt: { $lt: before }
      })
      .sort({ createdAt: -1 })
      .limit(limit);

      // Reverse to display chronologically ascending
      res.json(messages.reverse());
    }
    catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/register", authLimiter, validate(registerSchema), async (req, res) => {
    try {
      const { username, email, password, publicKey } = req.body;

      const existingUser = await User.findOne({ username });
      if (existingUser)
        return res.status(400).json({ message: "Username already taken" });

      const existingEmail = await User.findOne({ email });
      if (existingEmail)
        return res.status(400).json({ message: "Email already registered" });

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = new User({
        username,
        email,
        password: hashedPassword,
        publicKey,
      });

      await user.save();

      res.status(201).json({ message: "User registered successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/login", authLimiter, validate(loginSchema), async (req, res) => {
    try {
      const { username, password } = req.body;

      // Accept email or username — if it contains @, treat as email
      const query = username.includes('@')
        ? { email: username }
        : { username: username };

      const user = await User.findOne(query);
      if (!user || !user.password)
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

  // GET /api/auth/profile — returns logged-in user's details
  app.get('/api/auth/profile', verifyToken, async (req, res) => {
    try {
      const user = await User.findOne({ username: req.user.username }).select('-password -__v');
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json({
        username: user.username,
        email: user.email || null,
        googleLinked: !!user.googleId,
        createdAt: user.createdAt,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/auth/forgot-password — generates a 6-digit code, stores in Redis
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: 'Email is required' });

      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        // Don't reveal whether the email exists
        return res.json({ message: 'If that email is registered, a reset code has been sent.' });
      }
      if (!user.password) {
        return res.status(400).json({ message: 'This account uses Google Sign-In. Please log in with Google.' });
      }

      // Generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // Store in Redis with 10-minute TTL
      await pubClient.set(`reset:${email.toLowerCase()}`, code, { EX: 600 });

      let emailSent = false;
      if (emailTransporter) {
        try {
          await emailTransporter.sendMail({
            from: `"EchoChamber Support" <${process.env.EMAIL_USER}>`,
            to: email.toLowerCase(),
            subject: "Reset your EchoChamber Password",
            text: `Your password reset verification code is: ${code}. This code is valid for 10 minutes.`,
            html: `<p>Your password reset verification code is: <strong style="font-size: 1.2rem; font-family: monospace;">${code}</strong></p><p>This code is valid for 10 minutes.</p>`
          });
          console.log(`[PASSWORD RESET] Email sent successfully to ${email}`);
          emailSent = true;
        } catch (mailErr) {
          console.error(`[PASSWORD RESET] Failed to send email to ${email}:`, mailErr.message);
        }
      }

      console.log(`[PASSWORD RESET] Code for ${email}: ${code}`);

      res.json({ 
        message: 'If that email is registered, a reset code has been sent.', 
        code: !emailSent ? code : undefined 
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/auth/verify-reset-code — validates code, returns a reset token
  app.post('/api/auth/verify-reset-code', async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) return res.status(400).json({ message: 'Email and code are required' });

      const stored = await pubClient.get(`reset:${email.toLowerCase()}`);
      if (!stored || stored !== code) {
        return res.status(400).json({ message: 'Invalid or expired code' });
      }

      // Delete the code so it can't be reused
      await pubClient.del(`reset:${email.toLowerCase()}`);

      // Issue a short-lived reset token
      const resetToken = jwt.sign(
        { email: email.toLowerCase(), purpose: 'reset' },
        JWT_SECRET,
        { expiresIn: '10m' }
      );

      res.json({ resetToken });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/auth/reset-password — sets a new password
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { resetToken, newPassword } = req.body;
      if (!resetToken || !newPassword) {
        return res.status(400).json({ message: 'Reset token and new password are required' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }

      let decoded;
      try {
        decoded = jwt.verify(resetToken, JWT_SECRET);
      } catch (err) {
        return res.status(401).json({ message: 'Reset link expired. Please request a new one.' });
      }
      if (decoded.purpose !== 'reset') {
        return res.status(400).json({ message: 'Invalid token' });
      }

      const user = await User.findOne({ email: decoded.email });
      if (!user) return res.status(404).json({ message: 'User not found' });

      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();

      res.json({ message: 'Password reset successfully. You can now log in.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/conversations — distinct users the logged-in user has messaged with
  app.get('/api/conversations', verifyToken, async (req, res) => {
    try {
      const me = req.user.username;

      // Find all distinct usernames this user has exchanged messages with
      const sent = await Message.distinct('to', { from: me });
      const received = await Message.distinct('from', { to: me });
      const partnerUsernames = [...new Set([...sent, ...received])];

      // For each partner, grab the latest message for preview/sorting
      const conversations = await Promise.all(
        partnerUsernames.map(async (partner) => {
          const lastMsg = await Message.findOne({
            $or: [
              { from: me, to: partner },
              { from: partner, to: me }
            ]
          }).sort({ createdAt: -1 });

          return {
            username: partner,
            lastMessage: lastMsg?.message || '',
            lastMessageTime: lastMsg?.createdAt || null,
          };
        })
      );

      // Sort by most recent message first
      conversations.sort((a, b) => {
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
      });

      res.json(conversations);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/users/search?username=xyz — prefix match, capped at 10
  app.get('/api/users/search', verifyToken, async (req, res) => {
    try {
      const { username } = req.query;
      if (!username || username.trim().length === 0) {
        return res.json([]);
      }

      const users = await User.find({
        username: { $regex: `^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, $options: 'i' }
      })
        .select('username')
        .limit(10);

      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // Start listening
  // -------------------------------------------------------------------------
  const PORT = process.env.PORT || 5000;
  if (process.env.NODE_ENV !== 'test') {
    server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
  }
}

if (process.env.NODE_ENV !== 'test') {
  main();
}

export { app, server, pubClient, subClient, main };
