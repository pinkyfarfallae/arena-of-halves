import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders arena of halves title', () => {
  render(<App />);
  const titleElement = screen.getByText(/Arena of Halves/i);
  expect(titleElement).toBeInTheDocument();
});
