const prisma = require('../lib/prisma');

const VALID_TYPES = ['PLANNED', 'UNPLANNED'];
const VALID_STATUSES = ['REPORTED', 'ACTIVE', 'RESOLVED'];

async function validateSchedule(scheduleId, regionId) {
  if (scheduleId === undefined || scheduleId === null) return null;

  const schedule = await prisma.loadSheddingSchedule.findUnique({
    where: { id: Number(scheduleId) },
  });

  if (!schedule) {
    return 'scheduleId does not refer to an existing schedule';
  }
  if (schedule.regionId !== Number(regionId)) {
    return 'scheduleId does not belong to the same region as this outage';
  }
  return null;
}

// CREATE — POST /api/outages
async function createOutage(req, res) {
  try {
    const {
      regionId, scheduleId, type, status, cause, description,
      startedAt, expectedRestorationAt, restoredAt,
    } = req.body;

    if (!regionId || !type || !startedAt) {
      return res.status(400).json({ error: 'regionId, type and startedAt are required' });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of ${VALID_TYPES.join(', ')}` });
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` });
    }

    const start = new Date(startedAt);
    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ error: 'startedAt must be a valid date' });
    }

    const scheduleError = await validateSchedule(scheduleId, regionId);
    if (scheduleError) {
      return res.status(400).json({ error: scheduleError });
    }

    // Auto-stamp restoredAt when status is RESOLVED and none was explicitly given
    let finalRestoredAt = restoredAt ? new Date(restoredAt) : null;
    if (status === 'RESOLVED' && !finalRestoredAt) {
      finalRestoredAt = new Date();
    }

    const outage = await prisma.outage.create({
      data: {
        regionId: Number(regionId),
        scheduleId: scheduleId ? Number(scheduleId) : undefined,
        type,
        status, // omitted -> defaults to REPORTED
        cause,
        description,
        startedAt: start,
        expectedRestorationAt: expectedRestorationAt ? new Date(expectedRestorationAt) : undefined,
        restoredAt: finalRestoredAt,
      },
    });

    res.status(201).json(outage);
  } catch (err) {
    if (err.code === 'P2003') {
      return res.status(400).json({ error: 'regionId does not refer to an existing region' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create outage' });
  }
}

// READ ALL — GET /api/outages
// Supports optional filtering: ?regionId=1&status=ACTIVE&type=UNPLANNED
async function getOutages(req, res) {
  try {
    const { regionId, status, type } = req.query;
    const where = {};

    if (regionId) where.regionId = Number(regionId);
    if (status) where.status = status;
    if (type) where.type = type;

    const outages = await prisma.outage.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      include: {
        region: { select: { id: true, name: true, code: true } },
        schedule: { select: { id: true, title: true } },
      },
    });

    res.json(outages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch outages' });
  }
}

// READ ONE — GET /api/outages/:id
async function getOutageById(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid outage id' });
    }

    const outage = await prisma.outage.findUnique({
      where: { id },
      include: {
        region: { select: { id: true, name: true, code: true } },
        schedule: { select: { id: true, title: true } },
      },
    });

    if (!outage) {
      return res.status(404).json({ error: 'Outage not found' });
    }

    res.json(outage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch outage' });
  }
}

// UPDATE — PUT /api/outages/:id
async function updateOutage(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid outage id' });
    }

    const existing = await prisma.outage.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Outage not found' });
    }

    const {
      regionId, scheduleId, type, status, cause, description,
      startedAt, expectedRestorationAt, restoredAt,
    } = req.body;

    const data = {};

    if (regionId !== undefined) data.regionId = Number(regionId);
    if (type !== undefined) {
      if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({ error: `type must be one of ${VALID_TYPES.join(', ')}` });
      }
      data.type = type;
    }
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` });
      }
      data.status = status;
    }
    if (cause !== undefined) data.cause = cause;
    if (description !== undefined) data.description = description;
    if (startedAt !== undefined) {
      const start = new Date(startedAt);
      if (Number.isNaN(start.getTime())) {
        return res.status(400).json({ error: 'startedAt must be a valid date' });
      }
      data.startedAt = start;
    }
    if (expectedRestorationAt !== undefined) {
      data.expectedRestorationAt = expectedRestorationAt ? new Date(expectedRestorationAt) : null;
    }

    // Validate scheduleId against the (possibly updated) regionId
    if (scheduleId !== undefined) {
      const effectiveRegionId = regionId !== undefined ? regionId : existing.regionId;
      const scheduleError = await validateSchedule(scheduleId, effectiveRegionId);
      if (scheduleError) {
        return res.status(400).json({ error: scheduleError });
      }
      data.scheduleId = scheduleId === null ? null : Number(scheduleId);
    }

    // Auto-stamp restoredAt when transitioning to RESOLVED, unless explicitly provided
    if (restoredAt !== undefined) {
      data.restoredAt = restoredAt ? new Date(restoredAt) : null;
    } else if (status === 'RESOLVED' && !existing.restoredAt) {
      data.restoredAt = new Date();
    }

    const outage = await prisma.outage.update({ where: { id }, data });

    res.json(outage);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Outage not found' });
    }
    if (err.code === 'P2003') {
      return res.status(400).json({ error: 'regionId does not refer to an existing region' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update outage' });
  }
}

// DELETE — DELETE /api/outages/:id
async function deleteOutage(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid outage id' });
    }

    await prisma.outage.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Outage not found' });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({
        error: 'Cannot delete outage — it is still referenced by complaints',
      });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to delete outage' });
  }
}

module.exports = {
  createOutage,
  getOutages,
  getOutageById,
  updateOutage,
  deleteOutage,
};