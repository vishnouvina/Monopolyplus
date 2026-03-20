import { GameState } from "@/lib/domain/types";

// Future module boundary for camera-assisted board state ingestion.
export interface BoardStateProvider {
  getBoardState(gameId: string): Promise<{
    detectedPositions: Array<{ token: string; tileIndex: number; confidence: number }>;
    capturedAt: string;
  }>;
}

export interface PhysicalBoardTracker {
  calibrate(input: {
    boardImageUrl: string;
    referencePoints: Array<{ x: number; y: number; tileIndex: number }>;
  }): Promise<{ calibrationId: string }>;

  track(calibrationId: string, frameUrl: string): Promise<Array<{ token: string; tileIndex: number; confidence: number }>>;
}

export interface MoveConfirmationLayer {
  compare(gameState: GameState, detected: Array<{ token: string; tileIndex: number; confidence: number }>): {
    requiresHostConfirmation: boolean;
    mismatches: Array<{ playerId: string; expected: number; detected: number; confidence: number }>;
  };
}
