/**
 * api.js — Centralized API Fetch Module
 * Communicates with the Karachi Blood Bank backend relative routes.
 */

'use strict';

const API = (() => {
  const BASE_URL = '/api';

  /**
   * Helper function to issue Fetch requests
   * @param {string} endpoint - API endpoint relative to /api
   * @param {string} method - HTTP Verb
   * @param {Object} [body=null] - Request Payload
   * @returns {Promise<Object>} Backend response JSON
   */
  async function request(endpoint, method = 'GET', body = null) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };

    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      method,
      headers
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, config);
      const json = await response.json();

      if (!response.ok) {
        // Build readable error message
        const err = new Error(json.message || 'An error occurred while calling the API.');
        err.status = response.status;
        err.errors = json.errors || [];
        throw err;
      }

      return json;
    } catch (error) {
      console.error(`API Error on ${method} ${endpoint}:`, error);
      throw error;
    }
  }

  return {
    // ─── Authentication ────────────────────────────────────────────────────────
    async login(email, password) {
      const response = await request('/auth/login', 'POST', { email, password });
      if (response.success && response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      return response;
    },

    async register(name, email, phone, password, bloodType) {
      const response = await request('/auth/register', 'POST', {
        name,
        email,
        phone,
        password,
        bloodType
      });
      if (response.success && response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      return response;
    },

    async getMe() {
      return request('/auth/me');
    },

    // ─── Blood Banks ───────────────────────────────────────────────────────────
    async getBloodBanks(search = '') {
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      return request(`/bloodbanks${query}`);
    },

    async getBloodBank(id) {
      return request(`/bloodbanks/${id}`);
    },

    async updateInventory(bankId, bloodType, units) {
      return request(`/bloodbanks/${bankId}/inventory`, 'PUT', { bloodType, units });
    },

    async createBloodBank(data) {
      return request('/bloodbanks', 'POST', data);
    },

    async toggleBloodBankStatus(id) {
      return request(`/bloodbanks/${id}/status`, 'PATCH');
    },

    // ─── Blood Search ──────────────────────────────────────────────────────────
    async searchBlood(bloodType, neighborhood = '') {
      let query = `?bloodType=${encodeURIComponent(bloodType)}`;
      if (neighborhood && neighborhood !== 'All Regions') {
        query += `&neighborhood=${encodeURIComponent(neighborhood)}`;
      }
      return request(`/blood/search${query}`);
    },

    async getCriticalShortages() {
      return request('/blood/critical');
    },

    async getMapData() {
      return request('/blood/map');
    },

    // ─── Blood Requests ────────────────────────────────────────────────────────
    async getAllRequests() {
      return request('/requests');
    },

    async getRequest(id) {
      return request(`/requests/${id}`);
    },

    async createRequest(data) {
      return request('/requests', 'POST', data);
    },

    async updateRequest(id, data) {
      return request(`/requests/${id}`, 'PATCH', data);
    },

    async deleteRequest(id) {
      return request(`/requests/${id}`, 'DELETE');
    },

    // ─── Appointments ─────────────────────────────────────────────────────────
    async bookAppointment(bloodBankId, scheduledDate, bloodType, notes = '') {
      return request('/appointments', 'POST', { bloodBankId, scheduledDate, bloodType, notes });
    },

    async getMyAppointments() {
      return request('/appointments/my');
    },

    async getBankAppointments(bankId) {
      return request(`/appointments/bank/${bankId}`);
    },

    async updateAppointmentStatus(appointmentId, status) {
      return request(`/appointments/${appointmentId}/status`, 'PATCH', { status });
    },

    // ─── Super Admin Controls ─────────────────────────────────────────────────
    async getAllUsers(filters = {}) {
      let query = '?';
      if (filters.role) query += `role=${filters.role}&`;
      if (filters.verified !== undefined) query += `verified=${filters.verified}&`;
      if (filters.search) query += `search=${encodeURIComponent(filters.search)}&`;
      if (filters.page) query += `page=${filters.page}&`;
      if (filters.limit) query += `limit=${filters.limit}&`;
      return request(`/admin/users${query}`);
    },

    async createHospital(data) {
      return request('/admin/hospitals', 'POST', data);
    },

    async getAuditLogs(filters = {}) {
      let query = '?';
      if (filters.action) query += `action=${filters.action}&`;
      if (filters.userId) query += `userId=${filters.userId}&`;
      if (filters.from) query += `from=${filters.from}&`;
      if (filters.to) query += `to=${filters.to}&`;
      if (filters.page) query += `page=${filters.page}&`;
      if (filters.limit) query += `limit=${filters.limit}&`;
      return request(`/admin/logs${query}`);
    },

    async verifyUser(userId) {
      return request(`/admin/users/${userId}/verify`, 'PATCH');
    }
  };
})();
