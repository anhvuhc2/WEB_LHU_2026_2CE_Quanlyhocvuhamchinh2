'use client';

import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, Space, Typography, Badge, Card, Select } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  BookOutlined,
  CheckSquareOutlined,
  NotificationOutlined,
  MessageOutlined,
  GlobalOutlined,
  BulbOutlined,
  SafetyCertificateOutlined,
  DashboardOutlined,
  DownOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import apiClient from '../services/apiClient';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  
  // RBAC/ABAC Simulation State
  const [currentRole, setCurrentRole] = useState<string>('GiaoVien');
  const [userProfile, setUserProfile] = useState({
    name: 'Nguyễn Văn A',
    class: 'CN Lớp 1A',
    description: 'Giáo viên Chủ nhiệm Lớp 1A',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=A'
  });

  const [mockAccounts, setMockAccounts] = useState<any[]>([]);
  const [isGVCN, setIsGVCN] = useState<boolean>(false);
  const [nienKhoaList, setNienKhoaList] = useState<string[]>([]);
  const [workingYear, setWorkingYear] = useState<string>('');

  const handleWorkingYearChange = (year: string) => {
    localStorage.setItem('working_academic_year', year);
    setWorkingYear(year);
    window.location.reload();
  };

  const handleRoleChange = async (username: string, vaiTro: string, hoTen: string, triggerReload = false) => {
    setCurrentRole(vaiTro);
    localStorage.setItem('user_role', vaiTro);
    localStorage.setItem('user_username', username);
    localStorage.setItem('user_hoten', hoTen);
    
    setUserProfile({
      name: hoTen,
      class: vaiTro,
      description: `Tài khoản: ${username} - ${vaiTro}`,
      avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`
    });

    if (triggerReload) {
      try {
        const response = await apiClient.post('/TaiKhoan/dang-nhap', {
          TenDangNhap: username,
          MatKhau: '123456'
        });
        if (response.data && response.data.token) {
          localStorage.setItem('token', response.data.token);
          window.location.reload(); // Chỉ Restart giao diện khi có Token thành công
        }
      } catch (err: any) {
        console.error('Error logging in simulated role:', err);
        // Ngăn chặn Infinite Loop: Nếu chặn lỗi từ Backend (Server đang tắt), hiển thị thông báo lỗi thay vì f5 liên tục
        alert("Lỗi kết nối đến Backend: " + (err.message || 'Mất kết nối mạng'));
      }
    }
  };

  useEffect(() => {
    apiClient.get('/TaiKhoan/all-for-testing')
      .then(res => setMockAccounts(res.data))
      .catch(e => console.error("Lõi tải mỏck acc", e));

    // Tải danh sách niên khóa từ DB
    apiClient.get('/QuanLyTruong/danh-sach-nien-khoa')
      .then(res => {
        if (Array.isArray(res.data)) {
          setNienKhoaList(res.data);
        }
      })
      .catch(e => console.error("Lỗi tải danh sách niên khóa", e));

    // Xác định niên khóa làm việc hiện tại
    const savedWorkingYear = localStorage.getItem('working_academic_year');
    if (savedWorkingYear) {
      setWorkingYear(savedWorkingYear);
    } else {
      apiClient.get('/QuanLyTruong/nien-khoa-hien-tai')
        .then(res => {
          if (res.data?.activeAcademicYear) {
            localStorage.setItem('working_academic_year', res.data.activeAcademicYear);
            setWorkingYear(res.data.activeAcademicYear);
          }
        })
        .catch(e => console.error("Lỗi tải niên khóa hiện tại", e));
    }

    const savedRole = localStorage.getItem('user_role');
    const savedUsername = localStorage.getItem('user_username');
    const savedHoTen = localStorage.getItem('user_hoten');
    const token = localStorage.getItem('token');
    
    const roleToLogin = savedRole || 'HieuTruong';
    const usernameToLogin = savedUsername || 'hieutruong';
    const hotenToLogin = savedHoTen || 'Ban Giám Hiệu';
    
    if (!token) {
      handleRoleChange(usernameToLogin, roleToLogin, hotenToLogin, true);
    } else if (savedRole) {
      handleRoleChange(usernameToLogin, savedRole, hotenToLogin, false);
    } else {
      localStorage.setItem('user_role', 'HieuTruong');
      localStorage.setItem('user_username', 'hieutruong');
    }

    if (roleToLogin === 'GiaoVien') {
      apiClient.get('/LopHoc/danh-sach')
        .then(res => {
          if (Array.isArray(res.data)) {
            setIsGVCN(res.data.some((c: any) => c.gvchuNhiem?.trim().toUpperCase() === usernameToLogin.trim().toUpperCase()));
          }
        }).catch(() => setIsGVCN(false));
    } else {
      setIsGVCN(false);
    }
  }, []);

  const menuItems = [
    ...(currentRole === 'HieuTruong' ? [{
      key: '/modules/admin-dashboard',
      icon: <DashboardOutlined className="text-lg text-yellow-500" />,
      label: <span className="font-bold text-yellow-600">Bảng điều khiển BGH</span>,
    }] : []),
    ...(currentRole !== 'PhuHuynh' ? [
      {
        key: '/modules/class-profile',
        icon: <BookOutlined className="text-lg" />,
        label: '1. Hồ sơ & Phân công',
      },
      {
        key: '/modules/grading-evaluation',
        icon: <CheckSquareOutlined className="text-lg" />,
        label: '2. Đánh giá & Báo điểm',
      }
    ] : []),
    {
      key: '/modules/planning-notifications',
      icon: <NotificationOutlined className="text-lg" />,
      label: '3. Kế hoạch & Thông báo',
    },
    ...(currentRole === 'PhuHuynh' || currentRole === 'GiaoVien' ? [{
      key: '/modules/ai-assistant',
      icon: <MessageOutlined className="text-lg" />,
      label: (
        <span className="flex items-center justify-between w-full">
          <span>4. Tương tác & Trợ lý AI</span>
          <Badge count="AI" style={{ backgroundColor: '#10b981', fontSize: '9px', height: '16px', lineHeight: '16px' }} />
        </span>
      ),
    }] : []),
  ];

  const roleMenuItems = mockAccounts.map(acc => ({
    key: acc.tenDangNhap,
    label: `[${acc.vaiTro}] - ${acc.hoTen} (${acc.tenDangNhap})`,
    onClick: () => handleRoleChange(acc.tenDangNhap, acc.vaiTro, acc.hoTen, true),
  }));

  // Helper to determine module title from pathname
  const getPageTitle = () => {
    if (pathname.includes('/admin-dashboard')) return 'TRUNG TÂM KIỂM SOÁT BAN GIÁM HIỆU';
    if (pathname.includes('/class-profile')) return 'MODULE 1: QUẢN TRỊ HỒ SƠ, LỚP HỌC & PHÂN CÔNG GIẢNG DẠY';
    if (pathname.includes('/grading-evaluation')) return 'MODULE 2: QUẢN LÝ ĐÁNH GIÁ & BÁO ĐIỂM (TT27)';
    if (pathname.includes('/planning-notifications')) return 'MODULE 3: KẾ HOẠCH LỚP & THÔNG BÁO KÉP';
    if (pathname.includes('/ai-assistant')) return 'MODULE 4: TƯƠNG TÁC PHẢN HỒI & TRỢ LÝ ẢO AI (GEMINI)';
    return 'HỆ THỐNG QUẢN LÝ HỌC VỤ TIỂU HỌC';
  };

  return (
    <Layout className="min-h-screen">
      {/* Sidebar Sider */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={260}
        theme="dark"
        className="shadow-xl"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: '#001529',
          zIndex: 100,
        }}
      >
        {/* Brand/Logo Area */}
        <div className="h-16 flex items-center px-6 gap-3 border-b border-gray-800 bg-[#002140] overflow-hidden">
          <GlobalOutlined className="text-2xl text-emerald-400 animate-pulse flex-shrink-0" />
          {!collapsed && (
            <span className="font-bold text-white tracking-wider text-sm transition-all duration-300 whitespace-nowrap">
              TH HAM CHINH 2
            </span>
          )}
        </div>

        {/* Current Active Role widget */}
        {!collapsed && (
          <div className="mx-4 my-4 p-3 bg-slate-800/80 rounded-xl border border-gray-700/50">
            <div className="flex items-center gap-2 mb-1">
              <SafetyCertificateOutlined className="text-yellow-400" />
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                Active Security Role
              </span>
            </div>
            <div className="font-semibold text-emerald-300 text-xs truncate">
              {currentRole === 'HieuTruong' && `🔑 Hiệu Trưởng - ${userProfile.name}`}
              {currentRole === 'GiaoVien' && `👩‍🏫 Giáo Viên - ${userProfile.name}`}
              {currentRole === 'PhuHuynh' && `🏡 Phụ Huynh - ${userProfile.name}`}
            </div>
          </div>
        )}

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
          items={menuItems}
          onClick={({ key }) => router.push(key)}
          className="mt-2"
        />

        {/* Help Widget in Sider */}
        {!collapsed && (
          <div className="absolute bottom-6 left-4 right-4 p-4 rounded-xl bg-gradient-to-br from-indigo-900/60 to-purple-950/60 border border-indigo-700/30">
            <BulbOutlined className="text-lg text-amber-400 mb-1" />
            <div className="text-white text-xs font-semibold mb-1">Kiến trúc Bảo mật 2 lớp</div>
            <div className="text-[11px] text-gray-300 leading-relaxed">
              Dự án sử dụng cơ chế RBAC (chức vụ) cùng ABAC (ràng buộc maHS/maLop) để đảm bảo an toàn dữ liệu.
            </div>
          </div>
        )}
      </Sider>

      {/* Main Content Area */}
      <Layout 
        style={{ 
          marginLeft: collapsed ? 80 : 260, 
          transition: 'margin-left 0.2s',
          background: '#f8fafc'
        }}
      >
        {/* Header toolbar */}
        <Header 
          className="bg-white px-6 flex items-center justify-between border-b border-slate-200/80 sticky top-0 shadow-sm"
          style={{ height: '64px', zIndex: 90 }}
        >
          <div className="flex items-center gap-4">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="text-base w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100"
            />
            <Title level={4} style={{ margin: 0, color: '#1e293b' }} className="hidden md:block select-none text-base">
              {getPageTitle()}
            </Title>
          </div>

          <div className="flex items-center gap-4">
            {/* Working Academic Year Selector */}
            <div className="flex items-center gap-1.5 mr-2">
              <span className="font-medium text-xs text-slate-600 hidden sm:inline">Niên khóa:</span>
              <Select
                value={workingYear || undefined}
                onChange={handleWorkingYearChange}
                style={{ width: 140 }}
                options={nienKhoaList.map(nk => ({ value: nk, label: nk }))}
                suffixIcon={<CalendarOutlined className="text-blue-500" />}
                className="font-bold border-slate-300"
                placeholder="Chọn niên khóa"
              />
            </div>

            {/* RBAC Simulation Selector */}
            <Dropdown menu={{ items: roleMenuItems }} placement="bottomRight" arrow>
              <Button type="default" className="flex items-center gap-2 border-slate-350 shadow-sm hover:border-blue-500">
                <span className="font-medium text-xs text-slate-600 hidden sm:inline">Phân quyền giả lập:</span>
                <span className="font-bold text-xs text-blue-600">
                  {userProfile.name} ({currentRole})
                </span>
                <DownOutlined className="text-[10px] text-gray-400" />
              </Button>
            </Dropdown>

            {/* Profile Avatar Widget */}
            <Dropdown
              menu={{
                items: [
                  { key: 'profile', label: 'Xem thông tin chi tiết' },
                  { key: 'settings', label: 'Cài đặt hệ thống' },
                  { type: 'divider' },
                  { key: 'logout', label: 'Đăng xuất', danger: true }
                ]
              }}
              placement="bottomRight"
            >
              <div className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors select-none">
                <Avatar src={userProfile.avatar} icon={<UserOutlined />} className="bg-slate-200 border border-slate-300" />
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-800 leading-3">{userProfile.name}</span>
                  <span className="text-[10px] text-slate-400 mt-1">{userProfile.class}</span>
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>

        {/* Real Content Body */}
        <Content className="p-6 md:p-8 max-w-[1600px] w-full mx-auto" style={{ minHeight: 'calc(100vh - 64px)' }}>
          {/* Active simulation alert banner */}
          <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center md:flex-row flex-col gap-3 justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🤖</span>
              <div>
                <div className="text-xs font-bold text-blue-800">CƠ CHẾ BẢO MẬT & NGHIỆP VỤ ĐỒ ÁN ĐANG ĐƯỢC GIẢ LẬP</div>
                <div className="text-[11px] text-blue-600 mt-0.5">
                  Đang dùng vai trò <span className="font-bold underline">{userProfile.name} ({currentRole})</span>. Client tự động truyền JWT Header để API Server kiểm tra RBAC/ABAC trên CSDL SQL Server.
                </div>
              </div>
            </div>
            <div className="text-[10px] bg-white text-slate-500 border border-slate-200/70 p-2 rounded-lg font-medium">
              Backend API: <span className="text-emerald-600 font-bold font-mono">http://localhost:5076/api</span>
            </div>
          </div>

          <div className="animate-fadeIn">
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
