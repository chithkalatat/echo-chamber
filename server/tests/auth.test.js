import { jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Set environment variables BEFORE importing index.js
process.env.JWT_SECRET = 'test_secret_key';
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mock_uri'; // Will be overridden in beforeAll

// 1. Mock the Redis module to avoid connection attempts during testing
jest.unstable_mockModule('redis', () => {
  const mockClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    hKeys: jest.fn().mockResolvedValue([]),
    hSet: jest.fn().mockResolvedValue(1),
    hDel: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
    subscribe: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
    psubscribe: jest.fn().mockResolvedValue(undefined),
    punsubscribe: jest.fn().mockResolvedValue(undefined),
    duplicate: function () { return this; }
  };
  return {
    createClient: () => mockClient
  };
});

// Import app and initialization from index.js
const { app, main } = await import('../index.js');

let mongoServer;

beforeAll(async () => {
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  // Configure final test MONGO_URI
  process.env.MONGO_URI = uri;

  // Run initialization (connects mongoose to in-memory Mongo, setups routes, etc.)
  await main();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Authentication Flow Integration Tests', () => {
  const registerPayload = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123'
  };

  test('POST /api/register - Success', async () => {
    const res = await request(app)
      .post('/api/register')
      .send(registerPayload);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('User registered successfully');
  });

  test('POST /api/register - Duplicate Username Rejection', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({
        username: 'testuser', // Duplicate
        email: 'another@example.com',
        password: 'password123'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Username already taken');
  });

  test('POST /api/register - Invalid Username Format Rejection', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({
        username: 'ab', // too short
        email: 'valid@example.com',
        password: 'password123'
      });

    expect(res.status).toBe(400);
    const msg = res.body.message || res.body.error || res.text;
    expect(msg).toContain('Username must be at least 3 characters');
  });

  test('POST /api/login - Correct Credentials', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({
        username: 'testuser',
        password: 'password123'
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('POST /api/login - Incorrect Credentials', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({
        username: 'testuser',
        password: 'wrongpassword'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid credentials');
  });
});

describe('Conversations & Search Endpoints Integration Tests', () => {
  let token;

  beforeAll(async () => {
    // Log in to get token
    const res = await request(app)
      .post('/api/login')
      .send({
        username: 'testuser',
        password: 'password123'
      });
    token = res.body.token;
  });

  test('GET /api/conversations - Access Denied without Token', async () => {
    const res = await request(app)
      .get('/api/conversations');

    expect(res.status).toBe(403);
  });

  test('GET /api/conversations - Success with Token', async () => {
    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/users/search - Search matching users', async () => {
    const res = await request(app)
      .get('/api/users/search?username=test')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].username).toBe('testuser');
  });
});

describe('Username Update and Linkage by ID Tests', () => {
  let token;
  let user1;

  beforeAll(async () => {
    // Register testuser1
    await request(app)
      .post('/api/register')
      .send({ username: 'u1edit', email: 'u1edit@example.com', password: 'password123' });

    // Log in testuser1
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'u1edit', password: 'password123' });
    token = res.body.token;

    // Get user details
    const profileRes = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`);
    user1 = profileRes.body;
  });

  test('POST /api/auth/update-username - Success & Token update', async () => {
    const res = await request(app)
      .post('/api/auth/update-username')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'u1newname' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Username updated successfully');
    expect(res.body.token).toBeDefined();
    expect(res.body.username).toBe('u1newname');

    // Verify profile endpoint returns new username
    const profileRes = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${res.body.token}`);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.username).toBe('u1newname');
  });

  test('POST /api/auth/update-username - Validation Rejection', async () => {
    // Too short
    let res = await request(app)
      .post('/api/auth/update-username')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'ab' });
    expect(res.status).toBe(400);

    // Invalid characters
    res = await request(app)
      .post('/api/auth/update-username')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'invalid name!' });
    expect(res.status).toBe(400);
  });
});

describe('Authentication Rate Limiting Tests', () => {
  test('POST /api/login - Triggers rate limiting after max attempts', async () => {
    // Make 15 login attempts in quick succession
    // Note: max attempts configured is 10, so attempts 11-15 should fail with 429
    let triggered = false;
    for (let i = 0; i < 15; i++) {
      const res = await request(app)
        .post('/api/login')
        .send({
          username: 'rate_limited_user',
          password: 'password123'
        });

      if (res.status === 429) {
        triggered = true;
        expect(res.body.message).toContain('Too many attempts');
        break;
      }
    }
    expect(triggered).toBe(true);
  });
});
