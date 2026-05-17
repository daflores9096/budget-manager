import { useOutletContext } from 'react-router-dom';
import UsersPage from './UsersPage.jsx';

export default function UsersRoute() {
  const ctx = useOutletContext();
  return <UsersPage ctx={ctx} />;
}

