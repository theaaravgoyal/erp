const Lead = require('../models/Lead');
const Admission = require('../models/Admission');
const Student = require('../models/Student');
const Certificate = require('../models/Certificate');
const studentService = require('../services/studentService');
const feePlanService = require('../services/feePlanService');
const paymentService = require('../services/paymentService');
const createLead = async (req, res) => {
  try {
    let { name, phone, course, source, email, message } = req.body;

    // Validation
    if (!name || !phone || !course) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }
    name = name.trim();
    course = course.trim();
    source = source || "popup";

    if (name.length < 2 || name.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Name must be between 2 to 50 characters",
      });
    }

    phone = phone.replace(/\D/g, "");

    if (phone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: "Phone must be exactly 10 digits",
      });
    }
    const recentLead = await Lead.findOne({
      phone,
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
    });

    if (recentLead) {
      return res.status(400).json({
        success: false,
        message: "You already submitted recently",
      });
    }

    const existing = await Lead.findOne({ phone, course });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Lead already exists",
      });
    }
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }
    }

    // Save to DB
    const lead = await Lead.create({
      name,
      phone,
      email,
      message,
      course,
      source,
    });

    // Enqueue Admin notification via BullMQ
    const notificationService = require('../services/notificationService');
    const { addEmailJob } = require('../queues/queueManager');

    notificationService.create({
      isAdmin: true,
      title: 'New Lead Received',
      message: `New enquiry received from ${name} (${phone}) for course ${course}.`,
      module: 'Admissions',
      type: 'INFO',
      priority: 'MEDIUM',
      actionUrl: '/lead'
    }).catch(e => console.warn('[LeadController] Notification enqueue warning:', e.message));

    // Enqueue candidate acknowledgement email via BullMQ if email provided
    if (email) {
      addEmailJob('lead-enquiry-email', {
        type: 'LEAD_RECEIVED',
        to: email,
        subject: `Thank you for your enquiry - ${course}`,
        data: {
          name,
          phone,
          course
        }
      }).catch(e => console.warn('[LeadController] Email enqueue warning:', e.message));
    }

    res.status(201).json({
      success: true,
      message: "Lead saved successfully",
      data: lead,
    });

  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const getLeads = async (req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 });
    res.json({ data: leads });
  } catch (err) {
    res.status(500).json({ message: "Error fetching leads" });
  }
};

const deleteLead = async (req, res) => {
  try {
    await Lead.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Delete error" });
  }
};

const updateLead = async (req, res) => {
  try {
    const { name, phone, email, message, course, source, status, counsellor, date, alternatePhone, leadType } = req.body;
    
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = phone.replace(/\D/g, "");
    if (email !== undefined) updateData.email = email;
    if (message !== undefined) updateData.message = message;
    if (course !== undefined) updateData.course = course.trim();
    if (source !== undefined) updateData.source = source;
    if (status !== undefined) updateData.status = status;
    if (counsellor !== undefined) updateData.counsellor = counsellor;
    if (date !== undefined) updateData.date = date;
    if (alternatePhone !== undefined) updateData.alternatePhone = alternatePhone;
    if (leadType !== undefined) updateData.leadType = leadType;

    const updated = await Lead.findByIdAndUpdate(
      req.params.id,
      updateData,
      { returnDocument: 'after' }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    res.json({ success: true, data: updated });

  } catch (err) {
    console.error("❌ Update Lead Error:", err.message);
    res.status(500).json({ success: false, message: "Update error" });
  }
};

const createOfflineLead = async (req, res) => {
  try {
    let { name, phone, alternatePhone, course, source, email, message, counsellor, date, leadType } = req.body;

    if (!name || !phone || !course) {
      return res.status(400).json({
        success: false,
        message: "Name, Phone, and Course are required",
      });
    }

    name = name.trim();
    course = course.trim();
    phone = phone.replace(/\D/g, "");

    if (phone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: "Phone must be exactly 10 digits",
      });
    }

    // Since this is manually entered by admin, we don't do recent submission block.
    // But we check if the exact phone/course duplicate already exists.
    const existing = await Lead.findOne({ phone, course });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Lead with this phone and course already exists",
      });
    }

    const lead = await Lead.create({
      name,
      phone,
      email,
      message,
      course,
      source: source || "Walk-in",
      counsellor: counsellor || "Unassigned",
      date: date || new Date(),
      alternatePhone,
      leadType: leadType || "Cold"
    });

    res.status(201).json({
      success: true,
      message: "Offline lead saved successfully",
      data: lead,
    });

  } catch (error) {
    console.error("❌ Create Offline Lead Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const admitStudent = async (req, res) => {
  const creatorId = req.user.id || req.user._id;
  try {
    const admissionData = req.body;
    
    // Verify if the user exists in Lead based on phone
    const existingLead = await Lead.findOne({ phone: admissionData.contact });

    if (!existingLead) {
      return res.status(400).json({ success: false, message: "User is not in the Leads system. Admission is only allowed for existing leads." });
    }

    existingLead.leadType = 'Sale';
    existingLead.status = 'Converted';
    await existingLead.save();

    // 1. Calculate and validate remaining fees
    const totalFees = Number(admissionData.totalFees) || 0;
    const advancePaid = Number(admissionData.advancePaid) || 0;
    if (advancePaid > totalFees) {
      return res.status(400).json({ success: false, message: "Advance payment cannot exceed total fees." });
    }
    const remainingFees = totalFees - advancePaid;
    admissionData.remainingFees = remainingFees;
    
    // Normalize courses safely
    if (typeof admissionData.courses === 'string') {
      try {
        admissionData.courses = JSON.parse(admissionData.courses);
      } catch (e) {
        admissionData.courses = admissionData.courses.split(',').map(c => c.trim()).filter(Boolean);
      }
    }
    if (!Array.isArray(admissionData.courses)) {
      admissionData.courses = admissionData.courses ? [String(admissionData.courses)] : [];
    }

    // Parse emiSchedule safely
    if (typeof admissionData.emiSchedule === 'string') {
      try {
        admissionData.emiSchedule = JSON.parse(admissionData.emiSchedule);
      } catch (e) {
        admissionData.emiSchedule = [];
      }
    }

    // Check for duplicate enrollment number
    const existingAdmission = await Admission.findOne({ enrollmentNo: admissionData.enrollmentNo });
    if (existingAdmission) {
      return res.status(400).json({ success: false, message: "This enrollment number is already registered. Please enter a different number." });
    }
    
    // 2. Check if student with this enrollment number already exists in Fees Management
    // We check this BEFORE creating the LeadAdmission to avoid half-created state if it fails.
    let feesStudent = await Student.findOne({ studentId: admissionData.enrollmentNo, deletedAt: null });
    let isNewStudent = false;
    
    if (!feesStudent) {
      isNewStudent = true;
    }
    
    // Handle uploaded files
    if (req.files) {
      if (req.files.photo && req.files.photo[0]) {
        admissionData.studentPhotograph = `/uploads/profile-pictures/${req.files.photo[0].filename}`;
      }
      
      // Handle multiple ID document photos
      admissionData.idDocumentPhotos = [];
      if (req.files.idDocumentPhotos && req.files.idDocumentPhotos.length > 0) {
        req.files.idDocumentPhotos.forEach(file => {
          admissionData.idDocumentPhotos.push(`/uploads/profile-pictures/${file.filename}`);
        });
      } else if (req.files.idDocumentImage && req.files.idDocumentImage[0]) {
        // Fallback for older middleware usage if any
        admissionData.idDocumentImage = `/uploads/profile-pictures/${req.files.idDocumentImage[0].filename}`;
        admissionData.idDocumentPhotos.push(admissionData.idDocumentImage);
      }
    }

    // Save Admission in Lead Management flow
    const admission = await Admission.create({
      ...admissionData,
      createdBy: creatorId
    });

    // 3. Integrate with Fees Management
    if (isNewStudent) {
      let emailToUse = admissionData.email;
      if (!emailToUse || emailToUse.trim() === '') {
        emailToUse = `${admissionData.contact}@no-email.internal`;
      }

      const studentPayload = {
        studentId: admissionData.enrollmentNo,
        fullName: admissionData.fullName,
        fatherName: admissionData.fatherHusbandName || 'Not Provided',
        alternateNumber: admissionData.alternateNumber || '',
        centreReference: admissionData.centreReference || '',
        studentPhotograph: admissionData.studentPhotograph || '',
        idDocumentPhotos: admissionData.idDocumentPhotos || [],
        mobile: admissionData.contact,
        email: emailToUse,
        address: admissionData.address || 'N/A',
        dob: admissionData.dob || null,
        courseDuration: admissionData.courseDuration || '',
        course: (admissionData.courses && admissionData.courses.length > 0) ? admissionData.courses.join(', ') : 'Unknown',
        totalFees: totalFees,
        paymentPlan: remainingFees === 0 ? 'FULL_PAYMENT' : (admissionData.paymentPlan === 'ONE_TIME' ? 'FULL_PAYMENT' : 'INSTALLMENT')
      };
      
      try {
        feesStudent = await studentService.registerStudent(studentPayload, creatorId);
        
        // Setup Fee Plan
        const feePlanPayload = {
          studentId: feesStudent._id,
          totalFees: totalFees,
          paymentPlan: remainingFees === 0 ? 'FULL_PAYMENT' : (admissionData.paymentPlan === 'ONE_TIME' ? 'FULL_PAYMENT' : 'INSTALLMENT'),
          numberOfInstallments: admissionData.paymentPlan === 'INSTALLMENT' && admissionData.installmentMonths ? parseInt(admissionData.installmentMonths) : (remainingFees > 0 ? 3 : 1),
          firstDueDate: admissionData.paymentPlan === 'INSTALLMENT' && admissionData.firstEmiDate ? new Date(admissionData.firstEmiDate) : new Date(),
          installments: admissionData.paymentPlan === 'INSTALLMENT' && admissionData.emiSchedule ? admissionData.emiSchedule : undefined,
          advanceAmount: advancePaid
        };
        
        const newFeePlan = await feePlanService.setupFeePlan(feePlanPayload, creatorId);

          // Initial Payment
          if (advancePaid > 0) {
             let paymentType = 'INITIAL_PAYMENT';
             let installmentId = undefined;
             
             if (newFeePlan.paymentPlan === 'FULL_PAYMENT' && advancePaid === totalFees) {
                 paymentType = 'FULL_PAYMENT';
             }

             const paymentData = {
               studentId: feesStudent._id,
               paymentType: paymentType,
               installmentId: installmentId,
               paymentMode: admissionData.paymentMode || 'Cash',
               amount: advancePaid,
               paymentDate: new Date(),
               remarks: 'Advance paid during Lead Admission'
             };
             await paymentService.collectPayment(paymentData, creatorId);
          }

      } catch (err) {
        // Rollback Lead Admission if Fees Management integration fails
        await Admission.findByIdAndDelete(admission._id);
        throw err;
      }
    } else {
       // If student already exists in Fees Management, we don't recreate the student or fee plan.
       // The user requested to link/update existing. In this case, we just return success as Lead Admission is saved.
    }
    
    // Auto-create Certificate Management Record
    try {
      const existingCertificate = await Certificate.findOne({ enrollmentNumber: admissionData.enrollmentNo });
      if (!existingCertificate) {
        await Certificate.create({
          studentName: admissionData.fullName,
          enrollmentNumber: admissionData.enrollmentNo,
          course: (admissionData.courses && admissionData.courses.length > 0) ? admissionData.courses.join(', ') : 'Unknown',
          courseIssueDate: new Date().toISOString().split('T')[0],
          duration: admissionData.courseDuration || 'N/A',
          internship: 'No',
          internshipDuration: '',
          issueDate: new Date().toISOString().split('T')[0]
        });
      }
    } catch (certError) {
      console.warn("❌ Failed to auto-create Certificate record:", certError.message);
    }
    
    res.status(201).json({
      success: true,
      message: "Admission successfully completed",
      data: admission
    });

  } catch (error) {
    console.error("❌ Admission Error:", error.message);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "This enrollment number is already registered. Please enter a different number."
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || "Failed to process admission"
    });
  }
};

const updateAdmittedStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const admissionData = req.body;
    const modifierId = req.employee?._id || req.user?._id;
    
    if (typeof admissionData.courses === 'string') {
      try {
        admissionData.courses = JSON.parse(admissionData.courses);
      } catch (e) {
        admissionData.courses = admissionData.courses.split(',').map(c => c.trim()).filter(Boolean);
      }
    }
    if (!Array.isArray(admissionData.courses)) {
      admissionData.courses = admissionData.courses ? [String(admissionData.courses)] : [];
    }
    
    // Parse emiSchedule safely
    if (typeof admissionData.emiSchedule === 'string') {
      try {
        admissionData.emiSchedule = JSON.parse(admissionData.emiSchedule);
      } catch (e) {
        admissionData.emiSchedule = [];
      }
    }

    let admission = await Admission.findById(id);
    if (!admission) return res.status(404).json({ success: false, message: 'Admission not found' });
    
    // Check if enrollment number is being updated to an existing one
    if (admissionData.enrollmentNo && admissionData.enrollmentNo !== admission.enrollmentNo) {
      const existing = await Admission.findOne({ enrollmentNo: admissionData.enrollmentNo });
      if (existing) {
        return res.status(400).json({ success: false, message: "This enrollment number is already registered. Please enter a different number." });
      }
    }

    // Handle images
    if (req.files) {
      if (req.files.photo && req.files.photo[0]) {
        admissionData.studentPhotograph = `/uploads/profile-pictures/${req.files.photo[0].filename}`;
      }
      
      let newPhotos = [];
      if (req.files.idDocumentPhotos && req.files.idDocumentPhotos.length > 0) {
        req.files.idDocumentPhotos.forEach(file => {
          newPhotos.push(`/uploads/profile-pictures/${file.filename}`);
        });
      } else if (req.files.idDocumentImage && req.files.idDocumentImage[0]) {
        newPhotos.push(`/uploads/profile-pictures/${req.files.idDocumentImage[0].filename}`);
        admissionData.idDocumentImage = newPhotos[0];
      }
      
      // Since frontend might send retained images in 'retainedIdDocumentPhotos' array
      let existingPhotos = admissionData.retainedIdDocumentPhotos || admission.idDocumentPhotos || [];
      if (typeof existingPhotos === 'string') {
        try { existingPhotos = JSON.parse(existingPhotos); } catch(e) { existingPhotos = [existingPhotos]; }
      }
      admissionData.idDocumentPhotos = [...existingPhotos, ...newPhotos];
    } else {
      // If no new files, retain old photos based on what frontend sent or what was in DB
      let existingPhotos = admissionData.retainedIdDocumentPhotos || admission.idDocumentPhotos || [];
      if (typeof existingPhotos === 'string') {
        try { existingPhotos = JSON.parse(existingPhotos); } catch(e) { existingPhotos = [existingPhotos]; }
      }
      admissionData.idDocumentPhotos = existingPhotos;
    }

    if (admissionData.removePhoto === 'true') {
      admissionData.studentPhotograph = '';
    }
    if (admissionData.removeIdDocumentImage === 'true') {
      admissionData.idDocumentImage = '';
      admissionData.idDocumentPhotos = [];
    }
    
    // Update admission record
    Object.assign(admission, admissionData);
    await admission.save();
    
    // Update student record in Fees Management if it exists
    const feesStudent = await Student.findOne({ studentId: admission.enrollmentNo, deletedAt: null });
    if (feesStudent) {
      const studentPayload = {
        fullName: admission.fullName,
        fatherName: admission.fatherHusbandName || 'Not Provided',
        alternateNumber: admission.alternateNumber || '',
        centreReference: admission.centreReference || '',
        mobile: admission.contact,
        address: admission.address || 'N/A',
        course: (admission.courses && admission.courses.length > 0) ? admission.courses.join(', ') : 'Unknown',
      };
      
      if (admissionData.studentPhotograph !== undefined) studentPayload.studentPhotograph = admissionData.studentPhotograph;
      if (admissionData.idDocumentImage !== undefined) studentPayload.idDocumentImage = admissionData.idDocumentImage;
      if (admissionData.idDocumentPhotos !== undefined) studentPayload.idDocumentPhotos = admissionData.idDocumentPhotos;
      
      const emailToUse = admission.email || `${admission.contact}@no-email.internal`;
      if (emailToUse !== feesStudent.email) {
        studentPayload.email = emailToUse;
      }
      
      await studentService.updateStudent(feesStudent._id, studentPayload, modifierId);
      
      // Update Fee Plan and Installments
      try {
        const totalFees = Number(admissionData.totalFees) || 0;
        const advancePaid = Number(admissionData.advancePaid) || 0;
        const remainingFees = totalFees - advancePaid;
        
        const feePlanUpdate = {
          totalFees: totalFees,
          paymentPlan: remainingFees === 0 ? 'FULL_PAYMENT' : (admissionData.paymentPlan === 'ONE_TIME' ? 'FULL_PAYMENT' : 'INSTALLMENT'),
          numberOfInstallments: admissionData.paymentPlan === 'INSTALLMENT' && admissionData.installmentMonths ? parseInt(admissionData.installmentMonths) : (remainingFees > 0 ? 3 : 1),
          firstDueDate: admissionData.paymentPlan === 'INSTALLMENT' && admissionData.firstEmiDate ? new Date(admissionData.firstEmiDate) : undefined,
          installments: admissionData.paymentPlan === 'INSTALLMENT' && admissionData.emiSchedule ? admissionData.emiSchedule : undefined,
        };
        
        await feePlanService.updateFeePlan(feesStudent._id, feePlanUpdate, modifierId);
      } catch (fpErr) {
        console.warn("Failed to update fee plan during admission edit:", fpErr.message);
      }
    }
    
    res.status(200).json({ success: true, message: 'Admission updated successfully', data: admission });
  } catch (error) {
    console.error("❌ Edit Admission Error:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to update admission" });
  }
};

const getAdmittedStudents = async (req, res) => {
  try {
    const admissions = await Admission.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: admissions });
  } catch (error) {
    console.error("❌ Fetch Admissions Error:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to fetch admissions" });
  }
};

const deleteAdmittedStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const admission = await Admission.findByIdAndDelete(id);
    if (!admission) {
      return res.status(404).json({ success: false, message: 'Admission not found' });
    }
    // Note: This only deletes the Admission record. It does not cascade delete the Student from FeesManagement.
    // If the user wants that, it would need a call to studentService.removeStudent, but typically we keep the student or soft-delete it separately.
    res.status(200).json({ success: true, message: 'Admission deleted successfully' });
  } catch (error) {
    console.error("❌ Delete Admission Error:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to delete admission" });
  }
};

module.exports = {
  createLead,
  getLeads,
  deleteLead,
  updateLead,
  createOfflineLead,
  admitStudent,
  updateAdmittedStudent,
  getAdmittedStudents,
  deleteAdmittedStudent,
};
