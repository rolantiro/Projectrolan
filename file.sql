-- =====================================================
-- DATABASE SISTEM INFORMASI REKAM MEDIS RUMAH SAKIT
-- Sesuai HK.01.07/MENKES/1423/2022
-- =====================================================

CREATE DATABASE IF NOT EXISTS simrs_rekam_medis;
USE simrs_rekam_medis;

-- Tabel Master Pengguna/Petugas
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nama_lengkap VARCHAR(100) NOT NULL,
    role ENUM('admin', 'petugas_loket', 'perawat', 'dokter', 'koder', 'manajer_rm') NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Master Penjamin/Asuransi
CREATE TABLE penjamin_asuransi (
    penjamin_id INT AUTO_INCREMENT PRIMARY KEY,
    kode_penjamin VARCHAR(10) UNIQUE NOT NULL,
    nama_penjamin VARCHAR(100) NOT NULL,
    jenis ENUM('BPJS', 'Asuransi_Swasta', 'Umum', 'Jaminan_Perusahaan') NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Tabel Master Klinik/Poliklinik
CREATE TABLE klinik (
    klinik_id INT AUTO_INCREMENT PRIMARY KEY,
    kode_klinik VARCHAR(10) UNIQUE NOT NULL,
    nama_klinik VARCHAR(100) NOT NULL,
    lantai VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE
);

-- Tabel Master ICD-10
CREATE TABLE icd10_master (
    icd_id INT AUTO_INCREMENT PRIMARY KEY,
    kode_icd VARCHAR(10) UNIQUE NOT NULL,
    nama_penyakit VARCHAR(255) NOT NULL,
    kategori VARCHAR(100),
    is_chronic BOOLEAN DEFAULT FALSE,
    severity_level ENUM('ringan', 'sedang', 'berat', 'kritis') DEFAULT 'sedang'
);

-- Tabel Master Pasien
CREATE TABLE master_pasien (
    pasien_id INT AUTO_INCREMENT PRIMARY KEY,
    nomor_rm VARCHAR(15) UNIQUE NOT NULL,
    nik VARCHAR(16) UNIQUE NOT NULL,
    nama_lengkap VARCHAR(100) NOT NULL,
    tanggal_lahir DATE NOT NULL,
    jenis_kelamin ENUM('L', 'P') NOT NULL,
    alamat TEXT,
    no_telepon VARCHAR(20),
    penjamin_id INT,
    tanggal_daftar TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Informasi Arsip Fisik (Hybrid Records)
    kode_rak_arsip VARCHAR(20),
    status_scan ENUM('Belum', 'Proses', 'Sudah') DEFAULT 'Belum',
    status_kelengkapan ENUM('Lengkap', 'Tidak_Lengkap') DEFAULT 'Tidak_Lengkap',
    catatan_kelengkapan TEXT,
    FOREIGN KEY (penjamin_id) REFERENCES penjamin_asuransi(penjamin_id)
);

-- Tabel Antrean Elektronik (Loket)
CREATE TABLE antrean_pasien (
    antrean_id INT AUTO_INCREMENT PRIMARY KEY,
    pasien_id INT NOT NULL,
    nomor_antrean VARCHAR(10) NOT NULL,
    klinik_id INT NOT NULL,
    tanggal_kunjungan DATE NOT NULL,
    waktu_daftar TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status_antrean ENUM('menunggu', 'dipanggil', 'dilayani', 'selesai', 'batal') DEFAULT 'menunggu',
    petugas_loket_id INT,
    FOREIGN KEY (pasien_id) REFERENCES master_pasien(pasien_id),
    FOREIGN KEY (klinik_id) REFERENCES klinik(klinik_id),
    FOREIGN KEY (petugas_loket_id) REFERENCES users(user_id)
);

-- Tabel Kunjungan/Episode Perawatan
CREATE TABLE kunjungan (
    kunjungan_id INT AUTO_INCREMENT PRIMARY KEY,
    antrean_id INT NOT NULL,
    pasien_id INT NOT NULL,
    klinik_id INT NOT NULL,
    tanggal_kunjungan TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status_kunjungan ENUM('registrasi', 'pemeriksaan', 'selesai') DEFAULT 'registrasi',
    FOREIGN KEY (antrean_id) REFERENCES antrean_pasien(antrean_id),
    FOREIGN KEY (pasien_id) REFERENCES master_pasien(pasien_id),
    FOREIGN KEY (klinik_id) REFERENCES klinik(klinik_id)
);

-- Tabel Data Klinis (Tanda Vital + SOAP)
CREATE TABLE data_klinis (
    klinis_id INT AUTO_INCREMENT PRIMARY KEY,
    kunjungan_id INT NOT NULL,
    pasien_id INT NOT NULL,
    -- Tanda Vital
    tekanan_darah_sistolik INT,
    tekanan_darah_diastolik INT,
    nadi INT,
    suhu DECIMAL(4,1),
    -- SOAP Notes
    subjective TEXT,
    objective TEXT,
    assessment TEXT,
    plan TEXT,
    -- Resume Medis
    resume_medis TEXT,
    diagnosis_kerja TEXT,
    -- Metadata
    perawat_id INT,
    dokter_id INT,
    waktu_input TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    waktu_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (kunjungan_id) REFERENCES kunjungan(kunjungan_id),
    FOREIGN KEY (pasien_id) REFERENCES master_pasien(pasien_id),
    FOREIGN KEY (perawat_id) REFERENCES users(user_id),
    FOREIGN KEY (dokter_id) REFERENCES users(user_id)
);

-- Tabel Diagnosis/Koding ICD-10
CREATE TABLE diagnosis_koding (
    diagnosis_id INT AUTO_INCREMENT PRIMARY KEY,
    kunjungan_id INT NOT NULL,
    pasien_id INT NOT NULL,
    icd_id INT NOT NULL,
    tipe_diagnosis ENUM('utama', 'sekunder') NOT NULL,
    urutan_prioritas INT NOT NULL,
    koder_id INT,
    is_validated BOOLEAN DEFAULT FALSE,
    cdss_alert TEXT,
    waktu_input TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kunjungan_id) REFERENCES kunjungan(kunjungan_id),
    FOREIGN KEY (pasien_id) REFERENCES master_pasien(pasien_id),
    FOREIGN KEY (icd_id) REFERENCES icd10_master(icd_id),
    FOREIGN KEY (koder_id) REFERENCES users(user_id)
);

-- Tabel Log Forensik (Audit Trail)
CREATE TABLE forensic_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    username VARCHAR(50),
    aksi ENUM('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'VIEW', 'VALIDATE') NOT NULL,
    tabel_terkait VARCHAR(50),
    record_id INT,
    data_sebelum JSON,
    data_sesudah JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- =====================================================
-- DATA AWAL (SEED DATA)
-- =====================================================

-- Insert Penjamin Asuransi
INSERT INTO penjamin_asuransi (kode_penjamin, nama_penjamin, jenis) VALUES
('BPJS01', 'BPJS Kesehatan', 'BPJS'),
('BPJS02', 'BPJS Ketenagakerjaan', 'BPJS'),
('PRU01', 'Prudential Indonesia', 'Asuransi_Swasta'),
('AXA01', 'AXA Mandiri', 'Asuransi_Swasta'),
('UMUM', 'Umum/Pribadi', 'Umum'),
('PERT01', 'Jaminan Pertamina', 'Jaminan_Perusahaan');

-- Insert Klinik
INSERT INTO klinik (kode_klinik, nama_klinik, lantai) VALUES
('POLI01', 'Poli Umum', 'Lantai 1'),
('POLI02', 'Poli Gigi', 'Lantai 1'),
('POLI03', 'Poli Anak', 'Lantai 2'),
('POLI04', 'Poli Kandungan', 'Lantai 2'),
('POLI05', 'Poli Jantung', 'Lantai 3'),
('POLI06', 'Poli Penyakit Dalam', 'Lantai 3'),
('POLI07', 'Poli Bedah', 'Lantai 4'),
('POLI08', 'Poli Mata', 'Lantai 1'),
('IGD', 'Instalasi Gawat Darurat', 'Lantai 1');

-- Insert Master ICD-10 (Contoh)
INSERT INTO icd10_master (kode_icd, nama_penyakit, kategori, is_chronic, severity_level) VALUES
('J06.9', 'Infeksi Saluran Pernapasan Atas Akut', 'Respiratory', FALSE, 'ringan'),
('J18.9', 'Pneumonia', 'Respiratory', FALSE, 'berat'),
('A09', 'Diare dan Gastroenteritis', 'Gastrointestinal', FALSE, 'sedang'),
('E11.9', 'Diabetes Mellitus Tipe 2', 'Endocrine', TRUE, 'sedang'),
('I10', 'Hipertensi Esensial (Primer)', 'Cardiovascular', TRUE, 'sedang'),
('I21.9', 'Infark Miokard Akut', 'Cardiovascular', FALSE, 'kritis'),
('K29.7', 'Gastritis', 'Gastrointestinal', FALSE, 'ringan'),
('M54.5', 'Nyeri Punggung Bawah', 'Musculoskeletal', FALSE, 'ringan'),
('N39.0', 'Infeksi Saluran Kemih', 'Genitourinary', FALSE, 'sedang'),
('R50.9', 'Demam, Tidak Spesifik', 'General Symptoms', FALSE, 'ringan'),
('B34.9', 'Infeksi Virus', 'Infectious', FALSE, 'ringan'),
('J45.9', 'Asma', 'Respiratory', TRUE, 'sedang'),
('G43.9', 'Migrain', 'Neurological', TRUE, 'ringan'),
('K21.0', 'GERD dengan Esofagitis', 'Gastrointestinal', TRUE, 'ringan');

-- Insert Users (Password: hash dari 'password123')
INSERT INTO users (username, password_hash, nama_lengkap, role) VALUES
('admin', '$2y$10$example_hash_admin', 'Administrator Sistem', 'admin'),
('loket1', '$2y$10$example_hash_loket', 'Budi Santoso', 'petugas_loket'),
('perawat1', '$2y$10$example_hash_perawat', 'Siti Nurhaliza', 'perawat'),
('dokter1', '$2y$10$example_hash_dokter', 'dr. Ahmad Yani, Sp.PD', 'dokter'),
('koder1', '$2y$10$example_hash_koder', 'Dewi Lestari', 'koder'),
('mrm1', '$2y$10$example_hash_mrm', 'Hendra Wijaya', 'manajer_rm');

-- =====================================================
-- STORED PROCEDURES
-- =====================================================

-- Prosedur Generate Nomor RM Unik
DELIMITER //
CREATE PROCEDURE GenerateNomorRM(OUT new_rm VARCHAR(15))
BEGIN
    DECLARE last_number INT;
    DECLARE year_code VARCHAR(4);
    
    SET year_code = DATE_FORMAT(CURDATE(), '%Y');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(nomor_rm, 6) AS UNSIGNED)), 0) INTO last_number
    FROM master_pasien
    WHERE nomor_rm LIKE CONCAT('RM', year_code, '%');
    
    SET new_rm = CONCAT('RM', year_code, LPAD(last_number + 1, 6, '0'));
END //
DELIMITER ;

-- Prosedur Generate Nomor Antrean
DELIMITER //
CREATE PROCEDURE GenerateNomorAntrean(IN p_klinik_id INT, IN p_tanggal DATE, OUT new_antrean VARCHAR(10))
BEGIN
    DECLARE last_number INT;
    DECLARE klinik_code VARCHAR(5);
    
    SELECT kode_klinik INTO klinik_code FROM klinik WHERE klinik_id = p_klinik_id;
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(nomor_antrean, -3) AS UNSIGNED)), 0) INTO last_number
    FROM antrean_pasien
    WHERE klinik_id = p_klinik_id AND tanggal_kunjungan = p_tanggal;
    
    SET new_antrean = CONCAT(LEFT(klinik_code, 2), '-', LPAD(last_number + 1, 3, '0'));
END //
DELIMITER ;

-- Prosedur Log Forensik
DELIMITER //
CREATE PROCEDURE InsertForensicLog(
    IN p_user_id INT,
    IN p_username VARCHAR(50),
    IN p_aksi VARCHAR(20),
    IN p_tabel VARCHAR(50),
    IN p_record_id INT,
    IN p_data_sebelum JSON,
    IN p_data_sesudah JSON,
    IN p_ip VARCHAR(45),
    IN p_user_agent TEXT
)
BEGIN
    INSERT INTO forensic_logs (user_id, username, aksi, tabel_terkait, record_id, data_sebelum, data_sesudah, ip_address, user_agent)
    VALUES (p_user_id, p_username, p_aksi, p_tabel, p_record_id, p_data_sebelum, p_data_sesudah, p_ip, p_user_agent);
END //
DELIMITER ;

-- View Statistik Biostatistik
CREATE VIEW v_biostatistik AS
SELECT 
    COUNT(DISTINCT k.kunjungan_id) as total_kunjungan,
    AVG(TIMESTAMPDIFF(YEAR, mp.tanggal_lahir, CURDATE())) as rata_rata_usia,
    (SELECT COUNT(*) FROM master_pasien WHERE status_kelengkapan = 'Lengkap') * 100.0 / 
    (SELECT COUNT(*) FROM master_pasien) as persentase_klpcm,
    (SELECT COUNT(*) FROM master_pasien WHERE status_scan = 'Sudah') * 100.0 / 
    (SELECT COUNT(*) FROM master_pasien) as persentase_scan
FROM kunjungan k
JOIN master_pasien mp ON k.pasien_id = mp.pasien_id
WHERE DATE(k.tanggal_kunjungan) = CURDATE();

-- View Sebaran Penyakit
CREATE VIEW v_sebaran_penyakit AS
SELECT 
    im.kode_icd,
    im.nama_penyakit,
    COUNT(dk.diagnosis_id) as jumlah_kasus,
    COUNT(dk.diagnosis_id) * 100.0 / (SELECT COUNT(*) FROM diagnosis_koding WHERE tipe_diagnosis = 'utama') as persentase
FROM diagnosis_koding dk
JOIN icd10_master im ON dk.icd_id = im.icd_id
WHERE dk.tipe_diagnosis = 'utama'
GROUP BY im.icd_id, im.kode_icd, im.nama_penyakit
ORDER BY jumlah_kasus DESC;
