import axios from 'axios';
import { API_CONFIG } from '../../../config/api';

// Dedicated axios instance for Lead Management
const leadAxios = axios.create({
  baseURL: API_CONFIG.LEAD_BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_CONFIG.HEADERS
});

// Attach auth token if available
leadAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const leadApi = {
  getLeads: async () => {
    const response = await leadAxios.get('/lead');
    return response.data;
  },

  updateLeadStatus: async (leadId, status) => {
    const response = await leadAxios.put(`/lead/${leadId}`, { status });
    return response.data;
  },

  deleteLead: async (leadId) => {
    const response = await leadAxios.delete(`/lead/${leadId}`);
    return response.data;
  },

  createLead: async (leadData) => {
    const response = await leadAxios.post('/lead', leadData);
    return response.data;
  },

  createOfflineLead: async (leadData) => {
    const response = await leadAxios.post('/lead/offline', leadData);
    return response.data;
  },

  updateLead: async (leadId, leadData) => {
    const response = await leadAxios.put(`/lead/${leadId}`, leadData);
    return response.data;
  },

  admitStudent: async (admissionData) => {
    const formData = new FormData();
    for (const key in admissionData) {
      if (admissionData[key] !== null && admissionData[key] !== undefined) {
        if (key === 'selectedCourses' || key === 'enrolledCourses' || key === 'courses' || key === 'emiSchedule') {
          formData.append(key, JSON.stringify(admissionData[key]));
        } else if (key === 'idDocumentPhotos') {
          admissionData[key].forEach(file => {
            formData.append('idDocumentPhotos', file);
          });
        } else if (key === 'retainedIdDocumentPhotos') {
          formData.append(key, JSON.stringify(admissionData[key]));
        } else {
          formData.append(key, admissionData[key]);
        }
      }
    }
    const response = await leadAxios.post('/lead/admission', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },
  
  updateAdmittedStudent: async (id, admissionData) => {
    const formData = new FormData();
    for (const key in admissionData) {
      if (admissionData[key] !== null && admissionData[key] !== undefined) {
        if (key === 'selectedCourses' || key === 'enrolledCourses' || key === 'courses' || key === 'emiSchedule') {
          formData.append(key, JSON.stringify(admissionData[key]));
        } else if (key === 'idDocumentPhotos') {
          admissionData[key].forEach(file => {
            formData.append('idDocumentPhotos', file);
          });
        } else if (key === 'retainedIdDocumentPhotos') {
          formData.append(key, JSON.stringify(admissionData[key]));
        } else {
          formData.append(key, admissionData[key]);
        }
      }
    }
    const response = await leadAxios.put(`/lead/admission/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  getAdmittedStudents: async () => {
    const response = await leadAxios.get('/lead/admissions');
    return response.data;
  },

  deleteAdmittedStudent: async (id) => {
    const response = await leadAxios.delete(`/lead/admission/${id}`);
    return response.data;
  }
};
