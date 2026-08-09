import { describe, expect, it } from "vite-plus/test";

import {
  getModifierGroupSignals,
  type ModifierGroupOutput,
} from "@/features/catalog/options/helpers.ts";

const group = (overrides: Partial<ModifierGroupOutput>): ModifierGroupOutput => ({
  id: "group",
  tenantId: "tenant",
  name: "Group",
  selectionRule: "required-one",
  maximum: null,
  defaultModifierId: null,
  sortOrder: 0,
  archivedAt: null,
  createdAt: new Date(),
  linkedToCount: 0,
  modifiers: [],
  ...overrides,
});

describe("modifier group signals", () => {
  it("separates in-use, needs-attention, and unused groups", () => {
    const activeModifier = {
      id: "modifier",
      tenantId: "tenant",
      groupId: "group",
      name: "Active option",
      delta: { kind: "absolute" as const, amountCentavos: 0 },
      sortOrder: 0,
      archivedAt: null,
      createdAt: new Date(),
    };
    const archivedModifier = { ...activeModifier, id: "archived", archivedAt: new Date() };

    expect(
      getModifierGroupSignals(group({ linkedToCount: 1, modifiers: [activeModifier] })),
    ).toEqual({
      activeModifierCount: 1,
      inUse: true,
      needsAttention: false,
      unused: false,
    });
    expect(
      getModifierGroupSignals(group({ linkedToCount: 1, modifiers: [archivedModifier] })),
    ).toEqual({
      activeModifierCount: 0,
      inUse: false,
      needsAttention: true,
      unused: false,
    });
    expect(getModifierGroupSignals(group({ modifiers: [archivedModifier] }))).toEqual({
      activeModifierCount: 0,
      inUse: false,
      needsAttention: false,
      unused: true,
    });
  });
});
