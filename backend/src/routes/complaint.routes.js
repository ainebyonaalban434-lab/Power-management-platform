const express = require('express');
const router = express.Router();
const {
  createComplaint,
  getComplaints,
  getComplaintById,
  updateComplaint,
  deleteComplaint,
} = require('../controllers/complaint.controller');

router.post('/', createComplaint);
router.get('/', getComplaints);
router.get('/:id', getComplaintById);
router.put('/:id', updateComplaint);
router.delete('/:id', deleteComplaint);

module.exports = router;