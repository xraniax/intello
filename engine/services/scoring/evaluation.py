"""
Evaluation metrics for automated grading system accuracy and fairness.
"""
import logging
import math
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass

import numpy as np
from scipy import stats
from sklearn.metrics import (
    accuracy_score, precision_recall_fscore_support,
    mean_squared_error, mean_absolute_error, confusion_matrix,
    cohen_kappa_score
)

from .models import ScoringResult

logger = logging.getLogger("scoring-evaluation")


@dataclass
class EvaluationMetrics:
    """Container for evaluation metrics."""
    # Accuracy metrics
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    
    # Agreement metrics
    quadratic_weighted_kappa: float
    cohen_kappa: float
    pearson_correlation: float
    spearman_correlation: float
    
    # Error metrics
    mean_absolute_error: float
    mean_squared_error: float
    root_mean_squared_error: float
    
    # Fairness metrics
    bias_score: float
    consistency_score: float
    reliability: float
    
    # Distribution metrics
    grade_distribution: Dict[str, int]
    score_statistics: Dict[str, float]


class GradingEvaluator:
    """
    Comprehensive evaluator for automated grading systems.
    
    Evaluates accuracy, fairness, and reliability compared to human grading.
    """
    
    def __init__(self):
        self.grade_boundaries = {
            "A": 0.9,
            "B": 0.8,
            "C": 0.7,
            "D": 0.6,
            "F": 0.0
        }
    
    def evaluate_grading_system(
        self,
        automated_scores: List[float],
        human_scores: List[float],
        student_demographics: Optional[List[Dict[str, Any]]] = None,
        question_metadata: Optional[List[Dict[str, Any]]] = None
    ) -> EvaluationMetrics:
        """
        Comprehensive evaluation of automated grading system.
        
        Args:
            automated_scores: List of automated scores (0-1)
            human_scores: List of human scores (0-1)
            student_demographics: Optional demographic data for fairness analysis
            question_metadata: Optional question metadata for subgroup analysis
            
        Returns:
            Comprehensive evaluation metrics
        """
        if len(automated_scores) != len(human_scores):
            raise ValueError("Automated and human scores must have same length")
        
        if len(automated_scores) < 10:
            logger.warning("Small sample size may lead to unreliable metrics")
        
        logger.info(f"Evaluating {len(automated_scores)} graded responses")
        
        # Convert scores to grades
        automated_grades = [self._score_to_grade(score) for score in automated_scores]
        human_grades = [self._score_to_grade(score) for score in human_scores]
        
        # Calculate accuracy metrics
        accuracy_metrics = self._calculate_accuracy_metrics(
            automated_grades, human_grades
        )
        
        # Calculate agreement metrics
        agreement_metrics = self._calculate_agreement_metrics(
            automated_scores, human_scores, automated_grades, human_grades
        )
        
        # Calculate error metrics
        error_metrics = self._calculate_error_metrics(
            automated_scores, human_scores
        )
        
        # Calculate fairness metrics
        fairness_metrics = self._calculate_fairness_metrics(
            automated_scores, human_scores, student_demographics
        )
        
        # Calculate distribution metrics
        distribution_metrics = self._calculate_distribution_metrics(
            automated_scores, automated_grades
        )
        
        return EvaluationMetrics(
            **accuracy_metrics,
            **agreement_metrics,
            **error_metrics,
            **fairness_metrics,
            grade_distribution=distribution_metrics["grade_distribution"],
            score_statistics=distribution_metrics["score_statistics"]
        )
    
    def _score_to_grade(self, score: float) -> str:
        """Convert numeric score to letter grade."""
        for grade, boundary in sorted(self.grade_boundaries.items(), key=lambda x: x[1], reverse=True):
            if score >= boundary:
                return grade
        return "F"
    
    def _calculate_accuracy_metrics(
        self, 
        automated_grades: List[str], 
        human_grades: List[str]
    ) -> Dict[str, float]:
        """Calculate grade-level accuracy metrics."""
        accuracy = accuracy_score(human_grades, automated_grades)
        
        precision, recall, f1, _ = precision_recall_fscore_support(
            human_grades, automated_grades, average='weighted', zero_division=0
        )
        
        return {
            "accuracy": accuracy,
            "precision": precision,
            "recall": recall,
            "f1_score": f1
        }
    
    def _calculate_agreement_metrics(
        self,
        automated_scores: List[float],
        human_scores: List[float],
        automated_grades: List[str],
        human_grades: List[str]
    ) -> Dict[str, float]:
        """Calculate agreement and correlation metrics."""
        # Correlation coefficients
        pearson_corr, _ = stats.pearsonr(automated_scores, human_scores)
        spearman_corr, _ = stats.spearmanr(automated_scores, human_scores)
        
        # Cohen's kappa for categorical agreement
        cohen_kappa = cohen_kappa_score(human_grades, automated_grades)
        
        # Quadratic weighted kappa for ordinal agreement
        qwk = self._quadratic_weighted_kappa(automated_scores, human_scores)
        
        return {
            "quadratic_weighted_kappa": qwk,
            "cohen_kappa": cohen_kappa,
            "pearson_correlation": pearson_corr,
            "spearman_correlation": spearman_corr
        }
    
    def _calculate_error_metrics(
        self, 
        automated_scores: List[float], 
        human_scores: List[float]
    ) -> Dict[str, float]:
        """Calculate error metrics."""
        mae = mean_absolute_error(human_scores, automated_scores)
        mse = mean_squared_error(human_scores, automated_scores)
        rmse = math.sqrt(mse)
        
        return {
            "mean_absolute_error": mae,
            "mean_squared_error": mse,
            "root_mean_squared_error": rmse
        }
    
    def _calculate_fairness_metrics(
        self,
        automated_scores: List[float],
        human_scores: List[float],
        demographics: Optional[List[Dict[str, Any]]]
    ) -> Dict[str, float]:
        """Calculate fairness and bias metrics."""
        if not demographics:
            return {
                "bias_score": 0.0,  # Neutral when no demographic data
                "consistency_score": 1.0,
                "reliability": 0.8  # Default moderate reliability
            }
        
        # Calculate bias across demographic groups
        bias_score = self._calculate_demographic_bias(
            automated_scores, human_scores, demographics
        )
        
        # Calculate consistency (same answer gets same score)
        consistency_score = self._calculate_consistency(
            automated_scores, human_scores
        )
        
        # Calculate reliability (test-retest consistency)
        reliability = self._calculate_reliability(automated_scores, human_scores)
        
        return {
            "bias_score": bias_score,
            "consistency_score": consistency_score,
            "reliability": reliability
        }
    
    def _calculate_demographic_bias(
        self,
        automated_scores: List[float],
        human_scores: List[float],
        demographics: List[Dict[str, Any]]
    ) -> float:
        """Calculate demographic bias score."""
        # Group by demographic attributes
        groups = {}
        for i, demo in enumerate(demographics):
            # Create group key (simplified - using first available attribute)
            group_key = next(iter(demo.values())) if demo else "unknown"
            if group_key not in groups:
                groups[group_key] = []
            groups[group_key].append(i)
        
        # Calculate score differences for each group
        group_errors = []
        for group_name, indices in groups.items():
            group_automated = [automated_scores[i] for i in indices]
            group_human = [human_scores[i] for i in indices]
            
            if len(group_human) > 0:
                group_mae = mean_absolute_error(group_human, group_automated)
                group_errors.append(group_mae)
        
        # Bias is the variance in error across groups
        if len(group_errors) > 1:
            bias = np.var(group_errors)
            return min(1.0, bias)  # Normalize to 0-1
        else:
            return 0.0  # No bias with single group
    
    def _calculate_consistency(
        self, 
        automated_scores: List[float], 
        human_scores: List[float]
    ) -> float:
        """Calculate scoring consistency."""
        # Consistency = 1 - coefficient of variation of errors
        errors = [abs(a - h) for a, h in zip(automated_scores, human_scores)]
        
        if len(errors) == 0:
            return 1.0
        
        mean_error = np.mean(errors)
        std_error = np.std(errors)
        
        if mean_error == 0:
            return 1.0
        
        cv = std_error / mean_error
        consistency = max(0.0, 1.0 - cv)
        
        return consistency
    
    def _calculate_reliability(
        self, 
        automated_scores: List[float], 
        human_scores: List[float]
    ) -> float:
        """Calculate reliability (simplified Cronbach's alpha)."""
        # This is a simplified reliability calculation
        # In practice, you'd want multiple graders or multiple attempts
        
        correlation, _ = stats.pearsonr(automated_scores, human_scores)
        
        # Reliability as correlation-based measure
        reliability = max(0.0, correlation)
        
        return reliability
    
    def _calculate_distribution_metrics(
        self, 
        automated_scores: List[float], 
        automated_grades: List[str]
    ) -> Dict[str, Any]:
        """Calculate score and grade distribution metrics."""
        # Grade distribution
        grade_counts = {}
        for grade in automated_grades:
            grade_counts[grade] = grade_counts.get(grade, 0) + 1
        
        # Score statistics
        scores_array = np.array(automated_scores)
        score_stats = {
            "mean": float(np.mean(scores_array)),
            "median": float(np.median(scores_array)),
            "std": float(np.std(scores_array)),
            "min": float(np.min(scores_array)),
            "max": float(np.max(scores_array)),
            "q25": float(np.percentile(scores_array, 25)),
            "q75": float(np.percentile(scores_array, 75))
        }
        
        return {
            "grade_distribution": grade_counts,
            "score_statistics": score_stats
        }
    
    def _quadratic_weighted_kappa(
        self, 
        actual: List[float], 
        predicted: List[float]
    ) -> float:
        """Calculate quadratic weighted kappa."""
        # Discretize scores into bins
        n_bins = 5
        actual_bins = np.digitize(actual, bins=np.linspace(0, 1, n_bins))
        predicted_bins = np.digitize(predicted, bins=np.linspace(0, 1, n_bins))
        
        # Create weight matrix
        weight_matrix = np.zeros((n_bins, n_bins))
        for i in range(n_bins):
            for j in range(n_bins):
                weight_matrix[i, j] = ((i - j) ** 2) / ((n_bins - 1) ** 2)
        
        # Calculate confusion matrix
        confusion = np.zeros((n_bins, n_bins))
        for a, p in zip(actual_bins, predicted_bins):
            confusion[a-1, p-1] += 1
        
        # Calculate expected matrix
        row_sums = confusion.sum(axis=1)
        col_sums = confusion.sum(axis=0)
        total = confusion.sum()
        
        expected = np.outer(row_sums, col_sums) / total
        
        # Calculate kappa
        numerator = np.sum(weight_matrix * confusion)
        denominator = np.sum(weight_matrix * expected)
        
        if denominator == 0:
            return 0.0
        
        kappa = 1.0 - (numerator / denominator)
        return kappa
    
    def generate_evaluation_report(
        self, 
        metrics: EvaluationMetrics,
        sample_size: int
    ) -> str:
        """Generate comprehensive evaluation report."""
        report = f"""
        Automated Grading System Evaluation Report
        ==========================================
        
        Sample Size: {sample_size} responses
        
        ACCURACY METRICS:
        - Overall Accuracy: {metrics.accuracy:.3f}
        - Precision: {metrics.precision:.3f}
        - Recall: {metrics.recall:.3f}
        - F1 Score: {metrics.f1_score:.3f}
        
        AGREEMENT METRICS:
        - Quadratic Weighted Kappa: {metrics.quadratic_weighted_kappa:.3f}
        - Cohen's Kappa: {metrics.cohen_kappa:.3f}
        - Pearson Correlation: {metrics.pearson_correlation:.3f}
        - Spearman Correlation: {metrics.spearman_correlation:.3f}
        
        ERROR METRICS:
        - Mean Absolute Error: {metrics.mean_absolute_error:.3f}
        - Mean Squared Error: {metrics.mean_squared_error:.3f}
        - Root Mean Squared Error: {metrics.root_mean_squared_error:.3f}
        
        FAIRNESS METRICS:
        - Bias Score: {metrics.bias_score:.3f} (0 = no bias, 1 = high bias)
        - Consistency Score: {metrics.consistency_score:.3f} (1 = perfect consistency)
        - Reliability: {metrics.reliability:.3f} (0 = no reliability, 1 = perfect reliability)
        
        GRADE DISTRIBUTION:
        """
        
        for grade, count in sorted(metrics.grade_distribution.items()):
            percentage = (count / sample_size) * 100
            report += f"- {grade}: {count} ({percentage:.1f}%)\n"
        
        report += f"""
        SCORE STATISTICS:
        - Mean: {metrics.score_statistics['mean']:.3f}
        - Median: {metrics.score_statistics['median']:.3f}
        - Std Dev: {metrics.score_statistics['std']:.3f}
        - Range: {metrics.score_statistics['min']:.3f} - {metrics.score_statistics['max']:.3f}
        
        INTERPRETATION:
        """
        
        # Add interpretation
        if metrics.quadratic_weighted_kappa >= 0.8:
            report += "- Excellent agreement with human graders\n"
        elif metrics.quadratic_weighted_kappa >= 0.6:
            report += "- Good agreement with human graders\n"
        elif metrics.quadratic_weighted_kappa >= 0.4:
            report += "- Moderate agreement with human graders\n"
        else:
            report += "- Poor agreement with human graders\n"
        
        if metrics.bias_score <= 0.1:
            report += "- Low bias detected across demographic groups\n"
        elif metrics.bias_score <= 0.3:
            report += "- Moderate bias detected - further investigation recommended\n"
        else:
            report += "- High bias detected - immediate attention required\n"
        
        return report
    
    def benchmark_against_human(
        self,
        automated_results: List[ScoringResult],
        human_scores: List[float],
        human_grades: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Benchmark automated system against human graders.
        
        Args:
            automated_results: List of automated scoring results
            human_scores: Human-provided scores (0-1)
            human_grades: Optional human-provided letter grades
            
        Returns:
            Benchmark comparison results
        """
        automated_scores = [result.final_score for result in automated_results]
        automated_grades = [result.grade for result in automated_results]
        
        # Calculate metrics
        metrics = self.evaluate_grading_system(automated_scores, human_scores)
        
        # Analyze specific cases of disagreement
        disagreements = self._analyze_disagreements(
            automated_results, human_scores, human_grades
        )
        
        # Component-wise analysis
        component_analysis = self._analyze_component_performance(
            automated_results, human_scores
        )
        
        return {
            "overall_metrics": metrics,
            "disagreement_analysis": disagreements,
            "component_analysis": component_analysis,
            "recommendations": self._generate_recommendations(metrics)
        }
    
    def _analyze_disagreements(
        self,
        automated_results: List[ScoringResult],
        human_scores: List[float],
        human_grades: Optional[List[str]]
    ) -> Dict[str, Any]:
        """Analyze cases where automated and human scores disagree."""
        disagreements = []
        
        for i, (result, human_score) in enumerate(zip(automated_results, human_scores)):
            score_diff = abs(result.final_score - human_score)
            
            if score_diff > 0.2:  # Significant disagreement
                disagreements.append({
                    "index": i,
                    "automated_score": result.final_score,
                    "human_score": human_score,
                    "difference": score_diff,
                    "automated_grade": result.grade,
                    "human_grade": self._score_to_grade(human_score),
                    "student_answer": result.student_answer[:100] + "...",
                    "feedback": result.feedback[:200] + "..."
                })
        
        # Sort by disagreement magnitude
        disagreements.sort(key=lambda x: x["difference"], reverse=True)
        
        return {
            "total_disagreements": len(disagreements),
            "disagreement_rate": len(disagreements) / len(automated_results),
            "top_disagreements": disagreements[:10],  # Top 10 cases
            "average_disagreement": np.mean([d["difference"] for d in disagreements]) if disagreements else 0.0
        }
    
    def _analyze_component_performance(
        self,
        automated_results: List[ScoringResult],
        human_scores: List[float]
    ) -> Dict[str, float]:
        """Analyze how individual components correlate with human scores."""
        component_correlations = {}
        
        # Extract component scores
        semantic_scores = []
        concept_scores = []
        keyword_scores = []
        
        for result in automated_results:
            for component in result.components:
                if component.method.value == "semantic_similarity":
                    semantic_scores.append(component.score)
                elif component.method.value == "concept_coverage":
                    concept_scores.append(component.score)
                elif component.method.value == "keyword_matching":
                    keyword_scores.append(component.score)
        
        # Calculate correlations
        if semantic_scores:
            sem_corr, _ = stats.pearsonr(semantic_scores, human_scores)
            component_correlations["semantic"] = sem_corr
        
        if concept_scores:
            conc_corr, _ = stats.pearsonr(concept_scores, human_scores)
            component_correlations["concept"] = conc_corr
        
        if keyword_scores:
            key_corr, _ = stats.pearsonr(keyword_scores, human_scores)
            component_correlations["keyword"] = key_corr
        
        return component_correlations
    
    def _generate_recommendations(self, metrics: EvaluationMetrics) -> List[str]:
        """Generate improvement recommendations based on metrics."""
        recommendations = []
        
        if metrics.quadratic_weighted_kappa < 0.6:
            recommendations.append("Consider adjusting scoring weights or thresholds")
        
        if metrics.mean_absolute_error > 0.15:
            recommendations.append("Review semantic similarity model for better alignment")
        
        if metrics.bias_score > 0.2:
            recommendations.append("Investigate potential bias in training data or scoring algorithm")
        
        if metrics.consistency_score < 0.8:
            recommendations.append("Improve consistency by refining preprocessing and normalization")
        
        if metrics.reliability < 0.7:
            recommendations.append("Consider ensemble methods or additional validation checks")
        
        # Grade distribution recommendations
        total_grades = sum(metrics.grade_distribution.values())
        if total_grades > 0:
            f_percentage = metrics.grade_distribution.get("F", 0) / total_grades
            if f_percentage > 0.3:
                recommendations.append("High failure rate detected - review scoring difficulty")
        
        return recommendations
