import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

describe('App', () => {
  it('labels the site as an initialized research system', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Serenity 海外产业信息监控');
    expect(html).toContain('工程初始化完成');
  });
});
