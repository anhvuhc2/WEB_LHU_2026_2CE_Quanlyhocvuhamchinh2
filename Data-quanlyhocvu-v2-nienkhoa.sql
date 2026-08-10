-- 1. XÓA DB CŨ NẾU CÓ VÀ TẠO DATABASE MỚI (Lưu ra DB mới để bảo toàn dữ liệu gốc)
USE master;
GO
IF DB_ID('DoAn_WebHocVu_Advanced_V2') IS NOT NULL
BEGIN
    ALTER DATABASE DoAn_WebHocVu_Advanced_V2 SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE DoAn_WebHocVu_Advanced_V2;
END
GO
CREATE DATABASE DoAn_WebHocVu_Advanced_V2;
GO
USE DoAn_WebHocVu_Advanced_V2;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-----------------------------------------------------------
-- NHÓM 1: QUẢN TRỊ VÀ PHÂN QUYỀN
-----------------------------------------------------------
CREATE TABLE TaiKhoan (
    TenDangNhap NVARCHAR(50) PRIMARY KEY,
    MatKhau NVARCHAR(255) NOT NULL,
    HoTen NVARCHAR(100) NOT NULL,
    VaiTro NVARCHAR(50) NOT NULL,
    CONSTRAINT CHK_VaiTro CHECK (VaiTro IN ('HieuTruong', 'GiaoVien', 'PhuHuynh'))
);
GO

CREATE TABLE LopHoc (
    MaLop NVARCHAR(20) PRIMARY KEY,
    TenLop NVARCHAR(50) NOT NULL,
    NienKhoa NVARCHAR(20),  -- Giá trị ví dụ: '2024-2025'
    GVChuNhiem NVARCHAR(50) FOREIGN KEY REFERENCES TaiKhoan(TenDangNhap)
);
GO

-- Một giáo viên chỉ chủ nhiệm tối đa 1 lớp tại MỘT thời điểm (Năm học)
CREATE UNIQUE INDEX UC_GVChuNhiem ON dbo.LopHoc(GVChuNhiem, NienKhoa) WHERE GVChuNhiem IS NOT NULL;
GO

CREATE TABLE MonHoc (
    MaMon NVARCHAR(20) PRIMARY KEY,
    TenMon NVARCHAR(100) NOT NULL,
    SoTinChi INT DEFAULT 0
);
GO

CREATE TABLE PhanCongGiangDay (
    MaPhanCong INT IDENTITY(1,1) PRIMARY KEY,
    MaGiaoVien NVARCHAR(50) FOREIGN KEY REFERENCES TaiKhoan(TenDangNhap),
    MaLop NVARCHAR(20) FOREIGN KEY REFERENCES LopHoc(MaLop),
    MaMon NVARCHAR(20) FOREIGN KEY REFERENCES MonHoc(MaMon),
    NienKhoa NVARCHAR(20) NOT NULL, -- THÊM MỚI: Phân công theo năm
    Thu NVARCHAR(20),
    Buoi NVARCHAR(20),
    Tiet NVARCHAR(20),
    CONSTRAINT UC_Lop_Mon_Nam UNIQUE (MaLop, MaMon, NienKhoa) -- Tránh phân công trùng lặp
);
GO

-- Khóa trùng lịch
CREATE UNIQUE INDEX UQ_Lop_ThoiGian_V2 ON dbo.PhanCongGiangDay(MaLop, NienKhoa, Thu, Buoi, Tiet) WHERE Thu IS NOT NULL AND Buoi IS NOT NULL AND Tiet IS NOT NULL;
GO

CREATE UNIQUE INDEX UQ_GiaoVien_ThoiGian_V2 ON dbo.PhanCongGiangDay(MaGiaoVien, NienKhoa, Thu, Buoi, Tiet) WHERE Thu IS NOT NULL AND Buoi IS NOT NULL AND Tiet IS NOT NULL;
GO

-----------------------------------------------------------
-- NHÓM 2: QUẢN LÝ HỌC TẬP (MÔ HÌNH V2 - HỖ TRỢ LỊCH SỬ)
-----------------------------------------------------------
CREATE TABLE HocSinh (
    MaHS NVARCHAR(20) PRIMARY KEY,
    HoTen NVARCHAR(100) NOT NULL,
    NgaySinh DATE,
    TaiKhoanPhuHuynh NVARCHAR(50) FOREIGN KEY REFERENCES TaiKhoan(TenDangNhap) ON UPDATE CASCADE,
    TrangThai NVARCHAR(50) NOT NULL DEFAULT N'Đang học',
    SDTPhuHuynh NVARCHAR(20),
    UuTienZalo BIT DEFAULT 1
);
GO

-- BẢNG SIÊU QUAN TRỌNG: Lưu lịch sử phân lớp của từng học sinh qua 5 năm
CREATE TABLE LichSuPhanLop (
    MaHS NVARCHAR(20) FOREIGN KEY REFERENCES HocSinh(MaHS),
    MaLop NVARCHAR(20) FOREIGN KEY REFERENCES LopHoc(MaLop),
    NienKhoa NVARCHAR(20) NOT NULL,
    PRIMARY KEY (MaHS, NienKhoa) -- Một học sinh chỉ được xếp vào 1 lớp duy nhất trong 1 năm học!
);
GO

CREATE TABLE BangDiem (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    MaHS NVARCHAR(20) FOREIGN KEY REFERENCES HocSinh(MaHS),
    MaMon NVARCHAR(20) FOREIGN KEY REFERENCES MonHoc(MaMon),
    NienKhoa NVARCHAR(20) NOT NULL, -- THÊM MỚI
    HocKy INT NOT NULL CHECK (HocKy IN (1, 2)), -- THÊM MỚI
    DiemChuyenCan FLOAT CHECK (DiemChuyenCan BETWEEN 0 AND 10),
    DiemThi FLOAT CHECK (DiemThi BETWEEN 0 AND 10),
    DiemTrungBinh AS (DiemChuyenCan * 0.3 + DiemThi * 0.7) PERSISTED,
    XepLoai NVARCHAR(10),
    NhanXet NVARCHAR(MAX),
    NgayCapNhat DATETIME DEFAULT GETDATE(),
    CONSTRAINT UC_HS_Mon_Nam_Ky UNIQUE (MaHS, MaMon, NienKhoa, HocKy) -- Siêu chống trùng lặp mới
);
GO

CREATE TABLE DiemDanh (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    MaHS NVARCHAR(20) FOREIGN KEY REFERENCES HocSinh(MaHS),
    NgayVang DATE DEFAULT GETDATE(),
    TrangThai NVARCHAR(50) CHECK (TrangThai IN (N'Có phép', N'Không phép')),
    NguoiDiemDanh NVARCHAR(50) FOREIGN KEY REFERENCES TaiKhoan(TenDangNhap),
    CONSTRAINT UQ_HS_NgayDiemDanh UNIQUE (MaHS, NgayVang)
);
GO

-----------------------------------------------------------
-- NHÓM 3: TƯƠNG TÁC
-----------------------------------------------------------
CREATE TABLE KeHoachLop (
    MaKeHoach INT IDENTITY(1,1) PRIMARY KEY,
    MaLop NVARCHAR(20) FOREIGN KEY REFERENCES LopHoc(MaLop),
    TieuDe NVARCHAR(255) NOT NULL,
    NoiDung NVARCHAR(MAX) NOT NULL,
    LoaiThongBao NVARCHAR(50) NOT NULL, 
    NgayDang DATETIME DEFAULT GETDATE(),
    NguoiDang NVARCHAR(50) FOREIGN KEY REFERENCES TaiKhoan(TenDangNhap),
    FileDinhKem NVARCHAR(500) NULL,
    CONSTRAINT CHK_LoaiThongBao CHECK (LoaiThongBao IN (N'Báo điểm', N'Báo kế hoạch'))
);
GO

CREATE TABLE TuongTac (
    MaTuongTac INT IDENTITY(1,1) PRIMARY KEY,
    MaKeHoach INT FOREIGN KEY REFERENCES KeHoachLop(MaKeHoach),
    TenDangNhap NVARCHAR(50) FOREIGN KEY REFERENCES TaiKhoan(TenDangNhap),
    NoiDung NVARCHAR(MAX) NOT NULL,
    ThoiGian DATETIME DEFAULT GETDATE(),
    TrangThai NVARCHAR(50) DEFAULT N'Mới'
);
GO


-----------------------------------------------------------
-- BƠM DỮ LIỆU ĐỂ BÁO CÁO TỐT NGHIỆP (MOCK DATA 5 NĂM LỊCH SỬ)
-----------------------------------------------------------
-- 1. THÊM TÀI KHOẢN
INSERT INTO TaiKhoan (TenDangNhap, MatKhau, HoTen, VaiTro) VALUES 
('hieutruong', '123456', N'Thầy Hiệu Trưởng Cấp Cao', 'HieuTruong'),
('gv_toan_1a', '123456', N'Cô Mai Dạy Toán', 'GiaoVien'),
('gv_van_1b', '123456', N'Thầy Hùng Dạy Văn', 'GiaoVien'),
('ph_danh', '123456', N'Phụ huynh bé Danh', 'PhuHuynh'),
('ph_an', '123456', N'Phụ huynh bé An', 'PhuHuynh');
GO

-- 2. THÊM MÔN HỌC
INSERT INTO MonHoc (MaMon, TenMon, SoTinChi) VALUES 
('TOAN', N'Toán học', 2),
('TV', N'Tiếng Việt', 2);
GO

-- 3. THÊM LỚP HỌC (Quá trình lên lớp 5 năm của bé Danh)
INSERT INTO LopHoc (MaLop, TenLop, NienKhoa, GVChuNhiem) VALUES 
('L1A_21', '1A', '2021-2022', 'gv_toan_1a'),
('L2A_22', '2A', '2022-2023', 'gv_van_1b'),
('L3A_23', '3A', '2023-2024', 'gv_toan_1a'),
('L4A_24', '4A', '2024-2025', 'gv_van_1b'),
('L5A_25', '5A', '2025-2026', 'gv_toan_1a'); -- Năm học hiện tại
GO

-- 4. THÊM HỌC SINH (Hồ sơ học sinh vĩnh viễn không đổi)
INSERT INTO HocSinh (MaHS, HoTen, NgaySinh, TaiKhoanPhuHuynh) VALUES 
('HS01', N'Em Lê Văn Danh', '2015-05-15', 'ph_danh'),
('HS02', N'Em Trần Thị An', '2015-08-20', 'ph_an');
GO

-- 5. LỊCH SỬ PHÂN LỚP (Bằng chứng đanh thép khi chạy Demo 5 năm)
INSERT INTO LichSuPhanLop (MaHS, MaLop, NienKhoa) VALUES 
('HS01', 'L1A_21', '2021-2022'), ('HS02', 'L1A_21', '2021-2022'), -- Lớp 1
('HS01', 'L2A_22', '2022-2023'), ('HS02', 'L2A_22', '2022-2023'), -- Lớp 2
('HS01', 'L3A_23', '2023-2024'), ('HS02', 'L3A_23', '2023-2024'), -- Lớp 3
('HS01', 'L4A_24', '2024-2025'), ('HS02', 'L4A_24', '2024-2025'), -- Lớp 4
('HS01', 'L5A_25', '2025-2026'), ('HS02', 'L5A_25', '2025-2026'); -- Lớp 5
GO

-- 6. BẢNG ĐIỂM (Lưu điểm từng học kỳ của suốt 5 năm - Thầy hỏi rớt nước mắt)
INSERT INTO BangDiem (MaHS, MaMon, NienKhoa, HocKy, DiemChuyenCan, DiemThi, XepLoai, NhanXet) VALUES 
-- Lớp 1 (Năm 2021-2022)
('HS01', 'TOAN', '2021-2022', 1, 9.0, 8.5, N'Giỏi', N'Học tốt, ngoan, cần luyện chữ'),
('HS01', 'TOAN', '2021-2022', 2, 9.0, 9.0, N'Giỏi', N'Tiến bộ rõ rệt học kỳ 2'),
-- Lớp 2 (Năm 2022-2023)
('HS01', 'TOAN', '2022-2023', 1, 8.0, 7.5, N'Khá', N'Phong độ giảm sút do COVID'),
('HS01', 'TOAN', '2022-2023', 2, 8.5, 8.0, N'Khá', N'Đã lấy lại đà học tập'),
-- Lớp 3 (Năm 2023-2024)
('HS01', 'TOAN', '2023-2024', 1, 9.0, 9.0, N'Giỏi', N'Hoàn thành xuất sắc'),
('HS01', 'TV',   '2023-2024', 1, 8.5, 9.0, N'Giỏi', N'Viết văn cảm xúc'),
('HS01', 'TOAN', '2023-2024', 2, 9.5, 9.5, N'Giỏi', N'Đạt giải nhì Toán cấp trường'),
-- Lớp 4 (Năm 2024-2025)
('HS01', 'TOAN', '2024-2025', 1, 9.5, 10.0, N'Giỏi', N'Cực kỳ thông minh'),
('HS01', 'TOAN', '2024-2025', 2, 10.0, 10.0, N'Giỏi', N'Thủ khoa khối 4'),
-- Lớp 5 (Hiện tại) Chưa có điểm thi, chỉ có điểm học kỳ 1 (Giả lập)
('HS01', 'TOAN', '2025-2026', 1, 10.0, 10.0, N'Giỏi', N'Tiếp tục duy trì phong độ');
GO

PRINT '=== THANH CONG: DA TAO DATABASE V2 VA BOM DU LIEU 5 NAM ===';
