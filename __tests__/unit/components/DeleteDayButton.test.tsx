import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteDayAction } from "@/app/actions/editionActions";
import DeleteDayButton from "@/components/editions/DeleteDayButton";
import { showActionToast } from "@/lib/action-toast";
import { ActionResponse } from "@/lib/types";

vi.mock("@/app/actions/editionActions", () => ({ deleteDayAction: vi.fn() }));
vi.mock("@/lib/action-toast", () => ({ showActionToast: vi.fn() }));

const DAY_ID = "day-42";
const DAY_NUMBER = 7;
const RESPONSE: ActionResponse = { message: "Día 7 borrado.", success: true };

function renderButton(props: { guessCount: number; isReleased: boolean }) {
  render(<DeleteDayButton dayId={DAY_ID} dayNumber={DAY_NUMBER} {...props} />);
  return screen.getByRole("button", { name: `Borrar el día ${DAY_NUMBER}` });
}

beforeEach(() => {
  vi.mocked(deleteDayAction).mockReset().mockResolvedValue(RESPONSE);
  vi.mocked(showActionToast).mockReset();
});

describe("DeleteDayButton", () => {
  it("renders a button named after the day", () => {
    renderButton({ guessCount: 0, isReleased: false });

    expect(screen.getByRole("button", { name: `Borrar el día ${DAY_NUMBER}` })).toBeInTheDocument();
  });

  it("deletes an unopened day without guesses straight away, with no dialog", async () => {
    const user = userEvent.setup();
    const trigger = renderButton({ guessCount: 0, isReleased: false });

    await user.click(trigger);

    await waitFor(() => {
      expect(showActionToast).toHaveBeenCalledWith(RESPONSE);
    });
    expect(deleteDayAction).toHaveBeenCalledTimes(1);
    expect(deleteDayAction).toHaveBeenCalledWith(DAY_ID);
    expect(showActionToast).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it.each([
    {
      case: "an opened day without guesses",
      description: `El día ${DAY_NUMBER} ya ha abierto. No tiene apuestas. No se puede deshacer.`,
      guessCount: 0,
      isReleased: true,
    },
    {
      case: "a day with one guess",
      description: `El día ${DAY_NUMBER} se borrará con su apuesta. No se puede deshacer.`,
      guessCount: 1,
      isReleased: false,
    },
    {
      case: "an opened day with one guess",
      description: `El día ${DAY_NUMBER} se borrará con su apuesta. No se puede deshacer.`,
      guessCount: 1,
      isReleased: true,
    },
    {
      case: "a day with several guesses",
      description: `El día ${DAY_NUMBER} se borrará con sus 5 apuestas. No se puede deshacer.`,
      guessCount: 5,
      isReleased: false,
    },
    {
      case: "an opened day with several guesses",
      description: `El día ${DAY_NUMBER} se borrará con sus 12 apuestas. No se puede deshacer.`,
      guessCount: 12,
      isReleased: true,
    },
  ])("asks for confirmation before deleting $case", async ({ description, guessCount, isReleased }) => {
    const user = userEvent.setup();
    const trigger = renderButton({ guessCount, isReleased });

    await user.click(trigger);

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveAccessibleName(`¿Borrar el día ${DAY_NUMBER}?`);
    expect(dialog).toHaveAccessibleDescription(description);
    expect(deleteDayAction).not.toHaveBeenCalled();
    expect(showActionToast).not.toHaveBeenCalled();
  });

  it("closes the dialog and deletes nothing when Cancelar is clicked", async () => {
    const user = userEvent.setup();
    const trigger = renderButton({ guessCount: 3, isReleased: true });

    await user.click(trigger);
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(deleteDayAction).not.toHaveBeenCalled();
    expect(showActionToast).not.toHaveBeenCalled();
  });

  it("deletes the day once and shows the result when Borrar is confirmed", async () => {
    const user = userEvent.setup();
    const failure: ActionResponse = { message: "No se pudo borrar el día. Inténtalo de nuevo.", success: false };
    vi.mocked(deleteDayAction).mockResolvedValue(failure);
    const trigger = renderButton({ guessCount: 3, isReleased: true });

    await user.click(trigger);
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Borrar" }));

    await waitFor(() => {
      expect(showActionToast).toHaveBeenCalledWith(failure);
    });
    expect(deleteDayAction).toHaveBeenCalledTimes(1);
    expect(deleteDayAction).toHaveBeenCalledWith(DAY_ID);
    expect(showActionToast).toHaveBeenCalledTimes(1);
  });

  it("focuses Cancelar when the confirmation opens", async () => {
    const user = userEvent.setup();
    const trigger = renderButton({ guessCount: 0, isReleased: true });

    await user.click(trigger);

    const dialog = await screen.findByRole("alertdialog");
    const cancel = within(dialog).getByRole("button", { name: "Cancelar" });
    await waitFor(() => {
      expect(cancel).toHaveFocus();
    });
  });
});
