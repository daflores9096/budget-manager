import { useOutletContext } from 'react-router-dom';
import FixedRecurringPage from './FixedRecurringPage.jsx';

export default function FixedRecurringRoute() {
  const ctx = useOutletContext();
  return <FixedRecurringPage ctx={ctx} />;
}
