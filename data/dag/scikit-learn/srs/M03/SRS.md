# Software Requirements Specification: Estimator Type Detection and Pipeline Fitted Checks

## Overview

This milestone addresses two related improvements to scikit-learn's estimator infrastructure:

1. **FR1**: Add a missing `is_clusterer()` function to the base module for detecting clustering estimators
2. **FR2**: Improve Pipeline's fitted state detection to properly warn users when methods are called on unfitted pipelines

**Affected Modules**:
- `sklearn.base` - Estimator type detection functions
- `sklearn.pipeline` - Pipeline fitted state checking

---

## Requirements

### FR1: Add is_clusterer() Function

**Problem**: The `sklearn.base` module provides type-checking functions `is_classifier()`, `is_regressor()`, and `is_outlier_detector()` for determining estimator categories, but lacks a corresponding `is_clusterer()` function for identifying clustering estimators.

**Requirements**:
- Add a public `is_clusterer()` function to `sklearn.base` that determines whether a given estimator is a clustering algorithm
- The function should accept an estimator object and return `True` if it is a clusterer, `False` otherwise
- The function should work consistently with the existing type-checking functions (`is_classifier()`, `is_regressor()`, `is_outlier_detector()`)
- The function should correctly identify clusterers wrapped in meta-estimators such as `Pipeline` and `GridSearchCV`
- The function should be publicly exported and accessible via `from sklearn.base import is_clusterer`

**Acceptance**:
- When `is_clusterer()` is called with a `KMeans` instance, the function returns `True`
- When `is_clusterer()` is called with an `SVC` or `SVR` instance, the function returns `False`
- When `is_clusterer()` is called with a clusterer wrapped in `GridSearchCV`, the function returns `True`
- When `is_clusterer()` is called with a clusterer wrapped in a `Pipeline`, the function returns `True`
- The function must include a numpydoc-formatted docstring with required sections: one-line summary, `Parameters` (documenting `estimator : object`), `Returns` (documenting `out : bool`), and `Examples` containing working doctest code that demonstrates usage with clusterers and non-clusterers

---

### FR2: Pipeline Fitted State Warning

**Problem**: The `Pipeline` class does not consistently check whether it has been fitted before executing methods like `predict`, `transform`, `score`, etc. When a pipeline containing stateless estimators (those that don't explicitly check fitted state) is used without being fitted, it may silently produce incorrect results or fail with confusing errors.

**Requirements**:
- Pipeline should verify its fitted state before executing post-fit methods
- When an unfitted Pipeline is used with methods that require fitting (e.g., `predict`, `transform`, `score`, `predict_proba`, `decision_function`, `score_samples`, `predict_log_proba`, `inverse_transform`), a `FutureWarning` should be raised indicating the pipeline is not fitted
- If a sub-estimator within the pipeline raises a `NotFittedError`, the pipeline should propagate a clear error message indicating the pipeline itself is not fitted
- The `__sklearn_is_fitted__()` method should properly detect fitted state by checking the last non-passthrough step
- A pipeline with all passthrough steps should be considered fitted

**Acceptance**:
- When calling `predict()` on an unfitted Pipeline containing a stateless estimator, a `FutureWarning` is raised with message "This Pipeline instance is not fitted yet"
- When calling `transform()` on an unfitted Pipeline containing a stateless estimator, a `FutureWarning` is raised
- When calling `score()` on an unfitted Pipeline containing a stateless estimator, a `FutureWarning` is raised
- When calling `predict_proba()` on an unfitted Pipeline containing a stateless estimator, a `FutureWarning` is raised
- When calling `decision_function()` on an unfitted Pipeline containing a stateless estimator, a `FutureWarning` is raised
- When calling `score_samples()` on an unfitted Pipeline containing a stateless estimator, a `FutureWarning` is raised
- When calling `predict_log_proba()` on an unfitted Pipeline containing a stateless estimator, a `FutureWarning` is raised
- When calling `inverse_transform()` on an unfitted Pipeline containing a stateless estimator, a `FutureWarning` is raised
- When a sub-estimator raises `NotFittedError`, the Pipeline re-raises it with message "Pipeline is not fitted yet."


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
