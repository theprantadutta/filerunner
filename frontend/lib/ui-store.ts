import { create } from "zustand";

/** App-wide overlays that can be opened from anywhere (keyboard, palette, buttons) */
interface UiState {
  commandOpen: boolean;
  newProjectOpen: boolean;
  passwordOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  setNewProjectOpen: (open: boolean) => void;
  setPasswordOpen: (open: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  commandOpen: false,
  newProjectOpen: false,
  passwordOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setNewProjectOpen: (newProjectOpen) => set({ newProjectOpen }),
  setPasswordOpen: (passwordOpen) => set({ passwordOpen }),
}));
