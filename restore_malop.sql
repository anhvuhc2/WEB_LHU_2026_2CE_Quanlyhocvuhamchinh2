IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('HocSinh') AND name = 'MaLop')
BEGIN
    ALTER TABLE HocSinh ADD MaLop NVARCHAR(20) FOREIGN KEY REFERENCES LopHoc(MaLop);
END
GO

UPDATE HocSinh 
SET MaLop = (
    SELECT TOP 1 MaLop 
    FROM LichSuPhanLop 
    WHERE LichSuPhanLop.MaHS = HocSinh.MaHS 
    ORDER BY NienKhoa DESC
);
GO
