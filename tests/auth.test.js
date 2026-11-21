
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const { promisify } = require('util');

jest.mock('../config/db', () => ({
  pool: {
    query: jest.fn(),
  },
}));

const { pool } = require('../config/db');
const authRoutes = require('../routes/auth');

const scrypt = promisify(crypto.scrypt);

const app = express();

app.use(express.json());

app.use(
  session({
    secret: 'test-session-secret',
    resave: false,
    saveUninitialized: false,
  })
);

app.use('/api/auth', authRoutes);

// Generate a password hash for login tests.
async function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);

  return `${salt}:${derived.toString('hex')}`;
}

// Reusable mock employee account.
function createActiveUser(overrides = {}) {
  return {
    user_id: 1,
    empno: 'E1234',
    full_name: 'John Doe',
    email: 'john@example.com',
    password_hash: null,
    role: 'user',
    status: 'active',
    must_set_password: false,
    firstname: 'John',
    lastname: 'Doe',
    ...overrides,
  };
}

describe('CyberHub authentication API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // REGISTRATION TESTS
  // ==========================================

  describe('POST /api/auth/register', () => {
    test('rejects an invalid employee number', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          empno: '123',
          email: 'john@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(400);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('rejects an employee who is not eligible', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [],
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          empno: 'E1234',
          email: 'john@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(404);
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test('registers an eligible employee with pending status', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [
            {
              empno: 'E1234',
              firstname: 'John',
              lastname: 'Doe',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 1,
              empno: 'E1234',
              full_name: 'John Doe',
              email: 'john@example.com',
              role: 'user',
              status: 'pending',
              must_set_password: false,
            },
          ],
        });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          empno: 'E1234',
          email: 'john@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(201);
      expect(response.body.user.status).toBe('pending');
      expect(response.body.user.role).toBe('user');
      expect(response.body.user.full_name).toBe('John Doe');
      expect(response.body.user.password_hash).toBeUndefined();
    });

    test('returns conflict for duplicate email or employee number', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [
            {
              empno: 'E1234',
              firstname: 'John',
              lastname: 'Doe',
            },
          ],
        })
        .mockRejectedValueOnce({
          code: '23505',
        });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          empno: 'E1234',
          email: 'john@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(409);
    });

    test('rejects an invalid email address', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          empno: 'E1234',
          email: 'invalid-email',
          password: 'Password123',
        });

      expect(response.status).toBe(400);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('rejects passwords shorter than eight characters', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          empno: 'E1234',
          email: 'john@example.com',
          password: 'short',
        });

      expect(response.status).toBe(400);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // LOGIN TESTS
  // ==========================================

  describe('POST /api/auth/login', () => {
    test('rejects incorrect passwords', async () => {
      const passwordHash = await createPasswordHash(
        'CorrectPassword123'
      );

      pool.query.mockResolvedValueOnce({
        rows: [
          createActiveUser({
            password_hash: passwordHash,
          }),
        ],
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'WrongPassword123',
        });

      expect(response.status).toBe(401);
    });

    test('rejects accounts awaiting administrator approval', async () => {
      const passwordHash = await createPasswordHash('Password123');

      pool.query.mockResolvedValueOnce({
        rows: [
          createActiveUser({
            password_hash: passwordHash,
            status: 'pending',
          }),
        ],
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(
        /awaiting administrator approval/i
      );
    });

    test('logs in an active user and creates a session', async () => {
      const passwordHash = await createPasswordHash('Password123');

      pool.query
        .mockResolvedValueOnce({
          rows: [
            createActiveUser({
              password_hash: passwordHash,
            }),
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            createActiveUser(),
          ],
        });

      const agent = request.agent(app);

      const loginResponse = await agent
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'Password123',
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.message).toBe('Login successful.');

      const meResponse = await agent.get('/api/auth/me');

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.user.email).toBe('john@example.com');
      expect(meResponse.body.user.empno).toBe('E1234');
    });

    test('rejects blocked accounts', async () => {
      const passwordHash = await createPasswordHash('Password123');

      pool.query.mockResolvedValueOnce({
        rows: [
          createActiveUser({
            password_hash: passwordHash,
            status: 'blocked',
          }),
        ],
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/blocked/i);
    });

    test('rejects login when credentials are missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: '',
          password: '',
        });

      expect(response.status).toBe(400);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // PROTECTED ROUTE TESTS
  // ==========================================

  describe('Protected routes', () => {
    test('rejects unauthenticated access to /me', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('rejects a session when the account is blocked after login', async () => {
      const passwordHash = await createPasswordHash('Password123');

      pool.query
        .mockResolvedValueOnce({
          rows: [
            createActiveUser({
              password_hash: passwordHash,
            }),
          ],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      const agent = request.agent(app);

      const loginResponse = await agent
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'Password123',
        });

      expect(loginResponse.status).toBe(200);

      const meResponse = await agent.get('/api/auth/me');

      expect(meResponse.status).toBe(401);
      expect(meResponse.body.error).toMatch(/session is no longer valid/i);

      // The invalid session should have been destroyed.
      const secondMeResponse = await agent.get('/api/auth/me');

      expect(secondMeResponse.status).toBe(401);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    test('rejects a session when the employee is no longer eligible', async () => {
      const passwordHash = await createPasswordHash('Password123');

      pool.query
        .mockResolvedValueOnce({
          rows: [
            createActiveUser({
              password_hash: passwordHash,
            }),
          ],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      const agent = request.agent(app);

      const loginResponse = await agent
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'Password123',
        });

      expect(loginResponse.status).toBe(200);

      const meResponse = await agent.get('/api/auth/me');

      expect(meResponse.status).toBe(401);
      expect(meResponse.body.error).toMatch(/session is no longer valid/i);
    });

    test('returns current account information instead of stale session data', async () => {
      const passwordHash = await createPasswordHash('Password123');

      pool.query
        .mockResolvedValueOnce({
          rows: [
            createActiveUser({
              password_hash: passwordHash,
              role: 'user',
            }),
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            createActiveUser({
              email: 'updated@example.com',
              role: 'admin',
            }),
          ],
        });

      const agent = request.agent(app);

      const loginResponse = await agent
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'Password123',
        });

      expect(loginResponse.status).toBe(200);

      const meResponse = await agent.get('/api/auth/me');

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.user.email).toBe('updated@example.com');
      expect(meResponse.body.user.role).toBe('admin');
    });

    test('rejects non-admin access to pending accounts', async () => {
      const passwordHash = await createPasswordHash('Password123');

      pool.query
        .mockResolvedValueOnce({
          rows: [
            createActiveUser({
              password_hash: passwordHash,
              role: 'user',
            }),
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            createActiveUser({
              role: 'user',
            }),
          ],
        });

      const agent = request.agent(app);

      await agent
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'Password123',
        });

      const response = await agent.get('/api/auth/pending');

      expect(response.status).toBe(403);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    test('rejects an administrator whose role was downgraded after login', async () => {
      const passwordHash = await createPasswordHash('Password123');

      pool.query
        .mockResolvedValueOnce({
          rows: [
            createActiveUser({
              password_hash: passwordHash,
              role: 'admin',
            }),
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            createActiveUser({
              role: 'user',
            }),
          ],
        });

      const agent = request.agent(app);

      const loginResponse = await agent
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'Password123',
        });

      expect(loginResponse.status).toBe(200);

      const response = await agent.get('/api/auth/pending');

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/administrator access required/i);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    test('allows an administrator to retrieve pending accounts', async () => {
      const passwordHash = await createPasswordHash('Password123');

      pool.query
        .mockResolvedValueOnce({
          rows: [
            createActiveUser({
              password_hash: passwordHash,
              role: 'admin',
            }),
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            createActiveUser({
              role: 'admin',
            }),
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 2,
              empno: 'E5678',
              full_name: 'Jane Smith',
              email: 'jane@example.com',
              role: 'user',
              status: 'pending',
              created_at: new Date().toISOString(),
              must_set_password: false,
            },
          ],
        });

      const agent = request.agent(app);

      const loginResponse = await agent
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'Password123',
        });

      expect(loginResponse.status).toBe(200);

      const response = await agent.get('/api/auth/pending');

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
      expect(response.body.users[0].email).toBe('jane@example.com');
    });

    test('successfully logs out and invalidates the session', async () => {
      const passwordHash = await createPasswordHash('Password123');

      pool.query
        .mockResolvedValueOnce({
          rows: [
            createActiveUser({
              password_hash: passwordHash,
            }),
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            createActiveUser(),
          ],
        });

      const agent = request.agent(app);

      const loginResponse = await agent
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'Password123',
        });

      expect(loginResponse.status).toBe(200);

      const logoutResponse = await agent.post('/api/auth/logout');

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.message).toBe('Logout successful.');

      const meResponse = await agent.get('/api/auth/me');

      expect(meResponse.status).toBe(401);
    });
  });
});
