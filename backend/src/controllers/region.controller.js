const prisma = require('../lib/prisma');

// CREATE — POST /api/regions
async function createRegion(req, res) {
  try {
    const { name, code } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Region name and code are required' });
    }

    const region = await prisma.region.create({
      data: { name, code },
    });

    res.status(201).json(region);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Region name or code already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create region' });
  }
}

// READ ALL — GET /api/regions
async function getRegions(req, res) {
  try {
    const regions = await prisma.region.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(regions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch regions' });
  }
}

// READ ONE — GET /api/regions/:id
async function getRegionById(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid region id' });
    }

    const region = await prisma.region.findUnique({ where: { id } });

    if (!region) {
      return res.status(404).json({ error: 'Region not found' });
    }

    res.json(region);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch region' });
  }
}

// UPDATE — PUT /api/regions/:id
async function updateRegion(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid region id' });
    }

    const { name, code } = req.body;

    const region = await prisma.region.update({
      where: { id },
      data: { name, code },
    });

    res.json(region);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Region not found' });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Region name or code already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update region' });
  }
}

// DELETE — DELETE /api/regions/:id
async function deleteRegion(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid region id' });
    }

    await prisma.region.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Region not found' });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({
        error: 'Cannot delete region — it is still referenced by other records (users, outages, complaints, etc.)',
      });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to delete region' });
  }
}

module.exports = {
  createRegion,
  getRegions,
  getRegionById,
  updateRegion,
  deleteRegion,
};