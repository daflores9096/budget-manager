import { useOutletContext } from 'react-router-dom';
import IncomesPage from './IncomesPage.jsx';

export default function IncomesRoute() {
  const ctx = useOutletContext();
  return <IncomesPage ctx={ctx} />;
}

