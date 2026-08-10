using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace DoAn_WebHocVu_API.Models;

public partial class DoAnWebHocVuAdvancedContext : DbContext
{
    public DoAnWebHocVuAdvancedContext()
    {
    }

    public DoAnWebHocVuAdvancedContext(DbContextOptions<DoAnWebHocVuAdvancedContext> options)
        : base(options)
    {
    }

    public virtual DbSet<BangDiem> BangDiems { get; set; }

    public virtual DbSet<DiemDanh> DiemDanhs { get; set; }

    public virtual DbSet<HocSinh> HocSinhs { get; set; }

    public virtual DbSet<KeHoachLop> KeHoachLops { get; set; }

    public virtual DbSet<LichSuPhanLop> LichSuPhanLops { get; set; }

    public virtual DbSet<LopHoc> LopHocs { get; set; }

    public virtual DbSet<DanhMucNienKhoa> DanhMucNienKhoas { get; set; }

    public virtual DbSet<MonHoc> MonHocs { get; set; }

    public virtual DbSet<PhanCongGiangDay> PhanCongGiangDays { get; set; }

    public virtual DbSet<TaiKhoan> TaiKhoans { get; set; }

    public virtual DbSet<TuongTac> TuongTacs { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
#warning To protect potentially sensitive information in your connection string, you should move it out of source code. You can avoid scaffolding the connection string by using the Name= syntax to read it from configuration - see https://go.microsoft.com/fwlink/?linkid=2131148. For more guidance on storing connection strings, see https://go.microsoft.com/fwlink/?LinkId=723263.
        => optionsBuilder.UseSqlServer("Server=ADMIN;Database=DoAn_WebHocVu_Advanced_V2;User Id=sa;Password=123456;TrustServerCertificate=True");

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<HocSinh>(entity => 
        {
            entity.Property(e => e.Nu).HasDefaultValueSql("((0))");
            entity.Property(e => e.DanTocKhac).HasDefaultValueSql("((0))");
        });

        modelBuilder.Entity<DanhMucNienKhoa>(entity =>
        {
            entity.HasKey(e => e.MaNienKhoa);
            entity.ToTable("DanhMucNienKhoa");
            entity.Property(e => e.MaNienKhoa).HasMaxLength(20);
            entity.Property(e => e.TenNienKhoa).HasMaxLength(100);
            entity.Property(e => e.NgayTao).HasColumnType("datetime").HasDefaultValueSql("(getdate())");
        });

        modelBuilder.Entity<BangDiem>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__BangDiem__3214EC277F387AC2");

            entity.ToTable("BangDiem");

            entity.HasIndex(e => new { e.MaHs, e.MaMon, e.NienKhoa, e.HocKy }, "UC_HS_Mon_Nam_Ky").IsUnique();

            entity.Property(e => e.Id).HasColumnName("ID");
            entity.Property(e => e.MaHs)
                .HasMaxLength(20)
                .HasColumnName("MaHS");
            entity.Property(e => e.MaMon).HasMaxLength(20);
            entity.Property(e => e.NgayCapNhat)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.NienKhoa).HasMaxLength(20);
            entity.Property(e => e.XepLoai).HasMaxLength(10);

            entity.HasOne(d => d.MaHsNavigation).WithMany(p => p.BangDiems)
                .HasForeignKey(d => d.MaHs)
                .HasConstraintName("FK__BangDiem__MaHS__286302EC");

            entity.HasOne(d => d.MaMonNavigation).WithMany(p => p.BangDiems)
                .HasForeignKey(d => d.MaMon)
                .HasConstraintName("FK__BangDiem__MaMon__29572725");
        });

        modelBuilder.Entity<DiemDanh>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__DiemDanh__3214EC27212E9121");

            entity.ToTable("DiemDanh");

            entity.HasIndex(e => new { e.MaHs, e.NgayVang }, "UQ_HS_NgayDiemDanh").IsUnique();

            entity.Property(e => e.Id).HasColumnName("ID");
            entity.Property(e => e.MaHs)
                .HasMaxLength(20)
                .HasColumnName("MaHS");
            entity.Property(e => e.NgayVang).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.NguoiDiemDanh).HasMaxLength(50);
            entity.Property(e => e.TrangThai).HasMaxLength(50);

            entity.HasOne(d => d.MaHsNavigation).WithMany(p => p.DiemDanhs)
                .HasForeignKey(d => d.MaHs)
                .HasConstraintName("FK__DiemDanh__MaHS__30F848ED");

            entity.HasOne(d => d.NguoiDiemDanhNavigation).WithMany(p => p.DiemDanhs)
                .HasForeignKey(d => d.NguoiDiemDanh)
                .HasConstraintName("FK__DiemDanh__NguoiD__33D4B598");
        });

        modelBuilder.Entity<HocSinh>(entity =>
        {
            entity.HasKey(e => e.MaHs).HasName("PK__HocSinh__2725A6EF2F97AA55");

            entity.ToTable("HocSinh");

            entity.Property(e => e.MaHs)
                .HasMaxLength(20)
                .HasColumnName("MaHS");
            entity.Property(e => e.HoTen).HasMaxLength(100);
            entity.Property(e => e.SdtphuHuynh)
                .HasMaxLength(20)
                .HasColumnName("SDTPhuHuynh");
            entity.Property(e => e.TaiKhoanPhuHuynh).HasMaxLength(50);
            entity.Property(e => e.TrangThai)
                .HasMaxLength(50)
                .HasDefaultValue("Ä ang há» c");
            entity.Property(e => e.UuTienZalo).HasDefaultValue(true);
            entity.Property(e => e.MaLop).HasMaxLength(20);

            entity.HasOne(d => d.TaiKhoanPhuHuynhNavigation).WithMany(p => p.HocSinhs)
                .HasForeignKey(d => d.TaiKhoanPhuHuynh)
                .HasConstraintName("FK__HocSinh__TaiKhoa__1ED998B2");

            entity.HasOne(d => d.MaLopNavigation).WithMany()
                .HasForeignKey(d => d.MaLop)
                .HasConstraintName("FK_HocSinh_LopHoc");
        });

        modelBuilder.Entity<KeHoachLop>(entity =>
        {
            entity.HasKey(e => e.MaKeHoach).HasName("PK__KeHoachL__88C5741FEC8BA32D");

            entity.ToTable("KeHoachLop");

            entity.Property(e => e.FileDinhKem).HasMaxLength(500);
            entity.Property(e => e.LoaiThongBao).HasMaxLength(50);
            entity.Property(e => e.MaLop).HasMaxLength(20);
            entity.Property(e => e.NgayDang)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.NguoiDang).HasMaxLength(50);
            entity.Property(e => e.TieuDe).HasMaxLength(255);

            entity.HasOne(d => d.MaLopNavigation).WithMany(p => p.KeHoachLops)
                .HasForeignKey(d => d.MaLop)
                .HasConstraintName("FK__KeHoachLo__MaLop__36B12243");

            entity.HasOne(d => d.NguoiDangNavigation).WithMany(p => p.KeHoachLops)
                .HasForeignKey(d => d.NguoiDang)
                .HasConstraintName("FK__KeHoachLo__Nguoi__38996AB5");
        });

        modelBuilder.Entity<LichSuPhanLop>(entity =>
        {
            entity.HasKey(e => new { e.MaHs, e.NienKhoa }).HasName("PK__LichSuPh__0E3EEA2B65FB42E2");

            entity.ToTable("LichSuPhanLop");

            entity.Property(e => e.MaHs)
                .HasMaxLength(20)
                .HasColumnName("MaHS");
            entity.Property(e => e.NienKhoa).HasMaxLength(20);
            entity.Property(e => e.MaLop).HasMaxLength(20);

            entity.HasOne(d => d.MaHsNavigation).WithMany(p => p.LichSuPhanLops)
                .HasForeignKey(d => d.MaHs)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__LichSuPhan__MaHS__239E4DCF");

            entity.HasOne(d => d.MaLopNavigation).WithMany(p => p.LichSuPhanLops)
                .HasForeignKey(d => d.MaLop)
                .HasConstraintName("FK__LichSuPha__MaLop__24927208");
        });

        modelBuilder.Entity<LopHoc>(entity =>
        {
            entity.HasKey(e => e.MaLop).HasName("PK__LopHoc__3B98D2738EA9EEE7");

            entity.ToTable("LopHoc");

            entity.HasIndex(e => new { e.GvchuNhiem, e.NienKhoa }, "UC_GVChuNhiem")
                .IsUnique()
                .HasFilter("([GVChuNhiem] IS NOT NULL)");

            entity.Property(e => e.MaLop).HasMaxLength(20);
            entity.Property(e => e.GvchuNhiem)
                .HasMaxLength(50)
                .HasColumnName("GVChuNhiem");
            entity.Property(e => e.NienKhoa).HasMaxLength(20);
            entity.Property(e => e.TenLop).HasMaxLength(50);

            entity.HasOne(d => d.GvchuNhiemNavigation).WithMany(p => p.LopHocs)
                .HasForeignKey(d => d.GvchuNhiem)
                .HasConstraintName("FK__LopHoc__GVChuNhi__1367E606");
        });

        modelBuilder.Entity<MonHoc>(entity =>
        {
            entity.HasKey(e => e.MaMon).HasName("PK__MonHoc__3A5B29A8B3117E38");

            entity.ToTable("MonHoc");

            entity.Property(e => e.MaMon).HasMaxLength(20);
            entity.Property(e => e.SoTinChi).HasDefaultValue(0);
            entity.Property(e => e.TenMon).HasMaxLength(100);
        });

        modelBuilder.Entity<PhanCongGiangDay>(entity =>
        {
            entity.HasKey(e => e.MaPhanCong).HasName("PK__PhanCong__C279D916C1DF0D1A");

            entity.ToTable("PhanCongGiangDay");

            entity.HasIndex(e => new { e.MaLop, e.MaMon, e.NienKhoa }, "UC_Lop_Mon_Nam").IsUnique();

            entity.HasIndex(e => new { e.MaGiaoVien, e.NienKhoa, e.Thu, e.Buoi, e.Tiet }, "UQ_GiaoVien_ThoiGian_V2")
                .IsUnique()
                .HasFilter("([Thu] IS NOT NULL AND [Buoi] IS NOT NULL AND [Tiet] IS NOT NULL)");

            entity.HasIndex(e => new { e.MaLop, e.NienKhoa, e.Thu, e.Buoi, e.Tiet }, "UQ_Lop_ThoiGian_V2")
                .IsUnique()
                .HasFilter("([Thu] IS NOT NULL AND [Buoi] IS NOT NULL AND [Tiet] IS NOT NULL)");

            entity.Property(e => e.Buoi).HasMaxLength(20);
            entity.Property(e => e.MaGiaoVien).HasMaxLength(50);
            entity.Property(e => e.MaLop).HasMaxLength(20);
            entity.Property(e => e.MaMon).HasMaxLength(20);
            entity.Property(e => e.NienKhoa).HasMaxLength(20);
            entity.Property(e => e.Thu).HasMaxLength(20);
            entity.Property(e => e.Tiet).HasMaxLength(20);

            entity.HasOne(d => d.MaGiaoVienNavigation).WithMany(p => p.PhanCongGiangDays)
                .HasForeignKey(d => d.MaGiaoVien)
                .HasConstraintName("FK__PhanCongG__MaGia__1A14E395");

            entity.HasOne(d => d.MaLopNavigation).WithMany(p => p.PhanCongGiangDays)
                .HasForeignKey(d => d.MaLop)
                .HasConstraintName("FK__PhanCongG__MaLop__1B0907CE");

            entity.HasOne(d => d.MaMonNavigation).WithMany(p => p.PhanCongGiangDays)
                .HasForeignKey(d => d.MaMon)
                .HasConstraintName("FK__PhanCongG__MaMon__1BFD2C07");
        });

        modelBuilder.Entity<TaiKhoan>(entity =>
        {
            entity.HasKey(e => e.TenDangNhap).HasName("PK__TaiKhoan__55F68FC1C294DC32");

            entity.ToTable("TaiKhoan");

            entity.Property(e => e.TenDangNhap).HasMaxLength(50);
            entity.Property(e => e.HoTen).HasMaxLength(100);
            entity.Property(e => e.MatKhau).HasMaxLength(255);
            entity.Property(e => e.VaiTro).HasMaxLength(50);
        });

        modelBuilder.Entity<TuongTac>(entity =>
        {
            entity.HasKey(e => e.MaTuongTac).HasName("PK__TuongTac__E947A5AC7CE49C4F");

            entity.ToTable("TuongTac");

            entity.Property(e => e.TenDangNhap).HasMaxLength(50);
            entity.Property(e => e.ThoiGian)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.TrangThai)
                .HasMaxLength(50)
                .HasDefaultValue("Má»›i");

            entity.HasOne(d => d.MaKeHoachNavigation).WithMany(p => p.TuongTacs)
                .HasForeignKey(d => d.MaKeHoach)
                .HasConstraintName("FK__TuongTac__MaKeHo__3C69FB99");

            entity.HasOne(d => d.TenDangNhapNavigation).WithMany(p => p.TuongTacs)
                .HasForeignKey(d => d.TenDangNhap)
                .HasConstraintName("FK__TuongTac__TenDan__3D5E1FD2");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
