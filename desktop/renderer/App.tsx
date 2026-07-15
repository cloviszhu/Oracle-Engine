import { useEffect, useState } from 'react';
import type {
  AISettingsInput, EnvironmentCheckResult, LauncherSettingsInput, SerenityLauncherApi,
  ServiceHealthSummary, SetupStatus,
} from '../../shared/desktop/contracts.js';
import './styles.css';

const steps = ['环境', '家庭账号', 'AI', 'X', '飞书', '完成'];
const defaultAI: AISettingsInput = {
  enabled: true, providerPreset: 'openai', protocol: 'responses', baseUrl: '', apiKey: '',
  model: 'gpt-5.6-terra', reasoning: 'medium', inputCostPerMillionCents: 0,
  outputCostPerMillionCents: 0, maxRequestCostCents: 0, dailyBudgetCents: 0,
};

export function App({ launcher = window.serenityLauncher }: { launcher?: SerenityLauncherApi }) {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [setupStarted, setSetupStarted] = useState(false);
  useEffect(() => { void launcher.getSetupStatus().then(setStatus); }, [launcher]);
  if (status === null) return <LauncherFrame><section className="launcher-card"><h2>正在检查本机状态…</h2></section></LauncherFrame>;
  if (status.configured && !setupStarted) return <Dashboard launcher={launcher} status={status} onModify={() => setSetupStarted(true)} />;
  if (!setupStarted) return (
    <LauncherFrame>
      <section className="launcher-card intro-card" aria-live="polite">
        <span className="step-number">01 / 本机准备</span><h2>首次设置</h2>
        <p>无需终端或手工编辑 .env</p>
        <p className="muted">所有敏感信息只交给这台电脑的系统加密库。</p>
        <button className="primary" onClick={() => setSetupStarted(true)}>开始设置</button>
      </section>
    </LauncherFrame>
  );
  return <SetupWizard launcher={launcher} onSaved={(next) => setStatus(next)} />;
}

function LauncherFrame({ children }: { children: React.ReactNode }) {
  return <main className="launcher-shell">
    <section className="launcher-hero"><span className="eyebrow">家庭本地版 · WINDOWS</span><h1>Serenity<br />家庭启动器</h1><p>把信息研究安静地留在这台电脑里。一次设置，此后只需启动、查看与备份。</p><div className="local-mark">● 仅本机回环访问</div></section>
    {children}
  </main>;
}

function SetupWizard({ launcher, onSaved }: { launcher: SerenityLauncherApi; onSaved(status: SetupStatus): void }) {
  const [step, setStep] = useState(0);
  const [checks, setChecks] = useState<EnvironmentCheckResult[]>([]);
  const [checking, setChecking] = useState(false);
  const [accounts, setAccounts] = useState([
    { actorId: 'father', username: '', password: '' }, { actorId: 'requester', username: '', password: '' },
  ]);
  const [aiEnabled, setAIEnabled] = useState(false);
  const [ai, setAI] = useState(defaultAI);
  const [aiProbed, setAIProbed] = useState(false);
  const [x, setX] = useState({ enabled: false, token: '', policyConfirmed: false });
  const [feishu, setFeishu] = useState({ enabled: false, webhookUrl: '', signingSecret: '' });
  const [message, setMessage] = useState('');
  const [saveResult, setSaveResult] = useState<'idle' | 'success' | 'failed'>('idle');

  const next = () => setStep((value) => Math.min(value + 1, steps.length - 1));
  const updateAccount = (index: number, field: 'username' | 'password', value: string) => setAccounts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  const runChecks = async () => { setChecking(true); try { setChecks(await launcher.runEnvironmentChecks()); } finally { setChecking(false); } };
  const probe = async () => {
    setMessage('正在验证模型能力…');
    const result = await launcher.probeAI(ai);
    setAIProbed(result.compatible);
    setMessage(result.compatible ? `模型能力验证通过 · ${result.actualModel ?? ai.model}` : `验证未通过：${result.category ?? '能力不完整'}`);
  };
  const save = async () => {
    const settings: LauncherSettingsInput = {
      familyAccounts: accounts,
      ai: aiEnabled ? ai : undefined,
      x: x.enabled ? x : { enabled: false, policyConfirmed: false },
      feishu: feishu.enabled ? feishu : { enabled: false },
    };
    try {
      const saved = await launcher.saveSettings(settings);
      setAccounts((current) => current.map((item) => ({ ...item, password: '' })));
      setAI((current) => ({ ...current, apiKey: '' }));
      setX((current) => ({ ...current, token: '' }));
      setFeishu((current) => ({ ...current, signingSecret: '' }));
      setSaveResult('success');
      setMessage('设置已保存');
      onSaved(saved);
    } catch {
      setSaveResult('failed');
      setMessage('保存失败，请检查标红项目后重试');
    }
  };

  return <main className="wizard-shell">
    <aside className="wizard-rail"><span className="eyebrow">SERENITY / SETUP</span><h1>安静地完成<br />一次设置</h1><ol>{steps.map((label, index) => <li key={label} className={index === step ? 'active' : index < step ? 'done' : ''}><span>{String(index + 1).padStart(2, '0')}</span>{label}</li>)}</ol><p>无需数据库先启动，设置始终可进入。</p></aside>
    <section className="wizard-stage" aria-live="polite">
      {step === 0 && <><SectionTitle kicker="STEP 01" title="检查这台电脑" copy="只检查，不会自动安装或修改 Docker。" /><button className="primary" onClick={() => void runChecks()} disabled={checking}>{checking ? '正在检查…' : '运行环境检查'}</button><div className="check-list">{checks.map((item) => <article key={item.code} className={item.status}><b>{item.label}</b><span>{item.message}</span></article>)}</div><Footer next={next} disabled={checks.length === 0 || checks.some((item) => item.status === 'fail')} /></>}
      {step === 1 && <><SectionTitle kicker="STEP 02" title="两位家庭成员" copy="密码只在此刻用于生成随机盐摘要，不会回显。" /><div className="account-grid">{accounts.map((account, index) => <fieldset key={account.actorId}><legend>账号 {index + 1}</legend><label>账号 {index + 1} 用户名<input value={account.username} onChange={(event) => updateAccount(index, 'username', event.target.value)} autoComplete="username" /></label><label>账号 {index + 1} 密码<input type="password" value={account.password} onChange={(event) => updateAccount(index, 'password', event.target.value)} autoComplete="new-password" /></label></fieldset>)}</div><Footer next={next} disabled={accounts.some((account) => !account.username || account.password.length < 12) || accounts[0]?.username === accounts[1]?.username} /></>}
      {step === 2 && <><SectionTitle kicker="STEP 03" title="AI 分析" copy="可以先跳过。启用时必须通过完整能力验证，不会自动换模型。" /><Toggle label="启用 AI 分析" checked={aiEnabled} onChange={(enabled) => { setAIEnabled(enabled); setAIProbed(false); }} />{aiEnabled && <div className="form-grid"><label>服务预设<select value={ai.providerPreset} onChange={(e) => setAI({ ...ai, providerPreset: e.target.value as AISettingsInput['providerPreset'], baseUrl: '', model: e.target.value === 'openai' ? 'gpt-5.6-terra' : '' })}><option value="openai">OpenAI 官方</option><option value="custom">自定义兼容服务</option></select></label><label>协议<select value={ai.protocol} disabled={ai.providerPreset === 'openai'} onChange={(e) => setAI({ ...ai, protocol: e.target.value as AISettingsInput['protocol'] })}><option value="responses">Responses</option><option value="chat_completions">Chat Completions</option></select></label>{ai.providerPreset === 'custom' && <label className="wide">HTTPS 服务地址<input value={ai.baseUrl} onChange={(e) => setAI({ ...ai, baseUrl: e.target.value })} /></label>}<label>模型<input value={ai.model} disabled={ai.providerPreset === 'openai'} onChange={(e) => setAI({ ...ai, model: e.target.value })} /></label><label>API Key<input type="password" value={ai.apiKey} onChange={(e) => { setAI({ ...ai, apiKey: e.target.value }); setAIProbed(false); }} /></label><NumberField label="输入价格（分/百万）" value={ai.inputCostPerMillionCents} onChange={(value) => setAI({ ...ai, inputCostPerMillionCents: value })} /><NumberField label="输出价格（分/百万）" value={ai.outputCostPerMillionCents} onChange={(value) => setAI({ ...ai, outputCostPerMillionCents: value })} /><button className="secondary wide" onClick={() => void probe()} disabled={!ai.apiKey || !ai.model}>测试 AI 连接</button>{message && <p className={aiProbed ? 'success-note' : 'muted'}>{message}</p>}</div>}<Footer next={next} nextLabel={aiEnabled ? '下一步' : '跳过 AI'} disabled={aiEnabled && !aiProbed} /></>}
      {step === 3 && <><SectionTitle kicker="STEP 04" title="X 数据源" copy="默认关闭；未启用时不会发起真实请求，也不会创建同步任务。" /><p className="fixed-state">X 未真实同步</p><Toggle label="启用 X 官方 API 同步" checked={x.enabled} onChange={(enabled) => setX({ ...x, enabled })} />{x.enabled && <div className="form-grid"><label className="wide">Bearer Token<input type="password" value={x.token} onChange={(e) => setX({ ...x, token: e.target.value })} /></label><Toggle label="我已确认 X 开发者政策" checked={x.policyConfirmed} onChange={(policyConfirmed) => setX({ ...x, policyConfirmed })} /></div>}<Footer next={next} nextLabel={x.enabled ? '测试并继续' : '跳过 X'} disabled={x.enabled && (!x.token || !x.policyConfirmed)} /></>}
      {step === 4 && <><SectionTitle kicker="STEP 05" title="飞书提醒" copy="网页功能不依赖飞书。未启用时不会产生投递、任务或积压。" /><p className="fixed-state">飞书 disabled</p><Toggle label="启用飞书签名机器人" checked={feishu.enabled} onChange={(enabled) => setFeishu({ ...feishu, enabled })} />{feishu.enabled && <div className="form-grid"><label className="wide">Webhook 地址<input value={feishu.webhookUrl} onChange={(e) => setFeishu({ ...feishu, webhookUrl: e.target.value })} /></label><label className="wide">签名密钥<input type="password" value={feishu.signingSecret} onChange={(e) => setFeishu({ ...feishu, signingSecret: e.target.value })} /></label></div>}<Footer next={next} nextLabel={feishu.enabled ? '测试并继续' : '跳过飞书'} disabled={feishu.enabled && (!feishu.webhookUrl || !feishu.signingSecret)} /></>}
      {step === 5 && <><SectionTitle kicker="READY" title="准备保存" copy="之后仍可从日常管理修改设置。敏感值不会再次显示。" /><div className="summary-grid"><StatusCard label="MySQL / Redis" value={saveResult === 'failed' ? '失败' : saveResult === 'success' ? '配置成功' : '启动时检查'} /><StatusCard label="AI" value={aiEnabled ? (saveResult === 'success' ? '能力验证通过' : '已完成预检') : '已跳过'} /><StatusCard label="X" value={x.enabled ? (saveResult === 'success' ? '连接测试通过' : '保存时测试') : '未真实同步'} /><StatusCard label="飞书" value={feishu.enabled ? (saveResult === 'success' ? '签名测试通过' : '保存时测试') : 'disabled'} /></div><button className="primary" onClick={() => void save()}>保存并完成</button>{message && <p className={saveResult === 'failed' ? 'fixed-state' : 'success-note'}>{message}</p>}</>}
    </section>
  </main>;
}

function Dashboard({ launcher, status, onModify }: { launcher: SerenityLauncherApi; status: SetupStatus; onModify(): void }) {
  const [health, setHealth] = useState<ServiceHealthSummary | null>(null);
  const [notice, setNotice] = useState('');
  const run = async (label: string, action: () => Promise<unknown>) => { setNotice(`${label}…`); try { await action(); setNotice(`${label}完成`); } catch { setNotice(`${label}失败，请查看诊断`); } };
  return <main className="dashboard-shell"><header><div><span className="eyebrow">SERENITY / LOCAL CONTROL</span><h1>日常管理</h1></div><div className={`health-orb ${health?.overall ?? 'stopped'}`}><span />{health?.overall === 'healthy' ? '服务正常' : health?.overall === 'degraded' ? '需要关注' : '当前已停止'}</div></header><section className="status-board"><article><span>数据源</span><strong>{status.x?.enabled ? 'X 已配置，等待真实同步' : 'X 未真实同步'}</strong></article><article><span>研究模型</span><strong>{status.ai?.enabled ? 'AI 已启用' : 'AI 未启用'}</strong></article><article><span>可选提醒</span><strong>{status.feishu?.enabled ? '飞书 enabled' : '飞书 disabled'}</strong></article></section><section className="command-deck"><button className="primary" onClick={() => void run('启动服务', launcher.startSerenity)}>启动服务</button><button onClick={() => void run('停止服务', launcher.stopSerenity)}>停止服务</button><button onClick={() => void run('健康检查', async () => setHealth(await launcher.getHealth()))}>健康检查</button><button onClick={() => void run('打开私有网页', launcher.openWorkspace)}>打开私有网页</button><button onClick={onModify}>修改设置</button><button onClick={() => void run('创建备份', launcher.createBackup)}>创建备份</button><button onClick={() => void run('导出诊断', launcher.exportDiagnostics)}>导出诊断</button></section><p className="dashboard-note">私有网页固定绑定 127.0.0.1，不对局域网或公网开放。</p>{notice && <div className="notice" role="status">{notice}</div>}</main>;
}

function SectionTitle({ kicker, title, copy }: { kicker: string; title: string; copy: string }) { return <header className="section-title"><span>{kicker}</span><h2>{title}</h2><p>{copy}</p></header>; }
function Footer({ next, disabled, nextLabel = '下一步' }: { next(): void; disabled?: boolean; nextLabel?: string }) { return <footer className="wizard-footer"><span>配置只保存在本机</span><button className="primary" disabled={disabled} onClick={next}>{nextLabel}</button></footer>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange(value: boolean): void }) { return <label className="toggle"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span />{label}</label>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange(value: number): void }) { return <label>{label}<input type="number" min="0" value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>; }
function StatusCard({ label, value }: { label: string; value: string }) { return <article><span>{label}</span><strong>{value}</strong></article>; }
