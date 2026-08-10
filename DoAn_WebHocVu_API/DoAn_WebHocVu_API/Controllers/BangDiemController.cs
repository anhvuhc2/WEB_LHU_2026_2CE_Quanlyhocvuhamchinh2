using DoAn_WebHocVu_API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using DoAn_WebHocVu_API.Application.Interfaces;
using DoAn_WebHocVu_API.Application.DTOs;

namespace DoAn_WebHocVu_API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "GiaoVien,HieuTruong")] // CHỐT CHẶN VÒNG NGOÀI
    public class BangDiemController : ControllerBase
    {
        private readonly IBangDiemService _bangDiemService;

        public BangDiemController(IBangDiemService bangDiemService)
        {
            _bangDiemService = bangDiemService;
        }

        // ====================================================================
        // CHỨC NĂNG: NHẬP ĐIỂM / XẾP LOẠI LINH HOẠT THEO TIỂU HỌC 
        // ====================================================================
        [HttpPost("nhap-diem")]
        public async Task<IActionResult> NhapDiem([FromBody] NhapDiemDto model)
        {
            var maGiaoVien = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var result = await _bangDiemService.NhapDiemAsync(model, maGiaoVien ?? "");

            if (result.Success)
                return Ok(new { message = result.Message, data = result.Data });
            else
                return StatusCode(result.StatusCode, new { message = result.Message, data = result.Data });
        }

        [HttpGet("xem-diem/{maHS}")]
        public async Task<IActionResult> XemDiem(string maHS, [FromQuery] string? nienKhoa, [FromQuery] int? hocKy)
        {
            var result = await _bangDiemService.XemDiemAsync(maHS, nienKhoa, hocKy);
            if (result.Success) return Ok(result.Data);
            return StatusCode(result.StatusCode, new { message = result.Message });
        }

        /// <summary>
        /// API: Xuất Bảng Điểm Tổng (Chỉ GVCN mới được xuất)
        /// </summary>
        [HttpGet("xuat-bang-diem-tong/{maLop}")]
        [Authorize(Roles = "GiaoVien,HieuTruong")]
        public async Task<IActionResult> XuatBangDiemTong(string maLop, [FromQuery] string? nienKhoa, [FromQuery] int? hocKy)
        {
            var maGiaoVien = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            bool isHieuTruong = User.IsInRole("HieuTruong");
            
            var result = await _bangDiemService.XuatBangDiemTongAsync(maLop, maGiaoVien ?? "", isHieuTruong, nienKhoa, hocKy);
            
            if (result.Success) return Ok(new { message = result.Message, data = result.Data });
            
            if (!result.Success && result.Data != null)
                return BadRequest(new { message = result.Message, chiTietLoi = result.Data });
            
            return StatusCode(result.StatusCode, new { message = result.Message });
        }

        /// <summary>
        /// API: Gửi thông báo điểm cho phụ huynh qua Zalo / SMS (Đã chốt chặn logic quy trình)
        /// </summary>
        [HttpPost("gui-thong-bao-diem/{maLop}")]
        [Authorize(Roles = "GiaoVien")]
        public async Task<IActionResult> GuiThongBaoDiem(string maLop, [FromQuery] string? nienKhoa, [FromQuery] int? hocKy)
        {
            var maGiaoVien = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var result = await _bangDiemService.GuiThongBaoDiemAsync(maLop, maGiaoVien ?? "", nienKhoa, hocKy);

            if (result.Success) return Ok(new { message = result.Message });
            
            if (!result.Success && result.Data != null)
                return BadRequest(new { message = result.Message, chiTietLoi = result.Data });
                
            return StatusCode(result.StatusCode, new { message = result.Message });
        }

        [Microsoft.AspNetCore.Authorization.AllowAnonymous]
        [HttpGet("test-gui-thong-bao-diem/{maLop}")]
        public async Task<IActionResult> TestGuiThongBaoDiem(string maLop)
        {
            try
            {
                var result = await _bangDiemService.GuiThongBaoDiemAsync(maLop, "GV001_LanAnh");
                return Ok(new { success = result.Success, message = result.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { 
                    error = ex.Message, 
                    inner = ex.InnerException?.Message, 
                    stack = ex.StackTrace 
                });
            }
        }

        public class NhapDiemDto
        {
            public string? MaHS { get; set; }
            public string? MaMon { get; set; }
            public float? DiemThi { get; set; }
            public string? XepLoai { get; set; }
            public string? NhanXet { get; set; }
            public string? NienKhoa { get; set; }
            public int? HocKy { get; set; }
        }
    }
}