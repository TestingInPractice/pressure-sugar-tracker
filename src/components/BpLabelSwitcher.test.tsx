import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BpLabelSwitcher from './BpLabelSwitcher';
import { BpLabelVariantProvider } from '../hooks/useBpLabelVariant';
import type { BpLabelVariant } from '../logic/bp-labels';

function renderSwitcher(initialVariant: BpLabelVariant = 'sad') {
  return render(
    <BpLabelVariantProvider initialVariant={initialVariant}>
      <BpLabelSwitcher />
    </BpLabelVariantProvider>,
  );
}

describe('BpLabelSwitcher', () => {
  it('renders САД | ВД | SYS with sad pressed by default', () => {
    renderSwitcher();
    const group = screen.getByRole('group', { name: 'Обозначения давления' });
    expect(group).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map(b => b.textContent)).toEqual(['САД', 'ВД', 'SYS']);
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true');
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'false');
    expect(buttons[2]).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches to the adjacent position on click', () => {
    renderSwitcher();
    fireEvent.click(screen.getByRole('button', { name: 'ВД' }));
    const buttons = screen.getAllByRole('button');
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'true');
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'false');
  });

  it('moves only one step when clicking a button two positions away', () => {
    renderSwitcher();
    fireEvent.click(screen.getByRole('button', { name: 'SYS' }));
    const buttons = screen.getAllByRole('button');
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'true');
    expect(buttons[2]).toHaveAttribute('aria-pressed', 'false');
  });

  it('steps back one position when clicking a far button from en', () => {
    renderSwitcher('en');
    fireEvent.click(screen.getByRole('button', { name: 'САД' }));
    const buttons = screen.getAllByRole('button');
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'true');
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking the active button does nothing', () => {
    renderSwitcher('vd');
    fireEvent.click(screen.getByRole('button', { name: 'ВД' }));
    const buttons = screen.getAllByRole('button');
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'true');
  });
});