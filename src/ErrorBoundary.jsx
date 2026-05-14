import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#fee2e2', color: '#991b1b', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Đã xảy ra lỗi trên giao diện!</h1>
          <p>Vui lòng chụp ảnh màn hình này gửi cho admin:</p>
          <pre style={{ background: '#f87171', color: 'white', padding: '10px', marginTop: '10px', whiteSpace: 'pre-wrap', borderRadius: '8px' }}>
            {this.state.error && this.state.error.toString()}
          </pre>
          <pre style={{ background: '#fca5a5', color: '#7f1d1d', padding: '10px', marginTop: '10px', whiteSpace: 'pre-wrap', fontSize: '12px', borderRadius: '8px' }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
