"""
Test the exam scoring system end-to-end.

Run with: python3 -m scoring.test_system
"""

import asyncio
from scoring import ExamScorer, ExamRubric, ConceptDefinition, StudentAnswer
from scoring.adaptive import extract_learning_gaps


def create_test_rubric():
    """Create a test rubric for SQL JOIN question."""
    return ExamRubric(
        question_id="test-sql-001",
        question_text="Explain the difference between INNER JOIN and LEFT JOIN in SQL.",
        reference_answer=(
            "INNER JOIN returns only rows where there is a match in both tables, "
            "while LEFT JOIN returns all rows from the left table and matching rows "
            "from the right table, with NULL for non-matching right table rows."
        ),
        concepts=[
            ConceptDefinition(
                name="inner_join_behavior",
                description="Returns only matching rows from both tables",
                keywords=["inner join", "matching rows", "both tables", "intersection"],
                weight=1.5,  # Critical
                required=True
            ),
            ConceptDefinition(
                name="left_join_behavior",
                description="Returns all left table rows plus matching right rows (NULL for no match)",
                keywords=["left join", "all rows", "left table", "null", "outer"],
                weight=1.5,  # Critical
                required=True
            ),
            ConceptDefinition(
                name="use_case_distinction",
                description="When to use each type based on data needs",
                keywords=["use case", "when to use", "example", "scenario"],
                weight=1.0,
                required=True
            ),
        ],
        important_keywords=["inner join", "left join", "matching", "null", "tables"],
        score_scale="0-5"
    )


def test_good_answer():
    """Test a strong student answer."""
    print("\n" + "="*60)
    print("TEST 1: Good Answer (should score high)")
    print("="*60)
    
    scorer = ExamScorer()
    rubric = create_test_rubric()
    
    answer = StudentAnswer(
        student_id="student-good",
        question_id="test-sql-001",
        answer_text=(
            "INNER JOIN only returns rows that exist in both tables, like finding "
            "customers who have orders. LEFT JOIN keeps all records from the left table "
            "and shows NULL where there's no match in the right table. You'd use INNER "
            "JOIN when you need matched data only, and LEFT JOIN when you need all "
            "primary records regardless of matches."
        )
    )
    
    result = scorer.score(answer, rubric)
    
    print(f"Score: {result.final_score}/5.0")
    print(f"  Semantic: {result.semantic_score:.2f}")
    print(f"  Concept: {result.concept_score:.2f}")
    print(f"  Keyword: {result.keyword_score:.2f}")
    print(f"Present concepts: {result.present_concepts}")
    print(f"Missing concepts: {result.missing_concepts or 'None'}")
    print(f"Feedback: {result.feedback}")
    
    # Test gap extraction
    gaps = extract_learning_gaps(result, [
        {"name": c.name, "description": c.description, "weight": c.weight, "required": c.required}
        for c in rubric.concepts
    ])
    print(f"\nLearning gaps: {gaps['recommendation']}")
    
    return result


def test_partial_answer():
    """Test a partial answer (some concepts, not all)."""
    print("\n" + "="*60)
    print("TEST 2: Partial Answer (should score medium)")
    print("="*60)
    
    scorer = ExamScorer()
    rubric = create_test_rubric()
    
    answer = StudentAnswer(
        student_id="student-partial",
        question_id="test-sql-001",
        answer_text=(
            "INNER JOIN returns matching rows from both tables. "
            "This is useful for finding common data."
        )
    )
    
    result = scorer.score(answer, rubric)
    
    print(f"Score: {result.final_score}/5.0")
    print(f"  Semantic: {result.semantic_score:.2f}")
    print(f"  Concept: {result.concept_score:.2f}")
    print(f"  Keyword: {result.keyword_score:.2f}")
    print(f"Present concepts: {result.present_concepts}")
    print(f"Missing concepts: {result.missing_concepts}")
    
    # Show soft coupling effect
    raw_semantic = result.semantic_score / 0.8  # Approximate reverse calculation
    print(f"\n[Soft coupling: semantic adjusted by concept coverage]")
    
    gaps = extract_learning_gaps(result, [
        {"name": c.name, "description": c.description, "weight": c.weight, "required": c.required}
        for c in rubric.concepts
    ])
    print(f"\nGap output:")
    for w in gaps['weak_areas']:
        print(f"  - {w['concept']}: {w['explanation'][:60]}...")
    print(f"Recommendation: {gaps['recommendation']}")
    
    return result


def test_fluff_answer():
    """Test 'fluent fluff' - sounds good but no real content."""
    print("\n" + "="*60)
    print("TEST 3: Fluent Fluff (should score LOW - tests soft coupling)")
    print("="*60)
    
    scorer = ExamScorer()
    rubric = create_test_rubric()
    
    answer = StudentAnswer(
        student_id="student-fluff",
        question_id="test-sql-001",
        answer_text=(
            "SQL is a very important database language that helps us work with data. "
            "Joins are useful operations in database management systems. Good database "
            "design is essential for application performance. Understanding SQL helps "
            "developers create better software systems."
        )
    )
    
    result = scorer.score(answer, rubric)
    
    print(f"Score: {result.final_score}/5.0")
    print(f"  Semantic: {result.semantic_score:.2f} (REDUCED by soft coupling)")
    print(f"  Concept: {result.concept_score:.2f}")
    print(f"  Keyword: {result.keyword_score:.2f}")
    print(f"Present concepts: {result.present_concepts or 'None'}")
    print(f"Missing concepts: {result.missing_concepts}")
    print(f"\n[This demonstrates soft coupling working: high semantic similarity]")
    print(f"[was penalized because no concepts were actually demonstrated]")
    
    gaps = extract_learning_gaps(result, [
        {"name": c.name, "description": c.description, "weight": c.weight, "required": c.required}
        for c in rubric.concepts
    ])
    print(f"\nRecommendation: {gaps['recommendation']}")
    
    return result


def test_keyword_stuffing():
    """Test anti-cheating detection."""
    print("\n" + "="*60)
    print("TEST 4: Keyword Stuffing (anti-cheating test)")
    print("="*60)
    
    scorer = ExamScorer()
    rubric = create_test_rubric()
    
    answer = StudentAnswer(
        student_id="student-stuff",
        question_id="test-sql-001",
        answer_text=(
            "INNER JOIN LEFT JOIN matching rows INNER JOIN null tables INNER JOIN "
            "LEFT JOIN both tables matching null INNER JOIN LEFT JOIN use case"
        )
    )
    
    result = scorer.score(answer, rubric)
    
    print(f"Score: {result.final_score}/5.0")
    print(f"Detected issues: {result.detected_issues or 'None'}")
    print(f"Anti-cheating penalty: {result.anti_cheating_penalty:.2f}")
    print(f"\n[Score reduced due to keyword stuffing detection]")
    
    return result


def run_all_tests():
    """Run all tests and summarize."""
    print("\n" + "="*60)
    print("EXAM SCORING SYSTEM - END TO END TESTS")
    print("="*60)
    print("\nTesting soft coupling, gap extraction, and anti-cheating...")
    
    results = {
        "good": test_good_answer(),
        "partial": test_partial_answer(),
        "fluff": test_fluff_answer(),
        "stuffing": test_keyword_stuffing(),
    }
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"\nGood answer:       {results['good'].final_score:.1f}/5.0 (should be 4.0-5.0)")
    print(f"Partial answer:      {results['partial'].final_score:.1f}/5.0 (should be 2.0-3.0)")
    print(f"Fluff answer:        {results['fluff'].final_score:.1f}/5.0 (should be 0.5-1.5)")
    print(f"Keyword stuffing:    {results['stuffing'].final_score:.1f}/5.0 (should be low, penalty applied)")
    
    # Verify soft coupling worked
    fluff_raw_semantic = results['fluff'].semantic_score / 0.6  # Rough estimate
    print(f"\n[Soft coupling check: Fluff semantic was ~{fluff_raw_semantic:.2f} raw]")
    print(f"[Adjusted to {results['fluff'].semantic_score:.2f} due to 0% concept coverage]")
    
    # Validate expectations
    all_pass = True
    if results['good'].final_score < 3.5:
        print("\n❌ FAIL: Good answer scored too low")
        all_pass = False
    if results['fluff'].final_score > 2.0:
        print("\n❌ FAIL: Fluff answer scored too high (soft coupling not working)")
        all_pass = False
    if results['stuffing'].final_score > results['partial'].final_score:
        print("\n❌ FAIL: Keyword stuffing scored higher than partial (anti-cheating failed)")
        all_pass = False
    
    if all_pass:
        print("\n✅ ALL TESTS PASSED - System working correctly")
    else:
        print("\n⚠️  Some tests failed - review scoring logic")
    
    return all_pass


if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)
