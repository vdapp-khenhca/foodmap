import { NavLink } from 'react-router-dom';
import { Map as MapIcon, Trophy, Plus, User } from 'lucide-react';

export default function TabBar() {
  const cls = ({ isActive }: { isActive: boolean }) => `tab${isActive ? ' active' : ''}`;
  return (
    <nav className="tabbar" aria-label="Điều hướng chính">
      <NavLink to="/" end className={cls}>
        <MapIcon size={22} />
        Bản đồ
      </NavLink>
      <NavLink to="/top" className={cls}>
        <Trophy size={22} />
        Xếp hạng
      </NavLink>
      <NavLink to="/add" className="tab tab-add">
        <span className="fab">
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
