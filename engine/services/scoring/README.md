# Cognify Engine Scoring Module

Level 2 scoring system for educational short-answer grading that combines semantic similarity, concept coverage, and keyword matching.

## Features

- **Semantic Similarity Scoring**: Uses embedding-based similarity with threshold normalization
- **Concept Coverage Detection**: Extracts and matches domain concepts using NLP
- **Keyword-Based Scoring**: Statistical keyword extraction and matching
- **Adaptive Weighting**: Configurable weights with validation and optimization
- **Comprehensive Feedback**: Automated feedback generation for students
- **Evaluation Metrics**: Comprehensive accuracy and fairness evaluation
- **Production Ready**: Async processing, error handling, and monitoring

## Architecture

```
scoring/
├── __init__.py          # Module exports
├── models.py            # Pydantic data models
├── scorer.py            # Main Level2Scorer orchestrator
├── similarity.py        # Semantic similarity scoring
├── concepts.py          # Concept extraction and coverage
├── keywords.py          # Keyword extraction and matching
├── feedback.py          # Feedback generation
├── formula.py           # Scoring formula and weight optimization
├── evaluation.py        # Evaluation metrics and benchmarking
├── utils.py             # Utility functions
├── routes.py            # FastAPI routes
└── README.md            # This documentation
```

## Quick Start

### Basic Usage

```python
from engine.services.scoring import Level2Scorer, ScoringConfig

# Initialize scorer with default config
scorer = Level2Scorer()

# Score an answer
result = await scorer.score_answer(
    student_answer="The mitochondria is the powerhouse of the cell",
    reference_answer="Mitochondria generate ATP through cellular respiration",
    domain_concepts=["mitochondria", "ATP", "cellular respiration"],
    custom_keywords=["powerhouse", "energy", "ATP"]
)

print(f"Score: {result.final_score:.3f}")
print(f"Grade: {result.grade}")
print(f"Feedback: {result.feedback}")
```

### Custom Configuration

```python
from engine.services.scoring import ScoringConfig

config = ScoringConfig(
    semantic_weight=0.6,
    concept_weight=0.3,
    keyword_weight=0.1,
    semantic_threshold=0.75,
    concept_threshold=0.65,
    keyword_threshold=0.55
)

scorer = Level2Scorer(config)
```

### Batch Processing

```python
results = await scorer.batch_score_answers(
    student_answers=["Answer 1", "Answer 2", "Answer 3"],
    reference_answers=["Reference 1", "Reference 2", "Reference 3"],
    domain_concepts=["concept1", "concept2"]
)
```

## API Usage

### Score Single Answer

```bash
POST /scoring/score
{
    "student_answer": "The mitochondria produces energy for the cell",
    "reference_answer": "Mitochondria generate ATP through cellular respiration",
    "domain_concepts": ["mitochondria", "ATP", "cellular respiration"],
    "custom_keywords": ["energy", "ATP", "powerhouse"]
}
```

### Batch Score

```bash
POST /scoring/batch-score
{
    "student_answers": ["Answer 1", "Answer 2"],
    "reference_answers": ["Reference 1", "Reference 2"],
    "domain_concepts": ["concept1", "concept2"]
}
```

### Evaluate System

```bash
POST /scoring/evaluate
{
    "automated_scores": [0.85, 0.72, 0.91],
    "human_scores": [0.80, 0.75, 0.88],
    "student_demographics": [{"group": "A"}, {"group": "B"}, {"group": "A"}]
}
```

## Configuration

### Default Weights
- Semantic Similarity: 50%
- Concept Coverage: 30%
- Keyword Matching: 20%

### Thresholds
- Semantic: 0.7
- Concept: 0.6
- Keyword: 0.5

### Model Configuration
- Similarity Model: `nomic-embed-text`
- Max Keywords: 10
- Min Concept Coverage: 0.3

## Evaluation Metrics

The system provides comprehensive evaluation metrics:

### Accuracy Metrics
- Overall Accuracy
- Precision, Recall, F1 Score
- Grade-level agreement

### Agreement Metrics
- Quadratic Weighted Kappa
- Cohen's Kappa
- Pearson/Spearman Correlation

### Error Metrics
- Mean Absolute Error
- Mean Squared Error
- Root Mean Squared Error

### Fairness Metrics
- Demographic Bias Score
- Consistency Score
- Reliability Measures

## Model Stack Recommendations

### Current Stack (Recommended)
- **Semantic**: `nomic-embed-text` via Ollama
- **Concepts**: spaCy `en_core_web_sm`
- **Keywords**: NLTK + TF-IDF

### Upgrade Options
- **Higher Accuracy**: `all-MiniLM-L6-v2` (sentence-transformers)
- **Complex Domains**: BERT-based NLI for concept relationships
- **Production**: Keep current stack for best performance/cost ratio

## Scoring Formula

The final score combines multiple components:

```
Final Score = (Semantic × Ws + Concept × Wc + Keyword × Wk) 
             × Length_Adjustment × Consistency_Adjustment
```

Where:
- Weights sum to 1.0 and are validated
- Threshold normalization is applied to each component
- Length and consistency adjustments ensure fairness

## Weight Optimization

Use historical data to optimize weights:

```python
from engine.services.scoring.formula import WeightOptimizer

optimizer = WeightOptimizer()
optimized_weights = optimizer.optimize_weights_from_examples(
    examples=[
        {"semantic": 0.8, "concept": 0.7, "keyword": 0.6},
        {"semantic": 0.9, "concept": 0.8, "keyword": 0.7},
        # ... more examples
    ],
    target_scores=[0.75, 0.85, ...]
)
```

## Fairness and Bias

The system includes built-in fairness checks:

- **Demographic Bias**: Measures score variance across groups
- **Consistency**: Ensures similar answers get similar scores
- **Reliability**: Validates scoring stability over time

## Performance

### Latency
- Single answer: ~100-200ms
- Batch (10 answers): ~300-500ms
- Depends on embedding model and text length

### Memory
- Base scorer: ~50MB
- spaCy model: ~60MB
- Embeddings: Cached in Ollama

### Throughput
- Concurrent processing supported
- Batch optimization available
- Async/await throughout

## Monitoring

### Health Checks
```bash
GET /scoring/health
```

### Configuration
```bash
GET /scoring/config
POST /scoring/config
```

### Available Models
```bash
GET /scoring/models/available
```

## Best Practices

### 1. Domain-Specific Configuration
- Adjust weights for different subjects
- Provide domain concepts for technical topics
- Use custom keywords for specific terminology

### 2. Quality Assurance
- Evaluate with human graders regularly
- Monitor bias across demographic groups
- Validate consistency on similar answers

### 3. Performance Optimization
- Use batch processing for multiple answers
- Cache embeddings for repeated content
- Monitor processing time and memory usage

### 4. Feedback Quality
- Review generated feedback samples
- Customize feedback templates if needed
- Ensure feedback is educational and constructive

## Integration

### Adding to Main Engine

Add to your main API routes:

```python
# In engine/services/api.py
from .scoring.routes import router as scoring_router

app.include_router(scoring_router)
```

### Database Integration

The scoring system works with your existing database setup and can store results if needed.

## Dependencies

Required packages (add to requirements.txt):

```
spacy>=3.4.0
nltk>=3.7
scipy>=1.9.0
scikit-learn>=1.1.0
numpy>=1.21.0
```

Download required models:

```python
python -m spacy download en_core_web_sm
python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords'); nltk.download('wordnet')"
```

## Troubleshooting

### Common Issues

1. **Low semantic scores**: Check embedding model availability
2. **Missing concepts**: Ensure spaCy model is downloaded
3. **Slow performance**: Consider batch processing or model optimization
4. **Bias detected**: Review training data and weight configuration

### Debug Mode

Enable detailed logging:

```python
import logging
logging.getLogger("scoring").setLevel(logging.DEBUG)
```

## Contributing

When extending the scoring system:

1. Follow the existing module structure
2. Add comprehensive tests for new components
3. Update evaluation metrics for new features
4. Document configuration options clearly
5. Consider performance impact of changes

## License

This module is part of the Cognify Engine project.
