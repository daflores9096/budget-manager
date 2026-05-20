import { useOutletContext } from 'react-router-dom';
import BackupsPage from './BackupsPage.jsx';

export default function BackupsRoute() {
  const ctx = useOutletContext();
  return <BackupsPage ctx={ctx} />;
}
