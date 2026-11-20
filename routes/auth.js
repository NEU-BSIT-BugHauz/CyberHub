const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const express = require('express');

const router = express.Router();
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

async function readUsers() {
  try {
    const raw = await fs.readFile(USERS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
      await fs.writeFile(USERS_FILE, '[]\n', 'utf8');
      return [];
    }
    throw err;
  }
}

async function writeUsers(users) {
  await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
  await fs.writeFile(USERS_FILE, `${JSON.stringify(users, null, 2)}\n`, 'utf8');
}

function sanitizeUser(user) {
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

router.post('/register', async (req, res, next) => {
  try {
    const fullName = String(req.body.full_name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!fullName || fullName.length < 2) {
      return res.status(400).json({ error: 'Full name must be at least 2 characters.' });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const users = await readUsers();
    const duplicate = users.some((u) => u.email === email);
    if (duplicate) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const nextId =
      users.reduce((maxId, u) => (Number(u.id) > maxId ? Number(u.id) : maxId), 0) + 1;

    const now = new Date().toISOString();
    const newUser = {
      id: nextId,
      full_name: fullName,
      email,
      password_hash: hashPassword(password),
      role: 'user',
      status: 'pending',
      must_set_password: false,
      created_at: now,
      updated_at: now,
    };

    users.push(newUser);
    await writeUsers(users);

    return res.status(201).json({
      message: 'Registration submitted. Your account is pending administrator approval.',
      user: sanitizeUser(newUser),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/pending', async (_req, res, next) => {
  try {
    const users = await readUsers();
    const pendingUsers = users
      .filter((u) => u.status === 'pending')
      .map(sanitizeUser);

    res.json({ count: pendingUsers.length, users: pendingUsers });
  } catch (err) {
    next(err);
  }
});

module.exports = router;