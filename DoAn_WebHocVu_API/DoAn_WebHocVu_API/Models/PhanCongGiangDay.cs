using System;
using System.Collections.Generic;

namespace DoAn_WebHocVu_API.Models;

public partial class PhanCongGiangDay
{
    public int MaPhanCong { get; set; }

    public string? MaGiaoVien { get; set; }

    public string? MaLop { get; set; }

    public string? MaMon { get; set; }

    public string NienKhoa { get; set; } = null!;

    public string? Thu { get; set; }

    public string? Buoi { get; set; }

    public string? Tiet { get; set; }

    public virtual TaiKhoan? MaGiaoVienNavigation { get; set; }

    public virtual LopHoc? MaLopNavigation { get; set; }

    public virtual MonHoc? MaMonNavigation { get; set; }
}
