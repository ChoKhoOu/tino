import { describe, test, expect } from 'bun:test';
import { runDoctorChecks, formatDoctorOutput, type DoctorCheckResult } from '../doctor.js';

describe('runDoctorChecks', () => {
  test('returns an array of check results', async () => {
    const results = await runDoctorChecks();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  test('each result has name, passed, and message fields', async () => {
    const results = await runDoctorChecks();
    for (const r of results) {
      expect(r).toHaveProperty('name');
      expect(r).toHaveProperty('passed');
      expect(r).toHaveProperty('message');
      expect(typeof r.name).toBe('string');
      expect(typeof r.passed).toBe('boolean');
      expect(typeof r.message).toBe('string');
    }
  });

  test('includes Bun version check that passes', async () => {
    const results = await runDoctorChecks();
    const bunCheck = results.find((r: DoctorCheckResult) => r.name === 'Bun Runtime');
    expect(bunCheck).toBeDefined();
    expect(bunCheck!.passed).toBe(true);
    expect(bunCheck!.message).toContain(Bun.version);
  });

  test('includes API keys check', async () => {
    const results = await runDoctorChecks();
    const apiCheck = results.find((r: DoctorCheckResult) => r.name === 'API Keys');
    expect(apiCheck).toBeDefined();
    expect(apiCheck!.message.length).toBeGreaterThan(0);
  });

  test('includes Python daemon check', async () => {
    const results = await runDoctorChecks();
    const daemonCheck = results.find((r: DoctorCheckResult) => r.name === 'Python Daemon');
    expect(daemonCheck).toBeDefined();
  });

  test('includes gRPC connection check', async () => {
    const results = await runDoctorChecks();
    const grpcCheck = results.find((r: DoctorCheckResult) => r.name === 'gRPC Connection');
    expect(grpcCheck).toBeDefined();
  });

  test('includes disk space check', async () => {
    const results = await runDoctorChecks();
    const diskCheck = results.find((r: DoctorCheckResult) => r.name === 'Disk Space');
    expect(diskCheck).toBeDefined();
  });

  test('optional suggestion field is string when present', async () => {
    const results = await runDoctorChecks();
    for (const r of results) {
      if (r.suggestion !== undefined) {
        expect(typeof r.suggestion).toBe('string');
      }
    }
  });
});

describe('formatDoctorOutput', () => {
  test('formats passing checks with checkmark', () => {
    const results: DoctorCheckResult[] = [
      { name: 'Test', passed: true, message: 'OK' },
    ];
    const output = formatDoctorOutput(results);
    expect(output).toContain('\u2713');
    expect(output).toContain('Test');
  });

  test('formats failing checks with cross mark and suggestion', () => {
    const results: DoctorCheckResult[] = [
      { name: 'Test', passed: false, message: 'Failed', suggestion: 'Fix it' },
    ];
    const output = formatDoctorOutput(results);
    expect(output).toContain('\u2717');
    expect(output).toContain('Fix it');
  });

  test('includes header', () => {
    const output = formatDoctorOutput([]);
    expect(output).toContain('Health Check');
  });
});
