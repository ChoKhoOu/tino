import { useCallback, useState } from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';
import { useKeyboardBinding, useKeyboardMode } from '../keyboard/use-keyboard.js';
import type { KeyEvent } from '../keyboard/types.js';

interface Option {
  label: string;
  description: string;
}

interface Question {
  question: string;
  header: string;
  options: Option[];
  multiple?: boolean;
}

interface QuestionPromptProps {
  questions: Question[];
  onAnswer: (answers: Array<{ question: string; answer: string | string[] }>) => void;
}

export function QuestionPrompt({ questions, onAnswer }: QuestionPromptProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<{ question: string; answer: string | string[] }>>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  const currentQuestion = questions[currentIndex];

  useKeyboardMode('popup');

  const submitAnswer = useCallback((answer: string | string[]) => {
    const activeQuestion = questions[currentIndex];
    if (!activeQuestion) return;

    const newAnswer = { question: activeQuestion.question, answer };
    const nextAnswers = [...answers, newAnswer];

    if (currentIndex < questions.length - 1) {
      setAnswers(nextAnswers);
      setCurrentIndex(currentIndex + 1);
      setSelectedIndices(new Set());
      return;
    }

    onAnswer(nextAnswers);
  }, [answers, currentIndex, onAnswer, questions]);

  const handleQuestionInput = useCallback((event: KeyEvent) => {
    const { input, key } = event;
    if (!currentQuestion) return false;

    const num = parseInt(input, 10);
    if (!isNaN(num) && num > 0 && num <= currentQuestion.options.length) {
      const index = num - 1;
      if (currentQuestion.multiple) {
        setSelectedIndices(prev => {
          const next = new Set(prev);
          if (next.has(index)) next.delete(index);
          else next.add(index);
          return next;
        });
      } else {
        submitAnswer(currentQuestion.options[index].label);
      }
      return true;
    }

    if (key.return && currentQuestion.multiple) {
      const selected = currentQuestion.options
        .filter((_, i) => selectedIndices.has(i))
        .map(o => o.label);
      submitAnswer(selected);
      return true;
    }
    return false;
  }, [currentQuestion, selectedIndices, submitAnswer]);

  useKeyboardBinding('popup', 'any', handleQuestionInput);

  if (!currentQuestion) return null;

  return (
    <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor={colors.info} padding={1}>
      <Box marginBottom={1}>
        <Text color={colors.info} bold>
          ? {currentQuestion.header}
        </Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text bold>{currentQuestion.question}</Text>
      </Box>

      <Box flexDirection="column">
        {currentQuestion.options.map((option, index) => {
          const isSelected = selectedIndices.has(index);
          const num = index + 1;
          
          return (
            <Box key={`${index}-${option.label}`} marginBottom={0}>
              <Text color={isSelected ? colors.highlight : colors.muted}>
                {isSelected ? '●' : '○'} 
              </Text>
              <Text color={colors.muted}> [{num}] </Text>
              <Text color={isSelected ? colors.highlight : colors.white} bold={isSelected}>
                {option.label}
              </Text>
              <Text color={colors.muted}> - {option.description}</Text>
            </Box>
          );
        })}
      </Box>

      {currentQuestion.multiple && (
        <Box marginTop={1}>
          <Text color={colors.muted} dimColor>
            (Press numbers to toggle, Enter to confirm)
          </Text>
        </Box>
      )}
      {!currentQuestion.multiple && (
        <Box marginTop={1}>
          <Text color={colors.muted} dimColor>
            (Press number to select)
          </Text>
        </Box>
      )}
    </Box>
  );
}
