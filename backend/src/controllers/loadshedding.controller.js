const prisma = require('../lib/prisma');

const VALID_STATUSES = ['SCHEDULED', 'CANCELLED', 'COMPLETED'];

function validateTimes(startAt, endAt) {
  const start = new Date(startAt);
  const end = new Date(endAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'startAt and endAt must be valid dates';
  }
  if (end <= start) {
    return 'endAt must be after startAt';
  }
  return null;
}

// CREATE — POST /api/load-shedding
async function createSchedule(req, res) {
  try {
    const { regionId, title, description, startAt, endAt, status } = req.body;

    if (!regionId || !title || !startAt || !endAt) {
      return res.status(400).json({
        error: 'regionId, title, startAt and endAt are required',
      });
    }

    const timeError = validateTimes(startAt, endAt);
    if (timeError) {
      return res.status(400).json({ error: timeError });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` });
    }

    const schedule = await prisma.loadSheddingSchedule.create({
      data: {
        regionId: Number(regionId),
        title,
        description,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        status, // omitted -> defaults to SCHEDULED per schema
      },
    });

    res.status(201).json(schedule);
  } catch (err) {
    if (err.code === 'P2003') {
      return res.status(400).json({ error: 'regionId does not refer to an existing region' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
}

// READ ALL — GET /api/load-shedding
// Supports optional filtering: ?regionId=1&status=SCHEDULED
async function getSchedules(req, res) {
  try {
    const { regionId, status } = req.query;
    const where = {};

    if (regionId) where.regionId = Number(regionId);
    if (status) where.status = status;

    const schedules = await prisma.loadSheddingSchedule.findMany({
      where,
      orderBy: { startAt: 'asc' },
      include: { region: { select: { id: true, name: true, code: true } } },
    });

    res.json(schedules);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
}

// READ ONE — GET /api/load-shedding/:id
async function getScheduleById(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    const schedule = await prisma.loadSheddingSchedule.findUnique({
      where: { id },
      include: { region: { select: { id: true, name: true, code: true } } },
    });

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json(schedule);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
}

// UPDATE — PUT /api/load-shedding/:id
async function updateSchedule(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    const { regionId, title, description, startAt, endAt, status } = req.body;
    const data = {};

    if (regionId !== undefined) data.regionId = Number(regionId);
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` });
      }
      data.status = status;
    }

    // Only validate startAt/endAt together if either is being changed —
    // need the existing record to check the one not being updated
    if (startAt !== undefined || endAt !== undefined) {
      const existing = await prisma.loadSheddingSchedule.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      const newStart = startAt !== undefined ? startAt : existing.startAt;
      const newEnd = endAt !== undefined ? endAt : existing.endAt;

      const timeError = validateTimes(newStart, newEnd);
      if (timeError) {
        return res.status(400).json({ error: timeError });
      }

      if (startAt !== undefined) data.startAt = new Date(startAt);
      if (endAt !== undefined) data.endAt = new Date(endAt);
    }

    const schedule = await prisma.loadSheddingSchedule.update({ where: { id }, data });

    res.json(schedule);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    if (err.code === 'P2003') {
      return res.status(400).json({ error: 'regionId does not refer to an existing region' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
}

// DELETE — DELETE /api/load-shedding/:id
async function deleteSchedule(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    await prisma.loadSheddingSchedule.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({
        error: 'Cannot delete schedule — it is still referenced by outages',
      });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
}

module.exports = {
  createSchedule,
  getSchedules,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
};