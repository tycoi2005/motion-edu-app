/**
 * Gesture type definitions for the motion-based flashcard app.
 */

export type GestureType = "REST" | "NEXT" | "PREV" | "SELECT";

export const ALL_GESTURES: GestureType[] = ["REST", "NEXT", "PREV", "SELECT"];

/**
 * Get a human-readable label for a gesture type.
 * 
 * @param gesture - The gesture type
 * @returns A formatted label string
 */
export function getGestureLabel(gesture: GestureType): string {
  switch (gesture) {
    case "REST":
      return "Rest / Neutral";
    case "NEXT":
      return "Next Card";
    case "PREV":
      return "Previous Card";
    case "SELECT":
      return "Select / Confirm";
    default:
      return gesture;
  }
}

