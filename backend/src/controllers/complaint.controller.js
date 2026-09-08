const prisma = require('../lib/prisma');

const VALID_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'];
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

async function validateOutage(outageId, regionId) {
  if (outageId === undefined || outageId === null) return null;

  const outage = await prisma.outage.findUnique({ where: { id: Number(outageId) } });

  if (!outage) {
    return 'outageId does not refer to an existing outage';
  }
  if (outage.regionId !== Number(regionId)) {
    return 'outageId does not belong to the same region as this complaint';
  }
  return null;
}

// CREATE — POST /api/complaints
async function createComplaint(req, res) {
  try {
    const {
      userId, regionId, outageId, title, description,
      status, priority, location,
    } = req.body;

    if (!userId || !regionId || !title || !description) {
      return res.status(400).json({
        error: 'userId, regionId, title and description are required',
      });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` });
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `priority must be one of ${VALID_PRIORITIES.join(', ')}` });
    }

    const outageError = await validateOutage(outageId, regionId);
    if (outageError) {
      return res.status(400).json({ error: outageError });
    }

    const resolvedAt = status === 'RESOLVED' ? new Date() : null;

    const complaint = await prisma.complaint.create({
      data: {
        userId: Number(userId),
        regionId: Number(regionId),
        outageId: outageId ? Number(outageId) : undefined,
        title,
        description,
        status, // omitted -> defaults to OPEN
        priority, // omitted -> defaults to MEDIUM
        location,
        resolvedAt,
      },
    });

    res.status(201).json(complaint);
  } catch (err) {
    if (err.code === 'P2003') {
      return res.status(400).json({ error: 'userId or regionId does not refer to an existing record' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create complaint' });
  }
}

// READ ALL — GET /api/complaints
// Supports optional filtering: ?regionId=1&status=OPEN&priority=HIGH&userId=1
async function getComplaints(req, res) {
  try {
    const { regionId, status, priority, userId } = req.query;
    const where = {};

    if (regionId) where.regionId = Number(regionId);
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (userId) where.userId = Number(userId);

    const complaints = await prisma.complaint.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        region: { select: { id: true, name: true, code: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        outage: { select: { id: true, type: true, status: true } },
      },
    });

    res.json(complaints);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
}

// READ ONE — GET /api/complaints/:id
async function getComplaintById(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid complaint id' });
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        region: { select: { id: true, name: true, code: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        outage: { select: { id: true, type: true, status: true } },
      },
    });

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    res.json(complaint);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch complaint' });
  }
}

// UPDATE — PUT /api/complaints/:id
async function updateComplaint(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid complaint id' });
    }

    const existing = await prisma.complaint.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const {
      regionId, outageId, title, description,
      status, priority, location, resolution,
    } = req.body;

    const data = {};

    if (regionId !== undefined) data.regionId = Number(regionId);
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (location !== undefined) data.location = location;
    if (resolution !== undefined) data.resolution = resolution;

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` });
      }
      data.status = status;

      // Only RESOLVED auto-stamps resolvedAt, and only if not already set
      if (status === 'RESOLVED' && !existing.resolvedAt) {
        data.resolvedAt = new Date();
      }
    }

    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) {
        return res.status(400).json({ error: `priority must be one of ${VALID_PRIORITIES.join(', ')}` });
      }
      data.priority = priority;
    }

    if (outageId !== undefined) {
      const effectiveRegionId = regionId !== undefined ? regionId : existing.regionId;
      const outageError = await validateOutage(outageId, effectiveRegionId);
      if (outageError) {
        return res.status(400).json({ error: outageError });
      }
      data.outageId = outageId === null ? null : Number(outageId);
    }

    const complaint = await prisma.complaint.update({ where: { id }, data });

    res.json(complaint);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    if (err.code === 'P2003') {
      return res.status(400).json({ error: 'regionId does not refer to an existing region' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update complaint' });
  }
}

// DELETE — DELETE /api/complaints/:id
async function deleteComplaint(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid complaint id' });
    }

    await prisma.complaint.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({
        error: 'Cannot delete complaint — it is still referenced by work orders',
      });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to delete complaint' });
  }
}

module.exports = {
  createComplaint,
  getComplaints,
  getComplaintById,
  updateComplaint,
  deleteComplaint,
};