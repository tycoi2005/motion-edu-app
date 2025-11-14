"""
Gesture Data Collection Script

Captures pose landmarks from webcam using MediaPipe and allows interactive
labeling of gestures via keyboard input. Saves labeled samples to CSV.
"""

import cv2
import mediapipe as mp
import numpy as np
import pandas as pd
import os
from datetime import datetime
from typing import List, Dict, Optional


def extract_landmarks(pose_landmarks) -> Optional[np.ndarray]:
    """
    Extract and flatten pose landmarks into a 1D numpy array.
    
    Args:
        pose_landmarks: MediaPipe pose landmarks object
        
    Returns:
        Flattened numpy array of [x, y, z, visibility] for each landmark,
        or None if no landmarks provided
    """
    if pose_landmarks is None:
        return None
    
    landmarks = []
    for landmark in pose_landmarks.landmark:
        landmarks.extend([landmark.x, landmark.y, landmark.z, landmark.visibility])
    
    return np.array(landmarks)


def get_output_path() -> str:
    """
    Get the path to the gesture_raw data directory.
    Uses __file__ to ensure correct relative path from ml/scripts/.
    
    Returns:
        Absolute path to ../data/gesture_raw/ directory
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    ml_dir = os.path.dirname(script_dir)
    data_dir = os.path.join(ml_dir, 'data', 'gesture_raw')
    return data_dir


def save_samples(samples: List[Dict], output_dir: str) -> None:
    """
    Convert samples list to DataFrame and save as CSV.
    
    Args:
        samples: List of dictionaries containing sample data
        output_dir: Directory path where CSV should be saved
    """
    if not samples:
        print("No samples collected. Nothing to save.")
        return
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Convert to DataFrame
    df = pd.DataFrame(samples)
    
    # Generate filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"gesture_samples_{timestamp}.csv"
    filepath = os.path.join(output_dir, filename)
    
    # Save to CSV
    df.to_csv(filepath, index=False)
    print(f"\nSaved {len(samples)} samples to: {filepath}")


def main() -> None:
    """Main function to run gesture collection."""
    
    # Initialize MediaPipe Pose
    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        enable_segmentation=False,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )
    mp_drawing = mp.solutions.drawing_utils
    
    # Initialize webcam
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return
    
    print("Gesture Collection Started")
    print("Controls:")
    print("  'n' - NEXT gesture")
    print("  'p' - PREV gesture")
    print("  's' - SELECT gesture")
    print("  'r' - REST (neutral)")
    print("  'q' - Quit and save")
    print("\nPress a key to label the current pose...")
    
    # Storage for collected samples
    samples: List[Dict] = []
    sample_index = 0
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("Error: Failed to read frame from webcam.")
                break
            
            # Flip frame horizontally for mirror effect
            frame = cv2.flip(frame, 1)
            
            # Convert BGR to RGB for MediaPipe
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Process frame with MediaPipe
            results = pose.process(rgb_frame)
            
            # Draw pose landmarks on frame for visual feedback
            if results.pose_landmarks:
                mp_drawing.draw_landmarks(
                    frame,
                    results.pose_landmarks,
                    mp_pose.POSE_CONNECTIONS,
                    mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=2),
                    mp_drawing.DrawingSpec(color=(0, 0, 255), thickness=2)
                )
            
            # Display frame
            cv2.imshow('Gesture Collection - Press keys to label (q to quit)', frame)
            
            # Check for key press
            key = cv2.waitKey(1) & 0xFF
            
            if key == ord('q'):
                print("\nQuitting...")
                break
            elif key == ord('n'):
                gesture_label = "NEXT"
            elif key == ord('p'):
                gesture_label = "PREV"
            elif key == ord('s'):
                gesture_label = "SELECT"
            elif key == ord('r'):
                gesture_label = "REST"
            else:
                # No valid key pressed, continue to next frame
                continue
            
            # Extract landmarks if available
            if results.pose_landmarks:
                landmarks = extract_landmarks(results.pose_landmarks)
                if landmarks is not None:
                    # Create sample dictionary
                    sample = {
                        'sample_index': sample_index,
                        'timestamp': datetime.now().isoformat(),
                        'gesture_label': gesture_label
                    }
                    
                    # Add landmark coordinates as separate columns
                    # MediaPipe Pose has 33 landmarks, each with 4 values (x, y, z, visibility)
                    for i in range(len(landmarks) // 4):
                        base_idx = i * 4
                        sample[f'landmark_{i}_x'] = landmarks[base_idx]
                        sample[f'landmark_{i}_y'] = landmarks[base_idx + 1]
                        sample[f'landmark_{i}_z'] = landmarks[base_idx + 2]
                        sample[f'landmark_{i}_visibility'] = landmarks[base_idx + 3]
                    
                    samples.append(sample)
                    sample_index += 1
                    print(f"Captured sample {sample_index}: {gesture_label}")
            else:
                print(f"Warning: No landmarks detected. Skipping {gesture_label} label.")
    
    except KeyboardInterrupt:
        print("\nInterrupted by user.")
    
    finally:
        # Cleanup
        cap.release()
        cv2.destroyAllWindows()
        pose.close()
        
        # Save collected samples
        if samples:
            output_dir = get_output_path()
            save_samples(samples, output_dir)
        else:
            print("No samples were collected.")


if __name__ == "__main__":
    main()

