import React, { useState, useRef, useEffect } from 'react';
import { Edit2, User, Phone, BookOpen, Clock, Hash, CreditCard, Trash2 } from 'lucide-react';

const STATUS_COLORS = {
  Full: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Partial: 'bg-amber-50 text-amber-700 border-amber-200',
  Pending: 'bg-rose-50 text-[#E31C1C] border-rose-200',
};

function CourseCell({ courses }) {
  if (!courses || courses.length === 0) {
    return <span className="text-[10px] text-slate-400 font-semibold">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5 min-w-0">
      {courses.map(c => (
        <span key={c} className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md break-words whitespace-normal leading-tight text-center max-w-full">
          {c}
        </span>
      ))}
    </div>
  );
}

export default function RegisteredStudents({ students, onEdit, onDelete, onAddStudent }) {
  if (students.length === 0) {
    return (
      <div className="bg-white border border-[#E8E6E1] rounded-2xl p-16 text-center shadow-sm">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <User size={28} className="text-slate-400" />
        </div>
        <h3 className="text-sm font-black text-slate-700 mb-1">No Students Registered</h3>
        <p className="text-xs text-slate-400 font-semibold mb-6">Students submitted via the Admission Form will appear here.</p>
        {onAddStudent && (
          <button
            onClick={onAddStudent}
            className="bg-[#E31C1C] text-white text-[11px] font-black px-6 py-2.5 rounded-xl hover:bg-[#c01919] transition-colors shadow-sm"
          >
            Add New Student
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E8E6E1] rounded-2xl shadow-sm overflow-hidden">
      {/* Table Header */}
      <div className="grid grid-cols-[2fr_1.2fr_2fr_1.4fr_1.2fr_160px] gap-4 px-6 py-3.5 bg-[#FAFAF9] border-b border-[#E8E6E1]">
        {[
          { icon: User, label: 'Student Name' },
          { icon: Phone, label: 'Contact' },
          { icon: BookOpen, label: 'Courses' },
          { icon: Hash, label: 'Enrollment No.' },
          { icon: CreditCard, label: 'Payment' },
          { icon: null, label: 'Actions' },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            {Icon && <Icon size={11} className="text-slate-400 shrink-0" />}
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{label}</span>
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-[#F0EEEA]">
        {students.map((student) => (
          <div
            key={student.id}
            className="grid grid-cols-[2fr_1.2fr_2fr_1.4fr_1.2fr_160px] gap-4 px-6 py-4 hover:bg-[#FAFAF9] transition-colors group items-center"
          >
            {/* Name */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#E31C1C] text-white font-black text-xs flex items-center justify-center shrink-0">
                {student.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-black text-slate-800 truncate">{student.name}</span>
                {student.centreReference && (
                  <span className="text-[10px] text-slate-400 truncate font-semibold mt-0.5">Ref: {student.centreReference}</span>
                )}
              </div>
            </div>

            {/* Contact */}
            <div className="flex flex-col min-w-0">
              <div className="text-xs font-semibold text-slate-600 truncate">{student.contact || '—'}</div>
              {student.alternateNumber && (
                <div className="text-[10px] text-slate-400 truncate mt-0.5">{student.alternateNumber}</div>
              )}
            </div>

            {/* Courses */}
            <CourseCell courses={student.courses || []} />

            {/* Enrollment No */}
            <div className="text-[11px] font-black text-slate-700 tracking-wider">{student.enrollmentNo}</div>

            {/* Payment Status */}
            <div>
              <span className={`text-[10px] font-black border px-2.5 py-1 rounded-full ${STATUS_COLORS[student.paymentStatus] || STATUS_COLORS.Pending}`}>
                {student.paymentStatus}
              </span>
            </div>

            {/* Actions */}
            <div>
              <div className="flex gap-2">
                <button
                  onClick={() => onEdit(student)}
                  className="flex items-center gap-1.5 text-[11px] font-black text-slate-500 hover:text-[#E31C1C] border border-[#E3E1DC] hover:border-[#E31C1C] px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                >
                  <Edit2 size={11} />
                  Edit
                </button>
                {onDelete && (
                  <button
                    onClick={() => onDelete(student.id)}
                    className="flex items-center gap-1.5 text-[11px] font-black text-slate-500 hover:text-[#E31C1C] border border-[#E3E1DC] hover:border-[#E31C1C] px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                  >
                    <Trash2 size={11} />
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-[#FAFAF9] border-t border-[#E8E6E1] flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {students.length} student{students.length !== 1 ? 's' : ''} registered
        </span>
        {onAddStudent && (
          <button
            onClick={onAddStudent}
            className="text-[10px] font-black bg-white border border-[#E3E1DC] text-slate-600 px-4 py-2 rounded-lg hover:border-slate-300 transition-colors shadow-sm"
          >
            + Add Student
          </button>
        )}
      </div>
    </div>
  );
}
