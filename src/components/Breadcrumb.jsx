import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Breadcrumb component for dashboard pages.
 * @param {{ items: { label: string, to?: string }[] }} props
 * items: array of { label, to } — last item has no `to` (current page)
 */
export default function Breadcrumb({ items }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm mb-6 flex-wrap">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={14} className="text-gray-300" />}
            {isLast ? (
              <span className="text-[#f97316] font-semibold">{item.label}</span>
            ) : (
              <Link to={item.to || '#'} className="text-gray-400 hover:text-[#1e3a8a] transition">
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
