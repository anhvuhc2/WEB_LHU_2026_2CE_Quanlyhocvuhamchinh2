using System;

namespace DoAn_WebHocVu_API.Models;

public partial class DanhMucNienKhoa
{
    public string MaNienKhoa { get; set; } = null!;
    public string? TenNienKhoa { get; set; }
    public bool IsActive { get; set; }
    public DateTime NgayTao { get; set; }
}
