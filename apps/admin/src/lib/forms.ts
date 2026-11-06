// Enhanced forms re-render with the owner's entered values (design D3): a
// preview is a read, so the inputs must not reset when its answer arrives.
import type { SubmitFunction } from "$app/forms";

export const keepEnteredValues: SubmitFunction =
  () =>
  async ({ update }) => {
    await update({ reset: false });
  };
