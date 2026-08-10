SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF NOT EXISTS(SELECT 1 FROM LopHoc WHERE MaLop = 'L4A_25') INSERT INTO LopHoc (MaLop, TenLop, NienKhoa, GVChuNhiem) VALUES ('L4A_25', '4A', '2025-2026', 'gv_van_1b');
GO

DECLARE @i INT = 1;
DECLARE @MaHS NVARCHAR(20);
DECLARE @HoTen NVARCHAR(100);
DECLARE @Lop NVARCHAR(20);

WHILE @i <= 25
BEGIN
    SET @MaHS = 'HS25_' + RIGHT('00' + CAST(@i AS VARCHAR), 3);
    SET @HoTen = N'Học Sinh Demo ' + CAST(@i AS NVARCHAR);
    
    DELETE FROM LichSuPhanLop WHERE MaHS = @MaHS;
    DELETE FROM BangDiem WHERE MaHS = @MaHS;
    DELETE FROM DiemDanh WHERE MaHS = @MaHS;
    DELETE FROM HocSinh WHERE MaHS = @MaHS;
    
    INSERT INTO HocSinh (MaHS, HoTen, NgaySinh, SDTPhuHuynh, TrangThai) 
    VALUES (@MaHS, @HoTen, '2015-01-01', '0901234567', N'Đang học');
    
    -- Phân bố: HS 1-5 -> Lóp 1A, HS 6-10 -> Lớp 2A...
    IF @i <= 5 SET @Lop = 'L1A_25';
    ELSE IF @i <= 10 SET @Lop = 'L2A_25';
    ELSE IF @i <= 15 SET @Lop = 'L3A_25';
    ELSE IF @i <= 20 SET @Lop = 'L4A_25';
    ELSE SET @Lop = 'L5A_25';
    
    INSERT INTO LichSuPhanLop (MaLop, MaHS, NienKhoa) VALUES (@Lop, @MaHS, '2025-2026');

    INSERT INTO BangDiem (MaHS, MaMon, NienKhoa, HocKy, DiemThi, XepLoai) VALUES (@MaHS, 'TOAN', '2025-2026', 1, 8, N'Tốt');
    INSERT INTO BangDiem (MaHS, MaMon, NienKhoa, HocKy, DiemThi, XepLoai) VALUES (@MaHS, 'TOAN', '2025-2026', 2, 9, N'Tốt');
    
    INSERT INTO BangDiem (MaHS, MaMon, NienKhoa, HocKy, DiemThi, XepLoai) VALUES (@MaHS, 'TV', '2025-2026', 1, 7, N'Hoàn thành');
    INSERT INTO BangDiem (MaHS, MaMon, NienKhoa, HocKy, DiemThi, XepLoai) VALUES (@MaHS, 'TV', '2025-2026', 2, 8, N'Tốt');

    SET @i = @i + 1;
END
GO
