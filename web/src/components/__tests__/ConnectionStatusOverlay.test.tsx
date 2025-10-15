import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import ConnectionStatusOverlay from "../ConnectionStatusOverlay";
import { gameStore } from "../../store/gameStore";

describe("ConnectionStatusOverlay", () => {
  beforeEach(() => {
    gameStore.actions.resetGameState();
  });

  it("displays latency when the last ping timestamp is zero", () => {
    gameStore.setPartial({
      connectionStatus: "connected",
      lastPingAt: 0,
      lastPongAt: 150,
      reconnectAttempts: 0,
      joinError: null,
    });

    render(<ConnectionStatusOverlay />);

    expect(screen.getByText("Latência")).toBeInTheDocument();
    expect(screen.getByText("150 ms")).toBeInTheDocument();
  });
});
