import { useOutletContext } from 'react-router-dom';
import ExpensesPage from './ExpensesPage.jsx';

export default function ExpensesRoute() {
  const ctx = useOutletContext();
  return <ExpensesPage ctx={ctx} />;
}

