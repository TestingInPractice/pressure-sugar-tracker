import { render, screen } from '@testing-library/react';
import App from './App';

it('renders app title', async () => {
  render(<App />);
  expect(screen.getByText('Трекер давления и сахара')).toBeInTheDocument();
  for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0));
});
