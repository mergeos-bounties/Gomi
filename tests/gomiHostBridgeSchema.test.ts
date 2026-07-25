import { describe, expect, it } from "vitest";
import {
  validateHostBridgeMessage,
  MAX_BRIDGE_PAYLOAD_BYTES,
} from "../src/vs/workbench/contrib/gomi/electron-sandbox/gomiHostBridgeSchema";

describe("validateHostBridgeMessage", () => {
  it("rejects null", () => {
    expect(validateHostBridgeMessage(null).valid).toBe(false);
  });

  it("rejects non-object primitives", () => {
    expect(validateHostBridgeMessage("string").valid).toBe(false);
    expect(validateHostBridgeMessage(42).valid).toBe(false);
    expect(validateHostBridgeMessage(true).valid).toBe(false);
  });

  it("rejects message with missing type", () => {
    expect(validateHostBridgeMessage({}).valid).toBe(false);
    expect(validateHostBridgeMessage({ protocolVersion: 1 }).valid).toBe(false);
  });

  it("rejects unknown message type", () => {
    expect(validateHostBridgeMessage({ type: "gomi.unknown" }).valid).toBe(false);
    expect(validateHostBridgeMessage({ type: "arbitrary" }).valid).toBe(false);
  });

  it("validates gomi.run requires request field", () => {
    expect(validateHostBridgeMessage({ type: "gomi.run" }).valid).toBe(false);
    expect(
      validateHostBridgeMessage({ type: "gomi.run", request: "hello" }).valid
    ).toBe(true);
  });

  it("validates gomi.applyPatch requires patch object", () => {
    expect(validateHostBridgeMessage({ type: "gomi.applyPatch" }).valid).toBe(
      false
    );
    expect(
      validateHostBridgeMessage({
        type: "gomi.applyPatch",
        patch: { id: "x" },
      }).valid
    ).toBe(true);
  });

  it("validates gomi.openProject requires project object", () => {
    expect(
      validateHostBridgeMessage({ type: "gomi.openProject" }).valid
    ).toBe(false);
    expect(
      validateHostBridgeMessage({
        type: "gomi.openProject",
        project: { id: "1", name: "test" },
      }).valid
    ).toBe(true);
  });

  it("accepts valid gomi.stop with optional reason", () => {
    expect(validateHostBridgeMessage({ type: "gomi.stop" }).valid).toBe(true);
    expect(
      validateHostBridgeMessage({ type: "gomi.stop", reason: "done" }).valid
    ).toBe(true);
  });

  it("rejects invalid protocolVersion", () => {
    expect(
      validateHostBridgeMessage({
        type: "gomi.stop",
        protocolVersion: 0,
      }).valid
    ).toBe(false);
    expect(
      validateHostBridgeMessage({
        type: "gomi.stop",
        protocolVersion: "1",
      }).valid
    ).toBe(false);
  });

  it("accepts valid protocolVersion", () => {
    expect(
      validateHostBridgeMessage({
        type: "gomi.stop",
        protocolVersion: 1,
      }).valid
    ).toBe(true);
  });
});
