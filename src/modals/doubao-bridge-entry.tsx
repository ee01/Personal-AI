import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { DoubaoBridgePanel } from './doubao-bridge';

document.addEventListener('DOMContentLoaded', () => {
  const mountElement = document.getElementById('doubao-bridge-root');
  if (mountElement) {
    ReactDOM.render(
      <React.StrictMode>
        <DoubaoBridgePanel />
      </React.StrictMode>,
      mountElement,
    );
  }
});

