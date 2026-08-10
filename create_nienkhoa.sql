SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DanhMucNienKhoa' and xtype='U')
BEGIN
    CREATE TABLE DanhMucNienKhoa (
        MaNienKhoa NVARCHAR(20) PRIMARY KEY,
        TenNienKhoa NVARCHAR(100),
        IsActive BIT NOT NULL DEFAULT 0,
        NgayTao DATETIME NOT NULL DEFAULT GETDATE()
    );
END
GO

-- Insert default years
IF NOT EXISTS(SELECT 1 FROM DanhMucNienKhoa WHERE MaNienKhoa = '2025-2026') 
    INSERT INTO DanhMucNienKhoa (MaNienKhoa, TenNienKhoa, IsActive) VALUES ('2025-2026', N'Năm học 2025-2026', 1);

IF NOT EXISTS(SELECT 1 FROM DanhMucNienKhoa WHERE MaNienKhoa = '2026-2027') 
    INSERT INTO DanhMucNienKhoa (MaNienKhoa, TenNienKhoa, IsActive) VALUES ('2026-2027', N'Năm học 2026-2027', 0);
GO
