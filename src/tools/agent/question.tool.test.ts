import { describe, it, expect } from 'bun:test';
import questionTool, { getPendingQuestion, respondToQuestion } from './question.tool.js';

describe('Question Tool', () => {
  it('should create a pending question state when executed', () => {
    const questions = [
      {
        question: 'What is your favorite color?',
        header: 'Color Preference',
        options: [
          { label: 'Red', description: 'The color of fire' },
          { label: 'Blue', description: 'The color of the sky' },
        ],
      },
    ];

    // Execute the tool (don't await yet)
    const promise = questionTool.execute({ questions }, {
      signal: new AbortController().signal,
      onProgress: () => {},
      config: {},
    });

    // Check pending state
    const pending = getPendingQuestion();
    expect(pending).toEqual(questions);

    // Resolve it
    const answers = [{ question: 'What is your favorite color?', answer: 'Blue' }];
    respondToQuestion(answers);

    // Now await the result
    return promise.then((result) => {
      expect(JSON.parse(result)).toEqual(answers);
      expect(getPendingQuestion()).toBeNull();
    });
  });

  it('should handle multi-select questions', async () => {
    const questions = [
      {
        question: 'Select fruits',
        header: 'Fruit Basket',
        options: [
          { label: 'Apple', description: 'Red fruit' },
          { label: 'Banana', description: 'Yellow fruit' },
        ],
        multiple: true,
      },
    ];

    const promise = questionTool.execute({ questions }, {
      signal: new AbortController().signal,
      onProgress: () => {},
      config: {},
    });

    const answers = [{ question: 'Select fruits', answer: ['Apple', 'Banana'] }];
    respondToQuestion(answers);

    const result = await promise;
    expect(JSON.parse(result)).toEqual(answers);
  });
});
