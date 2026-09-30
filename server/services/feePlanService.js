const feePlanRepository = require('../repositories/feePlanRepository');
const studentRepository = require('../repositories/studentRepository');
const activityLogRepository = require('../repositories/activityLogRepository');
const { NotFoundError, ConflictError, BadRequestError } = require('../utils/customErrors');

/**
 * FeePlan Service - Orchestrates the core business flows of Fee Plan management.
 * Connects with Student and Settings models, calculates installments division, handles soft-deletes and audits logs.
 */
class FeePlanService {
  /**
   * Initialize a student's Fee Plan.
   * @param {Object} planData - Fee plan registration details.
   * @param {string} creatorId - User ID of staff executing registration.
   */
  async setupFeePlan(planData, creatorId) {
    const { studentId, totalFees, paymentPlan, numberOfInstallments, firstDueDate } = planData;

    // Verify Student profile exists and is active
    const student = await studentRepository.findById(studentId);
    if (!student) {
      throw new NotFoundError('The specified student does not exist.');
    }

    // Check duplicate Fee Plan
    const activeExists = await feePlanRepository.existsActivePlan(studentId);
    if (activeExists) {
      throw new ConflictError('An active Fee Plan already exists for this student.');
    }

    const finalPlan = {
      studentId,
      totalFees,
      paymentPlan,
      paidAmount: 0,
      status: 'PENDING'
    };

    if (paymentPlan === 'FULL_PAYMENT') {
      finalPlan.numberOfInstallments = 1;
      finalPlan.installmentAmount = totalFees;
      finalPlan.remainingAmount = totalFees;
      finalPlan.firstDueDate = firstDueDate || new Date();
    } else {
      // paymentPlan === 'INSTALLMENT'
      const numInstallments = planData.installments && planData.installments.length > 0
        ? planData.installments.length
        : parseInt(numberOfInstallments);
      finalPlan.numberOfInstallments = numInstallments;
      
      const advanceAmt = planData.advanceAmount || 0;
      if (advanceAmt > 0 && advanceAmt < totalFees && numInstallments > 1) {
          finalPlan.installmentAmount = Math.round((totalFees - advanceAmt) / (numInstallments - 1));
      } else {
          finalPlan.installmentAmount = Math.round(totalFees / numInstallments);
      }
      
      finalPlan.remainingAmount = totalFees;
      finalPlan.firstDueDate = new Date(firstDueDate);
    }

    // Save to Database
    const newPlan = await feePlanRepository.create(finalPlan);
    const invoiceRepository = require('../repositories/invoiceRepository');

    // Auto-generate installments and invoices if installment plan is chosen
    if (paymentPlan === 'INSTALLMENT') {
      const installmentService = require('./installmentService');
      
      let createdInstallments;
      if (planData.installments && planData.installments.length > 0) {
        createdInstallments = await installmentService.saveCustomInstallments(newPlan, planData.installments, creatorId);
      } else {
        createdInstallments = await installmentService.generateInstallments(newPlan, creatorId, planData.advanceAmount || 0);
      }
      
      // Create invoice for each installment
      for (const inst of createdInstallments) {
        await invoiceRepository.create({
          studentId,
          installmentId: inst._id,
          amount: inst.amount,
          dueDate: inst.dueDate,
          status: 'PENDING'
        });
      }
    } else {
      // FULL_PAYMENT plan
      // Create a single invoice for full payment
      await invoiceRepository.create({
        studentId,
        installmentId: null,
        amount: totalFees,
        dueDate: firstDueDate || new Date(),
        status: 'PENDING'
      });
    }

    // Audit Log
    await activityLogRepository.create({
      action: 'FEE_PLAN_CREATED',
      description: `Fee Plan created for student ${student.fullName} (${student.studentId}). Plan: ${paymentPlan}. Total: ₹${totalFees}.`,
      performedBy: creatorId,
      studentId: student._id
    });

    return newPlan;
  }

  /**
   * Fetch Fee Plan details for a student.
   * @param {string} studentId - Student database Object ID.
   */
  async getFeePlan(studentId) {
    const plan = await feePlanRepository.findByStudentId(studentId);
    if (!plan) {
      throw new NotFoundError('Fee Plan not found for this student.');
    }
    return plan;
  }

  /**
   * Update student's Fee Plan.
   * @param {string} studentId - Student database Object ID.
   * @param {Object} updateData - Key-values to update.
   * @param {string} modifierId - User ID of staff executing update.
   */
  async updateFeePlan(studentId, updateData, modifierId) {
    const plan = await feePlanRepository.findByStudentId(studentId);
    if (!plan) {
      throw new NotFoundError('Fee Plan not found for this student.');
    }

    // Validation: Block changing paymentPlan if any payment has occurred
    if (updateData.paymentPlan && updateData.paymentPlan !== plan.paymentPlan) {
      if (plan.paidAmount > 0) {
        throw new BadRequestError('Cannot change payment plan once payments have been recorded.');
      }
    }

    // Formulate final parameters for recalculation
    const totalFees = updateData.totalFees !== undefined ? Number(updateData.totalFees) : plan.totalFees;
    const paymentPlan = updateData.paymentPlan || plan.paymentPlan;
    let numberOfInstallments = updateData.numberOfInstallments !== undefined ? Number(updateData.numberOfInstallments) : plan.numberOfInstallments;
    const firstDueDate = updateData.firstDueDate || plan.firstDueDate;

    const recalculatedData = {
      totalFees,
      paymentPlan,
      firstDueDate
    };

    if (paymentPlan === 'FULL_PAYMENT') {
      recalculatedData.numberOfInstallments = 1;
      recalculatedData.installmentAmount = totalFees;
      recalculatedData.remainingAmount = totalFees - plan.paidAmount;
    } else {
      // INSTALLMENT
      if (updateData.paymentPlan && updateData.paymentPlan === 'INSTALLMENT' && updateData.numberOfInstallments === undefined) {
        // Switch defaults to prevent installment count: 1 on plan changes
        numberOfInstallments = numberOfInstallments > 1 ? numberOfInstallments : 2;
      }
      recalculatedData.numberOfInstallments = numberOfInstallments;
      recalculatedData.installmentAmount = Math.round(totalFees / numberOfInstallments);
      recalculatedData.remainingAmount = totalFees - plan.paidAmount;
    }

    if (updateData.status) {
      recalculatedData.status = updateData.status;
    }

    // Update DB
    const updatedPlan = await feePlanRepository.update(studentId, recalculatedData);

    // Regenerate or clean up installments and invoices if plan metrics change before any payment is recorded
    if (plan.paidAmount === 0) {
      const installmentService = require('./installmentService');
      const invoiceRepository = require('../repositories/invoiceRepository');
      const Invoice = require('../models/Invoice');
      
      // Clean up previous unpaid invoices
      await Invoice.deleteMany({ studentId });

      if (paymentPlan === 'INSTALLMENT') {
        const installmentRepository = require('../repositories/installmentRepository');
        let createdInstallments;
        
        if (updateData.installments && updateData.installments.length > 0) {
           await installmentRepository.deleteManyByPlan(plan._id);
           createdInstallments = await installmentService.saveCustomInstallments(updatedPlan, updateData.installments, modifierId);
        } else {
           createdInstallments = await installmentService.regenerateInstallments(plan._id, updatedPlan, modifierId);
        }
        
        // Create fresh invoices
        for (const inst of createdInstallments) {
          await invoiceRepository.create({
            studentId,
            installmentId: inst._id,
            amount: inst.amount,
            dueDate: inst.dueDate,
            status: 'PENDING'
          });
        }
      } else if (paymentPlan === 'FULL_PAYMENT') {
        const installmentRepository = require('../repositories/installmentRepository');
        await installmentRepository.deleteManyByPlan(plan._id);

        // Create a single invoice for full payment
        await invoiceRepository.create({
          studentId,
          installmentId: null,
          amount: totalFees,
          dueDate: firstDueDate || new Date(),
          status: 'PENDING'
        });
      }
    } else {
      if (paymentPlan === 'INSTALLMENT' && updateData.installments && updateData.installments.length > 0) {
        const installmentService = require('./installmentService');
        await installmentService.syncCustomInstallments(updatedPlan, updateData.installments, modifierId);
      }
    }

    // Audit Log
    await activityLogRepository.create({
      action: 'FEE_PLAN_UPDATED',
      description: `Fee Plan updated for student ${updatedPlan.student.fullName} (${updatedPlan.student.studentId}). Total: ₹${totalFees}.`,
      performedBy: modifierId,
      studentId: updatedPlan.student._id
    });

    return updatedPlan;
  }

  /**
   * Soft-delete student's Fee Plan.
   * @param {string} studentId - Student database Object ID.
   * @param {string} userId - User ID of staff deleting the plan.
   */
  async deleteFeePlan(studentId, userId) {
    const plan = await feePlanRepository.findByStudentId(studentId);
    if (!plan) {
      throw new NotFoundError('Fee Plan not found for this student.');
    }

    const Invoice = require('../models/Invoice');
    await Invoice.deleteMany({ studentId });

    const deletedPlan = await feePlanRepository.softDelete(studentId, userId);

    // Audit Log
    await activityLogRepository.create({
      action: 'FEE_PLAN_DELETED',
      description: `Fee Plan soft-deleted for student ${deletedPlan.student.fullName} (${deletedPlan.student.studentId}).`,
      performedBy: userId,
      studentId: deletedPlan.student._id
    });

    return deletedPlan;
  }
}

module.exports = new FeePlanService();
