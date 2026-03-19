import { useEffect } from 'react';

const SITE_NAME = 'Traffic68.com';

/**
 * Sets the document title for a page.
 * @param {string} title - Page-specific title (e.g. "Dashboard")
 * @param {boolean} [noSuffix] - If true, don't append the site name
 */
export default function usePageTitle(title, noSuffix = false) {
  useEffect(() => {
    document.title = noSuffix ? title : `${title} — ${SITE_NAME}`;
    return () => { document.title = SITE_NAME; };
  }, [title, noSuffix]);
}
