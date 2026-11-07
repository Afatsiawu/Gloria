import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/useApi.js';
import { EmptyState } from '../components/UI.jsx';

export default function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <EmptyState
      title="Page not found"
      action={
        <div className="hero-actions">
          <Link to="/" className="btn btn-primary">Go home</Link>
          <Link to="/search" className="btn btn-secondary">Find medicines</Link>
        </div>
      }
    >
      The page you asked for does not exist or has moved. Check the address or use the navigation above.
    </EmptyState>
  );
}
