using System.Threading.Tasks;
using DoAn_WebHocVu_API.Application.DTOs;
using DoAn_WebHocVu_API.Controllers; // To access NhapDiemDto temporarily

namespace DoAn_WebHocVu_API.Application.Interfaces
{
    public interface IBangDiemService
    {
        Task<ServiceResult> NhapDiemAsync(BangDiemController.NhapDiemDto model, string maGiaoVien);
        Task<ServiceResult> XemDiemAsync(string maHs, string? nienKhoa, int? hocKy);
        Task<ServiceResult> XuatBangDiemTongAsync(string maLop, string maGiaoVien, bool isHieuTruong, string? nienKhoa = null, int? hocKy = null);
        Task<ServiceResult> GuiThongBaoDiemAsync(string maLop, string maGiaoVien, string? nienKhoa = null, int? hocKy = null);
    }
}
