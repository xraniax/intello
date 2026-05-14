import sys
import os
from typing import Dict, Any, List

# Adjust path to include engine directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.summary_pipeline import build_summary_prompt

def test_summary_prompt_with_mode():
    print("Testing summary prompt generation with summary_mode...")
    
    context = "Photosynthesis is the process by which green plants and some other organisms use sunlight to synthesize nutrients from carbon dioxide and water."
    
    # Test specific mode
    mode = "teach_me_mode"
    prompt = build_summary_prompt(
        context=context,
        language="en",
        difficulty="intermediate",
        summary_mode=mode
    )
    
    print(f"\n--- GENERATED PROMPT (Mode: {mode}) ---")
    print(prompt)
    print("------------------------------------------\n")
    
    expected_header = "MODE: TEACH ME (TUTOR STYLE)"
    if expected_header in prompt:
        print(f"✅ SUCCESS: Found expected mode header '{expected_header}' in prompt.")
    else:
        print(f"❌ FAILURE: Did not find expected mode header '{expected_header}' in prompt.")
        sys.exit(1)

    # Test mapping logic (Detailed -> Advanced)
    mode_adv = "detailed_explanation"
    prompt_adv = build_summary_prompt(
        context=context,
        language="en",
        difficulty="intermediate", # default from backend
        summary_mode=mode_adv
    )
    
    # The prompt should contain advanced depth signals even if difficulty was intermediate
    expected_adv = "DEPTH STRATEGY: ADVANCED"
    if expected_adv in prompt_adv:
        print(f"✅ SUCCESS: Mapped '{mode_adv}' (difficulty: intermediate) to '{expected_adv}'.")
    else:
        print(f"❌ FAILURE: Mapping failed for {mode_adv}.")
        sys.exit(1)

if __name__ == "__main__":
    test_summary_prompt_with_mode()
