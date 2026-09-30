const Student = require('../models/Student');

/**
 * Student Repository - Concrete implementation of data access logic for Student resources.
 * Ensures soft-deleted documents are automatically excluded from application lookups.
 */
class StudentRepository {
  /**
   * Check if a student profile exists with specified email address.
   * @param {string} email - Target email.
   * @param {string|null} excludeId - Exclude target ID from checking (for updates).
   */
  async existsByEmail(email, excludeId = null) {
    if (!email || !email.trim()) return false;
    const filter = { email: email.trim().toLowerCase(), deletedAt: null };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    const student = await Student.findOne(filter).lean();
    return !!student;
  }

  /**
   * Check if a student profile exists with specified mobile phone number.
   * @param {string} mobile - Target phone.
   * @param {string|null} excludeId - Exclude target ID.
   */
  async existsByMobile(mobile, excludeId = null) {
    const filter = { mobile: mobile.trim(), deletedAt: null };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    const student = await Student.findOne(filter).lean();
    return !!student;
  }

  /**
   * Create a new student entry.
   * @param {Object} studentData - Data fields.
   */
  async create(studentData) {
    return await Student.create(studentData);
  }

  /**
   * Get non-deleted student by primary database ID.
   * @param {string} id - Student Object ID.
   */
  async findById(id, session = null) {
    const query = Student.findOne({ _id: id, deletedAt: null })
      .populate('createdBy', 'name email')
      .populate('feePlan')
      .lean();
    if (session) query.session(session);
    return await query;
  }

  /**
   * Fetch a paginated and sorted list of non-deleted students under filters.
   * @param {Object} queryFilter - Combined search and select queries.
   * @param {Object} sortObj - Sort fields configuration.
   * @param {number} skip - Pagination offset skip.
   * @param {number} limit - Pagination page limit.
   */
  async find(queryFilter, sortObj, skip, limit) {
    const filter = { ...queryFilter, deletedAt: null };
    
    const students = await Student.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email')
      .populate('feePlan')
      .lean();

    const total = await Student.countDocuments(filter);
    return { students, total };
  }

  /**
   * Update fields on an active student.
   * @param {string} id - Student Object ID.
   * @param {Object} updateData - Updated parameters.
   */
  async update(id, updateData) {
    return await Student.findOneAndUpdate(
      { _id: id, deletedAt: null },
      updateData,
      { returnDocument: 'after', runValidators: true }
    ).populate('createdBy', 'name email')
     .populate('feePlan');
  }

  /**
   * Perform a soft-delete on the student profile.
   * @param {string} id - Student ID.
   * @param {string} userId - User ID of staff deleting the profile.
   */
  async softDelete(id, userId) {
    return await Student.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { 
        status: 'INACTIVE',
        deletedAt: new Date(),
        deletedBy: userId
      },
      { returnDocument: 'after' }
    );
  }

  /**
   * Aggregate student counts and select latest items for dashboard summary cards.
   */
  async getDashboardSummary() {
    const filter = { deletedAt: null };
    
    const [total, active, inactive, fullPayment, installment, recentlyAdded] = await Promise.all([
      Student.countDocuments(filter),
      Student.countDocuments({ ...filter, status: 'ACTIVE' }),
      Student.countDocuments({ ...filter, status: 'INACTIVE' }),
      Student.countDocuments({ ...filter, paymentPlan: 'FULL_PAYMENT' }),
      Student.countDocuments({ ...filter, paymentPlan: 'INSTALLMENT' }),
      Student.find(filter)
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('createdBy', 'name email')
        .lean()
    ]);

    return {
      totalStudents: total,
      activeStudents: active,
      inactiveStudents: inactive,
      fullPaymentStudents: fullPayment,
      installmentStudents: installment,
      recentlyAddedStudents: recentlyAdded
    };
  }

  /**
   * Run custom aggregation pipelines.
   * @param {Array} pipeline - Aggregation pipeline.
   */
  async aggregate(pipeline) {
    return await Student.aggregate(pipeline);
  }

  /**
   * Count documents matching filter.
   * @param {Object} filter - Query filter.
   */
  async countActive(filter = {}) {
    return await Student.countDocuments({ ...filter, deletedAt: null });
  }

  /**
   * List minimal student details for selection lists.
   */
  async listAllActiveMinimal() {
    return await Student.find({ deletedAt: null }).select('_id fullName studentId course').lean();
  }

  /**
   * Get recently registered students.
   * @param {number} limit - Target number of students.
   */
  async getRecentStudents(limit = 10) {
    return await Student.find({ deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('feePlan')
      .lean();
  }
}

module.exports = new StudentRepository();
