import React, { useState, useEffect } from 'react';
import { Plus, List } from 'lucide-react';
import AdmissionForm from './AdmissionForm';
import RegisteredStudents from './RegisteredStudents';
import { leadApi } from '../api/leadApi';

export default function AdmissionTab() {
  const [nestedTab, setNestedTab] = useState('new-admission'); // 'new-admission' | 'registered-students'
  const [registeredStudents, setRegisteredStudents] = useState([]);
  const [editingStudent, setEditingStudent] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAdmittedStudents();
  }, []);

  const fetchAdmittedStudents = async () => {
    try {
      setIsLoading(true);
      const response = await leadApi.getAdmittedStudents();
      if (response && response.success) {
        setRegisteredStudents(response.data.map(s => ({ ...s, id: s._id, name: s.fullName || s.name })));
      }
    } catch (error) {
      console.error("Failed to fetch registered students:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdmissionSubmit = async (studentData) => {
    if (!studentData || isSubmitting) return; // cancelled or already submitting
    setIsSubmitting(true);
    try {
      if (editingStudent) {
        const response = await leadApi.updateAdmittedStudent(editingStudent.id, studentData);
        if (response && response.success) {
          setRegisteredStudents(prev =>
            prev.map(s => s.id === editingStudent.id ? { ...response.data, id: s.id, name: response.data.fullName || response.data.name } : s)
          );
          setEditingStudent(null);
          setNestedTab('registered-students');
          alert('Student information successfully updated!');
        } else {
          alert('Failed to update student: ' + (response?.message || 'Unknown error'));
        }
      } else {
        const response = await leadApi.admitStudent(studentData);
        if (response && response.success) {
          const admittedData = response.data;
          setRegisteredStudents(prev => [{ ...admittedData, id: admittedData._id || Date.now().toString(), name: admittedData.fullName || admittedData.name }, ...prev]);
          setNestedTab('registered-students');
          alert('Admission successfully integrated with Fees Management!');
        } else {
          alert('Failed to admit student: ' + (response?.message || 'Unknown error'));
        }
      }
    } catch (err) {
      console.error(err);
      alert('Error during admission: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditStudent = (student) => {
    setEditingStudent(student);
    setNestedTab('new-admission');
  };

  const handleCancelEdit = () => {
    setEditingStudent(null);
    setNestedTab('registered-students');
  };

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm("Are you sure you want to delete this admission record?")) return;
    try {
      const response = await leadApi.deleteAdmittedStudent(studentId);
      if (response && response.success) {
        setRegisteredStudents(prev => prev.filter(s => s.id !== studentId));
        alert('Admission record deleted successfully!');
      } else {
        alert('Failed to delete student: ' + (response?.message || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting admission: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="space-y-6">
      {/* Nested Tabs */}
      <div className="bg-white border border-[#E8E6E1] rounded-2xl p-2 flex items-center shadow-sm w-fit gap-2">
        <button
          onClick={() => {
            setNestedTab('new-admission');
            setEditingStudent(null);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            nestedTab === 'new-admission'
              ? 'bg-rose-50 text-[#E31C1C]'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
          }`}
        >
          <Plus size={14} />
          {editingStudent ? 'Edit Admission' : 'New Admission'}
        </button>
        <button
          onClick={() => {
            setNestedTab('registered-students');
            setEditingStudent(null);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            nestedTab === 'registered-students'
              ? 'bg-slate-100 text-slate-800'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
          }`}
        >
          <List size={14} />
          Registered Students ({registeredStudents.length})
        </button>
      </div>

      {/* Content Area */}
      {nestedTab === 'new-admission' ? (
        <AdmissionForm
          onSubmit={handleAdmissionSubmit}
          editingStudent={editingStudent}
          onCancel={editingStudent ? handleCancelEdit : null}
          isSubmitting={isSubmitting}
        />
      ) : isLoading ? (
        <div className="bg-white border border-[#E8E6E1] rounded-2xl p-16 text-center shadow-sm">
          <div className="w-8 h-8 border-4 border-[#E31C1C] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h3 className="text-sm font-black text-slate-700 mb-1">Loading Registered Students...</h3>
        </div>
      ) : (
        <RegisteredStudents
          students={registeredStudents}
          onEdit={handleEditStudent}
          onDelete={handleDeleteStudent}
          onAddStudent={() => {
            setNestedTab('new-admission');
            setEditingStudent(null);
          }}
        />
      )}
    </div>
  );
}
