import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import './Layout.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <header className="layout-header">
        <h1 className="layout-title">Fuel Loan Admin</h1>
        <div className="layout-user">
          <span>{user?.full_name ?? user?.phone_number ?? 'Admin'}</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>
      <nav className="layout-nav">
        <NavLink to="/dashboard" end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          Dashboard
        </NavLink>
        <NavLink to="/loans" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          Loans
        </NavLink>
        <NavLink to="/riders" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          Riders
        </NavLink>
        <NavLink to="/reports" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          Reports
        </NavLink>
      </nav>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}
