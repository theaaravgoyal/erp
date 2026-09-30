const installmentRepository = require('../repositories/installmentRepository');
const studentRepository = require('../repositories/studentRepository');
const feePlanRepository = require('../repositories/feePlanRepository');
const activityLogRepository = require('../repositories/activityLogRepository');
const { addMonths, getDueIndicator } = require('../utils/dateHelper');
const { NotFoundError, ConflictError, BadRequestError } = require('../utils/customErrors');

/**
 * Installment Service - Manages installment workflows.
 * Calculates dates, runs the Auto Status Checker, implements locking validations, and manages regeneration.
 */
class InstallmentService {
  /**
   * Automatically generate installment schedule documents.
   * @param {Object} feePlan - The parent Fee Plan.
   * @param {string} creatorId - User ID of staff setting up the plan.
   */
  async generateInstallments(feePlan, creatorId) {
    // Application-level duplicate check: Verify no installments already exist
    const existing = await installmentRepository.findByStudentId(feePlan.studentId);
    if (existing && existing.length > 0) {
      throw new ConflictError('Installments already exist for this student.');
    }

    const installments = [];
    for (let i = 1; i <= feePlan.numberOfInstallments; i++) {
      let dueDate = new Date(feePlan.firstDueDate);
      dueDate.setMonth(dueDate.getMonth() + (i - 1));
      
      let amount = feePlan.installmentAmount;
      
      if (advanceAmount > 0 && advanceAmount < feePlan.totalFees && feePlan.numberOfInstallments > 1) {
        if (i === 1) {
          amount = advanceAmount;
        } else if (i === feePlan.numberOfInstallments) {
          // Last installment covers any rounding difference
          const precedingInstallmentsSum = advanceAmount + (feePlan.installmentAmount * (feePlan.numberOfInstallments - 2));
          amount = feePlan.totalFees - precedingInstallmentsSum;
        }
      } else {
        if (i === feePlan.numberOfInstallments) {
          // Last installment covers any rounding difference
          const precedingInstallmentsSum = feePlan.installmentAmount * (feePlan.numberOfInstallments - 1);
          amount = feePlan.totalFees - precedingInstallmentsSum;
        }
      }

      // Prevent 0 or negative installment amounts
      if (amount <= 0) {
        throw new BadRequestError('Installment amount must be greater than zero.');
      }

      installments.push({
        studentId: feePlan.studentId,
        feePlanId: feePlan._id,
        installmentNo: i,
        amount,
        dueDate,
        paidAmount: 0,
        remainingAmount: amount,
        status: 'PENDING'
      });
    }

    // Save batch to database
    const createdDocs = await installmentRepository.createMany(installments);

    // Audit Log
    await activityLogRepository.create({
      action: 'INSTALLMENTS_GENERATED',
      description: `Automatically generated ${feePlan.numberOfInstallments} installments of value ₹${feePlan.installmentAmount} for student.`,
      performedBy: creatorId,
      studentId: feePlan.studentId
    });

    return createdDocs;
  }

  /**
   * Save custom-edited installment schedule documents.
   * @param {Object} feePlan - The parent Fee Plan.
   * @param {Array<Object>} customInstallments - List of custom installments.
   * @param {string} creatorId - User ID of staff setting up the plan.
   */
  async saveCustomInstallments(feePlan, customInstallments, creatorId) {
    // Application-level duplicate check: Verify no installments already exist
    const existing = await installmentRepository.findByStudentId(feePlan.studentId);
    if (existing && existing.length > 0) {
      throw new ConflictError('Installments already exist for this student.');
    }

    const installments = customInstallments.map((inst, index) => {
      const amount = Number(inst.amount);
      if (amount <= 0) {
        throw new BadRequestError('Installment amount must be greater than zero.');
      }

      return {
        studentId: feePlan.studentId,
        feePlanId: feePlan._id,
        installmentNo: inst.installmentNo || (index + 1),
        amount,
        dueDate: new Date(inst.dueDate),
        paidAmount: 0,
        remainingAmount: amount,
        status: 'PENDING'
      };
    });

    // Save batch to database
    const createdDocs = await installmentRepository.createMany(installments);

    // Audit Log
    await activityLogRepository.create({
      action: 'INSTALLMENTS_GENERATED',
      description: `Saved ${installments.length} custom edited installments for student.`,
      performedBy: creatorId,
      studentId: feePlan.studentId
    });

    return createdDocs;
  }

  /**
   * Recreate installment schedules to align with updated plan metrics.
   * Only allowed before any payment has been recorded.
   * @param {string} feePlanId - Fee Plan database Object ID.
   * @param {Object} updatedPlan - Recalculated Fee Plan.
   * @param {string} modifierId - User ID of staff.
   */
  async regenerateInstallments(feePlanId, updatedPlan, modifierId) {
    // Delete existing unpaid schedules first
    await installmentRepository.deleteManyByPlan(feePlanId);

    // Generate fresh set
    return await this.generateInstallments(updatedPlan, modifierId);
  }

  /**
   * Smartly sync custom installments, retaining payment histories.
   * @param {Object} feePlan - The parent Fee Plan.
   * @param {Array<Object>} customInstallments - List of custom installments.
   * @param {string} modifierId - User ID of staff.
   */
  async syncCustomInstallments(feePlan, customInstallments, modifierId) {
    const existing = await installmentRepository.findByStudentId(feePlan.studentId);
    
    // Process each custom installment
    const result = [];
    for (let i = 0; i < customInstallments.length; i++) {
      const customInst = customInstallments[i];
      const newAmount = Number(customInst.amount);
      if (newAmount <= 0) continue;
      
      const newDueDate = new Date(customInst.dueDate);
      
      if (i < existing.length) {
        // Update existing
        const inst = existing[i];
        
        if (inst.paidAmount > newAmount) {
           throw new BadRequestError(`Cannot reduce installment #${i+1} amount below its already paid amount (₹${inst.paidAmount}).`);
        }
        
        const remainingAmount = newAmount - inst.paidAmount;
        let status = 'PENDING';
        if (remainingAmount === 0) status = 'PAID';
        else if (inst.paidAmount > 0) status = 'PARTIAL';
        else if (newDueDate < new Date()) status = 'OVERDUE';
        
        const updatedInst = await installmentRepository.update(inst._id, {
          amount: newAmount,
          dueDate: newDueDate,
          remainingAmount,
          status
        });
        result.push(updatedInst);
      } else {
        // Create new
        const newInst = {
          studentId: feePlan.studentId,
          feePlanId: feePlan._id,
          installmentNo: i + 1,
          amount: newAmount,
          dueDate: newDueDate,
          paidAmount: 0,
          remainingAmount: newAmount,
          status: newDueDate < new Date() ? 'OVERDUE' : 'PENDING'
        };
        const created = await installmentRepository.createMany([newInst]);
        result.push(created[0]);
      }
    }
    
    // Remove extra unpaid installments
    if (existing.length > customInstallments.length) {
       for (let i = customInstallments.length; i < existing.length; i++) {
          const inst = existing[i];
          if (inst.paidAmount > 0) {
             throw new BadRequestError(`Cannot remove installment #${i+1} because it has payments recorded.`);
          }
          const Installment = require('../models/Installment');
          await Installment.findByIdAndDelete(inst._id);
       }
    }
    
    return result;
  }

  /**
   * List active installments of a student profile.
   * Runs the Auto Status Checker and appends dynamic calendar alerts.
   * @param {string} studentId - Student database Object ID.
   */
  async listStudentInstallments(studentId) {
    const student = await studentRepository.findById(studentId);
    if (!student) {
      throw new NotFoundError('The specified student does not exist.');
    }

    const feePlan = await feePlanRepository.findByStudentId(studentId);
    if (!feePlan) {
      throw new NotFoundError('Active Fee Plan not found for this student.');
    }

    let installments = await installmentRepository.findByStudentId(studentId);
    const today = new Date();

    // Auto Status Checker & Indicator formulation
    const processedInstallments = [];
    for (let inst of installments) {
      let instObj = inst.toObject ? inst.toObject() : inst;
      
      // Auto-update status to OVERDUE if unpaid past due date
      if (instObj.status !== 'PAID' && new Date(instObj.dueDate) < today && instObj.paidAmount < instObj.amount) {
        if (instObj.status !== 'OVERDUE') {
          await installmentRepository.update(instObj._id, { status: 'OVERDUE' });
          instObj.status = 'OVERDUE';
        }
      }

      // Append dynamic indicator
      instObj.dueIndicator = getDueIndicator(instObj.dueDate, instObj.status);
      processedInstallments.push(instObj);
    }

    return {
      student,
      feePlan,
      totalInstallments: processedInstallments.length,
      installmentList: processedInstallments
    };
  }

  /**
   * Fetch single installment details.
   * @param {string} studentId - Student database Object ID.
   * @param {number} installmentNo - Number of target installment.
   */
  async getSingleInstallment(studentId, installmentNo) {
    const inst = await installmentRepository.findByIdAndNo(studentId, installmentNo);
    if (!inst) {
      throw new NotFoundError('Installment not found.');
    }

    let instObj = inst.toObject ? inst.toObject() : inst;
    const today = new Date();

    // Auto-update status to OVERDUE if unpaid past due date
    if (instObj.status !== 'PAID' && new Date(instObj.dueDate) < today && instObj.paidAmount < instObj.amount) {
      if (instObj.status !== 'OVERDUE') {
        await installmentRepository.update(instObj._id, { status: 'OVERDUE' });
        instObj.status = 'OVERDUE';
      }
    }

    instObj.dueIndicator = getDueIndicator(instObj.dueDate, instObj.status);
    return instObj;
  }

  /**
   * Update editable parameters on a single installment.
   * @param {string} id - Installment database Object ID.
   * @param {Object} updateData - Target update parameters (dueDate, remarks).
   * @param {string} modifierId - User ID of staff.
   */
  async updateInstallment(id, updateData, modifierId) {
    const inst = await installmentRepository.findById(id);
    if (!inst) {
      throw new NotFoundError('Installment not found.');
    }

    // Validation Lock: Prevent updates on fully PAID installments
    if (inst.status === 'PAID' || inst.paidAmount >= inst.amount) {
      throw new ConflictError('Cannot modify a fully paid installment.');
    }

    const fieldsToUpdate = {};
    if (updateData.dueDate) fieldsToUpdate.dueDate = new Date(updateData.dueDate);
    if (updateData.remarks !== undefined) fieldsToUpdate.remarks = updateData.remarks;

    const updatedInst = await installmentRepository.update(id, fieldsToUpdate);

    // Audit Log
    await activityLogRepository.create({
      action: 'INSTALLMENT_UPDATED',
      description: `Installment #${updatedInst.installmentNo} was updated. Remarks: ${updatedInst.remarks || 'None'}`,
      performedBy: modifierId,
      studentId: updatedInst.studentId
    });

    return updatedInst;
  }

  /**
   * Soft-delete an installment.
   * @param {string} id - Installment database Object ID.
   * @param {string} userId - User ID of staff.
   */
  async removeInstallment(id, userId) {
    const inst = await installmentRepository.findById(id);
    if (!inst) {
      throw new NotFoundError('Installment not found.');
    }

    const deletedInst = await installmentRepository.softDelete(id, userId);

    // Audit Log
    await activityLogRepository.create({
      action: 'INSTALLMENT_DELETED',
      description: `Installment #${inst.installmentNo} (Value: ₹${inst.amount}) was deleted.`,
      performedBy: userId,
      studentId: inst.studentId
    });

    return deletedInst;
  }

  /**
   * Validate if an installment can accept a payment.
   * Blocks payment if the installment status is PAID.
   * Ready for future payment module integration.
   * @param {string} installmentId - Installment database Object ID.
   * @returns {Promise<Object>} The validated installment.
   */
  async validateInstallmentForPayment(installmentId) {
    const inst = await installmentRepository.findById(installmentId);
    if (!inst) {
      throw new NotFoundError('Installment not found.');
    }

    if (inst.status === 'PAID' || inst.remainingAmount <= 0) {
      throw new ConflictError('Payment not allowed. Installment is already fully paid.');
    }

    return inst;
  }

  /**
   * Scan and update all overdue installments in the system.
   * Can be invoked by a cron job or scheduled task.
   * @returns {Promise<number>} Number of installments updated.
   */
  async checkAndUpdateOverdueInstallments() {
    const today = new Date();
    // Find all non-deleted installments that are not PAID, not OVERDUE, and past their due date
    const unpaidOverdue = await installmentRepository.findUnpaidOverdue(today);

    let updatedCount = 0;
    for (const inst of unpaidOverdue) {
      if (inst.paidAmount < inst.amount) {
        await installmentRepository.update(inst._id, { status: 'OVERDUE' });
        updatedCount++;
        
        // Log activity for the auto status change
        await activityLogRepository.create({
          action: 'INSTALLMENT_UPDATED',
          description: `Installment #${inst.installmentNo} status automatically updated to OVERDUE due to past due date.`,
          performedBy: null, // System automated action
          studentId: inst.studentId
        });
      }
    }
    return updatedCount;
  }
}

module.exports = new InstallmentService();
