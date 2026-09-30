require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/Student');
const Admission = require('../models/Admission');
const feePlanService = require('./feePlanService');
const feePlanRepository = require('../repositories/feePlanRepository');
const installmentRepository = require('../repositories/installmentRepository');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    // Tanu Yadav
    const admission = await Admission.findOne({ enrollmentNo: 'RJ/2026/7096' });
    const student = await Student.findOne({ studentId: 'RJ/2026/7096' });
    
    if (!admission || !student) {
        console.log("Not found.");
        process.exit(1);
    }
    
    const remainingFees = admission.totalFees - (admission.advancePaid || 0);
    const feePlanUpdate = {
        totalFees: admission.totalFees,
        paymentPlan: remainingFees === 0 ? 'FULL_PAYMENT' : (admission.paymentPlan === 'ONE_TIME' ? 'FULL_PAYMENT' : 'INSTALLMENT'),
        numberOfInstallments: admission.paymentPlan === 'INSTALLMENT' && admission.installmentMonths ? parseInt(admission.installmentMonths) : (remainingFees > 0 ? 3 : 1),
        firstDueDate: admission.paymentPlan === 'INSTALLMENT' && admission.firstEmiDate ? new Date(admission.firstEmiDate) : undefined,
        installments: admission.paymentPlan === 'INSTALLMENT' && admission.emiSchedule ? admission.emiSchedule : undefined,
    };
    
    console.log("Applying update:", feePlanUpdate);
    
    try {
        await feePlanService.updateFeePlan(student._id, feePlanUpdate, student.createdBy);
        console.log("Fee plan updated successfully.");
        
        const plan = await feePlanRepository.findByStudentId(student._id);
        const insts = await installmentRepository.findByStudentId(student._id);
        console.log("Updated Plan:", plan);
        console.log("Installments:", insts);
    } catch (e) {
        console.error("Error updating fee plan:", e.message);
    }
    process.exit(0);
  });
