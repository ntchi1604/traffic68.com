import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AgencyApp from './AgencyApp.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'

function MainWrapper() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAgency, setIsAgency] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const hostname = window.location.hostname;
    // Main domains will NOT trigger agency mode
    const mainDomains = ['localhost', '127.0.0.1', 'traffic68.com', 'www.traffic68.com'];
    
    // Check if current domain is a main domain
    if (mainDomains.includes(hostname)) {
      setLoading(false);
      return;
    }

    // It's a custom domain, fetch agency config
    setIsAgency(true);
    fetch(`/api/agencies/config?domain=${hostname}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setConfig(data);
        }
      })
      .catch(err => {
        console.error(err);
        setError('Lỗi kết nối máy chủ');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{height: '100vh', display:'flex', alignItems:'center', justifyContent:'center'}}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#3B82F6', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (isAgency) {
    if (error) {
      return (
        <div style={{height: '100vh', display:'flex', flexDirection: 'column', alignItems:'center', justifyContent:'center', backgroundColor: '#f8fafc'}}>
          <p style={{fontSize: '4rem', fontWeight: 'bold', color: '#94a3b8', margin: 0}}>404</p>
          <p style={{fontSize: '1.2rem', color: '#475569', marginTop: '8px'}}>{error === 'Agency not found for this domain' ? 'Tên miền chưa được cấu hình đại lý' : error}</p>
        </div>
      );
    }
    return <AgencyApp config={config} />;
  }

  return <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <MainWrapper />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
)
