"""
Example usage of the exam scoring module.

This file demonstrates how to use the scoring system for evaluating
short-answer exam questions.
"""

from scoring import ExamScorer, ExamRubric, ConceptDefinition, StudentAnswer


def create_database_rubric():
    """
    Create a rubric for a database normalization question.
    
    This demonstrates how to define:
        - Reference answer
        - Required concepts with weights
        - Important terminology
    """
    return ExamRubric(
        question_id="db-101-q3",
        question_text="Explain database normalization and its importance. Include 1NF, 2NF, and 3NF.",
        reference_answer=(
            "Database normalization is the process of organizing data to reduce redundancy "
            "and improve data integrity. First Normal Form (1NF) requires atomic values "
            "and no repeating groups. Second Normal Form (2NF) eliminates partial "
            "dependencies, ensuring non-key attributes depend on the entire primary key. "
            "Third Normal Form (3NF) removes transitive dependencies, where non-key "
            "attributes depend on other non-key attributes. Normalization prevents update "
            "anomalies and ensures data consistency."
        ),
        concepts=[
            ConceptDefinition(
                name="definition",
                description="Definition of database normalization as organizing data to reduce redundancy",
                keywords=["normalization", "organizing", "redundancy", "data integrity"],
                weight=1.0,
                required=True
            ),
            ConceptDefinition(
                name="1nf",
                description="First Normal Form: atomic values, no repeating groups",
                keywords=["1nf", "first normal form", "atomic", "repeating groups"],
                weight=1.0,
                required=True
            ),
            ConceptDefinition(
                name="2nf",
                description="Second Normal Form: eliminates partial dependencies",
                keywords=["2nf", "second normal form", "partial dependencies"],
                weight=1.0,
                required=True
            ),
            ConceptDefinition(
                name="3nf",
                description="Third Normal Form: removes transitive dependencies",
                keywords=["3nf", "third normal form", "transitive dependencies"],
                weight=1.0,
                required=True
            ),
            ConceptDefinition(
                name="benefits",
                description="Benefits of normalization: prevent anomalies, ensure consistency",
                keywords=["update anomalies", "data consistency", "integrity"],
                weight=0.8,
                required=False
            ),
        ],
        important_keywords=[
            "normalization",
            "redundancy",
            "1nf", "first normal form",
            "2nf", "second normal form",
            "3nf", "third normal form",
            "dependencies",
            "atomic",
            "primary key"
        ],
        max_length=150,
        min_length=30,
        weights={
            "semantic": 0.35,
            "concept": 0.45,
            "keyword": 0.20
        },
        score_scale="0-5"
    )


def example_good_answer():
    """Example of a good student answer."""
    return StudentAnswer(
        student_id="student-123",
        question_id="db-101-q3",
        answer_text=(
            "Database normalization is the process of organizing data in a database "
            "to reduce data redundancy and improve data integrity. First Normal Form (1NF) "
            "requires that all values be atomic and eliminates repeating groups. "
            "Second Normal Form (2NF) removes partial dependencies, ensuring that "
            "all non-key attributes depend on the entire primary key. Third Normal Form (3NF) "
            "eliminates transitive dependencies where attributes depend on other non-key attributes. "
            "Normalization helps prevent update anomalies and maintains data consistency."
        ),
        submitted_at="2026-05-03T09:30:00Z"
    )


def example_partial_answer():
    """Example of a partial answer (missing some concepts)."""
    return StudentAnswer(
        student_id="student-456",
        question_id="db-101-q3",
        answer_text=(
            "Database normalization reduces data redundancy. 1NF makes sure data is atomic. "
            "Normalization is important for databases."
        ),
        submitted_at="2026-05-03T09:35:00Z"
    )


def example_stuffed_answer():
    """Example of keyword stuffing (anti-cheating demo)."""
    return StudentAnswer(
        student_id="student-789",
        question_id="db-101-q3",
        answer_text=(
            "Normalization normalization normalization database database redundancy 1NF 1NF "
            "first normal form atomic atomic atomic dependencies dependencies dependencies "
            "primary key primary key 2NF 2NF second normal form 3NF 3NF third normal form "
            "transitive transitive transitive consistency consistency integrity integrity"
        ),
        submitted_at="2026-05-03T09:40:00Z"
    )


def example_verbose_padding():
    """Example of irrelevant verbose padding."""
    return StudentAnswer(
        student_id="student-999",
        question_id="db-101-q3",
        answer_text=(
            "Database normalization is a very important topic in computer science and "
            "information technology. Many students study this topic in universities around "
            "the world. The history of databases goes back many decades. Computer scientists "
            "have worked on many problems related to data storage. Normalization helps organize "
            "data and reduce redundancy. This is important for applications. Companies use "
            "databases for their business needs. SQL is a language used with databases. "
            "There are many types of databases including relational and NoSQL. Normalization "
            "is specifically about relational databases and organizing tables properly. "
            "1NF requires atomic values. 2NF and 3NF eliminate various types of dependencies."
        ),
        submitted_at="2026-05-03T09:45:00Z"
    )


def run_examples():
    """Run scoring examples and display results."""
    print("=" * 70)
    print("EXAM SCORING MODULE - EXAMPLES")
    print("=" * 70)
    
    # Initialize scorer
    scorer = ExamScorer()
    
    # Create rubric
    rubric = create_database_rubric()
    
    examples = [
        ("GOOD ANSWER", example_good_answer()),
        ("PARTIAL ANSWER", example_partial_answer()),
        ("KEYWORD STUFFING", example_stuffed_answer()),
        ("VERBOSE PADDING", example_verbose_padding()),
    ]
    
    for label, answer in examples:
        print("\n" + "=" * 70)
        print(f"EXAMPLE: {label}")
        print("=" * 70)
        
        print(f"\nStudent Answer ({len(answer.answer_text.split())} words):")
        print(f'  "{answer.answer_text[:200]}..."')
        
        # Score the answer
        result = scorer.score(answer, rubric)
        
        # Display results
        print(f"\n--- SCORES ---")
        print(f"  Final Score:       {result.final_score}/5.0")
        print(f"  Normalized Score:  {result.normalized_score:.3f}")
        print(f"  Semantic Score:    {result.semantic_score:.3f}")
        print(f"  Concept Score:     {result.concept_score:.3f}")
        print(f"  Keyword Score:     {result.keyword_score:.3f}")
        
        print(f"\n--- CONCEPTS ---")
        print(f"  Present: {', '.join(result.present_concepts) or 'None'}")
        print(f"  Missing: {', '.join(result.missing_concepts) or 'None'}")
        
        print(f"\n--- KEYWORDS ---")
        print(f"  Found:   {', '.join(result.found_keywords[:5]) or 'None'}")
        print(f"  Missing: {', '.join(result.missing_keywords[:3]) or 'None'}")
        
        print(f"\n--- FEEDBACK ---")
        print(f"  {result.feedback}")
        
        print(f"\n--- GRADING EXPLANATION ---")
        print(f"  {result.grading_explanation[:300]}...")
        
        if result.warnings:
            print(f"\n--- WARNINGS ---")
            for warning in result.warnings:
                print(f"  ! {warning}")
        
        # Detailed breakdown
        print(f"\n--- DETAILED BREAKDOWN ---")
        breakdown = result.component_breakdown
        print(f"  Raw Combined Score: {breakdown['raw_combined_score']:.3f}")
        print(f"  Penalty Applied:    {breakdown['penalty_applied']:.3f}")
        print(f"  Anti-Cheating Suspicion: {breakdown['anti_cheating']['suspicion_score']:.3f}")
    
    print("\n" + "=" * 70)
    print("EXAMPLES COMPLETE")
    print("=" * 70)


def example_json_output():
    """Demonstrate JSON output format."""
    print("\n" + "=" * 70)
    print("JSON OUTPUT EXAMPLE")
    print("=" * 70)
    
    scorer = ExamScorer()
    rubric = create_database_rubric()
    answer = example_good_answer()
    
    result = scorer.score(answer, rubric)
    
    import json
    print("\nJSON Output (for API response):")
    print(json.dumps(result.to_dict(), indent=2))


if __name__ == "__main__":
    run_examples()
    example_json_output()
