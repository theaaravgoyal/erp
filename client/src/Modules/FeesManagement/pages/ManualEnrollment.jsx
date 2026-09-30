import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, User, Phone, Mail, BookOpen, 
  Sparkles, Check, RefreshCw, Search
} from 'lucide-react';
import { COURSES } from '../../../constants/Courses';
import { formatDate } from '../../../utils/dateUtils';
import DatePicker from '../components/DatePicker';
import Loader from '../components/Loader';
import ErrorState from '../components/ErrorState';
import { useStudents } from '../hooks/useStudents';
import { useFeePlans } from '../hooks/useFeePlans';

const ManualEnrollment = ({ onNavigate }) => {
  const { registerStudent } = useStudents();
  const { createFeePlan } = useFeePlans();

  const [selectedCourses, setSelectedCourses] = useState(['Digital Marketing']);
  const [courseFilter, setCourseFilter] = useState('');

  // Form State
  const currentYear = new Date().getFullYear();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    fatherName: '',
    dob: '',
    course: 'Digital Marketing',
    rollNo: `RJ/${currentYear}/`,
    section: '',
    admissionDate: new Date().toISOString().split('T')[0],
    totalFee: '',
    discount: '',
    depositAmount: '',
    paymentType: 'Installments',
    installmentCount: 3
  });

  const [installments, setInstallments] = useState([]);

  const filteredCourses = useMemo(() => {
    const q = courseFilter.toLowerCase().trim();
    if (!q) return COURSES;
    return COURSES.filter(c => c.toLowerCase().includes(q));
  }, [courseFilter]);

  const toggleCourse = (course) => {
    setSelectedCourses(prev => {
      let updated;
      if (prev.includes(course)) {
        if (prev.length === 1) {
          // Keep at least one or toggle off
          updated = [];
        } else {
          updated = prev.filter(c => c !== course);
        }
      } else {
        updated = [...prev, course];
      }
      setFormData(f => ({ ...f, course: updated.join(', ') }));
      if (validationErrors.course) {
        setValidationErrors(v => {
          const next = { ...v };
          delete next.course;
          return next;
        });
      }
      return updated;
    });
  };

  const [formSuccess, setFormSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // Field change handler - allows fluid typing and backspacing
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Trigger regeneration of installments list when core form data changes
  useEffect(() => {
    const totalFeeNum = Number(formData.totalFee) || 0;
    const discountNum = Number(formData.discount) || 0;
    const depositNum = Number(formData.depositAmount) || 0;
    const subtotal = Math.max(0, totalFeeNum - discountNum);
    const totalPayable = subtotal;
    const emiPayable = Math.max(0, totalPayable - depositNum);

    const generated = [];
    
    // In Option 1, we do NOT add Admission Deposit to the installments array.
    // The admission deposit is handled separately as an INITIAL_PAYMENT.
    // If the user entered a deposit, the installments will just cover the remaining emiPayable.

    if (formData.paymentType === 'One-Time') {
      if (emiPayable > 0 || depositNum === 0) {
        generated.push({
          name: 'Single Premium',
          amount: emiPayable > 0 ? emiPayable : totalPayable,
          dueDate: formData.admissionDate
        });
      }
    } else {
      // Installments
      const count = Math.max(1, parseInt(formData.installmentCount) || 1);
      const amtPerInstallment = Math.round(emiPayable / count);
      const baseDate = new Date(formData.admissionDate);

      for (let i = 0; i < count; i++) {
        const dueDate = new Date(baseDate);
        const targetDay = dueDate.getDate();
        dueDate.setDate(1);
        
        // If there's a deposit, the EMIs start 1 month after admission (i + 1)
        // If no deposit, EMIs start on admission date (i)
        const monthOffset = depositNum > 0 ? i + 1 : i;
        dueDate.setMonth(dueDate.getMonth() + monthOffset);
        
        const daysInMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate();
        dueDate.setDate(Math.min(targetDay, daysInMonth));
        
        // Handle rounding difference on final installment
        const isLast = i === count - 1;
        const installmentAmt = isLast 
          ? emiPayable - (amtPerInstallment * (count - 1)) 
          : amtPerInstallment;

        generated.push({
          name: `Installment ${i + 1}`,
          amount: installmentAmt,
          dueDate: dueDate.toISOString().split('T')[0]
        });
      }
    }

    setInstallments(generated);
  }, [
    formData.totalFee,
    formData.discount,
    formData.depositAmount,
    formData.paymentType,
    formData.installmentCount,
    formData.admissionDate
  ]);

  // Dynamic Date prefix year updater
  const handleAdmissionDateChange = (val) => {
    const newYear = new Date(val).getFullYear();
    setFormData(prev => {
      let updatedRollNo = prev.rollNo;
      const prefixRegex = /^RJ\/\d{4}\//;
      if (prefixRegex.test(prev.rollNo)) {
        updatedRollNo = prev.rollNo.replace(prefixRegex, `RJ/${newYear}/`);
      } else if (!prev.rollNo || prev.rollNo.trim() === '') {
        updatedRollNo = `RJ/${newYear}/`;
      }
      return {
        ...prev,
        admissionDate: val,
        rollNo: updatedRollNo
      };
    });
    if (validationErrors.admissionDate) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next.admissionDate;
        return next;
      });
    }
  };

  // Callback to handle manual modification of installments in the schedule list
  const handleInstallmentChange = (index, field, value) => {
    setInstallments(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: field === 'amount' ? (value === '' ? '' : Number(value)) : value
      };
      return next;
    });
  };

  // Live calculations
  const billingSummary = useMemo(() => {
    const totalFeeNum = Number(formData.totalFee) || 0;
    const discountNum = Number(formData.discount) || 0;
    const subtotal = Math.max(0, totalFeeNum - discountNum);
    const totalPayable = subtotal;

    return {
      subtotal,
      taxAmount: 0,
      totalPayable,
      installments
    };
  }, [formData.totalFee, formData.discount, installments]);

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'FullName is required';
    if (!formData.phone.trim()) errors.phone = 'Mobile number is required';
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email.trim() && !emailRegex.test(formData.email.trim())) {
      errors.email = 'Invalid email address format';
    }

    const phoneRegex = /^\d{10}$/;
    if (formData.phone.trim() && !phoneRegex.test(formData.phone.trim())) {
      errors.phone = 'Mobile number must be exactly 10 digits';
    }

    if (!selectedCourses || selectedCourses.length === 0) {
      errors.course = 'Please select at least one course';
    }

    // Verify installments sum matches emiPayable
    const totalFeeNum = Number(formData.totalFee) || 0;
    const discountNum = Number(formData.discount) || 0;
    const depositNum = Number(formData.depositAmount) || 0;
    const subtotal = Math.max(0, totalFeeNum - discountNum);
    const emiPayable = Math.max(0, subtotal - depositNum);

    const sum = installments.reduce((acc, inst) => acc + (Number(inst.amount) || 0), 0);
    if (formData.paymentType === 'Installments' && sum !== emiPayable) {
      errors.installments = `Sum of installments (₹${sum}) must equal Net Installment Balance (₹${emiPayable}).`;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      // 1. Create Student profile
      const studentPayload = {
        fullName: formData.name.trim(),
        fatherName: formData.fatherName.trim() || 'Not Provided',
        email: formData.email.trim(),
        mobile: formData.phone.trim(),
        course: formData.course,
        studentId: formData.rollNo.trim() || undefined,
        address: 'N/A',
        paymentPlan: formData.paymentType === 'One-Time' ? 'FULL_PAYMENT' : 'INSTALLMENT',
        totalFees: billingSummary.totalPayable
      };

      const studentRes = await registerStudent(studentPayload);
      if (studentRes.success && studentRes.data) {
        const student = studentRes.data;

        // 2. Setup Fee Plan settings
        const feePlanPayload = {
          studentId: student._id,
          totalFees: billingSummary.totalPayable,
          paymentPlan: formData.paymentType === 'One-Time' ? 'FULL_PAYMENT' : 'INSTALLMENT',
          numberOfInstallments: formData.paymentType === 'One-Time' ? undefined : billingSummary.installments.length,
          firstDueDate: formData.paymentType === 'One-Time' ? undefined : (billingSummary.installments[0]?.dueDate || formData.admissionDate),
          installments: billingSummary.installments.map((inst, index) => ({
            installmentNo: index + 1,
            amount: inst.amount,
            dueDate: inst.dueDate
          }))
        };

        const planRes = await createFeePlan(feePlanPayload);
        if (planRes.success) {
          setFormSuccess(true);
          setTimeout(() => {
            setFormSuccess(false);
            onNavigate('students');
          }, 2000);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Enrollment registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const formatINR = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  if (formSuccess) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white border border-[#EBEAE6] rounded-2xl shadow-sm text-center py-24 space-y-4">
        <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center animate-bounce shadow-md">
          <Check size={28} />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-extrabold text-slate-800">Enrollment Completed</h3>
          <p className="text-xs text-slate-400 font-semibold leading-normal max-w-sm">Student profile and fee installment books generated successfully in ERP records.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header action panel */}
      <div className="flex justify-between items-center bg-white p-4 border border-[#EBEAE6] rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('students')}
            className="p-2 rounded-xl border border-[#DEDCD8] hover:bg-[#FAF9F6] text-slate-650 transition-all cursor-pointer shadow-xs active:scale-95"
            title="Back to Directory"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <span className="text-[10px] text-slate-450 uppercase font-extrabold tracking-wider block">Student Admissions</span>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Manual Student Enrollment</h3>
          </div>
        </div>
      </div>

      {error && <ErrorState message={error} />}

      <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-6 text-xs font-bold text-slate-655">
        
        {/* Left Columns: Form Fields (Spans 2/3) */}
        <div className="lg:flex-[2] min-w-0 space-y-6">
          
          {/* Section 1: Personal Information */}
          <div className="bg-white border border-[#EBEAE6] rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider pb-2 border-b border-[#FAF9F6] flex items-center gap-1.5">
              <User size={14} className="text-amber-500" />
              <span>Personal Details</span>
            </h4>

            <div className="flex flex-wrap gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase text-slate-400 font-bold">Student Name *</label>
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-xl font-semibold outline-none ${validationErrors.name ? 'border-rose-300 focus:border-rose-450' : 'border-[#DEDCD8] focus:border-amber-400'}`}
                  placeholder="e.g. John Doe"
                />
                {validationErrors.name && <span className="text-[9px] text-rose-500 font-medium">{validationErrors.name}</span>}
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase text-slate-400 font-bold">Father's Name</label>
                <input 
                  type="text" 
                  name="fatherName" 
                  value={formData.fatherName} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-[#DEDCD8] rounded-xl font-semibold outline-none focus:border-amber-400"
                  placeholder="e.g. Richard Doe"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase text-slate-400 font-bold">Contact Mobile *</label>
                <input 
                  type="text" 
                  name="phone" 
                  value={formData.phone} 
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-xl font-semibold outline-none ${validationErrors.phone ? 'border-rose-300 focus:border-rose-450' : 'border-[#DEDCD8] focus:border-amber-400'}`}
                  placeholder="e.g. 9876543210"
                />
                {validationErrors.phone && <span className="text-[9px] text-rose-500 font-medium">{validationErrors.phone}</span>}
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase text-slate-400 font-bold">Email Address</label>
                <input 
                  type="email" 
                  name="email" 
                  value={formData.email} 
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-xl font-semibold outline-none ${validationErrors.email ? 'border-rose-300 focus:border-rose-450' : 'border-[#DEDCD8] focus:border-amber-400'}`}
                  placeholder="e.g. john@example.com"
                />
                {validationErrors.email && <span className="text-[9px] text-rose-500 font-medium">{validationErrors.email}</span>}
              </div>

              <DatePicker
                label="Date of Birth"
                value={formData.dob}
                onChange={(val) => handleChange({ target: { name: 'dob', value: val } })}
              />
            </div>
          </div>

          {/* Section 2: Academic Program Information */}
          <div className="bg-white border border-[#EBEAE6] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#FAF9F6]">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen size={14} className="text-[#E31C1C]" />
                <span>Program Setup & Predefined Course Selection</span>
              </h4>
              {selectedCourses.length > 0 && (
                <span className="text-[10px] bg-rose-50 text-[#E31C1C] px-2.5 py-0.5 rounded-full font-black border border-rose-200">
                  {selectedCourses.length} Selected
                </span>
              )}
            </div>

            {/* Course Search Filter Input */}
            <div className="space-y-1">
              <label className="block text-[10px] uppercase text-slate-400 font-bold">Select Institute Courses *</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  className="w-full pl-9 pr-4 py-2 border border-[#DEDCD8] bg-white rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#E31C1C] focus:ring-1 focus:ring-rose-200 transition-all placeholder:text-slate-400"
                  placeholder="Type to filter predefined institute courses..."
                  value={courseFilter}
                  onChange={e => setCourseFilter(e.target.value)}
                />
              </div>
            </div>

            {/* Interactive Course Pill Checkboxes */}
            <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-2.5 border border-[#EBEAE6] rounded-xl bg-[#FAF9F6]/50">
              {filteredCourses.map(c => {
                const isSelected = selectedCourses.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCourse(c)}
                    className={`text-xs font-bold px-3.5 py-1.5 rounded-full border transition-all cursor-pointer select-none flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-rose-50 text-[#E31C1C] border-[#E31C1C] font-extrabold ring-1 ring-[#E31C1C]/20 shadow-xs'
                        : 'bg-white text-slate-650 border-[#DEDCD8] hover:border-slate-400 hover:text-slate-850'
                    }`}
                  >
                    <span>{c}</span>
                  </button>
                );
              })}
              {filteredCourses.length === 0 && (
                <p className="text-xs text-slate-400 font-semibold p-2">No courses match "{courseFilter}"</p>
              )}
            </div>
            {validationErrors.course && (
              <span className="text-[9px] text-rose-500 font-medium block">{validationErrors.course}</span>
            )}

            {/* Roll No and Class Section */}
            <div className="flex flex-wrap gap-4 pt-2 border-t border-[#FAF9F6]">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase text-slate-400 font-bold">Roll / Reg No</label>
                <input 
                  type="text" 
                  name="rollNo" 
                  value={formData.rollNo} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-[#DEDCD8] rounded-xl font-semibold outline-none focus:border-amber-400"
                  placeholder={`e.g. RJ/${formData.admissionDate ? new Date(formData.admissionDate).getFullYear() : new Date().getFullYear()}/045`}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase text-slate-400 font-bold">Assigned Class Section</label>
                <input 
                  type="text" 
                  name="section" 
                  value={formData.section} 
                  onChange={handleChange}
                  placeholder="e.g. Section A / Batch 1"
                  className="w-full px-3 py-2 border border-[#DEDCD8] rounded-xl font-semibold outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Billing & Installments Config */}
          <div className="bg-white border border-[#EBEAE6] rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider pb-2 border-b border-[#FAF9F6] flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              <span>Billing Fees Structures</span>
            </h4>

            <div className="flex flex-wrap gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase text-slate-400 font-bold">Total Fees Base (₹) *</label>
                <input 
                  type="number" 
                  name="totalFee" 
                  value={formData.totalFee} 
                  onChange={handleChange}
                  placeholder="e.g. 120000"
                  className="w-full px-3 py-2 border border-[#DEDCD8] rounded-xl font-semibold outline-none focus:border-amber-400"
                  min="0"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase text-slate-400 font-bold">Discount / Concession (₹)</label>
                <input 
                  type="number" 
                  name="discount" 
                  value={formData.discount} 
                  onChange={handleChange}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-[#DEDCD8] rounded-xl font-semibold outline-none focus:border-amber-400"
                  min="0"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase text-slate-400 font-bold">Admission Deposit / Down Payment (₹)</label>
                <input 
                  type="number" 
                  name="depositAmount" 
                  value={formData.depositAmount} 
                  onChange={handleChange}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-[#DEDCD8] rounded-xl font-semibold outline-none focus:border-amber-400"
                  min="0"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase text-slate-400 font-bold">Plan Classification</label>
                <select 
                  name="paymentType" 
                  value={formData.paymentType} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-[#DEDCD8] bg-white rounded-xl font-bold cursor-pointer outline-none focus:border-amber-400"
                >
                  <option value="Installments">Installments Plan</option>
                  <option value="One-Time">One-Time / Full</option>
                </select>
              </div>

              {formData.paymentType === 'Installments' ? (
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase text-slate-400 font-bold">Installment Term Count</label>
                  <select 
                    name="installmentCount" 
                    value={formData.installmentCount} 
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-[#DEDCD8] bg-white rounded-xl font-bold cursor-pointer outline-none focus:border-amber-400"
                  >
                    <option value="2">2 Installments</option>
                    <option value="3">3 Installments</option>
                    <option value="4">4 Installments</option>
                    <option value="6">6 Installments</option>
                  </select>
                </div>
              ) : (
                <div className="space-y-1 opacity-50 select-none">
                  <label className="block text-[10px] uppercase text-slate-400 font-bold">Installment Term Count</label>
                  <select 
                    disabled
                    className="w-full px-3 py-2 border border-[#DEDCD8] bg-slate-50 rounded-xl font-bold outline-none cursor-not-allowed"
                  >
                    <option>N/A</option>
                  </select>
                </div>
              )}

              <DatePicker
                label="Enrollment / Admission Date"
                value={formData.admissionDate}
                onChange={(val) => handleAdmissionDateChange(val)}
              />
            </div>
          </div>

        </div>

        {/* Right Column: Invoicing preview (Spans 1/3) */}
        <div className="space-y-6">
          <div className="bg-white border border-[#EBEAE6] rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider pb-2 border-b border-[#FAF9F6]">
              Billing Summary Card
            </h4>
            
            <div className="space-y-3.5 font-semibold text-slate-655">
              <div className="flex justify-between py-1 border-b border-[#FAF9F6]">
                <span className="text-slate-400 font-bold">Base Tuition Fees</span>
                <span className="text-slate-700">{formatINR(formData.totalFee)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#FAF9F6]">
                <span className="text-slate-400">Discount Allocation</span>
                <span className="text-rose-500">- {formatINR(formData.discount)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#FAF9F6] text-slate-800">
                <span className="text-slate-450 font-extrabold">Net Total Payable</span>
                <span className="font-extrabold text-amber-500 text-sm">{formatINR(billingSummary.totalPayable)}</span>
              </div>
            </div>

            {/* Installments listing previews (editable) */}
            <div className="space-y-2 pt-2">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide block">Projected Billing Schedule</span>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {installments.map((inst, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2.5 bg-[#FAF9F6] border border-[#EBEAE6] rounded-xl text-[10px] font-bold gap-2">
                    <div className="flex-1 space-y-1">
                      <span className="text-slate-800 uppercase block leading-none">{inst.name}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] text-slate-400 font-semibold uppercase">Due:</span>
                        <input 
                          type="date" 
                          value={inst.dueDate} 
                          onChange={(e) => handleInstallmentChange(idx, 'dueDate', e.target.value)} 
                          className="w-[105px] px-1 py-0.5 border border-[#DEDCD8] rounded bg-white text-[9px] font-medium outline-none text-slate-600 focus:border-amber-400"
                        />
                      </div>
                    </div>
                    <div className="relative flex items-center shrink-0">
                      <span className="absolute left-1.5 text-[9px] text-slate-450 font-extrabold">₹</span>
                      <input 
                        type="number" 
                        value={inst.amount} 
                        onChange={(e) => handleInstallmentChange(idx, 'amount', e.target.value)} 
                        className="w-[75px] pl-3.5 pr-1 py-0.5 border border-[#DEDCD8] rounded bg-white text-[10px] font-extrabold text-slate-850 text-right outline-none focus:border-amber-400"
                        min="0"
                      />
                    </div>
                  </div>
                ))}
              </div>
              {validationErrors.installments && (
                <p className="text-[9px] text-rose-500 font-medium leading-normal mt-1.5">{validationErrors.installments}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 mt-4"
            >
              {loading ? <RefreshCw size={12} className="animate-spin" /> : null}
              <span>Register & Setup Plan</span>
            </button>
          </div>
        </div>

      </form>
    </div>
  );
};

export default ManualEnrollment;
