// officialService.js
// Module 7: Officials Registration

const OFFICIALS_STORAGE_KEY = 'cricket_officials';

// Default mock data
const INITIAL_OFFICIALS = [
  { id: 'O1001', name: 'R. Srinivasan', phone: '9443011111', email: 'srini@example.com', type: 'Umpire', qualification: 'Level 2', district: 'Virudhunagar', experience: '5 Years', status: 'Active', photo: '' },
  { id: 'O1002', name: 'M. Karthik', phone: '9443022222', email: 'karthik@example.com', type: 'Scorer', qualification: 'State Panel', district: 'Madurai', experience: '3 Years', status: 'Active', photo: '' }
];

if (!localStorage.getItem(OFFICIALS_STORAGE_KEY)) {
  localStorage.setItem(OFFICIALS_STORAGE_KEY, JSON.stringify(INITIAL_OFFICIALS));
}

const OfficialService = {
  getAll: () => JSON.parse(localStorage.getItem(OFFICIALS_STORAGE_KEY) || '[]'),
  
  save: (data) => localStorage.setItem(OFFICIALS_STORAGE_KEY, JSON.stringify(data)),
  
  add: (official) => {
    const all = OfficialService.getAll();
    
    // Validation: unique phone/email
    if (all.some(o => o.phone === official.phone)) {
      throw new Error("An official with this phone number is already registered.");
    }
    if (all.some(o => o.email.toLowerCase() === official.email.toLowerCase())) {
      throw new Error("An official with this email address is already registered.");
    }
    
    official.id = 'O' + Date.now();
    all.push(official);
    OfficialService.save(all);
    return official;
  },

  update: (id, updatedData) => {
    const all = OfficialService.getAll();
    const idx = all.findIndex(o => o.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...updatedData };
      OfficialService.save(all);
    }
  },

  delete: (id) => {
    const all = OfficialService.getAll();
    const filtered = all.filter(o => o.id !== id);
    OfficialService.save(filtered);
  }
};

// --- UI Logic ---
let editingOfficialId = null;

function openOfficialRegistrationModal(id = null) {
  document.getElementById('officialRegistrationModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  const form = document.getElementById('officialRegForm');
  form.reset();
  
  if (id) {
    editingOfficialId = id;
    document.getElementById('modalOfficialTitle').innerText = 'Edit Official';
    const official = OfficialService.getAll().find(o => o.id === id);
    if (official) {
      document.getElementById('off_name').value = official.name;
      document.getElementById('off_phone').value = official.phone;
      document.getElementById('off_email').value = official.email;
      document.getElementById('off_type').value = official.type;
      document.getElementById('off_qual').value = official.qualification;
      document.getElementById('off_dist').value = official.district;
      document.getElementById('off_exp').value = official.experience;
      document.getElementById('off_status').value = official.status;
    }
  } else {
    editingOfficialId = null;
    document.getElementById('modalOfficialTitle').innerText = 'Register Official';
  }
}

function closeOfficialRegistrationModal() {
  document.getElementById('officialRegistrationModal').style.display = 'none';
  document.body.style.overflow = '';
}

function handleOfficialSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('off_name').value.trim();
  const phone = document.getElementById('off_phone').value.trim();
  const email = document.getElementById('off_email').value.trim();
  const type = document.getElementById('off_type').value;
  const qualification = document.getElementById('off_qual').value.trim();
  const district = document.getElementById('off_dist').value.trim();
  const experience = document.getElementById('off_exp').value.trim();
  const status = document.getElementById('off_status').value;
  const photo = document.getElementById('off_photo').value; // Just the filename mock for now

  const data = { name, phone, email, type, qualification, district, experience, status, photo };

  try {
    if (editingOfficialId) {
      const all = OfficialService.getAll();
      const other = all.find(o => o.id !== editingOfficialId && (o.phone === phone || o.email.toLowerCase() === email.toLowerCase()));
      if (other) {
        alert("Another official with this phone or email already exists.");
        return;
      }
      OfficialService.update(editingOfficialId, data);
      alert('Official updated successfully!');
    } else {
      OfficialService.add(data);
      if (type && type.toLowerCase().includes('scorer')) {
        const API_BASE = (function () {
          if (typeof window !== 'undefined' && window.REACT_APP_API_URL) return window.REACT_APP_API_URL.replace(/\/+$/, '') + '/api';
          if (typeof window !== 'undefined' && window.location) {
            if (window.location.port === '80' || window.location.port === '' || window.location.port === '443') return '/api';
            return `http://${window.location.hostname}:5000/api`;
          }
          return '/api';
        })();
        fetch(`${API_BASE}/auth/register-scorer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, mobile: phone, taluk: district })
        }).catch(e => console.warn('Official MongoDB sync note:', e));
      }
      alert('Official registered successfully and submitted for Admin clearance!');
    }
    closeOfficialRegistrationModal();
    if (document.getElementById('officialListingModal').style.display === 'flex') {
      renderOfficialListing();
    }
  } catch (err) {
    alert(err.message);
  }
}

// --- Listing UI ---
function openOfficialListingModal() {
  document.getElementById('officialListingModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  renderOfficialListing();
}

function closeOfficialListingModal() {
  document.getElementById('officialListingModal').style.display = 'none';
  document.body.style.overflow = '';
}

function renderOfficialListing() {
  const typeFilter = document.getElementById('offFilter_type').value;
  const searchTerm = document.getElementById('offFilter_search').value.toLowerCase();
  
  let officials = OfficialService.getAll();
  
  if (typeFilter) officials = officials.filter(o => o.type === typeFilter);
  if (searchTerm) officials = officials.filter(o => o.name.toLowerCase().includes(searchTerm) || o.phone.includes(searchTerm));
  
  const tbody = document.getElementById('officialListingTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (officials.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 20px;">No officials found.</td></tr>';
    return;
  }
  
  officials.forEach(o => {
    let typeIcon = 'fa-user';
    if (o.type === 'Umpire') typeIcon = 'fa-hand-paper';
    if (o.type === 'Scorer') typeIcon = 'fa-calculator';
    if (o.type === 'Match Referee') typeIcon = 'fa-gavel';
    
    const typeBadge = `<span style="background:rgba(255,255,255,0.1); padding:3px 8px; border-radius:4px; font-size:11px;"><i class="fa-solid ${typeIcon}"></i> ${o.type}</span>`;
    const statusBadge = o.status === 'Active' ? '<span style="color:#81c784;"><i class="fa-solid fa-circle-check"></i> Active</span>' : '<span style="color:#e57373;"><i class="fa-solid fa-circle-xmark"></i> Inactive</span>';
    
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
    tr.innerHTML = `
      <td style="padding:8px;"><strong>${o.name}</strong><br><small style="color:#aaa;">${o.id}</small></td>
      <td style="padding:8px;">${typeBadge}</td>
      <td style="padding:8px;">${o.phone}<br><small style="color:#aaa;">${o.email}</small></td>
      <td style="padding:8px;">${o.district}</td>
      <td style="padding:8px;">${o.qualification}<br><small style="color:#aaa;">${o.experience}</small></td>
      <td style="padding:8px;">${statusBadge}</td>
      <td style="padding:8px;">
        <button class="btn btn-sm btn-outline-primary" style="padding:3px 8px;" onclick="openOfficialRegistrationModal('${o.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-sm btn-outline-primary" style="padding:3px 8px; color:#ff6b6b; border-color:#ff6b6b;" onclick="deleteOfficial('${o.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function deleteOfficial(id) {
  if (confirm("Are you sure you want to delete this official?")) {
    OfficialService.delete(id);
    renderOfficialListing();
  }
}

// Bind modal close events
document.addEventListener('DOMContentLoaded', () => {
  ['officialRegistrationModal', 'officialListingModal'].forEach(modalId => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
          document.body.style.overflow = '';
        }
      });
    }
  });
});
