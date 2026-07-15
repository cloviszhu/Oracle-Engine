import { useEffect, useState } from 'react';
import type { SerenityLauncherApi, SetupStatus } from '../../shared/desktop/contracts.js';
import './styles.css';

export function App({ launcher = window.serenityLauncher }: { launcher?: SerenityLauncherApi }) {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  useEffect(() => { void launcher.getSetupStatus().then(setStatus); }, [launcher]);
  return (
    <main className="launcher-shell">
      <section className="launcher-hero">
        <span className="eyebrow">家庭本地版</span>
        <h1>Serenity 家庭启动器</h1>
        <p>在这台 Windows 电脑上安全配置、启动和查看 Serenity。</p>
      </section>
      <section className="launcher-card" aria-live="polite">
        <h2>{status?.configured ? '日常管理' : '首次设置'}</h2>
        <p>无需终端或手工编辑 .env</p>
        <div className="status-chip">{status === null ? '正在检查…' : status.configured ? '已配置' : '尚未配置'}</div>
      </section>
    </main>
  );
}
