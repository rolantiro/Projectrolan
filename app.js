// =====================================================
// SIMRS - Sistem Informasi Rekam Medis
// Login & Authentication System
// =====================================================

// Mock user database
const userDatabase = [
    { username: 'admin', password: 'admin123', role: 'Administrator', fullName: 'Admin' },
    { username: 'loket', password: 'loket123', role: 'Petugas Loket', fullName: 'Ngabey Mukti W' },
    { username: 'dokter', password: 'dokter123', role: 'Dokter', fullName: 'Dr. Budi Santoso' },
    { username: 'koder', password: 'koder123', role: 'Koder', fullName: 'Siti Koders' },
    { username: 'arsip', password: 'arsip123', role: 'Arsiparis', fullName: 'Ari Parisky' }
];

// Session management
let currentSession = null;
const REGISTRASI_DRAFT_KEY = 'simrsRegistrasiDraft';
const ANTREAN_DATA_KEY = 'simrsAntreanData';
let antreanData = [];
let currentPatient = null;
let icd10Data = [];
let icd9Data = [];
let icd9Hierarchy = [];
let icd9SearchData = [];  // Flattened data for quick search
let icdData = [];
let currentIcdVersion = 'ICD-10';
let icdDataLoaded = false;
const icd10FallbackData = [
    { code: 'A09', description: 'Diare dan gastroenteritis asal usul yang tidak diketahui' },
    { code: 'B34', description: 'Virus lain dari saluran pernapasan atas yang tidak diklasifikasikan di tempat lain' },
    { code: 'C34', description: 'Kanker bronkus dan paru-paru' },
    { code: 'D50', description: 'Anemia defisiensi besi' },
    { code: 'E11', description: 'Diabetes mellitus tipe 2' },
    { code: 'F32', description: 'Episode depresi mayor' },
    { code: 'F41', description: 'Gangguan kecemasan' },
    { code: 'G40', description: 'Epilepsi dan kejang' },
    { code: 'H10', description: 'Konjungtivitis akut' },
    { code: 'I10', description: 'Hipertensi esensial (primer)' },
    { code: 'I20', description: 'Angina pektoris' },
    { code: 'I21', description: 'Infark miokard akut' },
    { code: 'I63', description: 'Infark serebri' },
    { code: 'J00', description: 'Rinitis akut tanpa spesifikasi' },
    { code: 'J18', description: 'Pneumonia, organisme yang tidak diklasifikasikan di tempat lain' },
    { code: 'J45', description: 'Asma' },
    { code: 'K35', description: 'Apendisitis akut' },
    { code: 'K80', description: 'Batu empedu' },
    { code: 'L03', description: 'Selulitis' },
    { code: 'M16', description: 'Osteoartritis panggul' },
    { code: 'N39', description: 'Infeksi saluran kemih' },
    { code: 'N80', description: 'Endometriosis' },
    { code: 'O80', description: 'Persalinan normal' },
    { code: 'R50', description: 'Demam yang tidak diklasifikasikan di tempat lain' },
    { code: 'R51', description: 'Sakit kepala' },
    { code: 'S06', description: 'Trauma intrakranial' }
];

const icd9FallbackData = [
    { code: '00.01', description: 'Therapeutic ultrasound of vessels of head and neck' },
    { code: '00.02', description: 'Therapeutic ultrasound of heart' },
    { code: '00.10', description: 'Implantation of chemotherapeutic agent' },
    { code: '00.40', description: 'Procedure on single vessel' },
    { code: '00.45', description: 'Insertion of one vascular stent' },
    { code: '01.01', description: 'Burr holes with aspiration of hematoma' },
    { code: '02.13', description: 'Needle aspiration of cranial cavity' },
    { code: '03.21', description: 'Lumbar puncture' },
    { code: '04.01', description: 'Incision of common bile duct' },
    { code: '04.31', description: 'Amputation of finger' },
    { code: '06.02', description: 'Endoscopic polypectomy of small intestine' },
    { code: '08.01', description: 'Excision of lacrimal gland' },
    { code: '09.41', description: 'Parotidectomy' },
    { code: '10.01', description: 'Aspiration of aqueous humor' },
    { code: '11.49', description: 'Repair of retinal detachment' },
    { code: '13.41', description: 'Mechanical vitrectomy' },
    { code: '14.74', description: 'Revision of external fixation device' },
    { code: '15.01', description: 'Diagnostic esophagoscopy' },
    { code: '16.01', description: 'Esophageal myotomy' },
    { code: '17.31', description: 'Gastroscopic removal of foreign body from stomach' }
];

const selectedIcdData = {
    utama: null,
    sekunder: []
};

// Initialize app on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadSessionIfExists();
    restoreRegistrasiDraft();
    restoreAntreanData();
    loadIcdData();
});

/**
 * Initialize the application
 */
function initializeApp() {
    // Check if user has active session
    const savedSession = sessionStorage.getItem('simrsSession');
    if (savedSession) {
        try {
            currentSession = JSON.parse(savedSession);
            showMainApp();
            updateUserInfo();
        } catch (e) {
            showLoginPage();
        }
    } else {
        showLoginPage();
    }
}

function flattenIcd9Nodes(nodes) {
    const entries = [];
    nodes.forEach(node => {
        if (node.code && node.desc) {
            entries.push({ code: node.code, description: node.desc });
        }
        if (Array.isArray(node.children) && node.children.length) {
            entries.push(...flattenIcd9Nodes(node.children));
        }
    });
    return entries;
}

function loadIcdData() {
    // ICD-9-CM procedure data source is explicitly loaded from procedure_codes.json
    const icd9Promise = typeof icdDataList !== 'undefined' && Array.isArray(icdDataList)
        ? Promise.resolve(icdDataList.map(item => ({ code: item.code, description: item.description })))
        : fetch('procedure_codes.json')
        .then(response => {
            console.log('ICD-9 fetch response status:', response.status, response.statusText);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('ICD-9 data loaded successfully, items:', Array.isArray(data) ? data.length : 'not array');
            icd9Hierarchy = data;
            const flatData = flattenIcd9Nodes(data);
            console.log('ICD-9 flattened data count:', flatData.length);
            icd9SearchData = flatData.map(item => ({
                code: item.code,
                description: item.description,
                type: 'procedure'
            }));
            return flatData;
        })
        .catch(error => {
            console.error('ICD-9 data load failed:', error.message);
            showToast('Gagal memuat data ICD-9-CM lokal; menggunakan dataset ringkas', 'warning');
            icd9Hierarchy = [];
            return icd9FallbackData;
        });

    const icd10Promise = typeof icdDataList !== 'undefined' && Array.isArray(icdDataList)
        ? Promise.resolve(icdDataList.map(item => ({ code: item.code, description: item.description })))
        : fetch('decoded_data.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load ICD data');
                }
                return response.json();
            })
            .then(data => {
                const entries = [];
                data.forEach(group => {
                    if (Array.isArray(group.codes)) {
                        group.codes.forEach(code => {
                            if (code.code && code.desc) {
                                entries.push({ code: code.code, description: code.desc });
                            }
                        });
                    }
                });
                return entries;
            })
            .catch(error => {
                console.error('ICD-10 data load failed:', error);
                showToast('Gagal memuat data ICD-10 lokal; menggunakan dataset ringkas', 'warning');
                return icd10FallbackData;
            });

    Promise.all([icd10Promise, icd9Promise]).then(([loadedIcd10, loadedIcd9]) => {
        icd10Data = loadedIcd10;
        icd9Data = loadedIcd9;
        finalizeIcdLoad();
    });
}

function switchIcdVersion() {
    const select = document.getElementById('icdVersionSelect');
    if (!select) return;

    currentIcdVersion = select.value;
    icdData = currentIcdVersion === 'ICD-9-CM' ? icd9Data : icd10Data;
    const versionLabel = currentIcdVersion === 'ICD-9-CM' ? 'ICD-9-CM' : 'ICD-10';
    document.getElementById('icdSearchUtama').placeholder = `Ketik kode atau nama ${currentIcdVersion === 'ICD-9-CM' ? 'prosedur' : 'penyakit'} (${versionLabel})...`;
    document.getElementById('icdSearchSekunder').placeholder = `Tambah ${currentIcdVersion === 'ICD-9-CM' ? 'prosedur' : 'diagnosis'} sekunder (${versionLabel})...`;
    document.getElementById('icdDropdownUtama').innerHTML = '';
    document.getElementById('icdDropdownSekunder').innerHTML = '';

    const codingTitle = document.getElementById('codingPanelTitle');
    const codingDescription = document.getElementById('codingDescription');
    const utamaHeading = document.getElementById('utamaHeading');
    const sekunderHeading = document.getElementById('sekunderHeading');
    if (codingTitle) {
        codingTitle.innerHTML = `<i class="fas fa-tags"></i> Input Kode ${currentIcdVersion === 'ICD-9-CM' ? 'Prosedur' : 'Diagnosa'}`;
    }
    if (codingDescription) {
        codingDescription.textContent = currentIcdVersion === 'ICD-9-CM'
            ? 'Gunakan navigator ICD-9-CM untuk memilih kode prosedur. Cari diagnosis ICD-10 jika Anda memilih ICD-10.'
            : 'Gunakan pencarian ICD-10 untuk memilih kode diagnosis. Navigator prosedur hanya tersedia di ICD-9-CM.';
    }
    if (utamaHeading) {
        utamaHeading.innerHTML = `<i class="fas fa-star"></i> ${currentIcdVersion === 'ICD-9-CM' ? 'Prosedur Utama' : 'Diagnosis Utama'} (Prioritas 1)`;
    }
    if (sekunderHeading) {
        sekunderHeading.innerHTML = `<i class="fas fa-plus-circle"></i> ${currentIcdVersion === 'ICD-9-CM' ? 'Prosedur Sekunder' : 'Diagnosis Sekunder'}`;
    }

    const icd9NavSection = document.getElementById('icd9NavigatorSection');
    const icd10SearchSection = document.getElementById('icd10SearchSection');
    if (icd9NavSection) {
        icd9NavSection.style.display = currentIcdVersion === 'ICD-9-CM' ? 'block' : 'none';
    }
    if (icd10SearchSection) {
        icd10SearchSection.style.display = currentIcdVersion === 'ICD-9-CM' ? 'none' : 'block';
    }

    if (currentIcdVersion === 'ICD-9-CM') {
        renderIcd9NavigatorTree();
    }
}

function finalizeIcdLoad() {
    icdData = currentIcdVersion === 'ICD-9-CM' ? icd9Data : icd10Data;
    icdDataLoaded = true;
    console.log('ICD Data Loaded:');
    console.log('- ICD-9 Data Count:', icd9Data.length);
    console.log('- ICD-9 Hierarchy Loaded:', !!icd9Hierarchy && icd9Hierarchy.length > 0);
    console.log('- ICD-9 Search Data Count:', icd9SearchData.length);
    console.log('- ICD-10 Data Count:', icd10Data.length);
    switchIcdVersion();
}

/**
 * Load session from localStorage if user selected "remember me"
 */
function loadSessionIfExists() {
    const rememberMeData = localStorage.getItem('simrsRememberMe');
    if (rememberMeData) {
        try {
            const data = JSON.parse(rememberMeData);
            document.getElementById('loginUsername').value = data.username;
            document.getElementById('rememberMe').checked = true;
        } catch (e) {
            // Invalid data, clear it
            localStorage.removeItem('simrsRememberMe');
        }
    }
}

/**
 * Handle login form submission
 */
function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const role = document.getElementById('loginRole').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    
    // Validate inputs
    if (!username || !password || !role) {
        showLoginAlert('Harap lengkapi semua field');
        return;
    }
    
    // Find user in database
    const user = userDatabase.find(u => 
        u.username === username && 
        u.password === password && 
        u.role === role
    );
    
    if (!user) {
        showLoginAlert('Username, password, atau peran tidak sesuai');
        clearPasswordField();
        return;
    }
    
    // Create session
    currentSession = {
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        loginTime: new Date().toISOString(),
        sessionId: generateSessionId()
    };
    
    // Save session
    sessionStorage.setItem('simrsSession', JSON.stringify(currentSession));
    
    // Handle remember me
    if (rememberMe) {
        localStorage.setItem('simrsRememberMe', JSON.stringify({
            username: user.username
        }));
    } else {
        localStorage.removeItem('simrsRememberMe');
    }
    
    // Hide alert and show main app
    hideLoginAlert();
    showMainApp();
    updateUserInfo();
    resetLoginForm();
    
    // Show success message
    showToast('Login berhasil!', 'success');
}

/**
 * Handle logout
 */
function handleLogout() {
    // Confirm logout
    if (confirm('Apakah Anda yakin ingin keluar dari sistem?')) {
        // Clear session
        sessionStorage.removeItem('simrsSession');
        currentSession = null;
        
        // Show login page
        showLoginPage();
        resetLoginForm();
        
        // Show logout message
        showToast('Anda telah keluar dari sistem', 'info');
    }
}

/**
 * Backward compatibility function
 */
function logout() {
    handleLogout();
}

/**
 * Toggle password visibility
 */
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('loginPassword');
    const toggleIcon = document.getElementById('toggleIcon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.classList.remove('fa-eye');
        toggleIcon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        toggleIcon.classList.remove('fa-eye-slash');
        toggleIcon.classList.add('fa-eye');
    }
}

/**
 * Show login page
 */
function showLoginPage() {
    document.getElementById('loginContainer').classList.add('show');
    document.getElementById('mainApp').style.display = 'none';
}

/**
 * Show main application
 */
function showMainApp() {
    document.getElementById('loginContainer').classList.remove('show');
    document.getElementById('mainApp').style.display = 'block';
}

/**
 * Show login alert message
 */
function showLoginAlert(message) {
    const alertDiv = document.getElementById('loginAlert');
    document.getElementById('loginAlertMessage').textContent = message;
    alertDiv.style.display = 'flex';
}

/**
 * Hide login alert message
 */
function hideLoginAlert() {
    document.getElementById('loginAlert').style.display = 'none';
}

/**
 * Clear password field
 */
function clearPasswordField() {
    document.getElementById('loginPassword').value = '';
}

/**
 * Reset login form
 */
function resetLoginForm() {
    document.getElementById('loginForm').reset();
    hideLoginAlert();
    // Reset password visibility
    document.getElementById('loginPassword').type = 'password';
    document.getElementById('toggleIcon').classList.remove('fa-eye-slash');
    document.getElementById('toggleIcon').classList.add('fa-eye');
}

/**
 * Update user information in header
 */
function updateUserInfo() {
    if (currentSession) {
        document.getElementById('currentUser').textContent = currentSession.fullName;
        document.getElementById('currentRole').textContent = currentSession.role;
    }
}

/**
 * Generate random session ID
 */
function generateSessionId() {
    return 'SIMRS_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Allow Enter key to submit login form
    document.getElementById('loginForm')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleLogin(e);
        }
    });
    
    // Clear alert when typing
    document.getElementById('loginUsername')?.addEventListener('input', hideLoginAlert);
    document.getElementById('loginPassword')?.addEventListener('input', hideLoginAlert);
    document.getElementById('loginRole')?.addEventListener('change', hideLoginAlert);

    // Registration autosave events

    const registrasiForm = document.getElementById('formRegistrasi');
    if (registrasiForm) {
        registrasiForm.addEventListener('input', saveRegistrasiDraft);
        registrasiForm.addEventListener('submit', function(event) {
            event.preventDefault();
            saveRegistrasiDraft();
            submitRegistrasiForm();
        });
    }
}

// =====================================================
// UTILITY FUNCTIONS (Toast Notifications, Modals, etc)
// =====================================================

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    
    const iconMap = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    };
    
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${iconMap[type]}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Close modal
 */
function closeModal() {
    document.getElementById('confirmModal').classList.remove('show');
}

/**
 * Switch between tabs (keeping existing functionality)
 */
function switchTab(tabName) {
    // Hide all tabs
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Remove active class from all nav tabs
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => tab.classList.remove('active'));
    
    // Show selected tab
    const selectedTab = document.getElementById(`tab-${tabName}`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Add active class to clicked nav tab
    const clickedNavTab = document.querySelector(`[data-tab="${tabName}"]`);
    if (clickedNavTab) {
        clickedNavTab.classList.add('active');
    }
}

/**
 * Update current date and time in header
 */
function updateDateTime() {
    const dateTimeElement = document.getElementById('currentDateTime');
    const now = new Date();
    const options = { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    dateTimeElement.textContent = now.toLocaleDateString('id-ID', options);
}

// Update datetime every minute
setInterval(updateDateTime, 60000);
updateDateTime();

// =====================================================
// EXISTING FORM FUNCTIONS
// =====================================================

/**
 * Generate Medical Record Number
 */
function generateNomorRM() {
    const prefix = 'RM';
    const date = new Date();
    const dateStr = date.getFullYear() + 
                   String(date.getMonth() + 1).padStart(2, '0') +
                   String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const nomorRM = prefix + dateStr + random;
    document.getElementById('nomorRM').value = nomorRM;
}

/**
 * Validate NIK format
 */
function validateNIK(input) {
    const value = input.value;
    document.getElementById('nikHint').textContent = `${value.length}/16 digit`;
    
    if (value.length === 16 && /^[0-9]{16}$/.test(value)) {
        document.getElementById('nikError').classList.remove('show');
    } else if (value.length === 16) {
        document.getElementById('nikError').textContent = 'NIK harus berisi angka saja';
        document.getElementById('nikError').classList.add('show');
    }
}

/**
 * Calculate age from birth date
 */
function hitungUsia() {
    const birthDateInput = document.getElementById('tanggalLahir').value;
    if (!birthDateInput) return;
    
    const birthDate = new Date(birthDateInput);
    const today = new Date();
    
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();
    
    if (days < 0) {
        months--;
        days += 30;
    }
    
    if (months < 0) {
        years--;
        months += 12;
    }
    
    document.getElementById('usiaTahun').textContent = years;
    document.getElementById('usiaBulan').textContent = months;
    document.getElementById('usiaHari').textContent = days;
}

function updateVitalStatus() {
    const sistolik = Number(document.getElementById('sistolik').value);
    const diastolik = Number(document.getElementById('diastolik').value);
    const nadi = Number(document.getElementById('nadi').value);
    const suhu = Number(document.getElementById('suhu').value);

    const bpStatus = document.getElementById('bpStatus');
    const nadiStatus = document.getElementById('nadiStatus');
    const suhuStatus = document.getElementById('suhuStatus');

    const bpContainer = document.getElementById('bpStatus').closest('.vital-item');
    const nadiContainer = document.getElementById('nadiStatus').closest('.vital-item');
    const suhuContainer = document.getElementById('suhuStatus').closest('.vital-item');

    if (sistolik && diastolik) {
        if (sistolik <= 120 && diastolik <= 80 && sistolik >= 90 && diastolik >= 60) {
            bpStatus.textContent = 'Tekanan darah normal';
            bpStatus.className = 'vital-status normal';
            bpContainer?.classList.add('vital-normal');
            bpContainer?.classList.remove('vital-warning', 'vital-danger');
        } else if (sistolik < 90 || diastolik < 60) {
            bpStatus.textContent = 'Tekanan darah rendah';
            bpStatus.className = 'vital-status warning';
            bpContainer?.classList.add('vital-warning');
            bpContainer?.classList.remove('vital-normal', 'vital-danger');
        } else if (sistolik <= 140 && diastolik <= 90) {
            bpStatus.textContent = 'Tekanan darah meningkat';
            bpStatus.className = 'vital-status warning';
            bpContainer?.classList.add('vital-warning');
            bpContainer?.classList.remove('vital-normal', 'vital-danger');
        } else {
            bpStatus.textContent = 'Tekanan darah tinggi';
            bpStatus.className = 'vital-status danger';
            bpContainer?.classList.add('vital-danger');
            bpContainer?.classList.remove('vital-normal', 'vital-warning');
        }
    } else {
        bpStatus.textContent = '';
        bpStatus.className = 'vital-status';
        bpContainer?.classList.remove('vital-normal', 'vital-warning', 'vital-danger');
    }

    if (nadi) {
        if (nadi >= 60 && nadi <= 100) {
            nadiStatus.textContent = 'Nadi normal';
            nadiStatus.className = 'vital-status normal';
            nadiContainer?.classList.add('vital-normal');
            nadiContainer?.classList.remove('vital-warning', 'vital-danger');
        } else if (nadi < 60) {
            nadiStatus.textContent = 'Nadi rendah';
            nadiStatus.className = 'vital-status warning';
            nadiContainer?.classList.add('vital-warning');
            nadiContainer?.classList.remove('vital-normal', 'vital-danger');
        } else {
            nadiStatus.textContent = 'Nadi cepat';
            nadiStatus.className = 'vital-status danger';
            nadiContainer?.classList.add('vital-danger');
            nadiContainer?.classList.remove('vital-normal', 'vital-warning');
        }
    } else {
        nadiStatus.textContent = '';
        nadiStatus.className = 'vital-status';
        nadiContainer?.classList.remove('vital-normal', 'vital-warning', 'vital-danger');
    }

    if (suhu) {
        if (suhu >= 36.1 && suhu <= 37.2) {
            suhuStatus.textContent = 'Suhu normal';
            suhuStatus.className = 'vital-status normal';
            suhuContainer?.classList.add('vital-normal');
            suhuContainer?.classList.remove('vital-warning', 'vital-danger');
        } else if (suhu < 36.1) {
            suhuStatus.textContent = 'Suhu rendah';
            suhuStatus.className = 'vital-status warning';
            suhuContainer?.classList.add('vital-warning');
            suhuContainer?.classList.remove('vital-normal', 'vital-danger');
        } else {
            suhuStatus.textContent = 'Demam / suhu tinggi';
            suhuStatus.className = 'vital-status danger';
            suhuContainer?.classList.add('vital-danger');
            suhuContainer?.classList.remove('vital-normal', 'vital-warning');
        }
    } else {
        suhuStatus.textContent = '';
        suhuStatus.className = 'vital-status';
        suhuContainer?.classList.remove('vital-normal', 'vital-warning', 'vital-danger');
    }
}

/**
 * Reset registration form
 */
function resetForm() {
    document.getElementById('formRegistrasi').reset();
    document.getElementById('nomorRM').value = '';
    document.getElementById('nikHint').textContent = '0/16 digit';
    document.getElementById('usiaTahun').textContent = '-';
    document.getElementById('usiaBulan').textContent = '-';
    document.getElementById('usiaHari').textContent = '-';
    localStorage.removeItem(REGISTRASI_DRAFT_KEY);
    showToast('Form direset', 'info');
}

/**
 * Save registration draft to localStorage
 */
function saveRegistrasiDraft() {
    const draft = {
        nomorRM: document.getElementById('nomorRM').value,
        nik: document.getElementById('nik').value,
        namaLengkap: document.getElementById('namaLengkap').value,
        tanggalLahir: document.getElementById('tanggalLahir').value,
        jeniskelamin: document.getElementById('jeniskelamin').value,
        penjamin: document.getElementById('penjamin').value,
        klinikTujuan: document.getElementById('klinikTujuan').value,
        alamat: document.getElementById('alamat').value,
        noTelepon: document.getElementById('noTelepon').value
    };
    localStorage.setItem(REGISTRASI_DRAFT_KEY, JSON.stringify(draft));
}

/**
 * Save draft action from button press
 */
function saveRegistrasiDraftAction() {
    saveRegistrasiDraft();
    showToast('Draf registrasi pasien berhasil disimpan', 'success');
}

/**
 * Restore registration draft from localStorage
 */
function restoreRegistrasiDraft() {
    const draftData = localStorage.getItem(REGISTRASI_DRAFT_KEY);
    if (!draftData) return;
    
    try {
        const draft = JSON.parse(draftData);
        document.getElementById('nomorRM').value = draft.nomorRM || '';
        document.getElementById('nik').value = draft.nik || '';
        document.getElementById('nikHint').textContent = `${(draft.nik || '').length}/16 digit`;
        document.getElementById('namaLengkap').value = draft.namaLengkap || '';
        document.getElementById('tanggalLahir').value = draft.tanggalLahir || '';
        if (draft.tanggalLahir) {
            hitungUsia();
        }
        document.getElementById('jeniskelamin').value = draft.jeniskelamin || '';
        document.getElementById('penjamin').value = draft.penjamin || '';
        document.getElementById('klinikTujuan').value = draft.klinikTujuan || '';
        document.getElementById('alamat').value = draft.alamat || '';
        document.getElementById('noTelepon').value = draft.noTelepon || '';
    } catch (e) {
        console.error('Gagal memuat draft registrasi:', e);
    }
}

/**
 * Submit registration form and clear draft
 */
function submitRegistrasiForm() {
    const form = document.getElementById('formRegistrasi');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    if (!document.getElementById('nomorRM').value) {
        generateNomorRM();
    }

    const entry = {
        antreanNo: generateAntreanNumber(),
        nomorRM: document.getElementById('nomorRM').value,
        namaPasien: document.getElementById('namaLengkap').value,
        usia: calculateAgeDisplay(document.getElementById('tanggalLahir').value),
        penjamin: document.getElementById('penjamin').selectedOptions[0]?.textContent || '',
        klinikTujuan: document.getElementById('klinikTujuan').selectedOptions[0]?.textContent || '',
        waktuDaftar: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        status: 'Menunggu'
    };

    antreanData.push(entry);
    saveAntreanData();
    renderAntreanTable();
    updateAntreanStats();
    localStorage.removeItem(REGISTRASI_DRAFT_KEY);
    resetForm();
    switchTab('antrean');
    showToast('Pasien berhasil didaftarkan ke antrean loket', 'success');
}

function generateAntreanNumber() {
    const nextNumber = antreanData.length + 1;
    return `A${String(nextNumber).padStart(3, '0')}`;
}

function calculateAgeDisplay(birthDateValue) {
    if (!birthDateValue) return '-';
    const birthDate = new Date(birthDateValue);
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();

    if (days < 0) {
        months--;
        days += 30;
    }
    if (months < 0) {
        years--;
        months += 12;
    }
    return `${years} thn ${months} bln`;
}

function saveAntreanData() {
    localStorage.setItem(ANTREAN_DATA_KEY, JSON.stringify(antreanData));
}

function restoreAntreanData() {
    const saved = localStorage.getItem(ANTREAN_DATA_KEY);
    if (!saved) return;

    try {
        antreanData = JSON.parse(saved) || [];
        renderAntreanTable();
        updateAntreanStats();
    } catch (e) {
        console.error('Gagal memuat data antrean:', e);
        antreanData = [];
    }
}

function renderAntreanTable() {
    const tbody = document.getElementById('antreanBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    antreanData.forEach(entry => {
        const row = document.createElement('tr');
        const statusClass = entry.status === 'Dipanggil' ? 'status-dipanggil' :
            entry.status === 'Selesai' ? 'status-selesai' : 'status-menunggu';
        const callButton = entry.status === 'Menunggu'
            ? `<button type="button" class="btn btn-sm btn-warning" onclick="panggilPasien('${entry.antreanNo}')">Panggil</button>`
            : `<button type="button" class="btn btn-sm btn-secondary" disabled>Panggil</button>`;
        const completeButton = entry.status === 'Dipanggil'
            ? `<button type="button" class="btn btn-sm btn-success" onclick="selesaikanPasien('${entry.antreanNo}')">Selesai</button>`
            : `<button type="button" class="btn btn-sm btn-secondary" disabled>Selesai</button>`;

        row.innerHTML = `
            <td>${entry.antreanNo}</td>
            <td>${entry.nomorRM}</td>
            <td>${entry.namaPasien}</td>
            <td>${entry.usia}</td>
            <td>${entry.penjamin}</td>
            <td>${entry.klinikTujuan}</td>
            <td>${entry.waktuDaftar}</td>
            <td><span class="status-badge ${statusClass}">${entry.status}</span></td>
            <td class="action-cell">
                <div class="action-group">
                    <button type="button" class="btn btn-sm btn-info" onclick="openAntreanDetail('${entry.antreanNo}')">Buka</button>
                    ${callButton}
                    ${completeButton}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function updateAntreanStats() {
    const total = antreanData.length;
    const waiting = antreanData.filter(entry => entry.status === 'Menunggu').length;
    const serving = antreanData.filter(entry => entry.status === 'Dipanggil').length;

    document.getElementById('totalAntrean').textContent = total;
    document.getElementById('waitingAntrean').textContent = waiting;
    document.getElementById('servingAntrean').textContent = serving;
}

function openAntreanDetail(antreanNo) {
    const entry = antreanData.find(item => item.antreanNo === antreanNo);
    if (!entry) return;

    currentPatient = entry;
    renderSelectedPatientDetail(entry);
    populateKlinisForm(entry);
    renderKodingResume(entry);
    document.getElementById('klinisLockScreen').style.display = 'none';
    document.getElementById('klinisForm').style.display = 'block';
    switchTab('klinis');
    showToast(`Pasien ${entry.namaPasien} dibuka untuk pemeriksaan klinis`, 'success');
}

function panggilPasien(antreanNo) {
    const entry = antreanData.find(item => item.antreanNo === antreanNo);
    if (!entry || entry.status !== 'Menunggu') return;
    entry.status = 'Dipanggil';
    saveAntreanData();
    renderAntreanTable();
    updateAntreanStats();
    showToast(`Pasien ${entry.namaPasien} dipanggil`, 'success');
}

function selesaikanPasien(antreanNo) {
    const entry = antreanData.find(item => item.antreanNo === antreanNo);
    if (!entry || entry.status !== 'Dipanggil') return;
    entry.status = 'Selesai';
    saveAntreanData();
    renderAntreanTable();
    updateAntreanStats();
    showToast(`Pasien ${entry.namaPasien} selesai`, 'success');
}

function renderSelectedPatientDetail(patient) {
    const badge = document.getElementById('selectedPatientBadge');
    if (!badge) return;

    badge.innerHTML = `
        <div class="patient-badge-item">
            <span class="patient-rm">${patient.nomorRM}</span>
            <span class="patient-name">${patient.namaPasien}</span>
            <span class="patient-info">${patient.usia} • ${patient.penjamin} • ${patient.klinikTujuan}</span>
        </div>
        <div class="patient-actions">
            <button type="button" class="btn btn-sm btn-warning" onclick="switchTab('koding')">
                <i class="fas fa-code"></i> Lanjut ke Koding
            </button>
        </div>
    `;
}

function populateKlinisForm(patient) {
    document.getElementById('soapSubjective').value = patient.soapSubjective || '';
    document.getElementById('soapObjective').value = patient.soapObjective || '';
    document.getElementById('soapAssessment').value = patient.soapAssessment || '';
    document.getElementById('soapPlan').value = patient.soapPlan || '';
    document.getElementById('resumeMedis').value = patient.resumeMedis || '';
    document.getElementById('diagnosisKerja').value = patient.diagnosisKerja || '';

    document.getElementById('sistolik').value = patient.sistolik || '';
    document.getElementById('diastolik').value = patient.diastolik || '';
    document.getElementById('nadi').value = patient.nadi || '';
    document.getElementById('suhu').value = patient.suhu || '';
    updateVitalStatus();

    selectedIcdData.utama = patient.icdUtama || null;
    selectedIcdData.sekunder = Array.isArray(patient.icdSekunder) ? patient.icdSekunder.slice() : [];
    document.getElementById('icdSearchUtama').value = selectedIcdData.utama ? `${selectedIcdData.utama.code} - ${selectedIcdData.utama.description}` : '';
    document.getElementById('icdSearchSekunder').value = '';
    displaySelectedIcdUtama();
    displaySelectedIcdSekunder();
}

function renderKodingResume(patient) {
    const resumeContent = document.getElementById('kodingResumeContent');
    if (!resumeContent) return;

    const resumeText = patient.resumeMedis || 'Resume medis belum diisi. Simpan data klinis terlebih dahulu untuk mengisi resume medis.';
    const diagnosisText = patient.diagnosisKerja || 'Diagnosis kerja belum diisi.';
    const icdUtamaText = patient.icdUtama ? `${patient.icdUtama.code} - ${patient.icdUtama.description} (${patient.icdUtama.version || 'ICD-10'})` : 'Belum ada diagnosis utama';
    const icdSekunderText = Array.isArray(patient.icdSekunder) && patient.icdSekunder.length
        ? patient.icdSekunder.map(item => `${item.code} - ${item.description} (${item.version || 'ICD-10'})`).join('<br>')
        : 'Belum ada diagnosis/prosedur sekunder';

    let icdUtamaLabel = 'ICD Utama';
    if (patient.icdUtama) {
        icdUtamaLabel = patient.icdUtama.version === 'ICD-9-CM' ? 'Prosedur Utama' : 'Diagnosis Utama';
    }

    let icdSekunderLabel = 'ICD Sekunder';
    if (Array.isArray(patient.icdSekunder) && patient.icdSekunder.length) {
        const all9 = patient.icdSekunder.every(i => i.version === 'ICD-9-CM');
        const all10 = patient.icdSekunder.every(i => i.version === 'ICD-10');
        if (all9) icdSekunderLabel = 'Prosedur Sekunder';
        else if (all10) icdSekunderLabel = 'Diagnosis Sekunder';
        else icdSekunderLabel = 'ICD Sekunder';
    }

    resumeContent.innerHTML = `
        <div class="resume-summary">
            <strong>Pasien:</strong> ${patient.namaPasien}<br>
            <strong>RM:</strong> ${patient.nomorRM}<br>
            <strong>Klinik:</strong> ${patient.klinikTujuan}<br>
            <strong>Resume:</strong>
            <p>${resumeText}</p>
            <strong>Diagnosis Kerja:</strong>
            <p>${diagnosisText}</p>
            <strong>${icdUtamaLabel}:</strong>
            <p>${icdUtamaText}</p>
            <strong>${icdSekunderLabel}:</strong>
            <p>${icdSekunderText}</p>
        </div>
    `;
}

function searchICD(type) {
    const fieldId = type === 'utama' ? 'icdSearchUtama' : 'icdSearchSekunder';
    const dropdownId = type === 'utama' ? 'icdDropdownUtama' : 'icdDropdownSekunder';
    const searchField = document.getElementById(fieldId);
    const dropdown = document.getElementById(dropdownId);
    if (!searchField || !dropdown) return;

    const query = searchField.value.trim().toLowerCase();
    if (!icdDataLoaded) {
        renderICDDropdown(type, [], query, true);
        return;
    }

    const results = query.length === 0
        ? icdData.slice(0, 6)
        : icdData.filter(item =>
            item.code.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query)
        ).slice(0, 8);

    renderICDDropdown(type, results, query);
}

function renderICDDropdown(type, items, query, loading = false) {
    const dropdownId = type === 'utama' ? 'icdDropdownUtama' : 'icdDropdownSekunder';
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    dropdown.innerHTML = '';
    dropdown.classList.remove('show');

    if (loading) {
        const loadingItem = document.createElement('div');
        loadingItem.className = 'icd-option loading';
        loadingItem.textContent = `Memuat ${currentIcdVersion}...`;
        dropdown.appendChild(loadingItem);
        dropdown.classList.add('show');
        return;
    }

    if (!items.length) {
        const emptyItem = document.createElement('div');
        emptyItem.className = 'icd-option empty';
        const versionLabel = currentIcdVersion === 'ICD-9-CM' ? 'ICD-9-CM' : 'ICD-10';
        emptyItem.textContent = query.length === 0
            ? `Ketik untuk mencari kode ${versionLabel}...`
            : `Tidak ada hasil ${versionLabel}`;
        dropdown.appendChild(emptyItem);
        dropdown.classList.add('show');
        return;
    }

    items.forEach(item => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'icd-option';
        option.innerHTML = `
            <strong>${item.code}</strong>
            <span>${item.description}</span>
        `;
        option.onclick = () => selectICD(type, item);
        dropdown.appendChild(option);
    });

    dropdown.classList.add('show');
}

function selectICD(type, item) {
    const fieldId = type === 'utama' ? 'icdSearchUtama' : 'icdSearchSekunder';
    const searchField = document.getElementById(fieldId);
    if (!searchField) return;

    const selectedItem = { ...item, version: currentIcdVersion };

    if (type === 'utama') {
        selectedIcdData.utama = selectedItem;
        displaySelectedIcdUtama();
        searchField.value = `${selectedItem.code} - ${selectedItem.description}`;
    } else {
        const exists = selectedIcdData.sekunder.some(icd => icd.code === selectedItem.code && icd.version === selectedItem.version);
        if (!exists) {
            selectedIcdData.sekunder.push(selectedItem);
        }
        displaySelectedIcdSekunder();
        searchField.value = '';
    }

    const dropdownId = type === 'utama' ? 'icdDropdownUtama' : 'icdDropdownSekunder';
    const dropdown = document.getElementById(dropdownId);
    if (dropdown) {
        dropdown.classList.remove('show');
    }
}

function displaySelectedIcdUtama() {
    const container = document.getElementById('selectedIcdUtama');
    if (!container) return;

    if (!selectedIcdData.utama) {
        container.innerHTML = '<span class="no-selection">Belum ada diagnosis utama dipilih</span>';
        return;
    }

    container.innerHTML = `
        <div class="icd-selected-item">
            <div>
                <strong>${selectedIcdData.utama.code}</strong>
                <p>${selectedIcdData.utama.description}</p>
            </div>
            <button type="button" class="btn btn-sm btn-secondary" onclick="clearSelectedIcd('utama')">
                <i class="fas fa-times"></i> Hapus
            </button>
        </div>
    `;
}

function displaySelectedIcdSekunder() {
    const container = document.getElementById('selectedIcdSekunder');
    if (!container) return;

    if (!selectedIcdData.sekunder.length) {
        container.innerHTML = '<span class="no-selection">Belum ada diagnosis sekunder</span>';
        return;
    }

    container.innerHTML = selectedIcdData.sekunder.map((item, index) => `
        <div class="icd-selected-item">
            <div>
                <strong>${item.code}</strong>
                <p>${item.description}</p>
            </div>
            <button type="button" class="btn btn-sm btn-secondary" onclick="removeSelectedIcdSekunder(${index})">
                <i class="fas fa-trash"></i> Hapus
            </button>
        </div>
    `).join('');
}

function clearSelectedIcd(type) {
    if (type === 'utama') {
        selectedIcdData.utama = null;
        displaySelectedIcdUtama();
        document.getElementById('icdSearchUtama').value = '';
    }
}

function removeSelectedIcdSekunder(index) {
    selectedIcdData.sekunder.splice(index, 1);
    displaySelectedIcdSekunder();
}

/**
 * Render ICD-9-CM Navigator Tree
 */
function renderIcd9NavigatorTree(searchQuery = '') {
    const treeContainer = document.getElementById('icd9ProcedureTree');
    if (!treeContainer) return;

    // Fallback ke icd9Data jika hierarchy tidak tersedia
    let dataToRender = icd9Hierarchy;
    if (!Array.isArray(icd9Hierarchy) || !icd9Hierarchy.length) {
        console.warn('ICD-9 Hierarchy empty, using flat search data');
        // Build simple tree dari flat data untuk display
        if (!Array.isArray(icd9Data) || !icd9Data.length) {
            treeContainer.innerHTML = '<div class="placeholder-text">Tidak ada data prosedur ICD-9-CM tersedia. Pastikan file procedure_codes.json dapat diakses.</div>';
            return;
        }
        // Gunakan search interface instead
        renderIcd9SearchResultsUI(icd9Data.slice(0, 50));
        return;
    }

    const filteredData = searchQuery.length === 0
        ? icd9Hierarchy
        : filterTreeByQuery(icd9Hierarchy, searchQuery.toLowerCase());

    if (!filteredData || !filteredData.length) {
        treeContainer.innerHTML = '<div class="placeholder-text">Tidak ada prosedur yang cocok dengan pencarian</div>';
        return;
    }

    const html = buildTreeHTML(filteredData);
    treeContainer.innerHTML = html;
    attachTreeEventListeners();
}

function filterTreeByQuery(nodes, query) {
    return nodes
        .map(node => {
            const codeMatch = node.code.toLowerCase().includes(query);
            const descMatch = node.desc.toLowerCase().includes(query);
            const childrenMatch = Array.isArray(node.children)
                ? filterTreeByQuery(node.children, query)
                : [];

            if (codeMatch || descMatch || childrenMatch.length > 0) {
                return {
                    ...node,
                    children: childrenMatch
                };
            }
            return null;
        })
        .filter(n => n !== null);
}

function buildTreeHTML(nodes, level = 0) {
    if (!Array.isArray(nodes) || !nodes.length) return '';

    let html = '<ul class="icd9-tree-list">';

    nodes.forEach(node => {
        const hasChildren = Array.isArray(node.children) && node.children.length > 0;
        const isLeaf = !hasChildren;

        html += '<li class="icd9-tree-item">';

        if (hasChildren) {
            html += `<button class="icd9-toggle" data-expanded="false" type="button">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                    <span class="icd9-node-category">${node.code} - ${node.desc}</span>
                    <ul class="icd9-tree-sublist" style="display: none;">
                        ${buildTreeHTML(node.children, level + 1)}
                    </ul>`;
        } else {
            html += `<span class="icd9-leaf-spacer"></span>
                    <button class="icd9-procedure-btn" type="button" data-code="${node.code}" data-desc="${node.desc}">
                        <strong>${node.code}</strong>
                        <span>${node.desc}</span>
                    </button>`;
        }

        html += '</li>';
    });

    html += '</ul>';
    return html;
}

function attachTreeEventListeners() {
    const treeContainer = document.getElementById('icd9ProcedureTree');
    if (!treeContainer) return;

    // Attach toggle listeners
    treeContainer.querySelectorAll('.icd9-toggle').forEach(toggle => {
        toggle.addEventListener('click', function() {
            const sublist = this.closest('li').querySelector('.icd9-tree-sublist');
            if (!sublist) return;

            const isExpanded = this.getAttribute('data-expanded') === 'true';
            if (isExpanded) {
                sublist.style.display = 'none';
                this.setAttribute('data-expanded', 'false');
                this.querySelector('i').className = 'fas fa-chevron-right';
            } else {
                sublist.style.display = 'block';
                this.setAttribute('data-expanded', 'true');
                this.querySelector('i').className = 'fas fa-chevron-down';
            }
        });
    });

    // Attach procedure selection listeners
    treeContainer.querySelectorAll('.icd9-procedure-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const code = this.getAttribute('data-code');
            const desc = this.getAttribute('data-desc');
            selectICD('utama', { code, description: desc, version: 'ICD-9-CM' });
            const searchInput = document.getElementById('icd9SearchInput');
            if (searchInput) {
                searchInput.value = `${code} - ${desc}`;
            }
        });
    });
}

function filterIcd9Navigator() {
    const searchInput = document.getElementById('icd9SearchInput');
    if (!searchInput) return;

    const query = searchInput.value.trim();
    
    if (query.length > 0 && typeof searchIcd9Codes === 'function' && icd9SearchData.length > 0) {
        const results = searchIcd9Codes(icd9SearchData, query, 100);
        if (results.length > 0) {
            renderIcd9SearchResultsUI(results);
            return;
        }
    }
    
    renderIcd9NavigatorTree(query);
}

function renderIcd9SearchResultsUI(results) {
    const treeContainer = document.getElementById('icd9ProcedureTree');
    if (!treeContainer) return;

    if (!results || results.length === 0) {
        treeContainer.innerHTML = '<div class="placeholder-text">Tidak ada hasil pencarian</div>';
        return;
    }

    let html = '<div class="icd9-search-results">';
    results.forEach(item => {
        html += `
            <button type="button" class="icd9-result-item" 
                    onclick="selectIcd9CodeFromSearch('${item.code}', '${item.description.replace(/'/g, "\\'")}')"
                    title="${item.description}">
                <strong>${item.code}</strong>
                <span>${item.description}</span>
            </button>
        `;
    });
    html += '</div>';
    treeContainer.innerHTML = html;
}

function selectIcd9CodeFromSearch(code, description) {
    const item = { code, description, version: 'ICD-9-CM' };
    selectICD('utama', item);
    const inputField = document.getElementById('icd9SearchInput');
    if (inputField) {
        inputField.value = `${code} - ${description}`;
    }
}

/**
 * Placeholder functions for other features
 */
function filterAntrean() {
    // Implement queue filtering
}

function batalPemeriksaan() {
    if (confirm('Batalkan pemeriksaan ini?')) {
        document.getElementById('klinisLockScreen').style.display = 'flex';
        document.getElementById('klinisForm').style.display = 'none';
        showToast('Pemeriksaan dibatalkan', 'warning');
    }
}

function simpanDataKlinis() {
    if (!currentPatient) {
        showToast('Pilih pasien dari antrean terlebih dahulu', 'error');
        return;
    }

    currentPatient.soapSubjective = document.getElementById('soapSubjective').value;
    currentPatient.soapObjective = document.getElementById('soapObjective').value;
    currentPatient.soapAssessment = document.getElementById('soapAssessment').value;
    currentPatient.soapPlan = document.getElementById('soapPlan').value;
    currentPatient.resumeMedis = document.getElementById('resumeMedis').value;
    currentPatient.diagnosisKerja = document.getElementById('diagnosisKerja').value;

    currentPatient.sistolik = document.getElementById('sistolik').value;
    currentPatient.diastolik = document.getElementById('diastolik').value;
    currentPatient.nadi = document.getElementById('nadi').value;
    currentPatient.suhu = document.getElementById('suhu').value;

    currentPatient.icdUtama = selectedIcdData.utama ? { ...selectedIcdData.utama } : null;
    currentPatient.icdSekunder = selectedIcdData.sekunder.map(item => ({ ...item }));

    saveAntreanData();
    renderKodingResume(currentPatient);
    showToast('Data klinis berhasil disimpan', 'success');
}

function validateCoding() {
    if (!currentPatient) {
        showToast('Pilih pasien dari antrean terlebih dahulu', 'error');
        return;
    }
    showToast('Validasi koding selesai', 'info');
}

function simpanKoding() {
    if (!currentPatient) {
        showToast('Pilih pasien dari antrean terlebih dahulu', 'error');
        return;
    }

    currentPatient.icdUtama = selectedIcdData.utama ? { ...selectedIcdData.utama } : null;
    currentPatient.icdSekunder = selectedIcdData.sekunder.map(item => ({ ...item }));
    saveAntreanData();
    renderKodingResume(currentPatient);

    if (!selectedIcdData.utama) {
        showToast('Simpan koding berhasil, namun harap pilih ICD Utama terlebih dahulu', 'warning');
        return;
    }

    showToast(`Koding ${currentIcdVersion} untuk ${currentPatient.namaPasien} berhasil disimpan`, 'success');
}

function exportLogs() {
    showToast('Export logs sedang diproses', 'info');
}

function filterLogs() {
    // Implement log filtering
}

// Add slide out animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
