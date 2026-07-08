# Software Requirements Specification: M12.4 - Infrastructure Foundation Phase 3b

## Overview

This milestone encompasses testing framework modernization, metadata routing support, and various improvements across scikit-learn modules.

**Summary of Requirements:**

1. **FR1**: SelfTrainingClassifier metadata routing support with parameter deprecation
2. **FR2**: ElasticNetCV/LassoCV sample weight support in alpha grid computation
3. **FR3**: HistGradientBoosting verbose parameter granularity
4. **FR4**: Estimator representation beyond maxlevels
5. **FR5**: Deprecated class signature preservation
6. **FR6**: FastICA low-rank warning threshold adjustment
7. **FR7**: NumPy 2.x doctest compatibility
8. **FR8**: Birch unused function removal
9. **FR9**: Clustering error message typo fix
10. **FR10**: setup.py documentation removal

**Affected Modules:**
- `sklearn.semi_supervised`
- `sklearn.linear_model`
- `sklearn.ensemble`
- `sklearn.utils`
- `sklearn.decomposition`
- `sklearn.cluster`
- `sklearn.metrics`
- `sklearn.datasets`
- `sklearn.preprocessing`
- Various other modules with doctest updates

---

## Requirements

### FR1: SelfTrainingClassifier Metadata Routing Support

**Problem**: SelfTrainingClassifier does not support scikit-learn's metadata routing framework, preventing users from passing metadata (such as sample weights) through to the underlying estimator during fit, predict, and other operations.

**Requirements**:
- Add metadata routing support to SelfTrainingClassifier following the SLEP006 specification
- The `fit` method must accept `**params` that are routed to the underlying estimator's `fit` method when metadata routing is enabled
- The `predict`, `predict_proba`, `predict_log_proba`, `decision_function`, and `score` methods must accept `**params` that are routed to the corresponding methods of the underlying estimator
- Implement `get_metadata_routing()` method that returns a MetadataRouter with proper method mappings
- Deprecate the `base_estimator` parameter in favor of `estimator` parameter
- The fitted estimator attribute should be renamed from `base_estimator_` to `estimator_`
- When metadata routing is not enabled and extra parameters are passed, raise a clear error message indicating that metadata routing must be enabled
- Maintain backward compatibility during the deprecation period: using `base_estimator` should emit a FutureWarning but continue to work

**Acceptance**:
- `SelfTrainingClassifier.__init__()` signature must be: `__init__(self, estimator=None, base_estimator="deprecated", threshold=0.75, criterion="threshold", k_best=10, max_iter=10, verbose=False)`
- The new `estimator` parameter must be the first positional parameter (before `base_estimator`)
- When `base_estimator` is used (not `"deprecated"`), a FutureWarning must be raised with message containing: `` `base_estimator` has been deprecated in 1.6 and will be removed`` (note: use backticks around `base_estimator` in the message)
- When `estimator=None` and `base_estimator="deprecated"`, a ValueError must be raised with message: `"You must pass an estimator to SelfTrainingClassifier"`
- When both `estimator` is not None and `base_estimator` is not `"deprecated"`, a ValueError must be raised with message: `"You must pass only one estimator to SelfTrainingClassifier"`
- The fitted estimator must be stored in `estimator_` attribute (not `base_estimator_`)
- `get_metadata_routing()` must return a `MetadataRouter` instance
- The method mapping in `get_metadata_routing()` must include: `fit->fit`, `fit->score`, `predict->predict`, `predict_proba->predict_proba`, `decision_function->decision_function`, `predict_log_proba->predict_log_proba`, `score->score`
- When metadata routing is disabled and extra params are passed to `fit`, `predict`, `predict_proba`, `predict_log_proba`, or `decision_function`, a ValueError must be raised with message containing: `"is only supported if enable_metadata_routing=True"`. Follow the same implementation pattern used by other meta-estimators like `Pipeline`
- When a meta-estimator (like `StackingClassifier`) is used as `estimator`, `hasattr(estimator, "predict_proba")` should be checked before fitting, and `predict_proba` must work after fitting if the underlying estimator supports it

---

### FR2: ElasticNetCV and LassoCV Sample Weight Support in Alpha Grid

**Problem**: ElasticNetCV and LassoCV do not properly account for sample weights when computing the alpha grid for cross-validation. The internally computed `alpha_max` value (the smallest alpha that results in all-zero coefficients) is incorrect when sample weights are provided, leading to suboptimal regularization parameter selection.

**Requirements**:
- Modify the `_alpha_grid` function to accept and properly use sample weights when computing the alpha grid
- When sample weights are provided, the weighted sum of samples should be used instead of the raw sample count for normalization
- The weighted dot product `X.T @ (y * sample_weight)` should be used in the alpha_max computation
- For sparse matrices, the centering correction must properly account for sample weights
- Pass sample weights from LinearModelCV's fit method to `_alpha_grid` when computing alphas

**Acceptance**:
- `_alpha_grid()` function signature must include a `sample_weight` parameter: `_alpha_grid(X, y, Xy=None, l1_ratio=1.0, fit_intercept=True, eps=1e-3, n_alphas=100, copy_X=True, sample_weight=None)`
- When `sample_weight` is provided, the effective sample count `n_samples` must be computed as `sample_weight.sum()` instead of `X.shape[0]`
- For sparse matrices, the computation must use: `safe_sparse_dot(X.T, yw, dense_output=True) - np.sum(yw) * X_offset` where `yw = y * sample_weight`
- `LinearModelCV.fit()` must pass `sample_weight` to `_alpha_grid()` when computing alphas
- When ElasticNetCV is fitted with sample weights, `reg.mse_path_`, `reg.alphas_`, and `reg.alpha_` must match those obtained by fitting with repeated data points
- When fitting with `eps=1` and `n_alphas=1`, the computed `alpha_max` must result in `coef_` being approximately zero (atol=1e-5)
- An alpha of `0.99 * alpha_max` must produce non-zero coefficients (max abs coef > 1e-3)

---

### FR3: HistGradientBoosting Verbose Parameter Granularity

**Problem**: The verbose parameter in HistGradientBoostingClassifier and HistGradientBoostingRegressor only has on/off behavior. Users who want summary information without per-iteration details have no way to configure this.

**Requirements**:
- Modify the verbose parameter behavior to support multiple levels of verbosity
- `verbose=0`: No output (unchanged)
- `verbose=1`: Print only summary information (new behavior)
- `verbose>=2`: Print per-iteration information including timing details (previous behavior of verbose=1)
- Update the docstrings to reflect the new verbosity level semantics

**Acceptance**:
- When `verbose=1`, the fitting process prints summary information but not per-iteration details
- When `verbose=2` or higher, the fitting process prints per-iteration timing and progress information
- When `verbose=0`, no output is printed (unchanged behavior)

---

### FR4: Estimator Representation Beyond Maxlevels

**Problem**: When pretty-printing nested estimators that exceed the configured depth limit (maxlevels), the representation shows `{...}` which provides no information about what type of estimator is being truncated.

**Requirements**:
- Modify the estimator pretty-printer's `_safe_repr` function to include the estimator class name when truncating due to maxlevels
- The truncated representation should follow the pattern `ClassName(...)` instead of `{...}`

**Acceptance**:
- In `sklearn/utils/_pprint.py`, the `_safe_repr` function must return `f"{typ.__name__}(...)"` instead of `"{...}"` when `maxlevels` is exceeded for `BaseEstimator` subclasses
- With `_EstimatorPrettyPrinter(depth=1)` and `print_changed_only=True`: `RFE(RFE(RFE(RFE(RFE(LogisticRegression())))))` must format as `"RFE(estimator=RFE(...))"`
- With `_EstimatorPrettyPrinter(depth=1)` and `print_changed_only=False`: `RFE(RFE(RFE(RFE(RFE(LogisticRegression())))))` must format as `"RFE(estimator=RFE(...), n_features_to_select=None, step=1, verbose=0)"`

---

### FR5: Deprecated Class Signature Preservation

**Problem**: When applying the `@deprecated()` decorator to a class, the resulting class loses its original constructor signature. Introspection tools and IDE autocompletion cannot determine the correct parameters.

**Requirements**:
- Modify the `deprecated` class decorator to preserve the original class signature
- Store the original signature using the `__signature__` attribute as specified in PEP 362
- The deprecation warning behavior should remain unchanged

**Acceptance**:
- In `sklearn/utils/deprecation.py`, the `deprecated` decorator must import `signature` from `inspect`
- Before wrapping `__new__`, capture the original signature: `sig = signature(cls)`
- After wrapping, set `cls.__signature__ = sig` to preserve the original signature
- For a test class decorated with `@deprecated()` having `__init__(self, a, b=1, c=2)`, calling `list(signature(MockClass).parameters.keys())` must return `['a', 'b', 'c']`

---

### FR6: FastICA Low-Rank Warning Threshold Adjustment

**Problem**: The low-rank detection warning in FastICA's eigenvalue-based whitening solver (`whiten_solver="eigh"`) is too sensitive to numerical precision variations across platforms, causing inconsistent test behavior.

**Requirements**:
- Increase the threshold for detecting degenerate eigenvalues in the whitening step
- Change the threshold from `np.finfo(d.dtype).eps` to `np.finfo(d.dtype).eps * 10`
- This adjustment makes the low-rank detection more robust to platform-specific numerical precision

**Acceptance**:
- The low-rank warning test `test_fastica_eigh_low_rank_warning` passes consistently across different platforms and random seeds
- The warning is still raised for genuinely low-rank input data

---

### FR7: NumPy 2.x Doctest Compatibility

**Problem**: Doctests across the codebase fail when running with NumPy 2.x because scalar return values are now displayed with their explicit dtype wrapper (e.g., `np.float64(0.5)` instead of `0.5`).

**Requirements**:
- Update all affected doctest examples to use the NumPy 2.x representation format
- Scalar numeric values should be wrapped with their NumPy dtype: `np.float64()`, `np.int64()`, `np.str_()`, `np.True_`, `np.False_`
- Update doctests in all affected modules including:
  - `sklearn.metrics` (classification, ranking, regression, cluster metrics)
  - `sklearn.datasets` (base, samples_generator)
  - `sklearn.covariance`
  - `sklearn.decomposition`
  - `sklearn.linear_model`
  - `sklearn.preprocessing`
  - `sklearn.isotonic`
  - `sklearn.cluster`
  - `sklearn.random_projection`
  - `sklearn.model_selection`
  - `sklearn.feature_selection`
  - `sklearn.manifold`
  - `sklearn.utils`

**Acceptance**:
- Scalar float values in doctest expected output must use `np.float64(value)` format, e.g., `np.float64(0.6875)` instead of `0.6875`
- Scalar integer values from NumPy operations must use `np.int64(value)` format, e.g., `np.int64(0)` instead of `0`
- Tuple unpacking of NumPy arrays must show dtype wrappers, e.g., `(np.int64(0), np.int64(2), np.int64(1), np.int64(1))` instead of `(0, 2, 1, 1)`
- String values from NumPy arrays converted to Python list must use `np.str_(value)` format, e.g., `[np.str_('setosa'), np.str_('versicolor'), np.str_('virginica')]` instead of `['setosa', 'versicolor', 'virginica']`. This applies to doctests like `list(data.target_names)` and `list(le.classes_)`
- All affected modules' doctests must be updated to match NumPy 2.x scalar representation:
  - `sklearn/metrics/_classification.py`: `confusion_matrix`, `cohen_kappa_score`, `jaccard_score`, `matthews_corrcoef`, `f1_score`, `fbeta_score`, `precision_score`, `recall_score`, `balanced_accuracy_score`, `hinge_loss`, `brier_score_loss`, `class_likelihood_ratios`, `precision_recall_fscore_support`
  - `sklearn/metrics/_ranking.py`: `roc_auc_score`, `auc`, `average_precision_score`, `coverage_error`, `label_ranking_average_precision_score`, `label_ranking_loss`, `dcg_score`, `ndcg_score`, `top_k_accuracy_score`
  - `sklearn/metrics/_regression.py`: `max_error`, `mean_pinball_loss`, `d2_pinball_score`, `d2_absolute_error_score`, `root_mean_squared_error`, `root_mean_squared_log_error`, `median_absolute_error`
  - `sklearn/metrics/cluster/_supervised.py`: `rand_score`, `mutual_info_score`, `homogeneity_score`, `completeness_score`, `v_measure_score`, `homogeneity_completeness_v_measure`, `fowlkes_mallows_score`
  - `sklearn/metrics/cluster/_unsupervised.py`: `silhouette_score`, `calinski_harabasz_score`, `davies_bouldin_score`
  - `sklearn/metrics/cluster/_bicluster.py`: `consensus_score`
  - `sklearn/datasets/_base.py`: `load_iris`, `load_breast_cancer`, `load_wine`
  - `sklearn/datasets/_samples_generator.py`: `make_classification`, `make_circles`, `make_hastie_10_2`, `make_gaussian_quantiles`, `make_friedman1`, `make_friedman2`, `make_friedman3`
  - `sklearn/covariance/_shrunk_covariance.py`: `ledoit_wolf_shrinkage`, `ledoit_wolf`, `oas`, `OAS`
  - `sklearn/decomposition/_sparse_pca.py`: `SparsePCA`, `MiniBatchSparsePCA`
  - `sklearn/decomposition/_dict_learning.py`: `dict_learning`, `dict_learning_online`, `DictionaryLearning`, `MiniBatchDictionaryLearning`
  - `sklearn/linear_model/_base.py`: `LinearRegression`
  - `sklearn/linear_model/_ridge.py`: `ridge_regression`
  - `sklearn/linear_model/_glm/glm.py`: `PoissonRegressor`, `GammaRegressor`, `TweedieRegressor`
  - `sklearn/linear_model/_least_angle.py`: `LarsCV`, `LassoLarsCV`
  - `sklearn/linear_model/_omp.py`: `OrthogonalMatchingPursuitCV`
  - `sklearn/linear_model/_quantile.py`: `QuantileRegressor`
  - `sklearn/linear_model/_coordinate_descent.py`: `MultiTaskLassoCV`
  - `sklearn/preprocessing/_label.py`: `LabelEncoder`
  - `sklearn/preprocessing/_target_encoder.py`: `TargetEncoder`
  - `sklearn/isotonic.py`: `check_increasing`
  - `sklearn/cluster/_mean_shift.py`: `estimate_bandwidth`
  - `sklearn/random_projection.py`: `johnson_lindenstrauss_min_dim`, `SparseRandomProjection`
  - `sklearn/model_selection/_search.py`: `RandomizedSearchCV`
  - `sklearn/feature_selection/_from_model.py`: `SelectFromModel`
  - `sklearn/manifold/_mds.py`: `smacof`
  - `sklearn/utils/extmath.py`: `fast_logdet`

---

### FR8: Birch Unused Function Removal

**Problem**: The `_check_fit` method in the Birch clustering class is defined but never used in the codebase.

**Requirements**:
- Remove the unused `_check_fit` method from the Birch class

**Acceptance**:
- The Birch class no longer contains the `_check_fit` method
- All existing Birch functionality continues to work correctly

---

### FR9: Clustering Error Message Typo Fix

**Problem**: The error message in hierarchical clustering's `_hc_cut` function contains a grammatical error: "where given" should be "were given".

**Requirements**:
- Fix the typo in the error message when attempting to extract more clusters than samples
- Change the message from "X clusters where given for a tree with Y leaves" to "X clusters were given for a tree with Y leaves"
- Update the message format to use f-strings for consistency

**Acceptance**:
- When calling hierarchical clustering with more clusters than samples, the error message reads "X clusters were given for a tree with Y leaves"

---

### FR10: setup.py Documentation Removal

**Problem**: Documentation and code comments still reference `setup.py` for building the package, which is outdated as the project now uses modern build tooling.

**Requirements**:
- Remove references to `python setup.py install` from error messages and documentation
- Replace setup.py build instructions with links to the advanced installation documentation
- Update comments in template files (`.pyx.tp` files) that reference setup.py to use generic build terminology

**Acceptance**:
- The build error message in `__check_build/__init__.py` provides a link to the building from source documentation instead of referencing setup.py
- Template file comments no longer reference setup.py for template substitution

---

### FR11: Matthews Correlation Coefficient Documentation Link Fix

**Problem**: The Wikipedia link in the Matthews correlation coefficient documentation redirects to a different article.

**Requirements**:
- Update the Wikipedia reference URL to point directly to the correct article
- Update the reference title to match the actual Wikipedia page title

**Acceptance**:
- The Matthews correlation coefficient docstring references the correct Wikipedia article without causing a redirect


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
