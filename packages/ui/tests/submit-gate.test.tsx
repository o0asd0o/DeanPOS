// @vitest-environment happy-dom
import { useForm } from "@tanstack/react-form";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { Button, Input, useSubmitGate } from "../src/index.ts";

let submits = 0;

function Editor({ dirty = false }: { dirty?: boolean }) {
  const form = useForm({
    defaultValues: { name: "Downtown" },
    onSubmit: () => {
      submits += 1;
    },
  });
  const gate = useSubmitGate(form, { dirty });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        gate.submit();
      }}
    >
      <form.Field name="name">
        {(field) => (
          <Input
            aria-label="Name"
            value={field.state.value}
            onChange={(event) => field.handleChange(event.target.value)}
          />
        )}
      </form.Field>
      <Button type="submit" aria-disabled={gate.blocked}>
        Save changes
      </Button>
    </form>
  );
}

afterEach(() => {
  cleanup();
  submits = 0;
});

describe("useSubmitGate", () => {
  it("blocks the commit until a value differs from the default, and again once it is put back", async () => {
    render(<Editor />);
    const save = screen.getByRole("button", { name: "Save changes" });
    const name = screen.getByLabelText("Name");

    expect(save.getAttribute("aria-disabled")).toBe("true");
    // `aria-disabled` does not stop Enter-to-submit, so the gate refuses too.
    fireEvent.submit(save.closest("form")!);
    expect(submits).toBe(0);

    fireEvent.change(name, { target: { value: "Uptown" } });
    expect(save.getAttribute("aria-disabled")).toBe("false");
    fireEvent.submit(save.closest("form")!);
    await waitFor(() => expect(submits).toBe(1));

    fireEvent.change(name, { target: { value: "Downtown" } });
    expect(save.getAttribute("aria-disabled")).toBe("true");
  });

  it("takes a change made outside the form as a reason to enable the commit", () => {
    render(<Editor dirty />);

    expect(screen.getByRole("button", { name: "Save changes" }).getAttribute("aria-disabled")).toBe(
      "false",
    );
  });
});
