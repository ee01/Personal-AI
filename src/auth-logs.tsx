import React from 'react';
import ReactDOM from 'react-dom';
import { AuthLogViewer } from './components/AuthLogViewer';

const container = document.getElementById('root');
if (container) {
  ReactDOM.render(<AuthLogViewer />, container);
}
