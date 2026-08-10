'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Modal, Form, Input, DatePicker, message, Row, Col, Tabs, Space, Alert, Typography, Spin, Popconfirm, Badge, Radio, Select, Checkbox } from 'antd';
import { UserOutlined, PlusOutlined, CalendarOutlined, CheckCircleOutlined, LockOutlined, DeleteOutlined, KeyOutlined, TeamOutlined, DesktopOutlined, BookOutlined, SearchOutlined } from '@ant-design/icons';
import apiClient from '../../../services/apiClient';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

// Định nghĩa các interface khớp 100% schema DTO Backend C#
interface Student {
  maHs: string;
  hoTen: string;
  ngaySinh: string;
  maLop: string;
  taiKhoanPhuHuynh?: string;
  sdtPhuHuynh?: string;
  nu?: boolean;
  danTocKhac?: boolean;
  uuTienZalo?: boolean;
  trangThai: string; // "Đang học" hoặc "Đã chuyển trường"
}

interface Teacher {
  tenDangNhap: string;
  hoTen: string;
  vaiTro: string;
  nhiemVu: string;
}

interface LopHoc {
  maLop: string;
  tenLop: string;
  gvchuNhiem?: string;
  nienKhoa?: string;
}

interface Schedule {
  maPhanCong?: number;
  maGiaoVien: string;
  maLop: string;
  maMon: string;
  thu: string;
  buoi: string;
  tiet: string;
  nienKhoa?: string;
}

export default function ClassProfilePage() {
  const [role, setRole] = useState<string>('GiaoVien');
  const [currentUser, setCurrentUser] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // States dữ liệu thực tế từ SQL Server
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [lopHocs, setLopHocs] = useState<LopHoc[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  // Search/Filter states
  const [nienKhoaList, setNienKhoaList] = useState<string[]>([]);
  const [selectedNienKhoa, setSelectedNienKhoa] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [lookupTeacherId, setLookupTeacherId] = useState<string>('');

  // Lấy năm học mới nhất (đứng đầu danh sách) làm năm học hiện tại
  const [activeAcademicYear, setActiveAcademicYear] = useState<string>('');
  const isLocked = selectedNienKhoa !== activeAcademicYear && selectedNienKhoa !== '';
  const [showAllStudents, setShowAllStudents] = useState<boolean>(true);

  // Modals visibility
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isAssignHomeroomModalOpen, setIsAssignHomeroomModalOpen] = useState(false);
  const [isAssignSubjectModalOpen, setIsAssignSubjectModalOpen] = useState(false);
  const [isTeacherAccModalOpen, setIsTeacherAccModalOpen] = useState(false);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isParentAccModalOpen, setIsParentAccModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);

  const handleChotNienKhoa = async (nienKhoaToLock: string) => {
    try {
      const res = await apiClient.post('/QuanLyTruong/chot-nien-khoa', { maNienKhoa: nienKhoaToLock });
      message.success(res.data.message || `Đã chốt năm học ${nienKhoaToLock} làm năm hiện hành!`);
      setActiveAcademicYear(nienKhoaToLock);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Có lỗi xảy ra khi chốt niên khóa!');
    }
  };

  // Form hooks
  const [classForm] = Form.useForm();
  const [homeroomForm] = Form.useForm();
  const [subjectForm] = Form.useForm();
  const [teacherAccForm] = Form.useForm();
  const [studentForm] = Form.useForm();
  const [parentAccForm] = Form.useForm();

  // Student modal edit mode
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [monHocs, setMonHocs] = useState<any[]>([]);

  // Điểm danh state (Local mapping: maHs -> trạng thái vắng)
  const [attendanceList, setAttendanceList] = useState<{ maHs: string; trangThai: string }[]>([]);

  // Hàm phụ trợ giải mã JWT Token để đọc thông tin đăng nhập thực tế
  const parseJwt = (token: string) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        window
          .atob(base64)
          .split('')
          .map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = parseJwt(token);
      if (decoded) {
        // Lấy tên đăng nhập & vai trò từ JWT Claim của C#
        const username = decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] || decoded.sub || "";
        const userRole = decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role"] ||
          decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ||
          decoded.role ||
          "GiaoVien";
        setRole(userRole);
        setCurrentUser(username);
        setLookupTeacherId(username);
      }
    }

    // Tải dữ liệu ban đầu
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const decoded = parseJwt(token);
      const userRole = decoded?.role ||
        decoded?.["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role"] ||
        decoded?.["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ||
        'GiaoVien';
      const username = decoded?.sub || decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] || '';

      // Tải niên khóa hiện tại
      try {
        const resNK = await apiClient.get('/QuanLyTruong/nien-khoa-hien-tai');
        if (resNK.data?.activeAcademicYear) {
          setActiveAcademicYear(resNK.data.activeAcademicYear);
        }
      } catch (e) {
        console.warn("Could not fetch active academic year", e);
      }

      // Tải danh sách lớp trước tiên
      const resLop = await apiClient.get('/LopHoc/danh-sach');
      if (resLop.data && Array.isArray(resLop.data)) {
        setLopHocs(resLop.data);
        if (resLop.data.length > 0) {
          // Trích xuất danh sách Niên Khóa duy nhất (Sắp xếp giảm dần để hiển thị năm mới nhất)
          const uniqueNK = Array.from(new Set(resLop.data.map((x: any) => x.nienKhoa))).sort((a: any, b: any) => b.localeCompare(a));
          setNienKhoaList(uniqueNK as string[]);

          // Đối với Giáo viên, tự động chọn lớp họ chủ nhiệm (nếu có)
          const gvcnClass = resLop.data.find(l => l.gvchuNhiem === username);
          if (gvcnClass) {
            setSelectedNienKhoa(gvcnClass.nienKhoa);
            setSelectedClass(gvcnClass.maLop);
            fetchStudentsForClass(gvcnClass.maLop);
          } else if (uniqueNK.length > 0) {
            const firstNK = uniqueNK[0] as string;
            setSelectedNienKhoa(firstNK);
            const firstClassOfNK = resLop.data.find((x: any) => x.nienKhoa === firstNK);
            if (firstClassOfNK) {
              setSelectedClass(firstClassOfNK.maLop);
              fetchStudentsForClass(firstClassOfNK.maLop);
            }
          }
        }
      }

      // Tải danh sách giáo viên
      const resGv = await apiClient.get('/TaiKhoan/danh-sach-giao-vien');
      if (resGv.data && Array.isArray(resGv.data)) {
        setTeachers(resGv.data);
      }

      // Tải danh sách môn học
      const resMon = await apiClient.get('/QuanLyTruong/danh-sach-mon-hoc');
      if (resMon.data) setMonHocs(resMon.data);

      // Tải lịch dạy của bản thân
      if (username) {
        fetchScheduleForTeacher(username);
      }
    } catch (err: any) {
      console.error('Lỗi khi tải dữ liệu khởi chạy:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsForClass = async (classCode: string) => {
    if (!classCode) return;
    setLoading(true);
    try {
      // Đọc hồ sơ học sinh - API này trả về toàn bộ học sinh (bao gồm cả học sinh đã chuyển trường) nếu đang xem năm cũ
      const isArchivedYear = selectedNienKhoa !== activeAcademicYear && selectedNienKhoa !== '';
      const forceFetchAll = showAllStudents || isArchivedYear;
      const endpoint = forceFetchAll ? `/HocSinh/truy-xuat-ho-so/${classCode}` : `/LopHoc/${classCode}/danh-sach-hien-tai`;
      
      const res = await apiClient.get(endpoint);
      if (res.data && Array.isArray(res.data)) {
        setStudents(res.data);
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        message.warning('🛡️ Giới hạn bảo mật (403): Bạn không có quyền truy xuất lớp học này.');
      } else {
        message.error('Không thể tải học sinh lớp ' + classCode);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduleForTeacher = async (teacherId: string) => {
    if (!teacherId) return;

    // BƯỚC 1: Xóa trắng sạch sẽ bộ đệm của Table cũ
    setSchedules([]);
    setLoading(true);

    try {
      const res = await apiClient.get(`/TaiKhoan/lich-day/${teacherId}`);
      if (res.data && Array.isArray(res.data)) {

        // VÒNG BẢO VỆ FRONTEND: Loại bỏ rò rỉ dữ liệu lịch cũ bị cache hoặc trộn từ React State
        const strictFilter = res.data.filter(item =>
          item.maGiaoVien && item.maGiaoVien.trim().toUpperCase() === teacherId.trim().toUpperCase()
        );

        setSchedules(strictFilter);

      } else {
        setSchedules([]);
      }
    } catch (err: any) {
      console.warn('Lỗi khi tải lịch học của GV:', err.message);
      setSchedules([]);
    } finally {
      setTimeout(() => setLoading(false), 1000);
    }
  };

  // 1. Thêm Lớp Mới (Hiệu trưởng)
  const handleCreateClass = async (values: any) => {
    setLoading(true);
    try {
      await apiClient.post('/LopHoc/them-moi', {
        maLop: values.maLop,
        tenLop: values.tenLop
      });
      message.success(`Đã thêm lớp ${values.tenLop} thành công!`);
      setIsClassModalOpen(false);
      classForm.resetFields();
      fetchInitialData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể tạo lớp mới!');
    } finally {
      setLoading(false);
    }
  };

  // 2. Phân Công Chủ Nhiệm (Hiệu trưởng)
  const handleAssignHomeroom = async (values: any) => {
    setLoading(true);
    try {
      const res = await apiClient.post(`/QuanLyTruong/phan-cong-chu-nhiem?maLop=${values.maLop}&maGVCN=${values.maGVCN || ''}`);
      message.success(res.data.message || 'Phân công chủ nhiệm thành công!');
      setIsAssignHomeroomModalOpen(false);
      homeroomForm.resetFields();
      fetchInitialData();
    } catch (err: any) {
      Modal.error({
        title: '❌ Thất bại: Chặn quyền hoặc trùng lặp chủ nhiệm',
        content: err.response?.data?.message || 'Giáo viên này đã chủ nhiệm lớp khác!',
      });
    } finally {
      setLoading(false);
    }
  };

  // 3. Phân Công Giảng Dạy Bộ Môn & Chống Trùng (Hiệu trưởng)
  const handleAssignSubject = async (values: any) => {
    setLoading(true);
    try {
      const payload: Schedule = {
        maGiaoVien: values.maGiaoVien,
        maLop: values.maLop,
        maMon: values.maMon,
        thu: values.thu,
        buoi: values.buoi,
        tiet: values.tiet?.toString() || '',
        nienKhoa: activeAcademicYear
      };
      const res = await apiClient.post('/QuanLyTruong/phan-cong-bo-mon', payload);
      message.success(res.data.message || 'Phân công bộ môn giảng dạy thành công!');
      setIsAssignSubjectModalOpen(false);
      subjectForm.resetFields();
      if (lookupTeacherId) fetchScheduleForTeacher(lookupTeacherId);
    } catch (err: any) {
      Modal.error({
        title: '⚠️ Lỗi Trùng Lịch / Chặn Nghiệp Vụ',
        content: err.response?.data?.message || (err.response?.data?.errors ? JSON.stringify(err.response.data.errors) : (err.message || 'Lỗi hệ thống không xác định từ Server!'))
      });
    } finally {
      setLoading(false);
    }
  };

  // 3.1. Hủy Phân Công Giảng Dạy Bộ Môn (Hiệu trưởng)
  const handleDeleteSchedule = async (maPhanCong?: number) => {
    if (maPhanCong === undefined) return;
    setLoading(true);
    try {
      const res = await apiClient.delete(`/QuanLyTruong/xoa-phan-cong/${maPhanCong}`);
      message.success(res.data?.message || 'Đã hủy phân phân công dạy thành công!');
      if (lookupTeacherId) {
        fetchScheduleForTeacher(lookupTeacherId);
      } else if (currentUser) {
        fetchScheduleForTeacher(currentUser);
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi xóa phân công giảng dạy!');
    } finally {
      setLoading(false);
    }
  };

  // 4. Tạo Tài Khoản Giáo Viên Mới (Hiệu trưởng)
  const handleCreateTeacherAccount = async (values: any) => {
    setLoading(true);
    try {
      const payload = {
        tenDangNhap: values.tenDangNhap,
        matKhau: values.matKhau,
        hoTen: values.hoTen,
        vaiTro: 'GiaoVien'
      };
      await apiClient.post('/TaiKhoan/them-tai-khoan', payload);
      message.success(`Đã cấp tài khoản giáo viên mới cho thầy/cô ${values.hoTen}!`);
      setIsTeacherAccModalOpen(false);
      teacherAccForm.resetFields();
      fetchInitialData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi cấp tài khoản giáo viên!');
    } finally {
      setLoading(false);
    }
  };

  // 5. Reset Mật Khẩu Giáo Viên (Hiệu trưởng)
  const handleResetTeacherPassword = async (tenDangNhap: string) => {
    setLoading(true);
    try {
      const res = await apiClient.put(`/QuanLyTruong/reset-mat-khau/${tenDangNhap}`);
      Modal.success({
        title: 'Đã reset mật khẩu giáo viên!',
        content: res.data.message
      });
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể reset mật khẩu!');
    } finally {
      setLoading(false);
    }
  };

  // 6. Xóa Tài Khoản Giáo Viên (Hiệu trưởng)
  const handleDeleteTeacherAccount = async (tenDangNhap: string) => {
    setLoading(true);
    try {
      const res = await apiClient.delete(`/TaiKhoan/xoa-tai-khoan/${tenDangNhap}`);
      message.success(res.data.message || 'Đã xóa tài khoản giáo viên ra khỏi hệ thống!');
      fetchInitialData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi xóa tài khoản giáo viên!');
    } finally {
      setLoading(false);
    }
  };

  // 7. Thêm / Sửa học sinh (GVCN)
  const handleSaveStudent = async (values: any) => {
    setLoading(true);
    try {
      const payload = {
        maHs: values.maHs,
        hoTen: values.hoTen,
        ngaySinh: values.ngaySinh.format('YYYY-MM-DD'),
        maLop: selectedClass,
        sdtPhuHuynh: values.sdtPhuHuynh,
        uuTienZalo: values.uuTienZalo,
        nu: values.nu || false,
        danTocKhac: values.danTocKhac || false,
        trangThai: values.trangThai || 'Đang học',
        taiKhoanPhuHuynh: values.taiKhoanPhuHuynh?.trim() || null
      };

      if (editingStudent) {
        // Sửa hồ sơ
        const res = await apiClient.put(`/HocSinh/${editingStudent.maHs}`, payload);
        message.success(res.data.message || 'Đã sửa hồ sơ học sinh thành công!');
      } else {
        // Thêm học sinh
        const res = await apiClient.post('/HocSinh', payload);
        message.success(res.data.message || 'Đã thêm học sinh vào lớp chủ nhiệm!');
      }

      setIsStudentModalOpen(false);
      studentForm.resetFields();
      setEditingStudent(null);
      fetchStudentsForClass(selectedClass);
    } catch (err: any) {
      // API Backend có thể ném 400 Validation Error (data.title) hoặc 500
      const errMsg = err.response?.data?.message || err.response?.data?.title || 'Có lỗi xảy ra khi lưu! Vui lòng kiểm tra lại thông tin nhập (có thể do trùng mã HS).';
      message.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // 8. Thôi học / Chuyển trường học sinh (GVCN)
  const handleDeleteStudent = async (maHs: string) => {
    setLoading(true);
    try {
      const res = await apiClient.delete(`/HocSinh/${maHs}`);
      message.success(res.data.message || 'Đã chuyển trạng thái học sinh.');
      fetchStudentsForClass(selectedClass);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi xử lý xóa học sinh!');
    } finally {
      setLoading(false);
    }
  };

  // 9. Cấp tài khoản phụ huynh (GVCN / Hiệu trưởng)
  const handleCreateParentAccount = async (values: any) => {
    setLoading(true);
    try {
      const payload = {
        tenDangNhap: values.tenDangNhap,
        matKhau: values.matKhau,
        hoTen: values.hoTen,
        vaiTro: 'PhuHuynh'
      };
      // Gửi post kèm theo query maHS để liên kết
      const res = await apiClient.post(`/TaiKhoan/them-tai-khoan?maHS=${values.maHs}`, payload);
      message.success(res.data.message || 'Cấp tài khoản phụ huynh và liên kết thành công!');
      setIsParentAccModalOpen(false);
      parentAccForm.resetFields();
      fetchStudentsForClass(selectedClass);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi tạo và gắn tài khoản phụ huynh!');
    } finally {
      setLoading(false);
    }
  };

  // 10. Reset mật khẩu phụ huynh (GVCN)
  const handleResetParentPassword = async (maHs: string) => {
    setLoading(true);
    try {
      const res = await apiClient.put(`/TaiKhoan/reset-mat-khau-phu-huynh/${maHs}`);
      Modal.success({
        title: 'Reset Khôi Phục Mật Khẩu Phụ Huynh',
        content: (
          <div>
            <p>{res.data.message}</p>
            <p>Tên đăng nhập: <b>{res.data.tenDangNhap}</b></p>
            <p>Mật khẩu mới: <b>{res.data.matKhauMoi}</b></p>
            <p className="text-yellow-600 font-semibold">{res.data.luuY}</p>
          </div>
        )
      });
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khôi phục mật khẩu!');
    } finally {
      setLoading(false);
    }
  };

  // 11. Xóa tài khoản phụ huynh (GVCN / Hiệu trưởng)
  const handleDeleteParentAccount = async (tenDangNhap: string) => {
    if (!tenDangNhap) return;
    setLoading(true);
    try {
      const res = await apiClient.delete(`/TaiKhoan/xoa-tai-khoan/${tenDangNhap}`);
      message.success(res.data.message || 'Đã xóa tài khoản phụ huynh!');
      fetchStudentsForClass(selectedClass);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể xóa tài khoản phụ huynh này!');
    } finally {
      setLoading(false);
    }
  };

  // 12. Điểm danh (GVCN)
  const handleOpenAttendance = () => {
    // Điểm danh ban đầu coi như có học sinh vắng thì tích
    const initialList = students
      .filter(s => s.trangThai === 'Đang học')
      .map(s => ({ maHs: s.maHs, trangThai: 'Đi học' }));
    setAttendanceList(initialList);
    setIsAttendanceModalOpen(true);
  };

  const handleUpdateSingleAttendance = (maHs: string, status: string) => {
    setAttendanceList(prev => prev.map(item => item.maHs === maHs ? { ...item, trangThai: status } : item));
  };

  const handleSubmitAttendance = async () => {
    const listVangOnly = attendanceList.filter(item => item.trangThai !== 'Đi học');
    setLoading(true);
    try {
      // Gọi API điểm danh C# nhận List<ThongTinVang>
      const payload = listVangOnly.map(item => ({
        maHs: item.maHs,
        trangThai: item.trangThai
      }));
      const res = await apiClient.post(`/LopHoc/${selectedClass}/diem-danh`, payload);
      message.success(res.data.message || `Đã điểm danh (${listVangOnly.length} em vắng) thành công!`);
      setIsAttendanceModalOpen(false);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Có lỗi xảy ra khi gọi API điểm danh!');
    } finally {
      setLoading(false);
    }
  };

  // --- RENDERING CONFIG FOR COLUMNS ---

  // Bảng học sinh dành cho Giáo viên / Hiệu trưởng
  const studentColumns = [
    { title: 'Mã HS', dataIndex: 'maHs', key: 'maHs', render: (text: string) => <b>{text}</b> },
    { title: 'Họ và Tên', dataIndex: 'hoTen', key: 'hoTen', className: 'font-semibold text-slate-800' },
    { title: 'Nữ', dataIndex: 'nu', key: 'nu', className: 'text-center', render: (val: boolean) => val ? <span className="font-bold text-pink-600">x</span> : '' },
    { title: 'Dân tộc khác', dataIndex: 'danTocKhac', key: 'danTocKhac', className: 'text-center', render: (val: boolean) => val ? <span className="font-bold text-emerald-600">x</span> : '' },
    {
      title: 'Ngày Sinh',
      dataIndex: 'ngaySinh',
      key: 'ngaySinh',
      render: (text: string) => text ? dayjs(text).format('DD/MM/YYYY') : 'Chưa nhập'
    },
    { title: 'SDT Phụ Huynh', dataIndex: 'sdtPhuHuynh', key: 'sdtPhuHuynh', render: (t: any) => t || 'Chưa cập nhật' },
    {
      title: 'Zalo Ưu Tiên',
      dataIndex: 'uuTienZalo',
      key: 'uuTienZalo',
      render: (zalo: boolean) => zalo ? <Tag color="blue">Ưu tiên Zalo</Tag> : <Tag color="gray">SMS Thường</Tag>
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'trangThai',
      key: 'trangThai',
      render: (t: string) => t === 'Đang học' ? <Tag color="green">Đang học</Tag> : <Tag color="volcano">{t}</Tag>
    },
    {
      title: 'Quyên Phụ Huynh',
      key: 'parentAccount',
      render: (_: any, record: Student) => (
        record.taiKhoanPhuHuynh ? (
          <Space orientation="vertical" size={2}>
            <span>Tài khoản: <Badge status="success" text={record.taiKhoanPhuHuynh} /></span>
            <Space>
              <Button size="small" disabled={record.trangThai === 'Đã chuyển trường' || isLocked} type="link" danger icon={<DeleteOutlined />} onClick={() => handleDeleteParentAccount(record.taiKhoanPhuHuynh!)}>Xóa</Button>
              <Button size="small" disabled={record.trangThai === 'Đã chuyển trường' || isLocked} type="link" icon={<KeyOutlined />} onClick={() => handleResetParentPassword(record.maHs)}>Reset</Button>
            </Space>
          </Space>
        ) : (
          <Button
            size="small"
            type="dashed"
            disabled={record.trangThai === 'Đã chuyển trường' || isLocked}
            icon={<PlusOutlined />}
            onClick={() => {
              parentAccForm.setFieldsValue({ maHs: record.maHs, tenDangNhap: `PH_${record.maHs.trim()}`, hoTen: `Phụ huynh em ${record.hoTen}` });
              setIsParentAccModalOpen(true);
            }}
          >
            Cấp tài khoản PH
          </Button>
        )
      )
    },
    {
      title: 'Hành động',
      key: 'actions',
      render: (_: any, record: Student) => {
        // GVCN có quyền sửa học sinh của lớp mình, GVBM chỉ xem
        return (
          <Space>
            <Button
              size="small"
              disabled={isLocked}
              onClick={() => {
                setEditingStudent(record);
                studentForm.setFieldsValue({
                  maHs: record.maHs,
                  hoTen: record.hoTen,
                  ngaySinh: record.ngaySinh ? dayjs(record.ngaySinh) : null,
                  sdtPhuHuynh: record.sdtPhuHuynh,
                  nu: record.nu,
                  danTocKhac: record.danTocKhac,
                  uuTienZalo: record.uuTienZalo,
                  trangThai: record.trangThai,
                  taiKhoanPhuHuynh: record.taiKhoanPhuHuynh
                });
                setIsStudentModalOpen(true);
              }}
            >
              Sửa
            </Button>
            {record.trangThai === 'Đang học' && (
              <Popconfirm
                title="Xác nhận thôi học/chuyển trường?"
                description="Đổi trạng thái học sinh thành 'Đã chuyển trường' để khóa nhập điểm."
                onConfirm={() => handleDeleteStudent(record.maHs)}
                okText="Đồng ý"
                cancelText="Hủy"
              >
                <Button size="small" danger disabled={isLocked}>Thôi học</Button>
              </Popconfirm>
            )}
          </Space>
        );
      }
    }
  ];

  // Bảng giáo viên dành cho Hiệu trưởng và Giáo viên xem danh bạ
  const teacherColumns = [
    { title: 'Tên Đăng Nhập (Mã GV)', dataIndex: 'tenDangNhap', key: 'tenDangNhap', render: (text: string) => <b>{text}</b> },
    { title: 'Họ và Tên', dataIndex: 'hoTen', key: 'hoTen', className: 'font-semibold text-slate-800' },
    { title: 'Nhiệm Vụ', dataIndex: 'nhiemVu', key: 'nhiemVu', render: (text: string) => <Tag color="blue">{text}</Tag> },
    ...(role === 'HieuTruong' ? [{
      title: 'Điều phối Tài khoản',
      key: 'management',
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" icon={<KeyOutlined />} onClick={() => handleResetTeacherPassword(record.tenDangNhap)}>
            Reset Pass
          </Button>
          <Popconfirm
            title={`Tước thẻ giáo viên ${record.hoTen}?`}
            description="Điều này sẽ gỡ cả lịch phân công và chức chủ nhiệm ra khỏi Database."
            onConfirm={() => handleDeleteTeacherAccount(record.tenDangNhap)}
            okText="Xóa bỏ"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>Xóa tài khoản</Button>
          </Popconfirm>
        </Space>
      )
    }] : [])
  ];

  // Bảng phân công môn học dành cho Hiệu trưởng & Giáo viên xem
  const scheduleColumns = [
    { title: 'Thứ', dataIndex: 'thu', key: 'thu', className: 'font-semibold' },
    { title: 'Buổi', dataIndex: 'buoi', key: 'buoi' },
    { title: 'Tiết dạy', dataIndex: 'tiet', key: 'tiet' },
    { title: 'Lớp', dataIndex: 'maLop', key: 'maLop', render: (text: string) => <Tag color="purple">{text}</Tag> },
    { title: 'Giáo Viên dạy', dataIndex: 'maGiaoVien', key: 'maGiaoVien', className: 'text-blue-600 font-semibold' },
    { title: 'Mã Môn', dataIndex: 'maMon', key: 'maMon', render: (text: string) => <Tag color="cyan">{text}</Tag> },
    ...(role === 'HieuTruong' ? [{
      title: 'Hành động',
      key: 'actions',
      render: (_: any, record: Schedule) => (
        <Popconfirm
          title="Xác nhận hủy phân công môn học này?"
          description="Lịch dạy của giáo viên sẽ bị xóa hoàn toàn khỏi lớp này."
          onConfirm={() => handleDeleteSchedule(record.maPhanCong)}
          okText="Đồng ý"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
          disabled={isLocked || record.maPhanCong === -1}
        >
          <Button
            size="small"
            danger
            type="link"
            icon={<DeleteOutlined />}
            disabled={isLocked || record.maPhanCong === -1}
          >
            Hủy phân công
          </Button>
        </Popconfirm>
      )
    }] : [])
  ];

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Title level={3} className="m-0 text-slate-800">Quản trị Lớp học & Hồ sơ Học vụ</Title>
          <Paragraph className="text-slate-500 text-xs">Module 1: Dữ liệu phân quyền học bạ & thuật toán tối ưu chống chồng lịch.</Paragraph>
        </div>
      </div>

      <Alert
        title="🛡️ Quy chế kiểm soát phân quyền C# Backend"
        description="Điểm danh và Thao tác Hồ sơ học sinh chỉ dành cho GVCN của lớp đó. Mọi tài khoản GVBM chỉ có quyền Read-only. Ban giám hiệu (Hiệu trưởng) quản lý toàn bộ hệ thống nhân sự, lớp học, phân công giảng dạy chống trùng lịch."
        type="info"
        showIcon
        className="mb-6 rounded-xl"
      />

      <Tabs
        type="card"
        defaultActiveKey="students"
        className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"
        items={[
          // TAB 1: Danh sách học sinh & điểm danh (Giáo viên / Hiệu trưởng đều truy cập được)
          {
            key: 'students',
            label: <span><TeamOutlined />Hồ Sơ Học Sinh</span>,
            children: (
              <div>
                <Row gutter={[16, 16]} className="mb-4" align="middle" justify="space-between">
                  <Col>
                    <Space>
                      <Text className="font-semibold text-slate-800">Năm Học:</Text>
                      <Select 
                        value={selectedNienKhoa || undefined} 
                        onChange={(val) => {
                          setSelectedNienKhoa(val);
                          const classesInYear = lopHocs.filter((c: any) => c.nienKhoa === val);
                          if (classesInYear.length > 0) {
                             setSelectedClass(classesInYear[0].maLop);
                             fetchStudentsForClass(classesInYear[0].maLop);
                          } else {
                             setSelectedClass('');
                             setStudents([]);
                          }
                        }} 
                        options={nienKhoaList.map(nk => ({ value: nk, label: nk }))}
                        className="font-bold min-w-[140px]"
                      />
                      {role === 'HieuTruong' && selectedNienKhoa !== activeAcademicYear && selectedNienKhoa !== '' && (
                        <Popconfirm title={`Chốt niên khóa ${selectedNienKhoa} làm năm hiện hành (Mở khóa sửa đổi)?`} onConfirm={() => handleChotNienKhoa(selectedNienKhoa)}>
                          <Button type="primary" danger icon={<LockOutlined />}>Chốt Năm Này</Button>
                        </Popconfirm>
                      )}

                      <Text className="font-semibold ml-4">Chọn Lớp ({selectedNienKhoa}):</Text>
                      <div className="flex gap-2 border-l-2 border-indigo-100 pl-4">
                        {lopHocs.filter((c: any) => c.nienKhoa === selectedNienKhoa).map((classItem: any) => (
                          <Button
                            key={classItem.maLop}
                            type={selectedClass === classItem.maLop ? 'primary' : 'default'}
                            onClick={() => {
                              setSelectedClass(classItem.maLop);
                              fetchStudentsForClass(classItem.maLop);
                            }}
                          >
                            Lớp {classItem.tenLop}
                          </Button>
                        ))}
                      </div>
                    </Space>
                  </Col>

                  <Col>
                    <Space>
                      {/* Chỉ GVCN lớp đó và Hiệu trưởng mới được nhập điểm danh và thêm học sinh */}
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        disabled={isLocked}
                        onClick={() => {
                          setEditingStudent(null);
                          studentForm.resetFields();
                          setIsStudentModalOpen(true);
                        }}
                      >
                        Thêm Học Sinh Mới
                      </Button>
                      <Button
                        type="default"
                        icon={<CheckCircleOutlined />}
                        className="bg-emerald-50 text-emerald-600 border-emerald-200"
                        disabled={isLocked}
                        onClick={handleOpenAttendance}
                      >
                        Mở Điểm Danh Lớp
                      </Button>
                    </Space>
                  </Col>
                </Row>

                {isLocked && (
                  <Alert message="🛡️ Dữ liệu năm học cũ đã khóa sổ (Archived). Tính năng chỉnh sửa, thêm mới và điểm danh đều bị vô hiệu hóa." type="error" showIcon className="mb-4 rounded-xl" />
                )}

                <div className="mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex justify-around items-center">
                  <div className="text-center">
                    <div className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Tổng Sĩ Số Sắp Lớp</div>
                    <div className="text-3xl font-bold text-indigo-700">{students.filter(s => s.trangThai === 'Đang học').length} <span className="text-lg font-normal text-indigo-400">em</span></div>
                  </div>
                  <div className="w-px h-12 bg-indigo-200"></div>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Số Học Sinh Nữ</div>
                    <div className="text-3xl font-bold text-pink-600">{students.filter(s => s.nu && s.trangThai === 'Đang học').length} <span className="text-lg font-normal text-pink-300">em</span></div>
                  </div>
                  <div className="w-px h-12 bg-indigo-200"></div>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Dân Tộc Khác</div>
                    <div className="text-3xl font-bold text-emerald-600">{students.filter(s => s.danTocKhac && s.trangThai === 'Đang học').length} <span className="text-lg font-normal text-emerald-300">em</span></div>
                  </div>
                </div>

                <Spin spinning={loading} description="Đang tải danh sách học sinh...">
                  <Table
                    dataSource={students}
                    columns={studentColumns}
                    rowKey="maHs"
                    pagination={false}
                    size="middle"
                    className="border border-slate-100 rounded-lg overflow-hidden"
                  />
                </Spin>
              </div>
            )
          },

          // TAB 2: Lịch dạy & Phân Phối (GV và Hiệu trưởng xem toàn phần tránh chồng chéo)
          {
            key: 'schedule',
            label: <span><CalendarOutlined />Lịch Dạy & Phân Công môn</span>,
            children: (
              <div>
                <Row gutter={[16, 16]} className="mb-4" align="middle" justify="space-between">
                  <Col>
                    <Space>
                      <Text className="font-semibold">Kiểm tra Ủy Quyền Dạy Thay / Dạy Chéo:</Text>
                      <Input id="chkMaGiaoVien" placeholder="Mã GV (VD: gv-theduc)" style={{ width: 140 }} />
                      <Input id="chkMaLop" placeholder="Mã Lớp" style={{ width: 90 }} />
                      <Input id="chkMaMon" placeholder="Mã Môn" style={{ width: 90 }} />
                      <Button type="default" icon={<SearchOutlined />} onClick={async () => {
                        const mgv = (document.getElementById('chkMaGiaoVien') as HTMLInputElement)?.value;
                        const mlop = (document.getElementById('chkMaLop') as HTMLInputElement)?.value;
                        const mmon = (document.getElementById('chkMaMon') as HTMLInputElement)?.value;
                        if (!mgv || !mlop || !mmon) return message.warning('Vui lòng nhập đủ 3 trường hợp mã định danh!');
                        try {
                          const res = await apiClient.get(`/TaiKhoan/kiem-tra-phan-cong?maGiaoVien=${mgv}&maLop=${mlop}&maMon=${mmon}`);
                          Modal.success({ title: 'Tra Cứu Hợp Lệ CSDL', content: res.data.message });
                        } catch (err: any) {
                          Modal.error({ title: 'Tra Cứu Thất Bại', content: err.response?.data?.message || 'Giáo viên không có quyền đảm nhận phân công này tại thời điểm hiện tại!' });
                        }
                      }}>Tra cứu quyền</Button>
                    </Space>
                  </Col>
                </Row>

                <Row gutter={[16, 16]} className="mb-4" align="middle" justify="space-between">
                  <Col>
                    <Space>
                      <Text className="font-semibold">Xem lịch dạy của Giáo viên:</Text>
                      <Input
                        placeholder="Mã Giáo Viên (ví dụ: GVCN1A)"
                        value={lookupTeacherId}
                        onChange={(e) => setLookupTeacherId(e.target.value)}
                        style={{ width: '180px' }}
                      />
                      <Button type="primary" onClick={() => fetchScheduleForTeacher(lookupTeacherId)}>Tải Lịch Biểu</Button>
                    </Space>
                  </Col>

                  {role === 'HieuTruong' && (
                    <Col>
                      <Space>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsAssignSubjectModalOpen(true)}>
                          Xếp Phân Công Mới
                        </Button>
                        <Button type="dashed" icon={<PlusOutlined />} onClick={() => setIsAssignHomeroomModalOpen(true)}>
                          Phân Công GVCN
                        </Button>
                      </Space>
                    </Col>
                  )}
                </Row>

                <Spin spinning={loading} description="Đang tải thời lịch biểu...">
                  <Table
                    dataSource={schedules}
                    columns={scheduleColumns}
                    rowKey={(record) => record.maPhanCong?.toString() || Math.random().toString()}
                    pagination={false}
                    size="middle"
                    className="border border-slate-100 rounded-lg overflow-hidden"
                  />
                </Spin>
              </div>
            )
          },

          // TAB 3: Quản trị Hệ Thống Nhân Sự & Danh Bạ Nội Bộ
          ...(['HieuTruong', 'GiaoVien'].includes(role) ? [
            {
              key: 'teachers',
              label: <span><DesktopOutlined />Ban Giám Hiệu & Giáo Viên</span>,
              children: (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold text-slate-700">Tổng số giáo viên trong toàn trường: <Tag color="blue">{teachers.length}</Tag></span>
                    <Space>
                      {role === 'HieuTruong' && (
                        <>
                          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsTeacherAccModalOpen(true)}>
                            Cấp Tài Khoản Giáo Viên
                          </Button>
                          <Button type="dashed" icon={<PlusOutlined />} onClick={() => setIsClassModalOpen(true)}>
                            Thêm Lớp Mới
                          </Button>
                        </>
                      )}
                    </Space>
                  </div>

                  <Spin spinning={loading} description="Đang đọc cơ sở giáo viên...">
                    <Table
                      dataSource={teachers}
                      columns={teacherColumns}
                      rowKey="tenDangNhap"
                      pagination={false}
                      size="middle"
                      className="border border-slate-100 rounded-lg overflow-hidden"
                    />
                  </Spin>
                </div>
              )
            }
          ] : [])
        ]}
      />

      {/* Modal 1: Nhập phân công giảng dạy (BGH Xếp Lịch) */}
      <Modal
        title="Xếp Phân Công Giảng Dạy & Tránh Trùng Lịch"
        open={isAssignSubjectModalOpen}
        onCancel={() => setIsAssignSubjectModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Alert
          title="Yêu cầu chống trùng C# Server"
          description="Nhập tay mã giáo viên, mã lớp và mã môn. Hệ thống tự động báo trùng lịch nếu giáo viên bị xếp trùng giờ tại lớp khác."
          type="warning"
          showIcon
          className="mb-4"
        />
        <Form form={subjectForm} layout="vertical" onFinish={handleAssignSubject}>
          <Form.Item name="maGiaoVien" label="Mã Giáo Viên (Tài khoản GV)" rules={[{ required: true, message: 'Nhập mã giáo viên!' }]}>
            <Select placeholder="Mở danh sách để chọn Giáo viên..." showSearch optionFilterProp="children">
              {teachers.map(t => <Select.Option key={t.tenDangNhap} value={t.tenDangNhap}>{t.hoTen} ({t.tenDangNhap})</Select.Option>)}
            </Select>
          </Form.Item>

          <Form.Item name="maLop" label="Lớp Học Phân Công" rules={[{ required: true, message: 'Nhập mã lớp!' }]}>
            <Select placeholder="Chọn lớp thuộc năm học hiện tại...">
              {lopHocs.filter((c: any) => c.nienKhoa === activeAcademicYear).map(c => <Select.Option key={c.maLop} value={c.maLop}>{c.tenLop} ({c.maLop})</Select.Option>)}
            </Select>
          </Form.Item>

          <Form.Item name="maMon" label="Môn Học Phân Công" rules={[{ required: true, message: 'Nhập mã môn!' }]}>
            <Select placeholder="Mở danh sách để chọn Môn học...">
              {monHocs.map(m => <Select.Option key={m.maMon} value={m.maMon}>{m.tenMon} ({m.maMon})</Select.Option>)}
            </Select>
          </Form.Item>

          <Row gutter={8}>
            <Col span={8}>
              <Form.Item name="thu" label="Thứ" rules={[{ required: true }]}>
                <Select>
                  {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'].map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="buoi" label="Buổi" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="Sáng">Sáng</Select.Option>
                  <Select.Option value="Chiều">Chiều</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="tiet" label="Tiết Số" rules={[{ required: true }]}>
                <Select>
                  {['1', '2', '3', '4', '5'].map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item className="mb-0 flex justify-end">
            <Space>
              <Button onClick={() => setIsAssignSubjectModalOpen(false)}>Hủy bỏ</Button>
              <Button type="primary" htmlType="submit">Ghi Nhận Phân Công</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal 2: Phân công chủ nhiệm lớp (Hiệu trưởng) */}
      <Modal
        title="Phân Công Giáo Viên Chủ Nhiệm"
        open={isAssignHomeroomModalOpen}
        onCancel={() => setIsAssignHomeroomModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={homeroomForm} layout="vertical" onFinish={handleAssignHomeroom}>
          <Form.Item name="maLop" label="Lớp Học" rules={[{ required: true, message: 'Nhập mã lớp học!' }]}>
            <Select placeholder="Chọn lớp thuộc năm học hiện tại...">
              {lopHocs.filter((c: any) => c.nienKhoa === activeAcademicYear).map(c => <Select.Option key={c.maLop} value={c.maLop}>{c.tenLop} ({c.maLop})</Select.Option>)}
            </Select>
          </Form.Item>

          <Form.Item name="maGVCN" label="Chọn Mã GVCN mới" rules={[{ required: false }]}>
            <Select placeholder="Chọn giáo viên hoặc để trống để gỡ" allowClear>
              {teachers.map(t => <Select.Option key={t.tenDangNhap} value={t.tenDangNhap}>{t.hoTen} ({t.tenDangNhap})</Select.Option>)}
            </Select>
          </Form.Item>

          <Form.Item className="mb-0 flex justify-end">
            <Space>
              <Button onClick={() => setIsAssignHomeroomModalOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit">Phân Chủ Nhiệm</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal 3: Thêm lớp mới */}
      <Modal
        title="BGH Tạo Lớp Học Mới"
        open={isClassModalOpen}
        onCancel={() => setIsClassModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={classForm} layout="vertical" onFinish={handleCreateClass}>
          <Form.Item name="maLop" label="Mã Lớp Học (Mã CSDL)" rules={[{ required: true, message: 'Nhập mã lớp học!' }]}>
            <Input placeholder="ví dụ: L4A, L5B" />
          </Form.Item>

          <Form.Item name="tenLop" label="Tên Lớp Học" rules={[{ required: true, message: 'Nhập tên lớp học!' }]}>
            <Input placeholder="ví dụ: 4A, 5B" />
          </Form.Item>

          <Form.Item className="mb-0 flex justify-end">
            <Space>
              <Button onClick={() => setIsClassModalOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit">Lưu Lớp</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal 4: Tạo tài khoản giáo viên mới */}
      <Modal
        title="Cấp Tài Khoản Giáo Viên Giáo Dục"
        open={isTeacherAccModalOpen}
        onCancel={() => setIsTeacherAccModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={teacherAccForm} layout="vertical" onFinish={handleCreateTeacherAccount}>
          <Form.Item name="tenDangNhap" label="Tên Đăng Nhập (Tài khoản GV)" rules={[{ required: true, message: 'Nhập tên đăng nhập!' }]}>
            <Input placeholder="ví dụ: GVCN5A, gv-amnhac" />
          </Form.Item>

          <Form.Item name="matKhau" label="Mật Khẩu Khởi Tạo" rules={[{ required: true, message: 'Nhập mật khẩu!' }]}>
            <Input.Password placeholder="Nhập mật khẩu" />
          </Form.Item>

          <Form.Item name="hoTen" label="Họ và Tên Giáo Viên" rules={[{ required: true, message: 'Nhập họ tên!' }]}>
            <Input placeholder="ví dụ: Nguyễn Văn Hải" />
          </Form.Item>

          <Form.Item className="mb-0 flex justify-end">
            <Space>
              <Button onClick={() => setIsTeacherAccModalOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit">Cấp Tài Khoản</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal 5: Thêm / Sửa học sinh lớp (GVCN) */}
      <Modal
        title={editingStudent ? "Cập Nhật Hồ Sơ Học Sinh" : "Thêm Học Sinh Mới Vào Lớp Chủ Nhiệm"}
        open={isStudentModalOpen}
        onCancel={() => {
          setIsStudentModalOpen(false);
          setEditingStudent(null);
        }}
        footer={null}
        destroyOnHidden
      >
        <Form form={studentForm} layout="vertical" onFinish={handleSaveStudent}>
          <Form.Item name="maHs" label="Mã Học Sinh (Mã CSDL)" rules={[{ required: true, message: 'Nhập mã học sinh!' }]}>
            <Input placeholder="ví dụ: HS01" disabled={!!editingStudent} />
          </Form.Item>

          <Form.Item name="hoTen" label="Họ và Tên Bé" rules={[{ required: true, message: 'Nhập họ tên!' }]}>
            <Input placeholder="Nhập đầy đủ họ và tên" disabled={editingStudent?.trangThai === 'Đã chuyển trường'} />
          </Form.Item>

          <Row gutter={16} className="mb-2">
            <Col span={12}>
              <Form.Item name="nu" valuePropName="checked" className="mb-0">
                <Checkbox disabled={editingStudent?.trangThai === 'Đã chuyển trường'}>Là Học Sinh Nữ</Checkbox>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="danTocKhac" valuePropName="checked" className="mb-0">
                <Checkbox disabled={editingStudent?.trangThai === 'Đã chuyển trường'}>Dân Tộc Khác (Không phải Kinh)</Checkbox>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="ngaySinh" label="Ngày Tháng Năm Sinh" rules={[{ required: true, message: 'Chọn ngày sinh!' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Chọn ngày" disabled={editingStudent?.trangThai === 'Đã chuyển trường'} />
          </Form.Item>

          <Form.Item name="sdtPhuHuynh" label="Số Điện Thoại Phụ Huynh Liên Hệ">
            <Input placeholder="Ví dụ: 0912345678" disabled={editingStudent?.trangThai === 'Đã chuyển trường'} />
          </Form.Item>

          <Form.Item name="taiKhoanPhuHuynh" label="Tài Khoản Phụ Huynh Liên Kết CSDL">
            <Input placeholder="Ví dụ: PH_HS002 (Bỏ trống nếu chưa liên kết)" disabled={editingStudent?.trangThai === 'Đã chuyển trường'} />
          </Form.Item>

          <Form.Item name="uuTienZalo" label="Độ Ưu Tiên Nhận Tin" valuePropName="checked">
            <Radio.Group disabled={editingStudent?.trangThai === 'Đã chuyển trường'}>
              <Radio value={true}>Ưu tiên Zalo</Radio>
              <Radio value={false}>SMS Thường</Radio>
            </Radio.Group>
          </Form.Item>

          {editingStudent && (
            <Form.Item name="trangThai" label="Trạng thái Học tập">
              <Radio.Group>
                <Radio value="Đang học">Đang học</Radio>
                <Radio value="Đã chuyển trường">Đã chuyển trường</Radio>
              </Radio.Group>
            </Form.Item>
          )}

          <Form.Item className="mb-0 flex justify-end">
            <Space>
              <Button onClick={() => {
                setIsStudentModalOpen(false);
                setEditingStudent(null);
              }}>Hủy</Button>
              <Button type="primary" htmlType="submit">Lưu Hồ Sơ</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal 6: Cấp Tài Khoản Phụ Huynh (GVCN) */}
      <Modal
        title="Cấp Tài Khoản Phụ Huynh Liên Kết Học Sinh"
        open={isParentAccModalOpen}
        onCancel={() => setIsParentAccModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={parentAccForm} layout="vertical" onFinish={handleCreateParentAccount}>
          <Form.Item name="maHs" label="Mã Học Sinh Liên Kết">
            <Input disabled />
          </Form.Item>

          <Form.Item name="tenDangNhap" label="Tên Đăng Nhập Mặc Định" rules={[{ required: true, message: 'Nhập tên đăng nhập!' }]}>
            <Input placeholder="Ví dụ: PH_HS01" />
          </Form.Item>

          <Form.Item name="matKhau" label="Mật Khẩu" rules={[{ required: true, message: 'Nhập mật khẩu!' }]}>
            <Input.Password placeholder="Nhập mật khẩu" />
          </Form.Item>

          <Form.Item name="hoTen" label="Tên Vợ / Chồng Phụ Huynh" rules={[{ required: true, message: 'Nhập họ tên phụ huynh!' }]}>
            <Input placeholder="Ví dụ: Phụ Huynh Lê Thị Dung" />
          </Form.Item>

          <Form.Item className="mb-0 flex justify-end">
            <Space>
              <Button onClick={() => setIsParentAccModalOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit">Cấp & Liên Kết CSDL</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal 7: Điểm Danh Bé Vắng Trong Ngày (GVCN) */}
      <Modal
        title={`Điểm danh vắng ngày (${dayjs().format('DD/MM/YYYY')}) - Lớp ${selectedClass}`}
        open={isAttendanceModalOpen}
        onCancel={() => setIsAttendanceModalOpen(false)}
        okText="Ghi Nhận Điểm Danh"
        cancelText="Quay lại"
        onOk={handleSubmitAttendance}
        width={650}
        destroyOnHidden
      >
        <Alert
          message="Hướng dẫn Điểm danh"
          description="Hệ thống mặc định mọi học sinh là 'Đi học'. Chỉ cần tích chọn trạng thái 'Vắng không phép' hoặc 'Có phép' cho những học sinh không có mặt."
          type="info"
          showIcon
          className="mb-4"
        />
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <Table
            dataSource={attendanceList}
            pagination={false}
            size="small"
            rowKey="maHs"
            columns={[
              { title: 'Mã HS', dataIndex: 'maHs', key: 'maHs', width: '20%' },
              {
                title: 'Họ Tên',
                key: 'hoTen',
                width: '40%',
                render: (_, record) => {
                  const student = students.find(s => s.maHs === record.maHs);
                  return <b>{student?.hoTen}</b>;
                }
              },
              {
                title: 'Trạng thái điểm danh',
                key: 'status',
                width: '40%',
                render: (_, record) => (
                  <Radio.Group
                    value={record.trangThai}
                    onChange={(e) => handleUpdateSingleAttendance(record.maHs, e.target.value)}
                  >
                    <Radio.Button value="Đi học" className="bg-emerald-50 text-emerald-600">Đi học</Radio.Button>
                    <Radio.Button value="Không phép" className="bg-red-50 text-red-600 border-red-200">Vắng</Radio.Button>
                    <Radio.Button value="Có phép" className="bg-orange-50 text-orange-600">Có phép</Radio.Button>
                  </Radio.Group>
                )
              }
            ]}
          />
        </div>
      </Modal>
    </div>
  );
}
