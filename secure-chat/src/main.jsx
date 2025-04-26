import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

function ErrorBoundary({ children }) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <React.StrictMode>{children}</React.StrictMode>
    </React.Suspense>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);