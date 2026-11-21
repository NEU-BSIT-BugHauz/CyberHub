
const request = require('supertest');
const express = require('express');

jest.mock('../config/db', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

jest.mock('../services/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
}));

const { pool } = require('../config/db');
const { sendPasswordResetEmail } = require('../services/emailService');
const passwordResetRoutes = require('../routes/passwordReset');

const app = express();

app.use(express.json());
app.use('/api/auth', passwordResetRoutes);

app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

const client = {
  query: jest.fn(),
  release: jest.fn(),
};

describe('CyberHub password reset API', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    process.env.PASSWORD_RESET_URL =
      'http://localhost:3000/reset-password';

    pool.connect.mockResolvedValue(client);

    client.query.mockResolvedValue({ rows: [], rowCount: 1 });

    sendPasswordResetEmail.mockResolvedValue({
      messageId: 'test-message-id',
    });
  });

  // ==========================================
  // FORGOT PASSWORD TESTS
  // ==========================================

  describe('POST /api/auth/forgot-password', () => {
    test('rejects an invalid email address', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
      expect(pool.query).not.toHaveBeenCalled();
      expect(pool.connect).not.toHaveBeenCalled();
    });

    test('returns a generic response when the account does not exist', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [],
      });

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'unknown@example.com',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toMatch(
        /if an eligible account exists/i
      );

      expect(pool.connect).not.toHaveBeenCalled();
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    test('creates a reset token and sends an email for an eligible account', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            email: 'john@example.com',
          },
        ],
      });

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'john@example.com',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toMatch(
        /if an eligible account exists/i
      );

      expect(pool.connect).toHaveBeenCalledTimes(1);

      expect(client.query).toHaveBeenCalledWith('BEGIN');
      expect(client.query).toHaveBeenCalledWith('COMMIT');

      expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);

      const [email, resetUrl] =
        sendPasswordResetEmail.mock.calls[0];

      expect(email).toBe('john@example.com');

      const parsedUrl = new URL(resetUrl);
      const token = parsedUrl.searchParams.get('token');

      expect(token).toMatch(/^[a-f0-9]{64}$/);
      expect(client.release).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================
  // RESET PASSWORD TESTS
  // ==========================================

  describe('POST /api/auth/reset-password', () => {
    test('rejects an invalid reset token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'NewPassword123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(
        /invalid or expired/i
      );

      expect(pool.connect).not.toHaveBeenCalled();
    });

    test('rejects passwords shorter than eight characters', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'a'.repeat(64),
          password: 'short',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(
        /at least 8 characters/i
      );

      expect(pool.connect).not.toHaveBeenCalled();
    });

    test('rejects an expired or already-used reset token', async () => {
      client.query.mockResolvedValueOnce({ rows: [] });
      client.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'a'.repeat(64),
          password: 'NewPassword123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(
        /invalid or expired/i
      );

      expect(client.query).toHaveBeenCalledWith('BEGIN');
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    test('successfully resets the password and invalidates existing sessions', async () => {
      client.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              id: 10,
              user_id: 1,
            },
          ],
        }) // Find valid reset token
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 1 }],
        }) // Update password
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [],
        }) // Mark token as used
        .mockResolvedValueOnce({
          rowCount: 2,
          rows: [],
        }) // Delete existing sessions
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'a'.repeat(64),
          password: 'NewPassword123',
        });

      expect(response.status).toBe(200);

      expect(response.body.message).toMatch(
        /password reset successful/i
      );

      expect(client.query).toHaveBeenCalledWith(
        'COMMIT'
      );

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM user_sessions'),
        ['1']
      );

      expect(client.release).toHaveBeenCalledTimes(1);
    });
  });
});
