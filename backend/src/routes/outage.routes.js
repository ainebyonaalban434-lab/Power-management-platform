const express = require('express');
const router = express.Router();
const {
  createOutage,
  getOutages,
  getOutageById,
  updateOutage,
  deleteOutage,
} = require('../controllers/outage.controller');

router.post('/', createOutage);
router.get('/', getOutages);
router.get('/:id', getOutageById);
router.put('/:id', updateOutage);
router.delete('/:id', deleteOutage);

module.exports = router;