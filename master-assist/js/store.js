/**
 * Master Assist — Shared Data Store
 * All data lives in localStorage. Excel export via SheetJS (loaded on demand).
 */
const MA = (function () {

  function load(key, def) {
    try { const r = localStorage.getItem('ma_' + key); return r ? JSON.parse(r) : def; } catch (e) { return def; }
  }
  function save(key, val) {
    try { localStorage.setItem('ma_' + key, JSON.stringify(val)); } catch (e) {}
    return val;
  }
  function nextId(arr) { return arr.length ? Math.max(...arr.map(r => r.id || 0)) + 1 : 1; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function fmt(n) { return '₹' + Number(n).toLocaleString('en-IN'); }

  // ── Empty seed (no hardcoded data) ──────────────────────────────────────────
  const SEED = {
    company: {
      name: '', tagline: '', gstin: '', pan: '', phone: '', email: '', address: '',
      invoicePrefix: 'BILL-', invoiceStart: 1, gstDefault: '18',
      approvalThreshold: 10000, autoApproveBelow: 1000,
      maxFileSizeMB: 10, sessionTimeout: 30, maxLoginAttempts: 5,
      passwordMinLength: 8, retainBackupDays: 30,
    },
    users: [{ id: 1, name: 'Administrator', username: 'admin', password: 'password', mobile: '', email: '', role: 'Admin', pos: 'All POS', lastLogin: '', status: 'active' }],
    centers: [], pos: [], suppliers: [], customers: [],
    categories: [], brands: [], taxes: [], items: [],
    bills: [], purchaseOrders: [], returns: [],
    sales: [], posTerminals: [], payments: [], expenses: [], ledger: [],
    inventory: [], stockTransfers: [], coupons: [], targets: [],
    bookings: [], areas: [], notifications: [], auditLog: [],
    smsTemplates: [], smsSendLog: [], gstFilingHistory: [],
    settings: {
      appearance: { theme: 'light', primaryColor: '#696cff', sidebarCollapsed: false },
      notifications: { billUpload: true, billApproval: true, lowStock: true, paymentReminder: true, emailDigest: false },
    },
  };

  function init() {
    Object.keys(SEED).forEach(function (key) {
      if (localStorage.getItem('ma_' + key) === null) save(key, SEED[key]);
    });
  }

  const API_BASE = 'http://localhost:4000/api';

  function syncRequest(method, endpoint, body) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, API_BASE + endpoint, false);
    xhr.setRequestHeader('Content-Type', 'application/json');
    try {
      xhr.send(body ? JSON.stringify(body) : null);
      if (xhr.status >= 200 && xhr.status < 300) {
        return JSON.parse(xhr.responseText);
      } else {
        var err;
        try { err = JSON.parse(xhr.responseText); } catch(e) { err = { error: xhr.statusText }; }
        alert("Local DB Error: " + (err.error || xhr.statusText));
        throw new Error(err.error);
      }
    } catch(e) {
      if (!xhr.status) {
        alert("Local DB not reachable! Please ensure the local server is running on port 4000.");
      }
      throw e;
    }
  }

  function getAll(key) { 
    if (key === 'items' || key === 'sales') {
        return syncRequest('GET', '/' + key, null);
    }
    return load(key, []); 
  }
  
  function getOne(key, id) { return getAll(key).find(r => r.id === id) || null; }
  
  function set(key, val) { 
    // We strictly should not use MA.set for items or sales as it overwrites the whole array!
    // But if something still does, we just return the value or throw an error.
    if (key === 'items' || key === 'sales') {
        console.warn('Direct MA.set called on ' + key + '. This bypasses DB sync. Use upsert/remove.');
        return val;
    }
    return save(key, val); 
  }

  function upsert(key, record) {
    if (key === 'items' || key === 'sales') {
        if (record.id) {
            return syncRequest('PUT', '/' + key + '/' + record.id, record);
        } else {
            return syncRequest('POST', '/' + key, record);
        }
    }
    const arr = getAll(key);
    const idx = arr.findIndex(r => r.id === record.id);
    if (idx >= 0) arr[idx] = record; else { record.id = record.id || nextId(arr); arr.push(record); }
    save(key, arr); return record;
  }
  
  function remove(key, id) { 
    if (key === 'items' || key === 'sales') {
        return syncRequest('DELETE', '/' + key + '/' + id, null);
    }
    save(key, getAll(key).filter(r => r.id !== id)); 
  }

  // ── Company ─────────────────────────────────────────────────────────────────
  function getCompany() { return load('company', SEED.company); }
  function setCompany(obj) { return save('company', Object.assign(getCompany(), obj)); }

  // ── Notifications ───────────────────────────────────────────────────────────
  function getUnreadCount() { return getAll('notifications').filter(n => n.unread).length; }
  function getPendingBillCount() { return getAll('bills').filter(b => b.status === 'pending').length; }

  // ── Audit ───────────────────────────────────────────────────────────────────
  function addAudit(action, user) {
    const log = getAll('auditLog');
    log.unshift({ id: nextId(log), action, user: user || 'admin', time: new Date().toISOString(), ip: '' });
    if (log.length > 500) log.length = 500;
    save('auditLog', log);
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────
  function dashStats() {
    const bills = getAll('bills'), sales = getAll('sales');
    const todaySales = sales.filter(s => s.date === today()).reduce((a, s) => a + (s.total || 0), 0);
    return {
      totalBills: bills.length,
      pending: bills.filter(b => b.status === 'pending').length,
      approved: bills.filter(b => b.status === 'approved').length,
      rejected: bills.filter(b => b.status === 'rejected').length,
      activePOS: getAll('posTerminals').filter(p => p.status === 'active').length,
      todaySales,
    };
  }

  // ── Excel Export (SheetJS) ───────────────────────────────────────────────────
  function _loadXLSX(cb) {
    if (window.XLSX) { cb(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js';
    s.onload = cb; document.head.appendChild(s);
  }

  /**
   * Export any store key to Excel.
   * @param {string} key  - store key e.g. 'items', 'sales', 'bills'
   * @param {string} [filename] - optional custom filename
   */
  function exportToExcel(key, filename) {
    _loadXLSX(function () {
      const data = getAll(key);
      if (!data.length) { alert('No data to export in "' + key + '"'); return; }
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, key);
      XLSX.writeFile(wb, (filename || key) + '_' + today() + '.xlsx');
    });
  }

  /**
   * Export multiple keys to one Excel workbook (one sheet per key).
   * @param {string[]} keys
   * @param {string} filename
   */
  function exportAllToExcel(keys, filename) {
    _loadXLSX(function () {
      const wb = XLSX.utils.book_new();
      keys.forEach(function (key) {
        const data = getAll(key);
        const ws = XLSX.utils.json_to_sheet(data.length ? data : [{}]);
        XLSX.utils.book_append_sheet(wb, ws, key.slice(0, 31)); // sheet name max 31 chars
      });
      XLSX.writeFile(wb, (filename || 'master_assist_export') + '_' + today() + '.xlsx');
    });
  }

  /**
   * Import rows from an Excel file into a store key.
   * @param {File} file
   * @param {string} key
   * @param {function} [onDone]
   */
  function importFromExcel(file, key, onDone) {
    _loadXLSX(function () {
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws);
          const existing = getAll(key);
          rows.forEach(function (row) {
            if (!row.id) row.id = nextId(existing.concat(rows));
            existing.push(row);
          });
          save(key, existing);
          if (onDone) onDone(rows.length);
        } catch (err) { alert('Import failed: ' + err.message); }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  // ── Public API ───────────────────────────────────────────────────────────────
  return {
    init, load, save, nextId, today, fmt,
    getAll, getOne, set, upsert, remove,
    getCompany, setCompany,
    getUnreadCount, getPendingBillCount,
    addAudit, dashStats,
    exportToExcel, exportAllToExcel, importFromExcel,
    SEED,
  };
})();

MA.init();
