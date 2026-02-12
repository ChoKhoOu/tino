import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';

const questionSchema = z.object({
  questions: z.array(z.object({
    question: z.string(),
    header: z.string(),
    options: z.array(z.object({
      label: z.string(),
      description: z.string(),
    })),
    multiple: z.boolean().optional(),
  })),
});

type QuestionArgs = z.infer<typeof questionSchema>;
type QuestionResolver = (answers: unknown) => void;

let pendingQuestion: QuestionArgs['questions'] | null = null;
let questionResolver: QuestionResolver | null = null;

export function getPendingQuestion() {
  return pendingQuestion;
}

export function respondToQuestion(answers: unknown) {
  if (questionResolver) {
    questionResolver(answers);
    questionResolver = null;
    pendingQuestion = null;
  }
}

export default definePlugin({
  id: 'question',
  domain: 'agent',
  riskLevel: 'safe',
  description: 'Ask the user structured questions (multiple choice, text input) and pause execution until response.',
  schema: questionSchema,
  execute: async (args, ctx) => {
    const { questions } = args as QuestionArgs;
    pendingQuestion = questions;
    
    ctx.onProgress('Waiting for user input...');
    
    const answers = await new Promise((resolve) => {
      questionResolver = resolve;
    });

    return JSON.stringify(answers);
  },
});
