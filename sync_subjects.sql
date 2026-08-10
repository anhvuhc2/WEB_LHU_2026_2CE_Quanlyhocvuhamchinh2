USE DoAn_WebHocVu_Advanced_V2;
GO
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- 1. Thêm các môn mới vào bảng MonHoc nếu chưa tồn tại
IF NOT EXISTS (SELECT 1 FROM MonHoc WHERE MaMon = 'TNXH')
    INSERT INTO MonHoc (MaMon, TenMon, SoTinChi) VALUES ('TNXH', N'Tự nhiên & Xã hội', 0);

IF NOT EXISTS (SELECT 1 FROM MonHoc WHERE MaMon = 'HĐTN')
    INSERT INTO MonHoc (MaMon, TenMon, SoTinChi) VALUES ('HĐTN', N'Hoạt động Trải nghiệm', 0);

IF NOT EXISTS (SELECT 1 FROM MonHoc WHERE MaMon = 'CN')
    INSERT INTO MonHoc (MaMon, TenMon, SoTinChi) VALUES ('CN', N'Công nghệ', 0);

IF NOT EXISTS (SELECT 1 FROM MonHoc WHERE MaMon = 'KH')
    INSERT INTO MonHoc (MaMon, TenMon, SoTinChi) VALUES ('KH', N'Khoa học', 0);

IF NOT EXISTS (SELECT 1 FROM MonHoc WHERE MaMon = 'ANH')
    INSERT INTO MonHoc (MaMon, TenMon, SoTinChi) VALUES ('ANH', N'Tiếng Anh', 0);

IF NOT EXISTS (SELECT 1 FROM MonHoc WHERE MaMon = 'LSĐL')
    INSERT INTO MonHoc (MaMon, TenMon, SoTinChi) VALUES ('LSĐL', N'Lịch sử & Địa lý', 0);
GO

-- 2. Kết chuyển dữ liệu từ mã cũ sang mã mới trong bảng PhanCongGiangDay
UPDATE PhanCongGiangDay SET MaMon = 'ANH' WHERE MaMon = 'NN';
UPDATE PhanCongGiangDay SET MaMon = 'LSĐL' WHERE MaMon = 'LSDL';
GO

-- 3. Kết chuyển dữ liệu từ mã cũ sang mã mới trong bảng BangDiem
UPDATE BangDiem SET MaMon = 'ANH' WHERE MaMon = 'NN';
UPDATE BangDiem SET MaMon = 'LSĐL' WHERE MaMon = 'LSDL';
GO

-- 4. Xóa mã cũ khỏi bảng MonHoc
DELETE FROM MonHoc WHERE MaMon = 'NN';
DELETE FROM MonHoc WHERE MaMon = 'LSDL';
GO
