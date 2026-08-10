using System;
using System.Collections.Generic;

namespace DoAn_WebHocVu_API.Models;

public partial class LichSuPhanLop
{
    public string MaHs { get; set; } = null!;

    public string? MaLop { get; set; }

    public string NienKhoa { get; set; } = null!;

    public virtual HocSinh MaHsNavigation { get; set; } = null!;

    public virtual LopHoc? MaLopNavigation { get; set; }
}
