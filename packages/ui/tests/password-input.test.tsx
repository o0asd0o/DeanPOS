// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { PasswordInput } from "../src/index.ts";

afterEach(cleanup);

describe("PasswordInput", () => {
  it("toggles the field between masked and readable, keeping the typed value", () => {
    render(<PasswordInput aria-label="Password" defaultValue="correct horse" />);

    const field = screen.getByLabelText("Password") as HTMLInputElement;
    expect(field.type).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(field.type).toBe("text");
    expect(field.value).toBe("correct horse");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(field.type).toBe("password");
  });
});
