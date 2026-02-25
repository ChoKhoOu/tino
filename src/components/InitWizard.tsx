import React, { useState, useCallback } from 'react';
import { Box, useInput } from 'ink';
import { runInitProject } from '../commands/init-project.js';
import { validateApiKey } from '../commands/api-key-validator.js';
import { saveApiKeyForProvider, saveApiKeyToEnv } from '../config/env.js';
import { setSetting } from '../config/settings.js';
import { colors } from '../theme.js';
import {
  AI_PROVIDERS, EXCHANGES,
  StepHeader, SelectionList, TextInputStep, ValidateStep, CompleteStep,
} from './InitWizardSteps.js';

type Step = 'ai-provider' | 'ai-key' | 'exchange' | 'exchange-api-key' | 'exchange-api-secret' | 'exchange-validate' | 'complete';

interface InitWizardProps {
  projectDir: string;
  onComplete: (summary: string) => void;
}

export function InitWizard({ projectDir, onComplete }: InitWizardProps) {
  const [step, setStep] = useState<Step>('ai-provider');
  const [aiIdx, setAiIdx] = useState(0);
  const [aiProvider, setAiProvider] = useState('');
  const [aiKey, setAiKey] = useState('');
  
  const [exIdx, setExIdx] = useState(0);
  const [exchange, setExchange] = useState('');
  const [exApiKey, setExApiKey] = useState('');
  const [exApiSecret, setExApiSecret] = useState('');
  
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [textBuf, setTextBuf] = useState('');

  const runValidation = useCallback(async () => {
    setValidating(true);
    setValidationError('');
    const result = await validateApiKey(exchange, exApiKey, exApiSecret);
    setValidating(false);
    if (result.valid) {
      setStep('complete');
    } else {
      setValidationError(result.error ?? 'Validation failed');
    }
  }, [exchange, exApiKey, exApiSecret]);

  const finalize = useCallback(() => {
    const finalProvider = aiProvider && aiProvider !== 'skip' ? aiProvider : undefined;
    const finalEx = exchange && exchange !== 'skip' ? exchange : undefined;

    // Create project files first so .tino/settings.json exists
    runInitProject(projectDir, { provider: finalProvider, exchange: finalEx });

    // Now setSetting writes to project-level .tino/settings.json (not global)
    if (finalProvider) {
      setSetting('provider', finalProvider);
      if (aiKey) {
        saveApiKeyForProvider(finalProvider, aiKey);
      }
    }

    // Persist exchange credentials to .env
    if (finalEx && exApiKey) {
      const prefix = finalEx.toUpperCase();
      saveApiKeyToEnv(`${prefix}_API_KEY`, exApiKey);
      if (exApiSecret) {
        saveApiKeyToEnv(`${prefix}_API_SECRET`, exApiSecret);
      }
    }

    onComplete('Tino is ready!');
  }, [projectDir, aiProvider, aiKey, exchange, exApiKey, exApiSecret, onComplete]);

  useInput((input, key) => {
    if (step === 'ai-provider') {
      if (key.downArrow) setAiIdx((i) => Math.min(i + 1, AI_PROVIDERS.length - 1));
      if (key.upArrow) setAiIdx((i) => Math.max(i - 1, 0));
      if (key.return) {
        const selected = AI_PROVIDERS[aiIdx].id;
        if (selected === 'skip') {
          setAiProvider('skip');
          setStep('exchange');
        } else {
          setAiProvider(selected);
          setStep('ai-key');
        }
      }
      return;
    }
    if (step === 'ai-key') {
      if (key.escape) { setStep('ai-provider'); setTextBuf(''); return; }
      if (key.return) { setAiKey(textBuf); setTextBuf(''); setStep('exchange'); return; }
      if (key.backspace || key.delete) { setTextBuf((t) => t.slice(0, -1)); return; }
      if (input && !key.ctrl && !key.meta) setTextBuf((t) => t + input);
      return;
    }
    
    if (step === 'exchange') {
      if (key.downArrow) setExIdx((i) => Math.min(i + 1, EXCHANGES.length - 1));
      if (key.upArrow) setExIdx((i) => Math.max(i - 1, 0));
      if (key.return) {
        const selected = EXCHANGES[exIdx].id;
        if (selected === 'skip') {
          setExchange('skip');
          setStep('complete');
        } else {
          setExchange(selected);
          setStep('exchange-api-key');
        }
      }
      return;
    }
    if (step === 'exchange-api-key') {
      if (key.escape) { setStep('exchange'); setTextBuf(''); return; }
      if (key.return) { setExApiKey(textBuf); setTextBuf(''); setStep('exchange-api-secret'); return; }
      if (key.backspace || key.delete) { setTextBuf((t) => t.slice(0, -1)); return; }
      if (input && !key.ctrl && !key.meta) setTextBuf((t) => t + input);
      return;
    }
    if (step === 'exchange-api-secret') {
      if (key.escape) { setStep('exchange-api-key'); setTextBuf(exApiKey); return; }
      if (key.return) { setExApiSecret(textBuf); setTextBuf(''); setStep('exchange-validate'); return; }
      if (key.backspace || key.delete) { setTextBuf((t) => t.slice(0, -1)); return; }
      if (input && !key.ctrl && !key.meta) setTextBuf((t) => t + input);
      return;
    }
    if (step === 'exchange-validate') {
      if (key.return && validationError) { setStep('exchange-api-key'); setValidationError(''); setTextBuf(''); }
      if (!validating && !validationError) runValidation();
      return;
    }
    
    if (step === 'complete' && key.return) {
      finalize();
      return;
    }
  });

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      {step === 'ai-provider' && (
        <Box flexDirection="column">
          <StepHeader step={1} title="AI Model Configuration" description="Choose your AI provider for analysis." />
          <SelectionList items={AI_PROVIDERS.map(p => p.label)} selectedIndex={aiIdx} />
        </Box>
      )}
      {step === 'ai-key' && (
        <Box flexDirection="column">
          <StepHeader step={1} title="AI API Key" />
          <TextInputStep label={`${AI_PROVIDERS.find(p => p.id === aiProvider)?.label} API Key`} value={textBuf} masked />
        </Box>
      )}
      
      {step === 'exchange' && (
        <Box flexDirection="column">
          <StepHeader step={2} title="Exchange Connection (Optional)" description="Connect an exchange to trade and view balance." />
          <SelectionList items={EXCHANGES.map(e => e.label)} selectedIndex={exIdx} />
        </Box>
      )}
      {step === 'exchange-api-key' && (
        <Box flexDirection="column">
          <StepHeader step={2} title={`${EXCHANGES.find(e => e.id === exchange)?.label} API Key`} />
          <TextInputStep label="API Key" value={textBuf} masked={false} />
        </Box>
      )}
      {step === 'exchange-api-secret' && (
        <Box flexDirection="column">
          <StepHeader step={2} title={`${EXCHANGES.find(e => e.id === exchange)?.label} API Secret`} />
          <TextInputStep label="API Secret" value={textBuf} masked />
        </Box>
      )}
      {step === 'exchange-validate' && (
        <Box flexDirection="column">
          <StepHeader step={2} title="Validating Credentials" />
          <ValidateStep validating={validating} error={validationError} />
        </Box>
      )}
      
      {step === 'complete' && (
        <Box flexDirection="column">
          <StepHeader step={3} title="Ready to Go!" />
          <CompleteStep />
        </Box>
      )}
    </Box>
  );
}
