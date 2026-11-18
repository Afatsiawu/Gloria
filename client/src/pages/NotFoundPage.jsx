import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/useApi.js';
import { EmptyState } from '../components/UI.jsx';

export default function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <EmptyState
      icon="Warning"
      title="Page not found"
      action={
        <Link to="/" className="btn btn-primary">Go home</Link>
      }
    >
      <span className="notfound-code">Error 404</span>
      The page you asked for does not exist or has moved. Check the address or use the navigation above.
    </EmptyState>
  );
}
