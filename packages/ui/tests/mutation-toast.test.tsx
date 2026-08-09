// @vitest-environment happy-dom
import { QueryClientProvider, useMutation } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { createQueryClient, Toaster } from "../src/index.ts";

afterEach(cleanup);

function Mutator({ result }: { result: () => Promise<unknown> }) {
  const queryClient = createQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <Button result={result} />
      <Toaster />
    </QueryClientProvider>
  );
}

function Button({ result }: { result: () => Promise<unknown> }) {
  const mutation = useMutation({
    mutationFn: result,
    meta: { success: "Store saved", error: "Couldn't save the store" },
  });
  return <button onClick={() => mutation.mutate()}>Save</button>;
}

async function clickSave(result: () => Promise<unknown>) {
  render(<Mutator result={result} />);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
}

describe("mutation toasts", () => {
  it("reports a resolved value as a success", async () => {
    await clickSave(() => Promise.resolve({ id: "1" }));

    await waitFor(() => expect(screen.getByText("Store saved")).toBeTruthy());
    expect(screen.getByText("The action completed successfully.")).toBeTruthy();
  });

  it("reports a rejection as a failure", async () => {
    await clickSave(() => Promise.reject(new Error("boom")));

    await waitFor(() => expect(screen.getByText("Couldn't save the store")).toBeTruthy());
  });

  // The repo's refusal convention: a handler that says no resolves `null`
  // rather than rejecting, and that is a failure to the person who clicked.
  it("reports a null result as a failure", async () => {
    await clickSave(() => Promise.resolve(null));

    await waitFor(() => expect(screen.getByText("Couldn't save the store")).toBeTruthy());
  });

  it("reports an { ok: false } result as a failure", async () => {
    await clickSave(() => Promise.resolve({ ok: false }));

    await waitFor(() => expect(screen.getByText("Couldn't save the store")).toBeTruthy());
  });

  it("falls back to generic copy when a mutation carries no meta", async () => {
    function Bare() {
      const queryClient = createQueryClient();
      return (
        <QueryClientProvider client={queryClient}>
          <BareButton />
          <Toaster />
        </QueryClientProvider>
      );
    }
    function BareButton() {
      const mutation = useMutation({ mutationFn: () => Promise.resolve({ id: "1" }) });
      return <button onClick={() => mutation.mutate()}>Go</button>;
    }
    render(<Bare />);

    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await waitFor(() => expect(screen.getByText("Saved")).toBeTruthy());
  });
});
