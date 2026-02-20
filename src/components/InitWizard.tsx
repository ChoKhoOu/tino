import React, { useState, useCallback } from 'react';
import { Box, useInput } from 'ink';
import { runInitProject } from '../commands/init-project.js';
import { validateApiKey } from '../commands/api-key-validator.js';
import {
  EXCHANGES, PAIRS,
  StepIndicator, WelcomeStep, ExchangeStep,
  TextInputStep, ValidateStep, PairStep, SummaryStep,
} from './InitWizardSteps.js';

type Step = 'welcome' | 'exchange' | 'api-key' | 'api-secret' | 'validate' | 'pair' | 'summary';

interface InitWizardProps {
  projectDir: string;
  onComplete: (summary: string) => void;
}

export function InitWizard({ projectDir, onComplete }: InitWizardProps) {
  const [step, setStep] = useState<Step>('welcome');
  const [exchangeIdx, setExchangeIdx] = useState(0);
  const [exchange, setExchange] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [pairIdx, setPairIdx] = useState(0);
  const [pair, setPair] = useState('');
  const [customPair, setCustomPair] = useState('');
  const [validationError, setValidationError] = useState('');
  const [validating, setValidating] = useState(false);
  const [textBuf, setTextBuf] = useState('');

  const advanceFromExchange = useCallback((idx: number) => {
    const selected = EXCHANGES[idx];
    if (selected === 'Skip') {
      setExchange('');
      setStep('pair');
    } else {
      setExchange(selected.toLowerCase());
      setStep('api-key');
    }
  }, []);

  const advanceFromPair = useCallback((idx: number) => {
    const selected = PAIRS[idx];
    if (selected === 'Custom') {
      setStep('summary');
      setPair('');
    } else {
      setPair(selected.replace('/', ''));
      setStep('summary');
    }
  }, []);

  const runValidation = useCallback(async () => {
    setValidating(true);
    setValidationError('');
    const result = await validateApiKey(exchange, apiKey, apiSecret);
    setValidating(false);
    if (result.valid) {
      setStep('pair');
    } else {
      setValidationError(result.error ?? 'Validation failed');
    }
  }, [exchange, apiKey, apiSecret]);

  const finalize = useCallback(() => {
    const initResult = runInitProject(projectDir, {
      exchange,
      defaultPair: pair || customPair || 'BTCUSDT',
    });
    const lines: string[] = [];
    if (initResult.created.length > 0) {
      lines.push('Created:');
      for (const f of initResult.created) lines.push(`  + ${f}`);
    }
    if (initResult.skipped.length > 0) {
      lines.push('Skipped (already exist):');
      for (const f of initResult.skipped) lines.push(`  - ${f}`);
    }
    lines.push('', 'Project initialized. Try: "backtest BTC/USDT momentum strategy"');
    onComplete(lines.join('\n'));
  }, [projectDir, exchange, pair, customPair, onComplete]);

  useInput((input, key) => {
    if (step === 'welcome' && key.return) {
      setStep('exchange');
      return;
    }
    if (step === 'exchange') {
      if (key.downArrow) setExchangeIdx((i) => Math.min(i + 1, EXCHANGES.length - 1));
      if (key.upArrow) setExchangeIdx((i) => Math.max(i - 1, 0));
      if (key.return) advanceFromExchange(exchangeIdx);
      return;
    }
    if (step === 'api-key') {
      if (key.return) { setApiKey(textBuf); setTextBuf(''); setStep('api-secret'); return; }
      if (key.backspace || key.delete) { setTextBuf((t) => t.slice(0, -1)); return; }
      if (input && !key.ctrl && !key.meta) setTextBuf((t) => t + input);
      return;
    }
    if (step === 'api-secret') {
      if (key.return) { setApiSecret(textBuf); setTextBuf(''); setStep('validate'); return; }
      if (key.backspace || key.delete) { setTextBuf((t) => t.slice(0, -1)); return; }
      if (input && !key.ctrl && !key.meta) setTextBuf((t) => t + input);
      return;
    }
    if (step === 'validate') {
      if (key.return && validationError) { setStep('api-key'); setValidationError(''); setTextBuf(''); }
      if (!validating && !validationError) runValidation();
      return;
    }
    if (step === 'pair') {
      if (key.downArrow) setPairIdx((i) => Math.min(i + 1, PAIRS.length - 1));
      if (key.upArrow) setPairIdx((i) => Math.max(i - 1, 0));
      if (key.return) advanceFromPair(pairIdx);
      return;
    }
    if (step === 'summary' && key.return) {
      finalize();
      return;
    }
  });

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <StepIndicator current={step} />
      {step === 'welcome' && <WelcomeStep />}
      {step === 'exchange' && <ExchangeStep selectedIndex={exchangeIdx} />}
      {step === 'api-key' && <TextInputStep label="API Key" value={textBuf} masked={false} />}
      {step === 'api-secret' && <TextInputStep label="API Secret" value={textBuf} masked />}
      {step === 'validate' && <ValidateStep validating={validating} error={validationError} />}
      {step === 'pair' && <PairStep selectedIndex={pairIdx} />}
      {step === 'summary' && <SummaryStep exchange={exchange} pair={pair || customPair || 'BTCUSDT'} />}
    </Box>
  );
}
