import React, { useState, useEffect, useRef } from 'react';
import {
  User, Upload, BookOpen, CreditCard, Save, Send, RotateCcw,
  Search, Plus, Trash2, AlertCircle, Phone, Mail, CalendarDays, ShieldCheck
} from 'lucide-react';
import DatePicker from '../../FeesManagement/components/DatePicker';

const PREDEFINED_COURSES = [
  'Digital Marketing', 'Graphic Designing', 'Video Editing', 'Web Development', 'UI/UX Design',
  'Blender', 'Tally with GST', 'Power BI', 'Artificial Intelligence', 'Advance Excel',
  'VBA Programming', 'AutoCAD', '3DS Max', 'SolidWorks', 'Interior Designing',
  'Revit Architecture', 'SketchUp', 'Architecture Designing', 'V-Ray', 'Mechanical CADD',
  'ArtCAM', 'C Language', 'C++', 'Python', 'Programming', 'Android Development',
  'RS-CIT', 'PGDCA', 'CCC', 'COPA',
];

const BATCH_SLOTS = [
  '08:00 AM - 10:00 AM',
  '10:00 AM - 12:00 PM',
  '12:00 PM - 02:00 PM',
  '02:00 PM - 04:00 PM',
  '04:00 PM - 06:00 PM',
  '06:00 PM - 08:00 PM',
];

const QUALIFICATIONS = [
  '10th Pass', '12th Pass', 'Diploma', 'Graduate (B.A)', 'Graduate (B.Sc)',
  'Graduate (B.Com)', 'Graduate (B.Tech)', 'Post Graduate', 'Other',
];

const ID_TYPES = ['Aadhar Card', 'PAN Card', 'Voter ID', 'Passport', 'Driving License'];
const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Net Banking', 'Bank Transfer', 'Cheque'];

function generatePrefix() {
  const currentYear = new Date().getFullYear();
  return `RJ/${currentYear}/`;
}

function calcAge(dob) {
  if (!dob) return '';
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age > 0 ? `${age} years` : '';
}

const EMPTY_FORM = {
  fullName: '',
  fatherHusbandName: '',
  contact: '',
  alternateNumber: '',
  email: '',
  centreReference: '',
  dob: '',
  gender: '',
  qualification: '',
  parentOccupation: '',
  address: '',
  pinCode: '',
  learningMode: 'Offline',
  idType: '',
  idNumber: '',
  batchSlot: BATCH_SLOTS[0],
  selectedCourses: [],
  manualCourse: '',
  enrolledCourses: [],
  courseDuration: "",
  totalFees: '',
  advancePaid: '',
  photo: null,
  idDocumentImage: null,
  removePhoto: false,
  removeIdDocumentImage: false,
  enrollmentPrefix: generatePrefix(),
  manualEnrollmentNo: '',
  idDocumentPhotos: [],
  paymentMode: 'Cash',
  paymentPlan: 'ONE_TIME',
  installmentMonths: '',
  firstEmiDate: '',
  emiSchedule: [],
};

export default function AdmissionForm({ onSubmit, editingStudent, onCancel, isSubmitting }) {
  const [form, setForm] = useState(() => {
    if (editingStudent) {
      let prefix = generatePrefix();
      let manualNo = editingStudent.enrollmentNo || '';
      const match = (editingStudent.enrollmentNo || '').match(/^(RJ\/\d{4}\/)(.*)$/);
      if (match) {
        prefix = match[1];
        manualNo = match[2];
      }
      
      return {
        ...EMPTY_FORM,
        fullName: editingStudent.name || editingStudent.fullName || '',
        fatherHusbandName: editingStudent.fatherHusbandName || '',
        contact: editingStudent.contact || '',
        alternateNumber: editingStudent.alternateNumber || '',
        email: editingStudent.email || '',
        centreReference: editingStudent.centreReference || '',
        dob: editingStudent.dob || '',
        gender: editingStudent.gender || '',
        qualification: editingStudent.qualification || '',
        parentOccupation: editingStudent.parentOccupation || '',
        address: editingStudent.address || '',
        pinCode: editingStudent.pinCode || '',
        learningMode: editingStudent.learningMode || 'Offline',
        idType: editingStudent.idType || '',
        idNumber: editingStudent.idNumber || '',
        batchSlot: editingStudent.batch || editingStudent.batchSlot || BATCH_SLOTS[0],
        selectedCourses: editingStudent.courses || [],
        totalFees: editingStudent.totalFees || '',
        advancePaid: editingStudent.paid || editingStudent.advancePaid || '',
        paymentMode: editingStudent.paymentMode || 'Cash',
        paymentPlan: editingStudent.paymentPlan || 'ONE_TIME',
        installmentMonths: editingStudent.installmentMonths || '',
        firstEmiDate: editingStudent.firstEmiDate ? new Date(editingStudent.firstEmiDate).toISOString().split('T')[0] : '',
        emiSchedule: editingStudent.emiSchedule || [],
        enrollmentPrefix: prefix,
        manualEnrollmentNo: manualNo,
        photo: editingStudent.studentPhotograph || null,
        idDocumentPhotos: editingStudent.idDocumentPhotos || (editingStudent.idDocumentImage ? [editingStudent.idDocumentImage] : []),
        removePhoto: false,
        removeIdDocumentImage: false,
      };
    }
    return { ...EMPTY_FORM, enrollmentPrefix: generatePrefix(), manualEnrollmentNo: '' };
  });

  const [qualSearch, setQualSearch] = useState('');
  const [showQualDropdown, setShowQualDropdown] = useState(false);
  const [courseFilter, setCourseFilter] = useState('');
  const [dragOver, setDragOver] = useState(false);
  
  // Use backend URL if photo is a string, otherwise use FileReader result
  const [photoPreview, setPhotoPreview] = useState(() => {
    if (editingStudent?.studentPhotograph && typeof editingStudent.studentPhotograph === 'string') {
      return editingStudent.studentPhotograph.startsWith('http') 
        ? editingStudent.studentPhotograph 
        : `${import.meta.env.VITE_API_URL || ''}${editingStudent.studentPhotograph}`;
    }
    return null;
  });
  
  const [idPreviews, setIdPreviews] = useState(() => {
    if (editingStudent?.idDocumentPhotos && editingStudent.idDocumentPhotos.length > 0) {
      return editingStudent.idDocumentPhotos.map(url => {
        if (typeof url !== 'string') return '';
        return url.startsWith('http') ? url : `${import.meta.env.VITE_API_URL || ''}${url}`;
      }).filter(Boolean);
    } else if (editingStudent?.idDocumentImage && typeof editingStudent.idDocumentImage === 'string') {
      const url = editingStudent.idDocumentImage;
      return [url.startsWith('http') ? url : `${import.meta.env.VITE_API_URL || ''}${url}`];
    }
    return [];
  });

  const fileInputRef = useRef(null);
  const idFileInputRef = useRef(null);
  const qualRef = useRef(null);
  const prevDepsRef = useRef({});

  useEffect(() => {
    function handleClickOutside(e) {
      if (qualRef.current && !qualRef.current.contains(e.target)) {
        setShowQualDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const toggleCourse = (course) => {
    setForm(f => ({
      ...f,
      selectedCourses: f.selectedCourses.includes(course)
        ? f.selectedCourses.filter(c => c !== course)
        : [...f.selectedCourses, course],
    }));
  };

  const addManualCourse = () => {
    if (!form.manualCourse.trim()) return;
    setForm(f => ({
      ...f,
      enrolledCourses: [...f.enrolledCourses, f.manualCourse.trim()],
      manualCourse: '',
    }));
  };

  const removeEnrolledCourse = (idx) => {
    setForm(f => ({ ...f, enrolledCourses: f.enrolledCourses.filter((_, i) => i !== idx) }));
  };

  const handlePhotoFile = (file) => {
    if (!file) return;
    set('photo', file);
    set('removePhoto', false);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    set('photo', null);
    set('removePhoto', true);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleIdDocumentFiles = (files) => {
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    
    setForm(f => ({
      ...f,
      idDocumentPhotos: [...f.idDocumentPhotos, ...newFiles],
      removeIdDocumentImage: false
    }));
    
    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    setIdPreviews(prev => [...prev, ...newPreviews]);
  };

  const removeIdPhoto = (index) => {
    setForm(f => {
      const newPhotos = [...f.idDocumentPhotos];
      newPhotos.splice(index, 1);
      return { ...f, idDocumentPhotos: newPhotos, removeIdDocumentImage: newPhotos.length === 0 };
    });
    setIdPreviews(prev => {
      const newPrev = [...prev];
      newPrev.splice(index, 1);
      return newPrev;
    });
    if (idFileInputRef.current) idFileInputRef.current.value = '';
  };

  const remaining = (() => {
    const total = parseFloat(form.totalFees) || 0;
    const paid = parseFloat(form.advancePaid) || 0;
    return total - paid;
  })();

  useEffect(() => {
    const depsKey = `${form.paymentPlan}-${form.totalFees}-${form.advancePaid}-${form.installmentMonths}-${form.firstEmiDate}`;
    if (prevDepsRef.current.depsKey === depsKey) {
      return;
    }
    prevDepsRef.current.depsKey = depsKey;

    if (form.paymentPlan === 'INSTALLMENT' && remaining > 0 && form.installmentMonths && form.firstEmiDate) {
      const months = parseInt(form.installmentMonths, 10);
      if (months > 0) {
        const schedule = [];
        const baseAmount = Math.floor(remaining / months);
        let currentRemaining = remaining;
        
        const [year, month, day] = form.firstEmiDate.split('-').map(Number);
        
        for (let i = 1; i <= months; i++) {
          let amount = baseAmount;
          if (i === months) {
            amount = currentRemaining;
          }
          currentRemaining -= amount;
          
          const dueDate = new Date(year, month - 1 + (i - 1), day);
          
          schedule.push({
            installmentNumber: i,
            dueDate: dueDate.toISOString(),
            amount: amount
          });
        }
        
        setForm(f => ({ ...f, emiSchedule: schedule }));
      }
    } else if (form.emiSchedule.length > 0 && form.paymentPlan !== 'INSTALLMENT') {
      setForm(f => ({ ...f, emiSchedule: [] }));
    }
  }, [form.paymentPlan, form.totalFees, form.advancePaid, form.installmentMonths, form.firstEmiDate, remaining]);

  const handleIdNumberChange = (e) => {
    let raw = e.target.value.replace(/[^A-Za-z0-9]/g, '');
    let formatted = '';
    for (let i = 0; i < raw.length; i++) {
      if (i > 0 && i % 4 === 0) formatted += ' ';
      formatted += raw[i];
    }
    set('idNumber', formatted);
  };

  const handleReset = () => {
    setForm({ ...EMPTY_FORM, enrollmentPrefix: generatePrefix(), manualEnrollmentNo: '' });
    setPhotoPreview(null);
    setIdPreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (idFileInputRef.current) idFileInputRef.current.value = '';
    setQualSearch('');
  };

  const handleSubmit = () => {
    if (isSubmitting) return;

    if (!form.manualEnrollmentNo || form.manualEnrollmentNo.trim() === '') {
      alert('Enrollment number is required. Please provide it before submitting.');
      return;
    }
    
    if (form.paymentPlan === 'INSTALLMENT' && form.emiSchedule.length > 0) {
      const emiTotal = form.emiSchedule.reduce((sum, emi) => sum + (Number(emi.amount) || 0), 0);
      if (emiTotal !== remaining) {
        alert(`Total installment amount (₹${emiTotal.toLocaleString('en-IN')}) must equal the remaining balance (₹${remaining.toLocaleString('en-IN')}). Please adjust the installments.`);
        return;
      }
    }

    onSubmit({
      ...form,
      name: form.fullName || 'Unnamed Student',
      courses: [...form.selectedCourses, ...form.enrolledCourses],
      paymentStatus: remaining <= 0 ? 'Full' : form.advancePaid ? 'Partial' : 'Pending',
      paid: form.advancePaid,
      paymentMode: form.paymentMode,
      enrollmentNo: form.enrollmentPrefix + form.manualEnrollmentNo,
      retainedIdDocumentPhotos: form.idDocumentPhotos.filter(p => typeof p === 'string'),
      idDocumentPhotos: form.idDocumentPhotos.filter(p => typeof p !== 'string')
    });
  };

  const filteredCourses = PREDEFINED_COURSES.filter(c =>
    c.toLowerCase().includes(courseFilter.toLowerCase())
  );
  const filteredQuals = QUALIFICATIONS.filter(q =>
    q.toLowerCase().includes(qualSearch.toLowerCase())
  );

  const inputCls = "w-full bg-[#FAFAF9] border border-[#E3E1DC] rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#E31C1C] focus:ring-1 focus:ring-[#E31C1C]/20 transition-all";
  const labelCls = "block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5";
  const sectionHeaderCls = "flex items-center gap-2 text-xs font-black text-slate-700 uppercase tracking-wider mb-5";

  return (
    <div className="relative">
      {/* Enrollment No Header */}
      <div className="bg-white border border-[#E8E6E1] rounded-2xl px-6 py-3.5 mb-5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-black uppercase tracking-widest">
          <AlertCircle size={13} className="text-[#E31C1C]" />
          ENROLLMENT NUMBER (EDITABLE ADMIN REFERENCE)
        </div>
        <div className="flex items-center text-sm font-black text-slate-800 tracking-widest gap-1 bg-[#FAFAF9] px-3 py-1.5 rounded-lg border border-[#E3E1DC]">
          <span className="opacity-60 select-none border-r border-[#E3E1DC] pr-2 mr-1">{form.enrollmentPrefix}</span>
          <input
            value={form.manualEnrollmentNo}
            onChange={(e) => set('manualEnrollmentNo', e.target.value.replace(/[^0-9]/g, ''))}
            className="bg-transparent border-none text-left text-sm font-black text-slate-800 focus:outline-none tracking-widest w-24 p-0 m-0 placeholder-slate-300"
            placeholder="7002"
          />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-5 items-start">
        {/* ── LEFT COLUMN ─────────────────────────────── */}
        <div className="flex-1 space-y-5">

          {/* Personal Information */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-sm">
            <div className={sectionHeaderCls}>
              <User size={15} className="text-[#E31C1C]" />
              Personal Information
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
              <div>
                <label className={labelCls}>Full Name <span className="text-[#E31C1C]">*</span></label>
                <input className={inputCls} placeholder="Enter student's full name" value={form.fullName} onChange={e => set('fullName', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Father's / Husband's Name <span className="text-[#E31C1C]">*</span></label>
                <input className={inputCls} placeholder="Father's or husband's name" value={form.fatherHusbandName} onChange={e => set('fatherHusbandName', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Contact Number <span className="text-[#E31C1C]">*</span></label>
                <div className="relative">
                  <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className={`${inputCls} pl-8`} placeholder="10-digit mobile number" maxLength={10} value={form.contact} onChange={e => set('contact', e.target.value.replace(/\D/, ''))} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-semibold">Without country prefix (e.g. 09876543210)</p>
              </div>
              <div>
                <label className={labelCls}>Alternate Number</label>
                <div className="relative">
                  <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className={`${inputCls} pl-8`} placeholder="10-digit mobile number" maxLength={10} value={form.alternateNumber} onChange={e => set('alternateNumber', e.target.value.replace(/\D/, ''))} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Email Address</label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className={`${inputCls} pl-8`} placeholder="student@example.com" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Centre Reference</label>
                <select className={inputCls} value={form.centreReference} onChange={e => set('centreReference', e.target.value)}>
                  <option value="">Select Centre Reference</option>
                  <option value="Google">Google</option>
                  <option value="Site">Site</option>
                  <option value="AI">AI</option>
                  <option value="Friend">Friend</option>
                  <option value="Old Student">Old Student</option>
                  <option value="Company">Company</option>
                  <option value="Instagram">Instagram</option>
                  <option value="YouTube">YouTube</option>
                  <option value="Family">Family</option>
                </select>
              </div>
              <div>
                <DatePicker
                  label="Date of Birth"
                  value={form.dob}
                  onChange={val => set('dob', val)}
                />
              </div>
              <div>
                <label className={labelCls}>Age <span className="text-[10px] font-bold text-slate-400 normal-case">(Auto-calculated, editable)</span></label>
                <input className={`${inputCls} bg-slate-50 text-slate-400`} readOnly value={calcAge(form.dob)} placeholder="Calculated age" />
              </div>
              <div>
                <label className={labelCls}>Gender</label>
                <select className={inputCls} value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="">Select Gender</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>

              {/* Educational Qualification — full width */}
              <div className="w-full" ref={qualRef}>
                <label className={labelCls}>Educational Qualification</label>
                <div className="relative">
                  <input
                    className={`${inputCls} pr-10`}
                    placeholder="Select Highest Qualification"
                    value={form.qualification || qualSearch}
                    onFocus={() => setShowQualDropdown(true)}
                    onChange={e => { setQualSearch(e.target.value); set('qualification', ''); setShowQualDropdown(true); }}
                  />
                  <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  {showQualDropdown && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-[#E3E1DC] rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                      {filteredQuals.map(q => (
                        <div
                          key={q}
                          className="px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:text-[#E31C1C] cursor-pointer transition-colors"
                          onClick={() => { set('qualification', q); setQualSearch(''); setShowQualDropdown(false); }}
                        >
                          {q}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full">
                <label className={labelCls}>Parent's / Father's Occupation</label>
                <input className={inputCls} placeholder="e.g. Business, Govt. Servant, Private Sector, Agriculturist" value={form.parentOccupation} onChange={e => set('parentOccupation', e.target.value)} />
              </div>
              <div className="w-full">
                <label className={labelCls}>Full Address</label>
                <textarea className={`${inputCls} resize-none`} rows={2} placeholder="Enter house no, street name, city, state" value={form.address} onChange={e => set('address', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Pin Code</label>
                <input className={inputCls} placeholder="6-digit numeric code" maxLength={6} value={form.pinCode} onChange={e => set('pinCode', e.target.value.replace(/\D/, ''))} />
              </div>
            </div>
          </div>

            <div className="flex flex-col xl:flex-row gap-5 items-start">
              <div className="flex-1 space-y-5 min-w-0">
                {/* Course Preferences */}
                <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-sm">
                  <div className={sectionHeaderCls}>
                    <BookOpen size={15} className="text-[#E31C1C]" />
                    Course Preferences
                  </div>
                  <div>
                    <label className={`${labelCls} mb-3`}>Learning Mode Preference <span className="text-[#E31C1C]">*</span></label>
                    <div className="flex gap-3 px-5 py-2 border border-[#E3E1DC] rounded-xl overflow-hidden">
                      {['Offline', 'Online', 'Hybrid'].map(mode => (
                        <button
                          key={mode}
                          onClick={() => set('learningMode', mode)}
                          className={`py-2 rounded-md px-2 text-xs font-black tracking-wider transition-all ${
                            form.learningMode === mode
                              ? 'bg-[#E31C1C] text-white'
                              : 'bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Identity Details */}
                <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-sm">
                  <div className={sectionHeaderCls}>
                    <ShieldCheck size={15} className="text-[#E31C1C]" />
                    Identity Details
                  </div>
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-wrap gap-4">
                      <div className="flex-1 min-w-[200px]">
                        <label className={labelCls}>Legal ID Document Type</label>
                        <select className={inputCls} value={form.idType} onChange={e => set('idType', e.target.value)}>
                          <option value="">Select ID Type</option>
                          {ID_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <label className={labelCls}>ID Document Number</label>
                        <input
                          className={`${inputCls} ${!form.idType ? 'opacity-50 cursor-not-allowed' : ''}`}
                          placeholder={form.idType ? `Enter ${form.idType} number` : 'Select ID Type first'}
                          disabled={!form.idType}
                          value={form.idNumber}
                          onChange={handleIdNumberChange}
                        />
                      </div>
                    </div>
                
                    {/* ID Document Photo Upload */}
                    <div>
                      <label className={labelCls}>ID Document Photo (Multiple Allowed)</label>
                      <div className="mt-2 bg-[#FAFAF9] border border-[#E3E1DC] rounded-xl p-4 flex flex-col gap-4">
                        {idPreviews.length > 0 && (
                          <div className="flex flex-wrap gap-4 w-full">
                            {idPreviews.map((previewUrl, idx) => (
                              <div key={idx} className="flex flex-col items-center gap-2">
                                <img src={previewUrl} alt={`ID Document ${idx + 1}`} className="w-16 h-16 object-cover rounded-lg border border-[#E3E1DC]" />
                                <button type="button" onClick={() => removeIdPhoto(idx)} className="text-[10px] font-black text-[#E31C1C] hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-md transition-colors w-full">Remove</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className={`flex items-center justify-between w-full ${idPreviews.length > 0 ? 'pt-3 border-t border-[#E3E1DC]' : ''}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-rose-50 text-[#E31C1C] rounded-full flex items-center justify-center">
                              <Upload size={16} />
                            </div>
                            <div>
                              <p className="text-[11px] font-black text-slate-700">Upload ID Photos</p>
                              <p className="text-[10px] font-semibold text-slate-400">{idPreviews.length > 0 ? "Add more files" : "Capture or select files"}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => idFileInputRef.current?.click()}
                            className="bg-white border border-[#E3E1DC] text-slate-700 text-[11px] font-black px-4 py-2 rounded-lg hover:border-slate-300 transition-colors shadow-sm"
                          >
                            Upload / Camera
                          </button>
                        </div>
                        <input
                          type="file"
                          multiple
                          ref={idFileInputRef}
                          className="hidden"
                          accept="image/*"
                          capture="environment"
                          onChange={e => handleIdDocumentFiles(e.target.files)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-5 min-w-0">
                {/* Payment Details */}
                <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 shadow-sm">
                  <div className={sectionHeaderCls}>
                    <CreditCard size={15} className="text-[#E31C1C]" />
                    Payment Details
                  </div>
                  <div className="flex flex-wrap gap-3 mb-4">
                    <div className="flex-1 min-w-[150px]">
                      <label className={labelCls}>Total Course Fees (₹) <span className="text-[#E31C1C]">*</span></label>
                      <input className={inputCls} placeholder="Enter total tuition fee" type="number" value={form.totalFees} onChange={e => set('totalFees', e.target.value)} />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <label className={labelCls}>Advance Paid Deposit (₹)</label>
                      <input className={inputCls} placeholder="Tuition deposit paid" type="number" value={form.advancePaid} onChange={e => set('advancePaid', e.target.value)} />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <label className={labelCls}>Payment Mode</label>
                      <select className={inputCls} value={form.paymentMode} onChange={e => set('paymentMode', e.target.value)}>
                        {PAYMENT_MODES.map(mode => (
                          <option key={mode} value={mode}>{mode}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <label className={labelCls}>Payment Plan</label>
                      <select className={inputCls} value={form.paymentPlan} onChange={e => set('paymentPlan', e.target.value)}>
                        <option value="ONE_TIME">One Time</option>
                        <option value="INSTALLMENT">Installment</option>
                      </select>
                    </div>
                  </div>
                
                  {form.paymentPlan === 'INSTALLMENT' && (
                    <div className="flex flex-wrap gap-3 mb-4 p-4 border border-[#E3E1DC] bg-slate-50/50 rounded-xl">
                      <div className="flex-1 min-w-[150px]">
                        <label className={labelCls}>Installment Duration</label>
                        <select className={inputCls} value={form.installmentMonths} onChange={e => set('installmentMonths', e.target.value)}>
                          <option value="">Select duration...</option>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                            <option key={num} value={num}>{num} Month{num > 1 ? 's' : ''}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1 min-w-[150px]">
                        <DatePicker
                          label="First EMI Date"
                          value={form.firstEmiDate}
                          onChange={val => set('firstEmiDate', val)}
                        />
                      </div>
                    </div>
                  )}
                
                  {/* Remaining Balance */}
                  <div className="bg-[#FAFAF9] border border-[#E3E1DC] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Calculated Remaining Fees Balance</span>
                      <span className={`text-[10px] font-black uppercase tracking-wider ${remaining > 0 ? 'text-[#E31C1C]' : 'text-emerald-600'}`}>
                        {remaining > 0 ? 'Pending Amount' : remaining === 0 && form.totalFees ? 'Fully Paid' : ''}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[#E31C1C] text-lg font-black">₹{remaining >= 0 ? remaining.toLocaleString('en-IN') : 0}</span>
                      <span className="text-xs font-bold text-slate-400">INR</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 font-semibold">This outstanding balance will update automatically upon modifying either total fees or tuition deposit.</p>
                  </div>
                
                  {form.paymentPlan === 'INSTALLMENT' && form.emiSchedule.length > 0 && (
                    <div className="mt-4 bg-white border border-[#E3E1DC] rounded-xl p-4">
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3">Installment Schedule Preview</div>
                      <div className="space-y-2">
                        {form.emiSchedule.map((emi, i) => {
                          const dateObj = new Date(emi.dueDate);
                          const dateString = isNaN(dateObj) ? '' : `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                          return (
                            <div key={i} className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-2 text-xs font-semibold text-slate-600 border-b border-[#F4F4F4] pb-2 last:border-0 last:pb-0">
                              <div className="flex items-center gap-2">
                                <span>{i + 1}.</span>
                                <div className="w-36">
                                  <DatePicker 
                                    value={dateString}
                                    onChange={(val) => {
                                      setForm(f => {
                                        const newSchedule = [...f.emiSchedule];
                                        newSchedule[i].dueDate = val ? new Date(val).toISOString() : new Date().toISOString();
                                        return { ...f, emiSchedule: newSchedule };
                                      });
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-slate-500">₹</span>
                                <input
                                  type="number"
                                  className="border border-[#E3E1DC] rounded px-2 py-1.5 w-24 text-right focus:outline-none focus:border-[#E31C1C] font-bold text-slate-800 bg-white"
                                  value={emi.amount}
                                  onChange={(e) => {
                                    setForm(f => {
                                      const newSchedule = [...f.emiSchedule];
                                      newSchedule[i].amount = Number(e.target.value) || 0;
                                      return { ...f, emiSchedule: newSchedule };
                                    });
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3 pt-3 border-t border-[#E3E1DC] flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-500">Total Installments: {form.emiSchedule.length}</span>
                        <span className={`font-black ${form.emiSchedule.reduce((sum, emi) => sum + (Number(emi.amount) || 0), 0) !== remaining ? 'text-orange-500' : 'text-[#E31C1C]'}`}>
                          Total Installment Amount: ₹{form.emiSchedule.reduce((sum, emi) => sum + (Number(emi.amount) || 0), 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      {form.emiSchedule.reduce((sum, emi) => sum + (Number(emi.amount) || 0), 0) !== remaining && (
                        <p className="text-[10px] text-orange-500 mt-2 font-bold bg-orange-50 p-2 rounded-lg border border-orange-100">
                          Warning: Total installment amount (₹{form.emiSchedule.reduce((sum, emi) => sum + (Number(emi.amount) || 0), 0).toLocaleString('en-IN')}) does not match the remaining fees balance (₹{remaining.toLocaleString('en-IN')}).
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

        </div>

        {/* ── RIGHT COLUMN ─────────────────────────────── */}
        <div className="w-80 shrink-0 space-y-5">

          {/* Student Photograph */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 shadow-sm">
            <div className={sectionHeaderCls}>
              <Upload size={15} className="text-[#E31C1C]" />
              Student Photograph
            </div>
            <div
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${
                dragOver ? 'border-[#E31C1C] bg-rose-50' : 'border-[#E3E1DC] bg-[#FAFAF9]'
              }`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handlePhotoFile(e.dataTransfer.files[0]); }}
              onClick={() => fileInputRef.current?.click()}
            >
              {photoPreview ? (
                <div className="flex flex-col items-center gap-3 w-full">
                  <img src={photoPreview} alt="Preview" className="w-28 h-28 object-cover rounded-xl border border-[#E3E1DC]" />
                  <div className="flex gap-2">
                    <button type="button" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="text-[10px] font-black text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-md transition-colors">Replace</button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); removePhoto(); }} className="text-[10px] font-black text-[#E31C1C] hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-md transition-colors">Remove</button>
                  </div>
                </div>
              ) : (
                <>
                  <Upload size={24} className="text-[#E31C1C]" />
                  <div className="text-center">
                    <p className="text-xs font-black text-slate-700">Drag &amp; Drop photograph here</p>
                    <p className="text-[10px] text-slate-400 mt-1">Accepts PNG, JPG, or JPEG up to 2MB</p>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400">or</p>
                  <button
                    type="button"
                    className="bg-[#E31C1C] text-white text-[11px] font-black px-5 py-2 rounded-lg hover:bg-[#c01919] transition-colors"
                    onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  >
                    Browse / Camera
                  </button>
                </>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="user" onChange={e => handlePhotoFile(e.target.files[0])} />
            </div>
          </div>

          {/* Predefined Course Selection */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 shadow-sm">
            <div className={sectionHeaderCls}>
              <BookOpen size={15} className="text-[#E31C1C]" />
              Predefined Course Selection
            </div>
            <div className="relative mb-3">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className={`${inputCls} pl-8`}
                placeholder="Type to filter predefined institute courses..."
                value={courseFilter}
                onChange={e => setCourseFilter(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {filteredCourses.map(c => (
                <button
                  key={c}
                  onClick={() => toggleCourse(c)}
                  className={`text-[11px] font-black px-3 py-1.5 rounded-full border transition-all ${
                    form.selectedCourses.includes(c)
                      ? 'bg-[#E31C1C] text-white border-[#E31C1C]'
                      : 'bg-white text-slate-600 border-[#E3E1DC] hover:border-[#E31C1C] hover:text-[#E31C1C]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Enrolled Courses (manual) */}
            <div className="mt-4 pt-4 border-t border-[#EBEAE6]">
              <div className="flex items-center gap-1.5 mb-1">
                <Plus size={13} className="text-[#E31C1C]" />
                <span className="text-xs font-black text-slate-700">Enrolled Courses</span>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold mb-3">Manually add additional or customized courses to this student's registration profile.</p>
              <div className="flex gap-2 mb-2">
                <input
                  className={`${inputCls} flex-1`}
                  placeholder="Enter manual course name..."
                  value={form.manualCourse}
                  onChange={e => set('manualCourse', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addManualCourse()}
                />
                <button
                  onClick={addManualCourse}
                  className="bg-[#E31C1C] text-white text-[11px] font-black px-3 py-2 rounded-xl hover:bg-[#c01919] transition-colors whitespace-nowrap flex items-center gap-1"
                >
                  <Plus size={12} />
                  Add Course
                </button>
              </div>
              {form.enrolledCourses.length === 0 ? (
                <p className="text-[10px] text-slate-400 font-semibold">No manual courses added yet. Use the input field above.</p>
              ) : (
                <div className="space-y-1.5">
                  {form.enrolledCourses.map((c, i) => (
                    <div key={i} className="flex items-center justify-between bg-[#FFF5F5] border border-[#FCD4D4] rounded-lg px-3 py-1.5">
                      <span className="text-xs font-bold text-slate-700">{c}</span>
                      <button onClick={() => removeEnrolledCourse(i)} className="text-[#E31C1C] hover:text-red-700">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>


        </div>
      </div>

      {/* ── FOOTER BAR ─────────────────────────────── */}
      <div className="sticky bottom-0 mt-6 -mx-0 bg-white border-t border-[#E3E1DC] px-6 py-4 flex items-center justify-between z-10 rounded-b-2xl">
        <div className="flex items-center gap-3">
          {onCancel ? (
            <button
              onClick={onCancel}
              className="text-xs font-black text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          ) : (
            <>
              <button
                onClick={() => onSubmit && onSubmit(null)}
                className="text-xs font-black text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-xs font-black text-slate-600 border border-[#E3E1DC] px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <RotateCcw size={13} />
                Reset Form
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {editingStudent ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`flex items-center gap-2 text-white text-xs font-black px-6 py-2.5 rounded-xl transition-colors shadow-sm ${
                isSubmitting ? 'bg-[#c01919] opacity-70 cursor-not-allowed' : 'bg-[#E31C1C] hover:bg-[#c01919] cursor-pointer'
              }`}
            >
              <Save size={14} />
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          ) : (
            <>
              <button
                disabled={isSubmitting}
                className={`flex items-center gap-2 border border-[#E3E1DC] text-xs font-black text-slate-700 px-5 py-2.5 rounded-xl transition-colors ${
                  isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 cursor-pointer'
                }`}
              >
                <Save size={14} />
                Save Draft
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`flex items-center gap-2 text-white text-xs font-black px-6 py-2.5 rounded-xl transition-colors shadow-sm ${
                  isSubmitting ? 'bg-[#c01919] opacity-70 cursor-not-allowed' : 'bg-[#E31C1C] hover:bg-[#c01919] cursor-pointer'
                }`}
              >
                <Send size={14} />
                {isSubmitting ? 'Submitting...' : 'Submit Admission'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
