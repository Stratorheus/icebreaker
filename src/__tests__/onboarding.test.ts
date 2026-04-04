import { describe, it, expect } from "vitest";
import { createTestStore } from "./helpers/test-store";

describe("onboarding store actions", () => {
  it("starts with onboardingComplete = false", () => {
    const store = createTestStore();
    expect(store.getState().onboardingComplete).toBe(false);
  });

  it("starts with empty hintsShown", () => {
    const store = createTestStore();
    expect(store.getState().hintsShown).toEqual({});
  });

  it("completeOnboarding sets flag to true", () => {
    const store = createTestStore();
    store.getState().completeOnboarding();
    expect(store.getState().onboardingComplete).toBe(true);
  });

  it("resetOnboarding clears onboarding and hints without touching stats", () => {
    const store = createTestStore();
    store.getState().completeOnboarding();
    store.getState().markHintShown("hint-death");
    store.getState().updateStats({ totalRuns: 5 });
    store.getState().addData(1000);

    store.getState().resetOnboarding();

    expect(store.getState().onboardingComplete).toBe(false);
    expect(store.getState().hintsShown).toEqual({});
    expect(store.getState().stats.totalRuns).toBe(5);
    expect(store.getState().data).toBe(1000);
  });

  it("markHintShown sets individual hint flags", () => {
    const store = createTestStore();
    store.getState().markHintShown("hint-death");
    expect(store.getState().hintsShown["hint-death"]).toBe(true);
    expect(store.getState().hintsShown["hint-run-shop"]).toBeUndefined();
  });

  it("markHintShown does not overwrite other hints", () => {
    const store = createTestStore();
    store.getState().markHintShown("hint-death");
    store.getState().markHintShown("hint-run-shop");
    expect(store.getState().hintsShown["hint-death"]).toBe(true);
    expect(store.getState().hintsShown["hint-run-shop"]).toBe(true);
  });
});
