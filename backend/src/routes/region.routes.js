const express = require('express');
const router = express.Router();
const {
  createRegion,
  getRegions,
  getRegionById,
  updateRegion,
  deleteRegion,
} = require('../controllers/region.controller');

router.post('/', createRegion);
router.get('/', getRegions);
router.get('/:id', getRegionById);
router.put('/:id', updateRegion);
router.delete('/:id', deleteRegion);

module.exports = router;