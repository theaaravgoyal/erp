const mongoose = require('mongoose');

/**
 * Student Schema - Represents the student profile in the system.
 * Manages identity details, registration details, base fees, and billing preferences.
 */
const StudentSchema = new mongoose.Schema(
  {
    // Auto-generated unique alphanumeric student identifier
    studentId: {
      type: String,
      unique: true,
      index: true,
    },
    // Student's complete legal name
    fullName: {
      type: String,
      required: [true, 'Student full name is required'],
      trim: true,
    },
    // Father's name
    fatherName: {
      type: String,
      required: [true, 'Father name is required'],
      trim: true,
    },
    // Mother's name (Optional as requested)
    motherName: {
      type: String,
      trim: true,
      default: '',
    },
    // Mobile contact number with basic international formatting validation
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
      validate: {
        validator: function (v) {
          return /^\+?[0-9]{10,14}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid mobile number!`,
      },
    },
    // Alternate contact number (Optional)
    alternateNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true; // Optional
          return /^\+?[0-9]{10,14}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid mobile number!`,
      },
    },
    // Centre Reference
    centreReference: {
      type: String,
      enum: {
        values: ['Google', 'Site', 'AI', 'Friend', 'Old Student', 'Company', 'Instagram', 'YouTube', 'Family', ''],
        message: '{VALUE} is not a valid centre reference',
      },
      trim: true,
    },
    // Unique contact email address with email format validation
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      validate: {
        validator: function (v) {
          if (!v) return true; // Optional
          return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
        },
        message: (props) => `${props.value} is not a valid email address!`,
      },
    },
    // Residential address details
    address: {
      type: String,
      required: [true, 'Residential address is required'],
      trim: true,
    },
    // Course enrolled in
    dob: {
      type: Date,
      default: null,
    },
    courseDuration: {
      type: String,
      trim: true,
      default: "",
    },
    course: {
      type: String,
      required: [true, 'Target academic course is required'],
      trim: true,
    },
    // Admission or enrollment date
    joiningDate: {
      type: Date,
      default: Date.now,
    },
    // Base course fees setup during admission
    totalFees: {
      type: Number,
      required: [true, 'Total fee definition is required'],
      min: [0, 'Total fees cannot be negative'],
    },
    // Selected payment schedule plan (FULL_PAYMENT or INSTALLMENT)
    paymentPlan: {
      type: String,
      required: [true, 'Billing payment plan is required'],
      enum: {
        values: ['FULL_PAYMENT', 'INSTALLMENT'],
        message: '{VALUE} is not a valid payment plan',
      },
      default: 'INSTALLMENT',
    },
    // Status of student (ACTIVE or INACTIVE)
    status: {
      type: String,
      enum: {
        values: ['ACTIVE', 'INACTIVE'],
        message: '{VALUE} is not a valid status',
      },
      default: 'ACTIVE',
    },
    // Reference to User account who registered this student profile
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator user account reference is required'],
    },
    // Timestamp when student was soft deleted
    deletedAt: {
      type: Date,
      default: null,
    },
    // Reference to User who performed soft delete
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Photographs
    studentPhotograph: {
      type: String,
    },
    idType: {
      type: String,
    },
    idNumber: {
      type: String,
    },
    idDocumentImage: {
      type: String,
    },
    idDocumentPhotos: {
      type: [String],
      default: [],
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// --- Virtual Relationships ---

// Virtual relationship referencing FeePlan
StudentSchema.virtual('feePlan', {
  ref: 'FeePlan',
  localField: '_id',
  foreignField: 'studentId',
  justOne: true,
});

// Virtual relationship referencing Payments
StudentSchema.virtual('payments', {
  ref: 'Payment',
  localField: '_id',
  foreignField: 'studentId',
});

// Virtual relationship referencing Installments
StudentSchema.virtual('installments', {
  ref: 'Installment',
  localField: '_id',
  foreignField: 'studentId',
});

// Virtual relationship referencing Receipts
StudentSchema.virtual('receipts', {
  ref: 'Receipt',
  localField: '_id',
  foreignField: 'studentId',
});

// Virtual relationship referencing Invoices
StudentSchema.virtual('invoices', {
  ref: 'Invoice',
  localField: '_id',
  foreignField: 'studentId',
});

// Database indexes for fast querying
StudentSchema.index({ deletedAt: 1 });

// Pre-save middleware to auto-generate a unique studentId if not provided (collision-free auto-increment counter)
StudentSchema.pre('save', async function () {
  if (!this.studentId) {
    const Counter = require('./Counter');
    let isUnique = false;
    let generatedId = '';
    
    // Check uniqueness iteratively to prevent any duplicate key errors on studentId
    while (!isUnique) {
      const counter = await Counter.findOneAndUpdate(
        { key: 'student_counter' },
        { $inc: { value: 1 } },
        { returnDocument: 'after', upsert: true }
      );
      const countStr = String(counter.value).padStart(4, '0');
      generatedId = `STD${countStr}`;
      
      const existingStudent = await mongoose.models.Student.findOne({ studentId: generatedId });
      if (!existingStudent) {
        isUnique = true;
      }
    }
    this.studentId = generatedId;
  }
});

module.exports = mongoose.model('Student', StudentSchema);
