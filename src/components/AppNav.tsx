import { Link, NavLink } from 'react-router-dom';
import { Map as MapIcon, Trophy, Plus, User } from 'lucide-react';
import { LogoMark } from './ui';

export default function AppNav() {
  const cls = ({ isActive }: { isActive: boolean }) => `nav-item${isActive ? ' active' : ''}`;
  return (
    <nav className="nav" aria-label="Điều hướng chính">
      <Link to="/" className="nav-logo" aria-label="FoodMap">
        <LogoMark />
      </Link>
      <NavLink to="/" end className={cls}>
        <MapIcon size={22} />
        Bản đồ
      </NavLink>
      <NavLink to="/top" className={cls}>
        <Trophy size={22} />
        Xếp hạng
      </NavLink>
      <NavLink to="/add" className="nav-item nav-add">
        <span className="fab-plus">
          <Plus size={26} />
        </span>
        Thêm quán
      </NavLink>
      <NavLink to="/me" className={cls}>
        <User size={22} />
        Tôi
      </NavLink>
    </nav>
  );
}
