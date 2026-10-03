// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseUWFile, validateUWFile } from '@uwmd/core/browser';
import { ValidationPanel } from './ValidationPanel.js';

describe('replacement binding qualification', () => {
  it('does not call synchronous structural success complete verification', () => {
    render(
      <ValidationPanel
        validation={validateUWFile(
          parseUWFile('---\nuw_version: "1.1"\ndeal_id: TEST\nasset_class: office\n---\n')
        )}
      />
    );
    expect(screen.getByText('Structural validation')).toBeTruthy();
    expect(screen.getByText(/not_checked \/ not_invoked/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('No issues. The file conforms to the format spec.')).toBeNull();
    expect(screen.getByText(/does not claim complete verification/)).toBeTruthy();
  });
});
