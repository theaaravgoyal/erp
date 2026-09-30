const express = require('express');
const router = express.Router();
const { createLead, getLeads, deleteLead, updateLead, createOfflineLead, admitStudent, updateAdmittedStudent, getAdmittedStudents, deleteAdmittedStudent } = require('../controllers/leadController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const admissionUploads = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'idDocumentPhotos', maxCount: 5 }
]);

// Public endpoints
router.post('/', createLead);

// Protected endpoints
router.post('/offline', protect, createOfflineLead);
router.post('/admission', protect, admissionUploads, admitStudent);
router.put('/admission/:id', protect, admissionUploads, updateAdmittedStudent);
router.delete('/admission/:id', protect, deleteAdmittedStudent);
router.get('/admissions', protect, getAdmittedStudents);
router.get('/', protect, getLeads);
router.delete('/:id', protect, deleteLead);
router.put('/:id', protect, updateLead);

module.exports = router;
