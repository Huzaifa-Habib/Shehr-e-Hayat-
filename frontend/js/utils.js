/**
 * utils.js — Shared UI Helpers, Auth Guards, and Formatters
 */

'use strict';

const Utils = {
  /**
   * Show a dynamic toast notification in the UI.
   * @param {string} message - Message to display
   * @param {'success' | 'error' | 'warning' | 'info'} type - Type of notification
   * @param {number} duration - Time in ms to display
   */
  showToast(message, type = 'info', duration = 4000) {
    // Check if toast container exists, create if not
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `p-4 rounded-lg shadow-lg text-white font-medium flex items-center gap-3 pointer-events-auto transform translate-y-2 opacity-0 transition-all duration-300 ease-out`;
    
    // Choose colors based on type
    let bgColor = 'bg-slate-800';
    let iconName = 'info';
    if (type === 'success') {
      bgColor = 'bg-emerald-600';
      iconName = 'check_circle';
    } else if (type === 'error') {
      bgColor = 'bg-rose-600';
      iconName = 'error';
    } else if (type === 'warning') {
      bgColor = 'bg-amber-500 text-slate-900';
      iconName = 'warning';
    }

    toast.className += ` ${bgColor}`;
    toast.innerHTML = `
      <span class="material-symbols-outlined shrink-0">${iconName}</span>
      <div class="flex-1 text-sm">${message}</div>
      <button class="text-white hover:opacity-80 ml-auto shrink-0 focus:outline-none" onclick="this.parentElement.remove()">
        <span class="material-symbols-outlined text-sm">close</span>
      </button>
    `;

    container.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    // Auto remove
    setTimeout(() => {
      toast.classList.add('translate-y-2', 'opacity-0');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  /**
   * Get active user info from localStorage
   * @returns {Object|null} User data
   */
  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch (e) {
      return null;
    }
  },

  /**
   * Get active auth token
   * @returns {string|null} JWT token
   */
  getToken() {
    return localStorage.getItem('token');
  },

  /**
   * Log out active user and clear session
   */
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    Utils.showToast('Logged out successfully. Redirecting...', 'success');
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 1000);
  },

  /**
   * Guard a protected route to only allow specific roles.
   * Redirects unauthorized users to the landing page or login page.
   * @param {string[]} allowedRoles - Roles allowed (e.g. ['super_admin', 'donor'])
   */
  requireAuth(allowedRoles = []) {
    const token = Utils.getToken();
    const user = Utils.getCurrentUser();

    if (!token || !user) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
      return false;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      Utils.showToast('Access Denied. Redirecting to authorized dashboard...', 'error');
      setTimeout(() => {
        Utils.redirectToDashboard(user.role);
      }, 1500);
      return false;
    }

    return true;
  },

  /**
   * Guard login/register pages to redirect logged in users.
   */
  redirectIfLoggedIn() {
    const token = Utils.getToken();
    const user = Utils.getCurrentUser();
    if (token && user) {
      Utils.redirectToDashboard(user.role);
    }
  },

  /**
   * Redirect user based on their dashboard role.
   * @param {string} role - User role
   */
  redirectToDashboard(role) {
    if (role === 'super_admin') {
      window.location.href = '/super-admin-dashboard.html';
    } else if (role === 'blood_bank_admin') {
      window.location.href = '/bank-admin-dashboard.html';
    } else if (role === 'hospital_admin') {
      window.location.href = '/hospital-admin-dashboard.html';
    } else if (role === 'donor') {
      window.location.href = '/donor-dashboard.html';
    } else {
      window.location.href = '/';
    }
  },

  /**
   * Format Date to readable Karachi timezone / local format
   * @param {string|Date} dateStr - Date representation
   * @returns {string} Formatted string
   */
  formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  /**
   * Capitalize or beautify blood type strings (e.g., O_negative -> O-)
   * @param {string} type - Blood type from backend DB
   * @returns {string} Formatted blood type
   */
  formatBloodType(type) {
    if (!type) return 'N/A';
    return type
      .replace('_positive', '+')
      .replace('_negative', '-')
      .replace('O_pos', 'O+')
      .replace('O_neg', 'O-');
  },

  /**
   * Map blood type display back to DB format (e.g., O- -> O_negative)
   */
  toDbBloodType(type) {
    if (!type) return '';
    return type
      .trim()
      .replace('+', '_positive')
      .replace('-', '_negative');
  }
};

// Auto-wire logout button if present on page load
document.addEventListener('DOMContentLoaded', () => {
  const logoutButtons = document.querySelectorAll('[data-action="logout"], [data-logout], a[href="#"][class*="logout"]');
  logoutButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      Utils.logout();
    });
  });
});
