const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');

const SALT_ROUNDS = 10;

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  regionId: true,
  createdAt: true,
  updatedAt: true,
};

async function createUser(req, res) {
  try {
    const { firstName, lastName, email, phone, password, role, regionId } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        error: 'firstName, lastName, email and password are required',
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: { firstName, lastName, email, phone, passwordHash, role, regionId },
      select: userSelect,
    });

    res.status(201).json(user);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Email or phone already in use' });
    }
    if (err.code === 'P2003') {
      return res.status(400).json({ error: 'regionId does not refer to an existing region' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create user' });
  }
}

async function getUsers(req, res) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: userSelect,
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

async function getUserById(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const user = await prisma.user.findUnique({ where: { id }, select: userSelect });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}

async function updateUser(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const { firstName, lastName, email, phone, password, role, isActive, regionId } = req.body;
    const data = { firstName, lastName, email, phone, role, isActive, regionId };

    if (password) {
      data.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    }

    const user = await prisma.user.update({ where: { id }, data, select: userSelect });

    res.json(user);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Email or phone already in use' });
    }
    if (err.code === 'P2003') {
      return res.status(400).json({ error: 'regionId does not refer to an existing region' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update user' });
  }
}

async function deleteUser(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({
        error: 'Cannot delete user — still referenced by other records (complaints, work orders, accounts, etc.)',
      });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
}

module.exports = { createUser, getUsers, getUserById, updateUser, deleteUser };