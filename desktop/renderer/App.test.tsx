// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

describe('launcher shell', () => {
  it('shows the Chinese local setup entry without requiring backend availability', async () => {
    render(<App launcher={{ getSetupStatus: vi.fn().mockResolvedValue({ configured: false }) } as never} />);
    expect(screen.getByRole('heading', { name: 'Serenity 家庭启动器' })).toBeInTheDocument();
    expect(await screen.findByText('首次设置')).toBeInTheDocument();
    expect(screen.getByText('无需终端或手工编辑 .env')).toBeInTheDocument();
  });
});
