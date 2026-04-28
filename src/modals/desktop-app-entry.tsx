import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { DesktopAppPanel } from './desktop-app';

document.addEventListener('DOMContentLoaded', () => {
  const mountElement = document.getElementById('desktop-app-root');
  if (mountElement) {
    ReactDOM.render(
      <React.StrictMode>
        <DesktopAppPanel />
      </React.StrictMode>,
      mountElement,
    );
  }
});
