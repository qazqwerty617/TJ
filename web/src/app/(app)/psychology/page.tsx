'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, Brain, Settings2, RefreshCw, XCircle, Calculator, TrendingUp } from 'lucide-react';
import DisciplineTimer from '@/components/DisciplineTimer';

const EMOTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function PsychologyPage() {
  const [check, setCheck] = useState<any>(null);
  const [journal, setJournal] = useState<any>(null);
  const [rules, setRules] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingRules, setSavingRules] = useState(false);
  const [showStop, setShowStop] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    maxDailyLossPercent: 5,
    maxDailyLossUsd: '',
    maxTradesPerDay: 4,
    maxLeverage: 10,
    requireStopLoss: true,
    maxConsecutiveLosses: 3,
    tradingHoursStart: '',
    tradingHoursEnd: '',
  });
  const [checkin, setCheckin] = useState({
    moodScore: 0,
    sleptWell: null as boolean | null,
    pressureToEarn: null as boolean | null,
  });

  // Risk Calculator state
  const [calc, setCalc] = useState({
    deposit: '',
    riskPercent: '1',
    leverage: '10',
    entryPrice: '',
    stopLossPrice: '',
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [checkRes, journalRes, rulesRes] = await Promise.all([
        api.get('/api/psychology/check'),
        api.get('/api/journal/today'),
        api.get('/api/psychology/rules'),
      ]);
      setCheck(checkRes.data);
      setJournal(journalRes.data);
      setRules(rulesRes.data);
      if (rulesRes.data) {
        setRuleForm({
          maxDailyLossPercent: rulesRes.data.maxDailyLossPercent,
          maxDailyLossUsd: rulesRes.data.maxDailyLossUsd || '',
          maxTradesPerDay: rulesRes.data.maxTradesPerDay,
          maxLeverage: rulesRes.data.maxLeverage,
          requireStopLoss: rulesRes.data.requireStopLoss,
          maxConsecutiveLosses: rulesRes.data.maxConsecutiveLosses,
          tradingHoursStart: rulesRes.data.tradingHoursStart || '',
          tradingHoursEnd: rulesRes.data.tradingHoursEnd || '',
        });
      }
      if (journalRes.data) {
        setCheckin({
          moodScore: journalRes.data.moodScore || 0,
          sleptWell: journalRes.data.sleptWell,
          pressureToEarn: journalRes.data.pressureToEarn,
        });
      }
      // Show stop screen if needed
      if (checkRes.data.shouldStop) setShowStop(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveCheckin = async () => {
    try {
      const res = await api.put('/api/journal/today', checkin);
      toast.success(res.data.shouldTrade === false
        ? '⚠️ Сегодня лучше не торговать'
        : '✅ Чек-ин сохранён! Можно торговать.');
      loadAll();
    } catch {
      toast.error('Ошибка сохранения');
    }
  };

  const saveRules = async () => {
    setSavingRules(true);
    try {
      await api.put('/api/psychology/rules', ruleForm);
      toast.success('✅ Правила сохранены!');
    } catch {
      toast.error('Ошибка сохранения правил');
    } finally {
      setSavingRules(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <RefreshCw size={28} className="spin" style={{ color: 'var(--green)' }} />
    </div>
  );

  const shouldTrade = journal?.shouldTrade !== false;

  // Risk Calculator derived values
  const calcResult = (() => {
    const dep = parseFloat(calc.deposit);
    const risk = parseFloat(calc.riskPercent) / 100;
    const lev = parseFloat(calc.leverage);
    const entry = parseFloat(calc.entryPrice);
    const sl = parseFloat(calc.stopLossPrice);
    if (!dep || !risk || !lev || !entry || !sl || entry <= 0 || sl <= 0) return null;

    const riskUsd = dep * risk;                         // $ at risk
    const slDistancePct = Math.abs(entry - sl) / entry; // % move to SL
    if (slDistancePct === 0) return null;

    const positionSize = riskUsd / slDistancePct;       // position value $
    const contracts = positionSize / entry;             // number of contracts
    const margin = positionSize / lev;                  // required margin $
    const slDistancePctWithLev = slDistancePct * lev * 100;
    const rrEntry = parseFloat(calc.entryPrice);

    return {
      riskUsd: riskUsd.toFixed(2),
      positionSize: positionSize.toFixed(2),
      contracts: contracts.toFixed(4),
      margin: margin.toFixed(2),
      slDistancePct: (slDistancePct * 100).toFixed(2),
      slDistancePctWithLev: slDistancePctWithLev.toFixed(2),
      marginPct: ((margin / dep) * 100).toFixed(1),
      isOk: margin <= dep * 0.3 && slDistancePctWithLev <= 100,
    };
  })();

  return (
    <>
      {/* STOP SCREEN */}
      {showStop && (
        <div className="stop-overlay" onClick={() => setShowStop(false)}>
          <div className="stop-icon">🛑</div>
          <div className="stop-title">СТОП!</div>
          <div className="stop-subtitle">
            {check?.warnings?.join('\n') || 'Ты достиг своего лимита на сегодня.'}
          </div>
          <div style={{ marginTop: 24, fontSize: 14, opacity: 0.8 }}>
            Закрой терминал. Выключи монитор. Выйди на улицу.
          </div>
          <button
            style={{ marginTop: 32, padding: '12px 32px', background: 'rgba(0,0,0,0.3)', border: '2px solid rgba(255,255,255,0.3)', borderRadius: 12, color: 'white', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}
            onClick={e => { e.stopPropagation(); setShowStop(false); }}>
            Я понял. Закрыть.
          </button>
        </div>
      )}

      <div className="page-header">
        <div>
          <h2>🧠 Психология</h2>
          <p>Контроль дисциплины и риск-менеджмент</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadAll}>
          <RefreshCw size={14} /> Обновить
        </button>
      </div>

      <div className="page-content">
        {/* Real-time status */}
        <div className={`card mb-24`} style={{
          marginBottom: 24,
          border: `1px solid ${check?.shouldStop ? 'rgba(255,71,87,0.4)' : shouldTrade ? 'var(--border-active)' : 'rgba(255,165,2,0.3)'}`,
          background: check?.shouldStop
            ? 'rgba(255,71,87,0.05)'
            : shouldTrade ? 'var(--green-dim)' : 'rgba(255,165,2,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            {check?.shouldStop ? (
              <XCircle size={22} color="var(--red)" />
            ) : shouldTrade ? (
              <CheckCircle2 size={22} color="var(--green)" />
            ) : (
              <AlertTriangle size={22} color="var(--yellow)" />
            )}
            <span style={{ fontSize: 16, fontWeight: 700, color: check?.shouldStop ? 'var(--red)' : shouldTrade ? 'var(--green)' : 'var(--yellow)' }}>
              {check?.shouldStop ? '🚫 СТОП — НЕ ТОРГОВАТЬ' : shouldTrade ? '✅ Можно торговать' : '⚠️ Торговать не рекомендуется'}
            </span>
          </div>

          {check?.warnings?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {check.warnings.map((w: string, i: number) => (
                <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {w}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
            <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>P&L сегодня</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: (check?.dailyStats.pnl || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {(check?.dailyStats.pnl || 0) >= 0 ? '+' : ''}{(check?.dailyStats.pnl || 0).toFixed(2)} $
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Сделок</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{check?.dailyStats.trades}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Убытков подряд</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: (check?.dailyStats.consecutiveLosses || 0) >= 2 ? 'var(--red)' : 'var(--text-primary)' }}>
                {check?.dailyStats.consecutiveLosses}
              </div>
            </div>
          </div>

          {check?.shouldStop && (
            <button className="btn btn-danger w-full" style={{ marginTop: 16 }} onClick={() => setShowStop(true)}>
              🛑 Показать экран СТОП
            </button>
          )}
        </div>

        <div className="grid-2 psychology-grid" style={{ gap: 20 }}>
          {/* Morning Check-in */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Brain size={18} color="var(--green)" />
              <span style={{ fontSize: 15, fontWeight: 700 }}>Утренний чек-ин</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
              Ответь на 3 вопроса перед торговлей. Если ответы плохие — система скажет не торговать сегодня.
            </p>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                Как ты себя чувствуешь сегодня? (1-10)
              </div>
              <div className="mood-scale">
                {EMOTIONS.map(n => (
                  <button key={n}
                    className={`mood-btn ${checkin.moodScore === n ? 'selected' : ''} ${n <= 3 ? 'red' : ''}`}
                    onClick={() => setCheckin({ ...checkin, moodScore: n })}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                Хорошо поспал?
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={`btn ${checkin.sleptWell === true ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setCheckin({ ...checkin, sleptWell: true })}>
                  ✅ Да
                </button>
                <button
                  className={`btn ${checkin.sleptWell === false ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                  onClick={() => setCheckin({ ...checkin, sleptWell: false })}>
                  ❌ Нет
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                Есть давление «надо заработать сегодня»?
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={`btn ${checkin.pressureToEarn === false ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setCheckin({ ...checkin, pressureToEarn: false })}>
                  ✅ Нет
                </button>
                <button
                  className={`btn ${checkin.pressureToEarn === true ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                  onClick={() => setCheckin({ ...checkin, pressureToEarn: true })}>
                  ⚠️ Да
                </button>
              </div>
            </div>

            {/* Preview result */}
            {checkin.moodScore > 0 && checkin.sleptWell !== null && checkin.pressureToEarn !== null && (
              <div style={{
                padding: '12px 16px', borderRadius: 8, marginBottom: 16,
                background: (checkin.moodScore >= 5 && checkin.sleptWell && !checkin.pressureToEarn) ? 'var(--green-dim)' : 'var(--red-dim)',
                border: `1px solid ${(checkin.moodScore >= 5 && checkin.sleptWell && !checkin.pressureToEarn) ? 'var(--border-active)' : 'rgba(255,71,87,0.3)'}`,
                fontSize: 13, fontWeight: 600,
                color: (checkin.moodScore >= 5 && checkin.sleptWell && !checkin.pressureToEarn) ? 'var(--green)' : 'var(--red)'
              }}>
                {(checkin.moodScore >= 5 && checkin.sleptWell && !checkin.pressureToEarn)
                  ? '✅ Хороший день для торговли'
                  : '⚠️ Лучше воздержаться от торговли сегодня'}
              </div>
            )}

            <button className="btn btn-primary w-full" onClick={saveCheckin}>
              Сохранить чек-ин
            </button>
          </div>

          {/* Risk Rules */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Settings2 size={18} color="var(--green)" />
              <span style={{ fontSize: 15, fontWeight: 700 }}>Правила риск-менеджмента</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Макс. дневной убыток (%)</label>
                <input className="form-input" type="number" min="1" max="100"
                  value={ruleForm.maxDailyLossPercent}
                  onChange={e => setRuleForm({ ...ruleForm, maxDailyLossPercent: parseFloat(e.target.value) })} />
              </div>

              <div className="form-group">
                <label className="form-label">Макс. дневной убыток ($)</label>
                <input className="form-input" type="number" placeholder="Необязательно"
                  value={ruleForm.maxDailyLossUsd}
                  onChange={e => setRuleForm({ ...ruleForm, maxDailyLossUsd: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Макс. сделок в день</label>
                <input className="form-input" type="number" min="1"
                  value={ruleForm.maxTradesPerDay}
                  onChange={e => setRuleForm({ ...ruleForm, maxTradesPerDay: parseInt(e.target.value) })} />
              </div>

              <div className="form-group">
                <label className="form-label">Макс. плечо</label>
                <input className="form-input" type="number" min="1"
                  value={ruleForm.maxLeverage}
                  onChange={e => setRuleForm({ ...ruleForm, maxLeverage: parseInt(e.target.value) })} />
              </div>

              <div className="form-group">
                <label className="form-label">Стоп при N убытках подряд</label>
                <input className="form-input" type="number" min="1"
                  value={ruleForm.maxConsecutiveLosses}
                  onChange={e => setRuleForm({ ...ruleForm, maxConsecutiveLosses: parseInt(e.target.value) })} />
              </div>

              <div className="rule-item">
                <span className="rule-label">🛑 Обязательный стоп-лосс</span>
                <button
                  onClick={() => setRuleForm({ ...ruleForm, requireStopLoss: !ruleForm.requireStopLoss })}
                  style={{
                    background: ruleForm.requireStopLoss ? 'var(--green)' : 'var(--bg-elevated)',
                    border: `1px solid ${ruleForm.requireStopLoss ? 'var(--green)' : 'var(--border)'}`,
                    borderRadius: 20, padding: '3px 12px', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600,
                    color: ruleForm.requireStopLoss ? '#000' : 'var(--text-muted)'
                  }}>
                  {ruleForm.requireStopLoss ? 'ВКЛ' : 'ВЫКЛ'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Торговля с (час)</label>
                  <input className="form-input" type="number" min="0" max="23" placeholder="0"
                    value={ruleForm.tradingHoursStart}
                    onChange={e => setRuleForm({ ...ruleForm, tradingHoursStart: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">До (час)</label>
                  <input className="form-input" type="number" min="0" max="24" placeholder="24"
                    value={ruleForm.tradingHoursEnd}
                    onChange={e => setRuleForm({ ...ruleForm, tradingHoursEnd: e.target.value })} />
                </div>
              </div>

              <button className="btn btn-primary w-full" onClick={saveRules} disabled={savingRules}>
                {savingRules ? 'Сохраняю...' : '💾 Сохранить правила'}
              </button>
            </div>
          </div>
        </div>

        {/* Discipline Timer & Alerts */}
        <DisciplineTimer />

        {/* ═══ RISK CALCULATOR ═══ */}
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <Calculator size={18} color="var(--green)" />
            <span style={{ fontSize: 15, fontWeight: 700 }}>Калькулятор размера позиции</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 10 }}>
              Риск-менеджмент
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div className="form-group">
              <label className="form-label">💰 Депозит ($)</label>
              <input className="form-input" type="number" placeholder="5000"
                value={calc.deposit} onChange={e => setCalc({ ...calc, deposit: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">📉 Риск на сделку (%)</label>
              <input className="form-input" type="number" step="0.1" placeholder="1"
                value={calc.riskPercent} onChange={e => setCalc({ ...calc, riskPercent: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">⚡ Плечо (x)</label>
              <input className="form-input" type="number" placeholder="10"
                value={calc.leverage} onChange={e => setCalc({ ...calc, leverage: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">🟢 Цена входа</label>
              <input className="form-input" type="number" step="any" placeholder="64000"
                value={calc.entryPrice} onChange={e => setCalc({ ...calc, entryPrice: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">🔴 Цена стоп-лосса</label>
              <input className="form-input" type="number" step="any" placeholder="63000"
                value={calc.stopLossPrice} onChange={e => setCalc({ ...calc, stopLossPrice: e.target.value })} />
            </div>
          </div>

          {calcResult ? (
            <div style={{
              background: calcResult.isOk ? 'var(--green-dim)' : 'var(--red-dim)',
              border: `1px solid ${calcResult.isOk ? 'var(--border-active)' : 'rgba(255,71,87,0.3)'}`,
              borderRadius: 12, padding: 20,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: calcResult.isOk ? 'var(--green)' : 'var(--red)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                {calcResult.isOk ? '✅ Параметры в норме' : '⚠️ Проверь параметры — высокий риск'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                {[
                  { label: 'Риск в $', value: `$${calcResult.riskUsd}`, color: 'var(--red)', bold: true },
                  { label: 'Размер позиции', value: `$${calcResult.positionSize}`, color: 'var(--text-primary)', bold: true },
                  { label: 'Кол-во монет', value: calcResult.contracts, color: 'var(--text-primary)', bold: false },
                  { label: 'Необходимая маржа', value: `$${calcResult.margin}`, color: 'var(--yellow)', bold: true },
                  { label: 'Маржа от депозита', value: `${calcResult.marginPct}%`, color: parseFloat(calcResult.marginPct) > 30 ? 'var(--red)' : 'var(--green)', bold: false },
                  { label: 'Расстояние до SL', value: `${calcResult.slDistancePct}% / ${calcResult.slDistancePctWithLev}% с плечом`, color: 'var(--text-secondary)', bold: false },
                ].map(({ label, value, color, bold }) => (
                  <div key={label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</div>
                    <div style={{ fontSize: bold ? 16 : 13, fontWeight: bold ? 800 : 600, color, fontFamily: 'monospace' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Quick tip */}
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                💡 Открой позицию {calcResult.contracts} {calc.entryPrice ? `монет по ~$${parseFloat(calc.entryPrice).toFixed(2)}` : ''}. 
                При попадании в стоп потеряешь <b style={{ color: 'var(--red)' }}>${calcResult.riskUsd}</b> ({calc.riskPercent}% депозита).
              </div>
            </div>
          ) : (
            <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: 10, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Введи депозит, % риска, плечо, цену входа и стоп-лосс → получишь точный размер позиции
            </div>
          )}
        </div>

        {/* Motivational block */}
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>💭 Напоминания</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {[
              { icon: '🛑', text: 'Поставил стоп — не двигай его. Никогда.' },
              { icon: '📊', text: 'Максимум 3-4 сделки в день. Больше — хуже.' },
              { icon: '💰', text: 'После большого профита — обязательный перерыв.' },
              { icon: '🧠', text: 'Торгуй головой, не эмоциями. Если злишься — выключи.' },
              { icon: '📒', text: 'Записывай каждую сделку. Паттерны ошибок видны только в журнале.' },
              { icon: '⏰', text: 'Если торгуешь дольше 4 часов — сделай перерыв минимум на час.' },
            ].map(({ icon, text }) => (
              <div key={text} style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
