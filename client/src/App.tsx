import { SYSTEM_NAME } from '../../shared/system.js';
import './styles.css';

export function App(): React.JSX.Element {
  return (
    <main className="shell">
      <section className="status-card" aria-labelledby="system-title">
        <p className="eyebrow">Private research workspace</p>
        <h1 id="system-title">{SYSTEM_NAME}</h1>
        <p className="status">工程初始化完成</p>
        <p className="description">
          当前仅包含可运行、可测试和可构建的工程骨架。业务功能将在 OpenSpec change 中定义和实现。
        </p>
      </section>
    </main>
  );
}
