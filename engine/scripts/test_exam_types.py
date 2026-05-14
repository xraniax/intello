import sys
import os
from typing import Dict, Any

# Adjust path to include engine directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.generation import build_prompt

def test_exam_prompt_with_types():
    print("Testing exam prompt generation with question types...")
    
    options = {
        "generation_options": {
            "distribution": [
                {"type": "mcq", "count": 3},
                {"type": "matching", "count": 2}
            ]
        }
    }
    
    prompt = build_prompt(
        material_type="exam",
        context="This is a test context about artificial intelligence.",
        topic="AI Basics",
        language="en",
        count=5,
        options=options
    )
    
    print("\n--- GENERATED PROMPT ---")
    print(prompt)
    print("------------------------\n")
    
    # Assertions
    expected_mix = "3x mcq, 2x matching"
    if expected_mix in prompt:
        print(f"✅ SUCCESS: Found expected question mix '{expected_mix}' in prompt.")
    else:
        print(f"❌ FAILURE: Did not find expected question mix '{expected_mix}' in prompt.")
        sys.exit(1)
        
    expected_schema = '"type": "mcq", "options": ["A", "B"]'
    if expected_schema in prompt:
        print(f"✅ SUCCESS: Found expanded schema hint in prompt.")
    else:
        print(f"❌ FAILURE: Did not find expanded schema hint in prompt.")
        sys.exit(1)

if __name__ == "__main__":
    test_exam_prompt_with_types()
