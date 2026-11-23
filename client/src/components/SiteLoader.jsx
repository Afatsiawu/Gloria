import { Icon } from './UI.jsx';

export default function SiteLoader({ text = 'Loading PharmaLink…' }) {
  return (
    <div className="site-loader" role="status" aria-live="polite">
      <span className="site-loader-mark" aria-hidden="true">
        <Icon name="Cross" size={26} />
      </span>
      <span className="site-loader-name">PharmaLink</span>
      <span className="site-loader-spinner" aria-hidden="true" />
      <span className="sr-only">{text}</span>
    </div>
  );
}
