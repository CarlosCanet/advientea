import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import ConfirmDialog from "@/components/ConfirmDialog";

/** The props as specified, kept here so the test does not lean on the component's own types. */
interface ConfirmDialogProps {
  confirmLabel: string;
  description: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
  variant?: "default" | "destructive";
}

const TITLE = "¿Borrar el día 3?";
const DESCRIPTION = "El día 3 se borrará con sus 2 apuestas. No se puede deshacer.";
const CONFIRM_LABEL = "Borrar";

function renderDialog(overrides: Partial<ConfirmDialogProps> = {}) {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();
  render(
    <ConfirmDialog
      confirmLabel={CONFIRM_LABEL}
      description={DESCRIPTION}
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open
      title={TITLE}
      {...overrides}
    />,
  );
  return { onConfirm, onOpenChange };
}

/** The first argument of every `onOpenChange` call: the component may forward extra details after it. */
function openValues(onOpenChange: ReturnType<typeof vi.fn>) {
  return onOpenChange.mock.calls.map((call) => call[0]);
}

/** A parent that owns the open state, as the real callers do. */
function DialogHost({ onConfirm, variant }: { onConfirm: () => void; variant?: "default" | "destructive" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        Abrir
      </button>
      <ConfirmDialog
        confirmLabel={CONFIRM_LABEL}
        description={DESCRIPTION}
        onConfirm={onConfirm}
        onOpenChange={setOpen}
        open={open}
        title={TITLE}
        variant={variant}
      />
    </>
  );
}

describe("ConfirmDialog", () => {
  it("renders no alertdialog while closed", () => {
    renderDialog({ open: false });

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog", { hidden: true })).not.toBeInTheDocument();
  });

  it("renders one alertdialog named by the title and described by the description", async () => {
    renderDialog();

    const dialogs = await screen.findAllByRole("alertdialog");
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveAccessibleName(TITLE);
    expect(dialogs[0]).toHaveAccessibleDescription(DESCRIPTION);
  });

  it("shows a cancel button and a confirm button named by confirmLabel", async () => {
    renderDialog();

    expect(await screen.findByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: CONFIRM_LABEL })).toBeInTheDocument();
  });

  it("closes without confirming when Cancelar is clicked", async () => {
    const user = userEvent.setup();
    const { onConfirm, onOpenChange } = renderDialog();

    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(openValues(onOpenChange)).toEqual([false]);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("closes without confirming when Escape is pressed", async () => {
    const user = userEvent.setup();
    const { onConfirm, onOpenChange } = renderDialog();
    await screen.findByRole("alertdialog");

    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(openValues(onOpenChange)).toEqual([false]);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirms once and closes when the confirm button is clicked", async () => {
    const user = userEvent.setup();
    const { onConfirm, onOpenChange } = renderDialog();

    await user.click(await screen.findByRole("button", { name: CONFIRM_LABEL }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(openValues(onOpenChange)).toEqual([false]);
  });

  it("confirms only once when the confirm button is double clicked", async () => {
    const user = userEvent.setup();
    // The mocked onOpenChange never closes it, so the button stays reachable for the second click.
    const { onConfirm } = renderDialog();
    const confirm = await screen.findByRole("button", { name: CONFIRM_LABEL });

    await user.dblClick(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("confirms only once when the confirm button is clicked twice", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();
    const confirm = await screen.findByRole("button", { name: CONFIRM_LABEL });

    await user.click(confirm);
    await user.click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("stays open and calls nothing when clicking outside it", async () => {
    // A modal may disable pointer events outside itself; the click must still reach the page.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { onConfirm, onOpenChange } = renderDialog();
    await screen.findByRole("alertdialog");

    await user.click(document.body);

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("focuses Cancelar when it opens with the destructive variant", async () => {
    renderDialog({ variant: "destructive" });

    const cancel = await screen.findByRole("button", { name: "Cancelar" });
    await waitFor(() => {
      expect(cancel).toHaveFocus();
    });
  });

  it("focuses the confirm button when it opens with the default variant", async () => {
    renderDialog();

    const confirm = await screen.findByRole("button", { name: CONFIRM_LABEL });
    await waitFor(() => {
      expect(confirm).toHaveFocus();
    });
  });

  it("returns focus to the trigger after cancelling", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DialogHost onConfirm={onConfirm} variant="destructive" />);
    const trigger = screen.getByRole("button", { name: "Abrir" });

    await user.click(trigger);
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("returns focus to the trigger after confirming", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DialogHost onConfirm={onConfirm} />);
    const trigger = screen.getByRole("button", { name: "Abrir" });

    await user.click(trigger);
    await user.click(await screen.findByRole("button", { name: CONFIRM_LABEL }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });
});
