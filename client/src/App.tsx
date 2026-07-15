import { FormEvent, useCallback, useEffect, useState } from 'react';
import { SYSTEM_NAME } from '../../shared/system.js';
import './styles.css';

type JsonRecord = Record<string, unknown>;
type View = 'latest' | 'timeline' | 'status' | 'detail';

export function App(): React.JSX.Element {
  const [phase, setPhase] = useState<'loading' | 'login' | 'ready'>('loading');
  const [actorId, setActorId] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [view, setView] = useState<View>('latest');
  const [items, setItems] = useState<JsonRecord[]>([]);
  const [detail, setDetail] = useState<JsonRecord>();
  const [detailRequested, setDetailRequested] = useState(false);
  const [operations, setOperations] = useState<JsonRecord>();
  const [nextCursor, setNextCursor] = useState<string>();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const request = useCallback(async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        ...options.headers,
      },
    });
    if (response.status === 401) {
      setPhase('login');
      throw new Error('unauthorized');
    }
    if (!response.ok) throw new Error('request_failed');
    return response.json() as Promise<JsonRecord>;
  }, [csrfToken]);

  const loadList = useCallback(async (search = '', append = false, target: 'latest' | 'timeline' = 'latest') => {
    setBusy(true);
    setError('');
    try {
      const endpoint = target === 'timeline' ? '/api/timeline' : '/api/intelligence';
      const result = await request(`${endpoint}${search ? `?${search}` : ''}`);
      const incoming = Array.isArray(result.items) ? result.items as JsonRecord[] : [];
      setItems((current) => append ? [...current, ...incoming] : incoming);
      setNextCursor(typeof result.nextCursor === 'string' ? result.nextCursor : undefined);
    } catch (reason) {
      if (reason instanceof Error && reason.message !== 'unauthorized') setError('情报加载失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  }, [request]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/auth/session', { credentials: 'same-origin' });
        if (!response.ok) {
          setPhase('login');
          return;
        }
        const session = await response.json() as JsonRecord;
        setActorId(String(session.actorId ?? 'family'));
        setCsrfToken(String(session.csrfToken ?? ''));
        setPhase('ready');
        const path = window.location.pathname;
        if (path === '/status') setView('status');
        else if (path === '/timeline') setView('timeline');
        else if (path.startsWith('/intelligence/')) setView('detail');
      } catch {
        setPhase('login');
      }
    })();
  }, []);

  useEffect(() => {
    if (phase !== 'ready') return;
    if (view === 'latest' || view === 'timeline') void loadList('', false, view);
    if (view === 'status') {
      setBusy(true);
      void request('/api/operations/status')
        .then(setOperations)
        .catch(() => setError('运行状态暂时不可用。'))
        .finally(() => setBusy(false));
    }
    if (view === 'detail' && !detail && !detailRequested) {
      const id = window.location.pathname.split('/').filter(Boolean).at(-1);
      if (id && id !== 'content') void openDetail(id);
    }
  }, [phase, view]); // request/loadList remain stable for a session

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.get('username'), password: form.get('password') }),
      });
      if (!response.ok) throw new Error('login_failed');
      const session = await response.json() as JsonRecord;
      setActorId(String(session.actorId ?? 'family'));
      setCsrfToken(String(session.csrfToken ?? ''));
      setPhase('ready');
      navigate('latest');
    } catch {
      setError('账号或密码不正确，请稍后再试。');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try { await request('/api/auth/logout', { method: 'POST' }); } finally {
      setActorId('');
      setCsrfToken('');
      setPhase('login');
    }
  }

  function navigate(next: Exclude<View, 'detail'>) {
    const path = next === 'latest' ? '/' : `/${next}`;
    window.history.pushState({}, '', path);
    setDetail(undefined);
    setDetailRequested(false);
    setOperations(undefined);
    setView(next);
  }

  async function openDetail(id: string) {
    setDetailRequested(true);
    setBusy(true);
    setError('');
    window.history.pushState({}, '', `/intelligence/${id}`);
    setView('detail');
    try {
      setDetail(await request(`/api/intelligence/${encodeURIComponent(id)}`));
    } catch {
      setError('详情加载失败，请返回后重试。');
    } finally {
      setBusy(false);
    }
  }

  async function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) {
      if (typeof value === 'string' && value) params.set(key, value);
    }
    await loadList(params.toString(), false, view === 'timeline' ? 'timeline' : 'latest');
  }

  async function submitFeedback(type: string) {
    if (!detail) return;
    setNotice('');
    try {
      const cardId = String(detail.card_id ?? detail.cardId);
      await request(`/api/intelligence/${encodeURIComponent(cardId)}/feedback`, {
        method: 'POST',
        body: JSON.stringify({
          cardVersion: Number(detail.card_version ?? detail.cardVersion ?? 1),
          type,
        }),
      });
      setNotice('反馈已记录');
    } catch {
      setNotice('反馈保存失败');
    }
  }

  async function retryOperation(id: string) {
    setNotice('');
    try {
      await request(`/api/operations/retry/${encodeURIComponent(id)}`, { method: 'POST' });
      setNotice('已创建新的恢复尝试');
      setOperations(await request('/api/operations/status'));
    } catch {
      setNotice('该任务当前不可恢复');
    }
  }

  if (phase === 'loading') return <LoadingScreen />;
  if (phase === 'login') return <LoginScreen busy={busy} error={error} onSubmit={login} />;

  return (
    <div className="workspace-shell">
      <aside className="rail">
        <div className="brand-mark" aria-hidden="true">S</div>
        <div>
          <p className="kicker">Family intelligence desk</p>
          <h1>{SYSTEM_NAME}</h1>
        </div>
        <nav aria-label="主要导航">
          <button className={view === 'latest' ? 'active' : ''} onClick={() => navigate('latest')}>最新情报</button>
          <button className={view === 'timeline' ? 'active' : ''} onClick={() => navigate('timeline')}>历史时间线</button>
          <button className={view === 'status' ? 'active' : ''} onClick={() => navigate('status')}>运行状态</button>
        </nav>
        <div className="rail-foot">
          <span className="privacy-dot" /> 私有家庭空间
          <small>当前账号 · {actorId}</small>
          <button className="text-button" onClick={() => void logout()}>退出登录</button>
        </div>
      </aside>

      <main className="main-stage">
        {error && <div className="error-banner" role="alert">{error}</div>}
        {busy && <div className="progress-line" aria-label="加载中" />}
        {(view === 'latest' || view === 'timeline') && (
          <IntelligenceList
            view={view}
            items={items}
            nextCursor={nextCursor}
            busy={busy}
            onFilter={submitFilters}
            onOpen={(id) => void openDetail(id)}
            onMore={() => void loadList(`cursor=${encodeURIComponent(nextCursor ?? '')}`, true, view)}
          />
        )}
        {view === 'detail' && detail && (
          <ResearchDetail detail={detail} notice={notice} onBack={() => navigate('latest')} onFeedback={submitFeedback} />
        )}
        {view === 'status' && operations && <OperationsPanel status={operations} notice={notice} onRetry={retryOperation} />}
      </main>
    </div>
  );
}

function LoadingScreen() {
  return <main className="entry-screen"><p className="kicker">Serenity archive</p><h1>正在打开家庭研究室</h1><div className="loading-orbit" /></main>;
}

function LoginScreen(props: { busy: boolean; error: string; onSubmit(event: FormEvent<HTMLFormElement>): void }) {
  return (
    <main className="login-layout">
      <section className="login-intro">
        <p className="kicker">Private · Evidence-led · Calm</p>
        <h1>把海外产业信号，<br />整理成家人看得懂的中文判断。</h1>
        <p>这里是只属于两位家庭成员的研究桌。无需飞书，也无需打开英文原帖。</p>
      </section>
      <form className="login-card" onSubmit={props.onSubmit}>
        <span className="folio">01 / ACCESS</span>
        <h2>家人登录</h2>
        <label>账号<input name="username" autoComplete="username" required /></label>
        <label>密码<input name="password" type="password" autoComplete="current-password" required /></label>
        {props.error && <p className="form-error" role="alert">{props.error}</p>}
        <button className="primary-button" disabled={props.busy}>{props.busy ? '正在确认…' : '进入研究室'}</button>
        <small>不开放注册 · 会话仅保存在本站</small>
      </form>
    </main>
  );
}

function IntelligenceList(props: {
  view: 'latest' | 'timeline'; items: JsonRecord[]; nextCursor?: string; busy: boolean;
  onFilter(event: FormEvent<HTMLFormElement>): void; onOpen(id: string): void; onMore(): void;
}) {
  return (
    <>
      <header className="page-header">
        <div><p className="kicker">{props.view === 'latest' ? 'Latest signals' : 'Archive chronology'}</p><h2>{props.view === 'latest' ? '最新情报' : '历史时间线'}</h2></div>
        <p>先看结论，再沿证据回到原文。所有不确定性都会保留。</p>
      </header>
      <form className="filter-deck" aria-label="情报筛选" onSubmit={props.onFilter}>
        <label>关键词<input name="keyword" placeholder="公司、事件或判断" /></label>
        <label>Ticker<input name="ticker" placeholder="NVDA" /></label>
        <label>主题<input name="topic" placeholder="AI 加速器" /></label>
        <label>重要性<select name="importance"><option value="all">全部</option><option value="candidate">值得提醒</option><option value="suppressed">普通归档</option></select></label>
        <label>内容类型<select name="contentType"><option value="">全部</option><option value="post">主帖</option><option value="reply">回复</option><option value="quote">引用</option></select></label>
        <label>开始日期<input name="dateFrom" type="date" /></label>
        <label>结束日期<input name="dateTo" type="date" /></label>
        <button className="filter-button">筛选</button>
      </form>
      <section className="intelligence-stack" aria-live="polite">
        {!props.busy && props.items.length === 0 && <div className="empty-state"><span>○</span><h3>还没有符合条件的情报</h3><p>归档会在后台持续积累，不需要配置飞书。</p></div>}
        {props.items.map((item, index) => (
          <article className="signal-card" key={String(item.id)} style={{ animationDelay: `${index * 70}ms` }}>
            <div className="signal-index">{String(index + 1).padStart(2, '0')}</div>
            <button className="card-body" onClick={() => props.onOpen(String(item.id))}>
              <div className="meta-row">
                <span>{contentTypeLabel(item.content_type ?? item.contentType)}</span>
                <time>{formatDate(item.published_at ?? item.publishedAt)}</time>
                <span>{item.confidence ? `置信度 ${confidenceLabel(item.confidence)}` : '待分析'}</span>
              </div>
              <h3>{String(item.translation ?? item.body ?? '研究卡片生成中')}</h3>
              <div className="score-row">
                <strong>{String(item.importance_score ?? item.importanceScore ?? '—')}</strong><small>重要性</small>
                <span className={item.decision === 'notify_candidate' ? 'candidate-chip' : 'archive-chip'}>
                  {item.decision === 'notify_candidate' ? '值得提醒' : '普通归档'}
                </span>
              </div>
            </button>
          </article>
        ))}
      </section>
      {props.nextCursor && <button className="more-button" onClick={props.onMore}>继续查看更早内容</button>}
    </>
  );
}

const LAYERS = [
  ['原文与来源', 'body'], ['忠实翻译', 'translation'], ['Serenity 判断', 'author_judgment'],
  ['他人内容', 'others_content'], ['AI 解释', 'ai_explanation'], ['未验证推断', 'unverified_inferences'],
  ['证据', 'evidence'], ['不确定性', 'uncertainties'], ['观点变化', 'viewpoint_change'],
] as const;

function ResearchDetail(props: { detail: JsonRecord; notice: string; onBack(): void; onFeedback(type: string): void }) {
  const tombstoned = !props.detail.body && ['deleted', 'unavailable'].includes(String(props.detail.visibility));
  return (
    <article className="research-sheet">
      <button className="back-button" onClick={props.onBack}>← 返回情报桌</button>
      <header>
        <p className="kicker">Research card · {String(props.detail.content_type ?? 'post')}</p>
        <h2>{String(props.detail.translation ?? '研究详情')}</h2>
        <div className="detail-badges"><span>上下文 {props.detail.contextCompleteness === 'partial' ? '不完整' : '完整'}</span><span>重要性 {String(props.detail.importance_score ?? '—')}</span><span>置信度 {confidenceLabel(props.detail.confidence)}</span></div>
      </header>
      <div className="layer-grid">
        {LAYERS.map(([title, key], index) => (
          <section className={`layer layer-${index}`} key={key}>
            <span className="layer-number">{String(index + 1).padStart(2, '0')}</span>
            <h3>{title}</h3>
            {key === 'body' && tombstoned
              ? <p className="tombstone">原文已按平台状态清除</p>
              : <LayerValue value={props.detail[key] ?? props.detail[toCamel(key)]} />}
          </section>
        ))}
      </div>
      <section className="context-panel"><h3>上下文</h3><p>{props.detail.contextCompleteness === 'partial' ? '部分回复或引用不可访问，研究结论未猜测补全。' : '关联回复与引用已归档。'}</p></section>
      <section className="context-panel"><h3>提醒状态</h3><LayerValue value={props.detail.notifications ?? '未创建提醒；网页详情不受影响。'} /></section>
      <section className="feedback-panel">
        <div><p className="kicker">Your signal</p><h3>这张卡片对你有帮助吗？</h3></div>
        <div className="feedback-actions">
          {[['important', '重要'], ['known', '已知'], ['irrelevant', '不相关'], ['follow', '继续跟踪'], ['translation_error', '翻译有误'], ['analysis_error', '分析有误']].map(([type, label]) =>
            <button key={type} onClick={() => props.onFeedback(type)}>{label}</button>)}
        </div>
        {props.notice && <p className="save-notice">{props.notice}</p>}
      </section>
    </article>
  );
}

function LayerValue({ value }: { value: unknown }) {
  if (value === undefined || value === null || value === '') return <p className="muted">暂无可用信息</p>;
  if (Array.isArray(value)) return <ul>{value.map((item, index) => <li key={index}>{claimText(item)}</li>)}</ul>;
  if (typeof value === 'object') return <p>{claimText(value)}</p>;
  return <p>{String(value)}</p>;
}

function OperationsPanel({ status, notice, onRetry }: { status: JsonRecord; notice: string; onRetry(id: string): void }) {
  const core = status.core as JsonRecord | undefined;
  const notification = status.notification as JsonRecord | undefined;
  const stages = Array.isArray(status.stages) ? status.stages as JsonRecord[] : [];
  const recoverableNotifications = Array.isArray(notification?.recoverable)
    ? notification.recoverable as JsonRecord[]
    : [];
  return (
    <section className="operations-page">
      <header className="page-header"><div><p className="kicker">System pulse</p><h2>运行状态</h2></div><p>这里显示能否正常归档和分析，不展示任何配置值。</p></header>
      <div className="core-status"><span className="pulse-dot" /><div><h3>{core?.status === 'succeeded' ? '核心流水线正常' : '核心流水线需要关注'}</h3><p>归档、上下文、AI 分析和重要性评分独立于提醒渠道。</p></div></div>
      <div className="stage-grid">
        {['ingest', 'context', 'analysis', 'score'].map((name) => {
          const stage = stages.find((item) => item.stage === name);
          return <article key={name}><span>{stageLabel(name)}</span><strong>{statusLabel(stage?.status)}</strong><small>{stage?.errorCode ? String(stage.errorCode) : '最近检查无异常'}</small>{stage?.manualRetryAllowed && stage.id ? <button onClick={() => onRetry(String(stage.id))}>创建恢复尝试</button> : null}</article>;
        })}
      </div>
      <article className="notification-branch">
        <div><p className="kicker">Optional channel</p><h3>{notification?.enabled ? '可选提醒已启用' : '可选提醒未启用'}</h3></div>
        <div>
          <p>{notification?.enabled ? `待处理 ${String(notification.backlog ?? 0)} 条` : '网页归档、分析、搜索和查看照常运行。'}</p>
          {recoverableNotifications.map((item) => (
            <button key={String(item.id)} onClick={() => onRetry(String(item.id))}>
              重试提醒 {String(item.id)}
            </button>
          ))}
        </div>
      </article>
      {notice && <p className="save-notice">{notice}</p>}
    </section>
  );
}

function claimText(value: unknown): string {
  if (value !== null && typeof value === 'object') {
    const record = value as JsonRecord;
    return String(record.text ?? record.claim ?? record.summary ?? JSON.stringify(record));
  }
  return String(value);
}
function toCamel(value: string) { return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()); }
function formatDate(value: unknown) { const date = new Date(String(value ?? '')); return Number.isNaN(date.getTime()) ? '时间待确认' : new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date); }
function contentTypeLabel(value: unknown) { return ({ post: '主帖', reply: '回复', quote: '引用' } as Record<string, string>)[String(value)] ?? '内容'; }
function confidenceLabel(value: unknown) { return ({ high: '高', medium: '中', low: '低' } as Record<string, string>)[String(value)] ?? '待确认'; }
function stageLabel(value: string) { return ({ ingest: '内容归档', context: '上下文补全', analysis: 'AI 分析', score: '重要性评分' } as Record<string, string>)[value]; }
function statusLabel(value: unknown) { return ({ succeeded: '正常', processing: '进行中', pending: '等待中', blocked: '已阻断', dead_letter: '需人工恢复', retryable_failed: '正在重试' } as Record<string, string>)[String(value)] ?? '尚无记录'; }
