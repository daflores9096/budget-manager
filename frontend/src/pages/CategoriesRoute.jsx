import { useOutletContext } from 'react-router-dom';
import CategoriesPage from './CategoriesPage.jsx';

export default function CategoriesRoute() {
  const ctx = useOutletContext();
  return <CategoriesPage ctx={ctx} />;
}

