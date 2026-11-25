// ==========================================
// Submission Hub - Offline-First PWA Logic
// ==========================================

const STORAGE_KEYS = {
  STUDENTS: 'subhub_students_v1',
  RECORDS: 'subhub_records_v1',
  THEME: 'subhub_theme_v1'
};

// App State
let students = []; // [{ id: 'N243091', name: 'Student Name' }]
let records = [];  // [{ id, title, createdAt, sortMode: 'entry'|'serial', entries: [{ studentId, date, time, addedIndex }] }]
let activeRecordId = null;

// ==========================================
// Helpers: Batch Detection & BD Time Formatting
// ==========================================
function normalizeId(raw) {
  return String(raw || '').trim().toUpperCase();
}

function getBatchLabel(studentId) {
  const clean = normalizeId(studentId);
  return clean.startsWith('N2430') ? 'ELL-48' : 'Others';
}

function getBangladeshDateTime() {
  const now = new Date();

  // dd/mm/yyyy in Asia/Dhaka
  const dateParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).formatToParts(now);

  const day = dateParts.find(p => p.type === 'day')?.value || '01';
  const month = dateParts.find(p => p.type === 'month')?.value || '01';
  const year = dateParts.find(p => p.type === 'year')?.value || '2026';
  const formattedDate = `${day}/${month}/${year}`;

  // 12-hour format BD time
  const formattedTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(now);

  return { date: formattedDate, time: formattedTime };
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.add('hidden'), 2600);
}

// ==========================================
// Persistence (LocalStorage)
// ==========================================
function loadState() {
  try {
    students = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENTS)) || [];
    records = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECORDS)) || [];
  } catch (e) {
    students = [];
    records = [];
  }

  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
  if (savedTheme === 'dark') {
    document.body.classList.add('dark');
  }
}

function saveStudents() {
  localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  renderStudents();
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
  renderRecordsGrid();
}

// ==========================================
// Tab Navigation & Theme
// ==========================================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

document.getElementById('themeToggleBtn').addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem(STORAGE_KEYS.THEME, document.body.classList.contains('dark') ? 'dark' : 'light');
});

// ==========================================
// SECTION 1: Assignment Notes Grid
// ==========================================
function renderRecordsGrid() {
  const grid = document.getElementById('recordsGrid');
  const empty = document.getElementById('recordsEmpty');
  const badge = document.getElementById('recordsBadge');
  const query = document.getElementById('recordSearchInput').value.trim().toLowerCase();

  badge.textContent = records.length;

  const filtered = records.filter(rec => {
    if (!query) return true;
    const inTitle = rec.title.toLowerCase().includes(query);
    const inEntries = rec.entries.some(e => e.studentId.toLowerCase().includes(query));
    return inTitle || inEntries;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = filtered.map(rec => {
    const previewChips = rec.entries.slice(0, 4).map(e => `<span class="mini-pill">${escapeHtml(e.studentId)}</span>`).join('');
    const moreChip = rec.entries.length > 4 ? `<span class="mini-pill">+${rec.entries.length - 4} more</span>` : '';

    return `
      <article class="note-card" data-record-id="${rec.id}">
        <div>
          <h3 class="note-card-title">${escapeHtml(rec.title || 'Untitled Assignment')}</h3>
          <div class="note-card-meta">Created: ${escapeHtml(rec.createdAt)}</div>
        </div>
        <div class="note-card-preview">
          ${previewChips || '<span class="mini-pill">No entries yet</span>'}
          ${moreChip}
        </div>
        <div class="note-card-footer">
          <span class="note-card-meta">Sort: ${rec.sortMode === 'serial' ? 'Serial ID' : 'Entry Order'}</span>
          <span class="count-badge">Submitted: ${rec.entries.length}</span>
        </div>
      </article>
    `;
  }).join('');

  grid.querySelectorAll('.note-card').forEach(card => {
    card.addEventListener('click', () => openRecordModal(card.dataset.recordId));
  });
}

document.getElementById('recordSearchInput').addEventListener('input', renderRecordsGrid);

// FAB -> Create New Assignment Record Note
document.getElementById('fabNewRecord').addEventListener('click', () => {
  const { date } = getBangladeshDateTime();
  const newRec = {
    id: 'rec_' + Date.now(),
    title: `Assignment #${records.length + 1}`,
    createdAt: date,
    sortMode: 'entry', // 'entry' | 'serial'
    entries: []
  };
  records.unshift(newRec);
  saveRecords();
  openRecordModal(newRec.id, true);
});

// ==========================================
// Assignment Record Workspace Modal
// ==========================================
function openRecordModal(recordId, isBrandNew = false) {
  activeRecordId = recordId;
  const rec = records.find(r => r.id === recordId);
  if (!rec) return;

  const titleInput = document.getElementById('recordTitleInput');
  const idInput = document.getElementById('entryIdInput');

  titleInput.value = rec.title;
  idInput.value = '';
  resetLookupPreview();
  renderRecordEntries();

  document.getElementById('recordModal').classList.remove('hidden');

  if (isBrandNew) {
    titleInput.focus();
    titleInput.select();
  } else {
    idInput.focus();
  }
}

function closeRecordModal() {
  activeRecordId = null;
  document.getElementById('recordModal').classList.add('hidden');
  renderRecordsGrid();
}

document.getElementById('closeRecordModalBtn').addEventListener('click', closeRecordModal);
document.getElementById('doneRecordBtn').addEventListener('click', closeRecordModal);

document.getElementById('recordTitleInput').addEventListener('input', (e) => {
  const rec = records.find(r => r.id === activeRecordId);
  if (!rec) return;
  rec.title = e.target.value;
  saveRecords();
});

document.getElementById('deleteRecordBtn').addEventListener('click', () => {
  if (!activeRecordId) return;
  if (!confirm('Delete this entire assignment record?')) return;
  records = records.filter(r => r.id !== activeRecordId);
  saveRecords();
  closeRecordModal();
  showToast('Assignment record deleted');
});

// Live ID Matching against Local Student Database
const entryIdInput = document.getElementById('entryIdInput');
const confirmAddEntryBtn = document.getElementById('confirmAddEntryBtn');
const lookupPreview = document.getElementById('lookupPreview');

function resetLookupPreview() {
  lookupPreview.className = 'lookup-preview neutral';
  lookupPreview.textContent = 'Type a Student ID to match with local database...';
  confirmAddEntryBtn.disabled = true;
}

entryIdInput.addEventListener('input', () => {
  const typedId = normalizeId(entryIdInput.value);
  const rec = records.find(r => r.id === activeRecordId);

  if (!typedId) {
    resetLookupPreview();
    return;
  }

  const matchedStudent = students.find(s => normalizeId(s.id) === typedId);
  const alreadySubmitted = rec && rec.entries.some(e => normalizeId(e.studentId) === typedId);

  if (!matchedStudent) {
    lookupPreview.className = 'lookup-preview unmatched';
    lookupPreview.innerHTML = `ID <strong>${escapeHtml(typedId)}</strong> not found in Student Database.`;
    confirmAddEntryBtn.disabled = true;
    return;
  }

  const batch = getBatchLabel(matchedStudent.id);
  if (alreadySubmitted) {
    lookupPreview.className = 'lookup-preview duplicate';
    lookupPreview.innerHTML = `⚠ Already added: <strong>${escapeHtml(matchedStudent.name)}</strong> (${batch})`;
    confirmAddEntryBtn.disabled = true;
    return;
  }

  lookupPreview.className = 'lookup-preview matched';
  lookupPreview.innerHTML = `✓ Match: <strong>${escapeHtml(matchedStudent.name)}</strong> <span class="batch-tag ${batch === 'ELL-48' ? 'batch-ell48' : 'batch-others'}">${batch}</span>`;
  confirmAddEntryBtn.disabled = false;
});

entryIdInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !confirmAddEntryBtn.disabled) {
    e.preventDefault();
    addMatchedEntry();
  }
});

confirmAddEntryBtn.addEventListener('click', addMatchedEntry);

function addMatchedEntry() {
  const rec = records.find(r => r.id === activeRecordId);
  if (!rec) return;

  const typedId = normalizeId(entryIdInput.value);
  const matchedStudent = students.find(s => normalizeId(s.id) === typedId);
  if (!matchedStudent) return;

  if (rec.entries.some(e => normalizeId(e.studentId) === typedId)) {
    showToast('Student already recorded in this assignment');
    return;
  }

  const { date, time } = getBangladeshDateTime();
  rec.entries.push({
    studentId: matchedStudent.id,
    date,
    time,
    addedOrder: Date.now()
  });

  saveRecords();
  renderRecordEntries();

  entryIdInput.value = '';
  resetLookupPreview();
  entryIdInput.focus();
  showToast(`Added ${matchedStudent.name}`);
}

// Toggle Sort Order: Entry Order vs Serial ID Order
document.getElementById('toggleSortBtn').addEventListener('click', () => {
  const rec = records.find(r => r.id === activeRecordId);
  if (!rec) return;
  rec.sortMode = rec.sortMode === 'entry' ? 'serial' : 'entry';
  saveRecords();
  renderRecordEntries();
});

function getSortedEntries(rec) {
  const list = [...rec.entries];
  if (rec.sortMode === 'serial') {
    list.sort((a, b) => a.studentId.localeCompare(b.studentId, undefined, { numeric: true }));
  }
  return list;
}

function renderRecordEntries() {
  const rec = records.find(r => r.id === activeRecordId);
  if (!rec) return;

  const tbody = document.getElementById('entriesTableBody');
  const empty = document.getElementById('entriesEmpty');
  const totalEl = document.getElementById('modalTotalCount');
  const sortLabel = document.getElementById('sortModeLabel');

  totalEl.textContent = rec.entries.length;
  sortLabel.textContent = rec.sortMode === 'serial' ? 'Serial ID (A→Z)' : 'Entry Order';

  if (rec.entries.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  const sorted = getSortedEntries(rec);

  tbody.innerHTML = sorted.map((entry, idx) => {
    const stu = students.find(s => normalizeId(s.id) === normalizeId(entry.studentId));
    const displayName = stu ? stu.name : '(Removed from DB)';
    const batch = getBatchLabel(entry.studentId);

    return `
      <tr>
        <td><strong>${idx + 1}</strong></td>
        <td>
          <div style="font-family: monospace; font-weight: 700;">${escapeHtml(entry.studentId)}</div>
          <span class="batch-tag ${batch === 'ELL-48' ? 'batch-ell48' : 'batch-others'}">${batch}</span>
        </td>
        <td>${escapeHtml(displayName)}</td>
        <td>${escapeHtml(entry.date)}</td>
        <td>${escapeHtml(entry.time)}</td>
        <td style="text-align: right;">
          <button class="mini-icon-btn del" data-remove-id="${escapeHtml(entry.studentId)}" title="Remove Entry">✕</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-remove-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.removeId;
      rec.entries = rec.entries.filter(e => normalizeId(e.studentId) !== normalizeId(targetId));
      saveRecords();
      renderRecordEntries();
      showToast(`Removed ${targetId}`);
    });
  });
}

// Export Individual Assignment to Excel
document.getElementById('exportRecordBtn').addEventListener('click', () => {
  const rec = records.find(r => r.id === activeRecordId);
  if (!rec || rec.entries.length === 0) {
    showToast('No entries to export');
    return;
  }
  if (typeof XLSX === 'undefined') {
    showToast('Excel library unavailable offline');
    return;
  }

  const sorted = getSortedEntries(rec);
  const rows = sorted.map((entry, idx) => {
    const stu = students.find(s => normalizeId(s.id) === normalizeId(entry.studentId));
    return {
      'Sl No.': idx + 1,
      'Student ID': entry.studentId,
      'Batch': getBatchLabel(entry.studentId),
      'Name': stu ? stu.name : 'Unknown',
      'Submitted Date': entry.date,
      'Time (BD)': entry.time
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Submissions');
  const safeFilename = (rec.title || 'Assignment_Submissions').replace(/[^a-z0-9_\-]/gi, '_') + '.xlsx';
  XLSX.writeFile(wb, safeFilename);
});

// ==========================================
// SECTION 2: Master Student Database
// ==========================================
function renderStudents() {
  const tbody = document.getElementById('studentsTableBody');
  const empty = document.getElementById('studentsEmpty');
  const badge = document.getElementById('studentsBadge');
  const summary = document.getElementById('studentCountSummary');

  const query = document.getElementById('studentSearchInput').value.trim().toLowerCase();
  const batchFilter = document.getElementById('batchFilterSelect').value;

  badge.textContent = students.length;

  const filtered = students.filter(stu => {
    const batch = getBatchLabel(stu.id);
    if (batchFilter !== 'ALL' && batch !== batchFilter) return false;
    if (!query) return true;
    return (
      stu.id.toLowerCase().includes(query) ||
      stu.name.toLowerCase().includes(query) ||
      batch.toLowerCase().includes(query)
    );
  });

  summary.textContent = `Showing ${filtered.length} of ${students.length} students`;

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  tbody.innerHTML = filtered.map((stu, idx) => {
    const batch = getBatchLabel(stu.id);
    return `
      <tr>
        <td>${idx + 1}</td>
        <td style="font-family: monospace; font-weight: 700;">${escapeHtml(stu.id)}</td>
        <td><span class="batch-tag ${batch === 'ELL-48' ? 'batch-ell48' : 'batch-others'}">${batch}</span></td>
        <td>${escapeHtml(stu.name)}</td>
        <td>
          <div class="row-actions">
            <button class="mini-icon-btn" data-edit-stu="${escapeHtml(stu.id)}" title="Edit">Edit</button>
            <button class="mini-icon-btn del" data-del-stu="${escapeHtml(stu.id)}" title="Delete">✕</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-edit-stu]').forEach(btn => {
    btn.addEventListener('click', () => openStudentModal(btn.dataset.editStu));
  });

  tbody.querySelectorAll('[data-del-stu]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.delStu;
      if (!confirm(`Remove student ${targetId} from database?`)) return;
      students = students.filter(s => normalizeId(s.id) !== normalizeId(targetId));
      saveStudents();
      showToast(`Removed ${targetId}`);
    });
  });
}

document.getElementById('studentSearchInput').addEventListener('input', renderStudents);
document.getElementById('batchFilterSelect').addEventListener('change', renderStudents);

document.getElementById('clearAllStudentsBtn').addEventListener('click', () => {
  if (students.length === 0) return;
  if (!confirm('Clear the entire local student database?')) return;
  students = [];
  saveStudents();
  showToast('Student database cleared');
});

// Excel Import (.xlsx, .xls, .csv)
document.getElementById('excelFileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (typeof XLSX === 'undefined') {
    showToast('Excel parser not loaded yet. Connect once to cache offline.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      let importedCount = 0;
      let updatedCount = 0;

      rawRows.forEach(row => {
        // Match flexible column headers (Sl No., ID, Name)
        const keys = Object.keys(row);
        const idKey = keys.find(k => /^(student\s*)?id$/i.test(k.trim())) || keys[1];
        const nameKey = keys.find(k => /^(student\s*)?name$/i.test(k.trim())) || keys[2];

        const cleanId = normalizeId(row[idKey]);
        const cleanName = String(row[nameKey] || '').trim();

        if (!cleanId || !cleanName) return;

        const existingIndex = students.findIndex(s => normalizeId(s.id) === cleanId);
        if (existingIndex >= 0) {
          students[existingIndex].name = cleanName;
          updatedCount++;
        } else {
          students.push({ id: cleanId, name: cleanName });
          importedCount++;
        }
      });

      saveStudents();
      showToast(`Imported ${importedCount} new, updated ${updatedCount}`);
    } catch (err) {
      console.error(err);
      showToast('Failed to read Excel file');
    } finally {
      e.target.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
});

// Export Student Database to Excel
document.getElementById('exportStudentsBtn').addEventListener('click', () => {
  if (students.length === 0) {
    showToast('Student database is empty');
    return;
  }
  const rows = students.map((s, idx) => ({
    'Sl No.': idx + 1,
    'ID': s.id,
    'Batch': getBatchLabel(s.id),
    'Name': s.name
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students');
  XLSX.writeFile(wb, 'Student_Database.xlsx');
});

// Add / Edit Single Student Modal
const studentModal = document.getElementById('studentModal');
const studentIdField = document.getElementById('studentIdField');
const studentNameField = document.getElementById('studentNameField');
const editStudentOriginalId = document.getElementById('editStudentOriginalId');
const batchAutoPreview = document.getElementById('batchAutoPreview');

function openStudentModal(existingId = null) {
  if (existingId) {
    const stu = students.find(s => normalizeId(s.id) === normalizeId(existingId));
    if (!stu) return;
    document.getElementById('studentModalTitle').textContent = 'Edit Student';
    editStudentOriginalId.value = stu.id;
    studentIdField.value = stu.id;
    studentNameField.value = stu.name;
  } else {
    document.getElementById('studentModalTitle').textContent = 'Add Student';
    editStudentOriginalId.value = '';
    studentIdField.value = '';
    studentNameField.value = '';
  }
  updateBatchPreview();
  studentModal.classList.remove('hidden');
  studentIdField.focus();
}

function updateBatchPreview() {
  const val = normalizeId(studentIdField.value);
  if (!val) {
    batchAutoPreview.textContent = 'Batch tag will auto-detect (N2430** → ELL-48)';
    return;
  }
  const tag = getBatchLabel(val);
  batchAutoPreview.innerHTML = `Detected Batch: <strong>${tag}</strong>`;
}

studentIdField.addEventListener('input', updateBatchPreview);

document.getElementById('addStudentBtn').addEventListener('click', () => openStudentModal(null));
document.getElementById('closeStudentModalBtn').addEventListener('click', () => studentModal.classList.add('hidden'));
document.getElementById('cancelStudentModalBtn').addEventListener('click', () => studentModal.classList.add('hidden'));

document.getElementById('studentForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const newId = normalizeId(studentIdField.value);
  const newName = studentNameField.value.trim();
  const origId = normalizeId(editStudentOriginalId.value);

  if (!newId || !newName) return;

  if (origId) {
    // Editing existing
    const idx = students.findIndex(s => normalizeId(s.id) === origId);
    if (idx >= 0) {
      students[idx] = { id: newId, name: newName };
    }
    // Also update ID references inside assignment records if ID changed
    if (origId !== newId) {
      records.forEach(r => {
        r.entries.forEach(entry => {
          if (normalizeId(entry.studentId) === origId) {
            entry.studentId = newId;
          }
        });
      });
      saveRecords();
    }
    showToast('Student updated');
  } else {
    // Adding new
    if (students.some(s => normalizeId(s.id) === newId)) {
      showToast('A student with this ID already exists!');
      return;
    }
    students.push({ id: newId, name: newName });
    showToast('Student added');
  }

  saveStudents();
  studentModal.classList.add('hidden');
});

// ==========================================
// SECTION 3: JSON Backup & Restore
// ==========================================
const backupModal = document.getElementById('backupModal');
document.getElementById('backupMenuBtn').addEventListener('click', () => backupModal.classList.remove('hidden'));
document.getElementById('closeBackupModalBtn').addEventListener('click', () => backupModal.classList.add('hidden'));

document.getElementById('downloadJsonBackupBtn').addEventListener('click', () => {
  const payload = {
    app: 'SubmissionHub',
    exportedAt: new Date().toISOString(),
    students,
    records
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SubmissionHub_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('JSON backup downloaded');
});

document.getElementById('restoreJsonInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const parsed = JSON.parse(evt.target.result);
      if (Array.isArray(parsed.students)) students = parsed.students;
      if (Array.isArray(parsed.records)) records = parsed.records;
      saveStudents();
      saveRecords();
      backupModal.classList.add('hidden');
      showToast('Backup restored successfully');
    } catch (err) {
      showToast('Invalid JSON backup file');
    } finally {
      e.target.value = '';
    }
  };
  reader.readAsText(file);
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ==========================================
// Service Worker Registration & Init
// ==========================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

loadState();
renderStudents();
renderRecordsGrid();
