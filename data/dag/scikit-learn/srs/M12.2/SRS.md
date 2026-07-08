# Software Requirements Specification: Infrastructure Foundation Phase 2

## Overview

This milestone continues infrastructure improvements for scikit-learn, focusing on metadata routing support for additional estimators, bug fixes across multiple modules, API cleanups for deprecated features, and minor enhancements. The changes span multiple subsystems including ensemble methods, model selection utilities, linear models, tree exporters, and preprocessing components.

### Summary of Requirements

1. **FR1**: Add metadata routing support for `StackingClassifier` and `StackingRegressor`
2. **FR2**: Add metadata routing support for `TransformedTargetRegressor`
3. **FR3**: Add metadata routing support for `learning_curve` function
4. **FR4**: Add `zero_division` parameter to `accuracy_score`
5. **FR5**: Fix `RidgeCV` scoring to use unscaled target values when `scoring` is specified
6. **FR6**: Fix `KNNImputer` to exclude samples with NaN distances for uniform weights
7. **FR7**: Fix `CalibratedClassifierCV` to reject `LeaveOneOut` cross-validation
8. **FR8**: Clean up deprecated `SAMME.R` algorithm from `AdaBoostClassifier`
9. **FR9**: Fix Graphviz tree export to escape double quotes in feature/class names
10. **FR10**: Improve HTML display for `FunctionTransformer`
11. **FR11**: Fix `TransformedTargetRegressor` warning when global `set_output` is configured
12. **FR12**: Support missing values in `ExtraTreesClassifier` and `ExtraTreesRegressor`
13. **FR13**: Relax `IncrementalPCA` sample count restriction for subsequent `partial_fit` calls
14. **FR14**: Add `normalize` parameter to `LatentDirichletAllocation.transform`
15. **FR15**: Improve regularization messages for `QuadraticDiscriminantAnalysis`
16. **FR16**: Use `scipy.special.inv_boxcox` in `PowerTransformer`
17. **FR17**: Fix `TfidfVectorizer` to set `idf_` dtype based on input dtype
18. **FR18**: Make initial binning in histogram-based gradient boosting parallel

### Affected Modules

- `sklearn/ensemble/_stacking.py`
- `sklearn/compose/_target.py`
- `sklearn/model_selection/_validation.py`
- `sklearn/metrics/_classification.py`
- `sklearn/linear_model/_ridge.py`
- `sklearn/impute/_knn.py`
- `sklearn/calibration.py`
- `sklearn/ensemble/_weight_boosting.py`
- `sklearn/tree/_export.py`
- `sklearn/preprocessing/_function_transformer.py`
- `sklearn/utils/_estimator_html_repr.py`
- `sklearn/tree/_classes.py`
- `sklearn/decomposition/_incremental_pca.py`
- `sklearn/decomposition/_lda.py`
- `sklearn/discriminant_analysis.py`
- `sklearn/preprocessing/_data.py`
- `sklearn/feature_extraction/text.py`
- `sklearn/ensemble/_hist_gradient_boosting/binning.py`

---

## Requirements

### FR1: Metadata Routing for StackingClassifier and StackingRegressor

**Problem**: `StackingClassifier` and `StackingRegressor` do not support the metadata routing API, preventing users from passing metadata like `sample_weight` through to sub-estimators when metadata routing is enabled.

**Requirements**:
- Implement `get_metadata_routing` method for both stacking estimators that defines routing for all sub-estimators and the final estimator
- Route metadata from `fit` to each sub-estimator's `fit` method
- Route metadata from `predict` to the final estimator's `predict` method
- Support `sample_weight` as a keyword argument in `fit` for backward compatibility
- When metadata routing is enabled, accept additional `**fit_params` that are routed to sub-estimators
- Deprecate passing `sample_weight` as a positional argument (should use keyword)

**Acceptance**:
- When metadata routing is enabled and a sub-estimator requests `sample_weight`, passing `sample_weight` to `fit` routes it correctly to that sub-estimator
- When metadata routing is enabled and custom metadata is requested by sub-estimators, it is correctly routed during `fit`
- When calling `get_metadata_routing()` before fitting, the routing information is returned without errors (must work on unfitted estimator)
- When routing is enabled and metadata is passed to sub-estimators that have not explicitly requested it, a `ValueError` is raised with message containing "are passed but are not explicitly set as requested or not requested for {EstimatorName}.fit"
- When metadata routing is disabled (default) and metadata like `sample_weight` or `metadata` are passed to `fit`, a `ValueError` is raised with message containing "is only supported if enable_metadata_routing=True"
- Both `StackingClassifier` and `StackingRegressor` must implement `get_metadata_routing()` method that returns a `MetadataRouter` instance

---

### FR2: Metadata Routing for TransformedTargetRegressor

**Problem**: `TransformedTargetRegressor` does not support the metadata routing API, preventing users from routing metadata to the underlying regressor when metadata routing is enabled.

**Requirements**:
- Implement `get_metadata_routing` method that defines routing for the underlying regressor
- Route metadata from `fit` to the regressor's `fit` method
- Route metadata from `predict` to the regressor's `predict` method
- Maintain backward compatibility when metadata routing is disabled

**Acceptance**:
- When metadata routing is enabled, metadata passed to `fit` is correctly routed to the underlying regressor's `fit` method
- When metadata routing is enabled, metadata passed to `predict` is correctly routed to the underlying regressor's `predict` method
- `TransformedTargetRegressor` must implement `get_metadata_routing()` method that returns a `MetadataRouter` instance
- When calling `get_metadata_routing()` before fitting, default request is empty (no metadata requested by default)
- When metadata routing is enabled and metadata is passed without being explicitly requested on the sub-estimator, a `UnsetMetadataPassedError` is raised with message containing "are passed but are not explicitly set as requested or not requested for {EstimatorName}.{method}"
- When the sub-estimator's request is explicitly set (e.g., via `set_fit_request(sample_weight=True)`), no error is raised and metadata is routed correctly

---

### FR3: Metadata Routing for learning_curve

**Problem**: The `learning_curve` function does not support the metadata routing API, and the `fit_params` argument follows the old pattern instead of the new `params` pattern.

**Requirements**:
- Add a `params` parameter to `learning_curve` that supports metadata routing when enabled
- Deprecate the `fit_params` parameter in favor of `params`
- When metadata routing is enabled, route parameters to the estimator's `fit` and `partial_fit` methods, the cross-validation splitter's `split` method, and the scorer's `score` method
- Support passing `groups` via `params` when metadata routing is enabled
- Handle incremental learning scenarios with proper metadata routing to `partial_fit`

**Acceptance**:
- `learning_curve()` must accept a `params` parameter (dict) for passing metadata when routing is enabled
- When `params` is passed with `sample_weight` and the estimator requests it, the sample weights are correctly applied during fitting
- When metadata routing is enabled and groups are passed via `params`, they are correctly routed to the splitter
- When using incremental learning with `exploit_incremental_learning=True`, metadata is correctly passed to `partial_fit` (routing to `partial_fit` must work)
- When `fit_params` is passed, a `FutureWarning` is raised with message containing "`fit_params` is deprecated"
- When both `params` and `fit_params` are passed, a `ValueError` is raised with message containing "`params` and `fit_params` cannot both be provided"
- When metadata routing is enabled and `groups` is passed as a top-level argument (not via `params`), a `ValueError` is raised with message containing "`groups` can only be passed if"
- When metadata routing is enabled and metadata is passed via `params` without being requested by the estimator, a `ValueError` is raised with message containing "but are not explicitly set as requested or not requested"

---

### FR4: Add zero_division Parameter to accuracy_score

**Problem**: When `accuracy_score` is called with empty inputs (`y_true` and `y_pred` both empty), it returns `0.0` without allowing users to control this behavior or suppress warnings.

**Requirements**:
- Add a `zero_division` parameter to `accuracy_score` that accepts values `"warn"`, `0.0`, `1.0`, or `np.nan`
- When `zero_division="warn"` (default) and inputs are empty, return `0.0` and raise a warning
- When `zero_division` is set to a numeric value and inputs are empty, return that value without warning
- The parameter should only affect behavior when both `y_true` and `y_pred` are empty

**Acceptance**:
- `accuracy_score()` must accept a `zero_division` parameter
- The `zero_division` parameter must accept values: `"warn"` (default), `0.0`, `1.0`, and `np.nan`
- When `y_true` and `y_pred` are empty and `zero_division="warn"`, an `UndefinedMetricWarning` is raised and `0.0` is returned
- When `y_true` and `y_pred` are empty and `zero_division=0.0`, no warning is raised and `0.0` is returned
- When `y_true` and `y_pred` are empty and `zero_division=1.0`, no warning is raised and `1.0` is returned
- When `y_true` and `y_pred` are empty and `zero_division=np.nan`, no warning is raised and `np.nan` is returned
- The `zero_division` parameter only affects behavior when both `y_true` and `y_pred` are empty (zero samples)

---

### FR5: Fix RidgeCV Scoring with Unscaled Target Values

**Problem**: When `RidgeCV` is used with a custom `scoring` parameter, the internal cross-validation predictions and scoring are performed on scaled target values instead of the original scale, leading to incorrect scores and inconsistent `cv_results_`.

**User Report**:
```
When using RidgeCV with scoring != None, the stored cv_results_ predictions
are on the scaled/centered scale rather than the original scale, making them
inconsistent with what a naive LOO-CV would produce.
```

**Requirements**:
- When `scoring` is specified, ensure that predictions stored in `cv_results_` are rescaled back to the original target scale
- When `scoring` is specified, ensure the scorer receives predictions and targets on the original scale
- Handle sample weights correctly when rescaling predictions
- Maintain backward compatibility when `scoring=None` (using internal GCV mechanism)

**Acceptance**:
- When `RidgeCV` is fitted with `scoring` specified (e.g., `scoring="neg_mean_squared_error"`) and `store_cv_results=True`, the predictions stored in `cv_results_` must be on the original (unscaled) target scale
- The predictions in `cv_results_` must match those from a naive leave-one-out cross-validation using a `Ridge` estimator fitted on each train split and predicting on the corresponding test sample
- When sample weights are used, predictions are correctly rescaled accounting for the weight transformation
- Scores computed by the custom scorer are consistent with manual cross-validation
- The `cv_results_` attribute shape must be `(*y.shape, len(alphas))` where `y` is the target and `alphas` is the list of regularization parameters

---

### FR6: Fix KNNImputer for NaN Distances with Uniform Weights

**Problem**: When `KNNImputer` uses `weights="uniform"` and some training samples have NaN values that result in undefined (NaN) distances to the sample being imputed, those samples are not properly excluded from the imputation calculation, leading to NaN imputed values.

**Requirements**:
- When `weights="uniform"` is used, exclude samples with NaN distances from the imputation calculation
- Create a weight matrix for uniform weights that sets weight to zero for samples with NaN distances
- Maintain existing behavior for distance-weighted imputation

**Acceptance**:
- When `weights="uniform"` and some training samples have NaN distances to the sample being imputed (due to missing values in overlapping features), those samples with NaN distances must be excluded from the imputation calculation
- When a test sample has missing values that cause NaN distances to some training samples, and `weights="uniform"`, only training samples with finite distances contribute to the imputed value
- When all neighbors have finite distances, the imputation result is unchanged from previous behavior
- When `n_neighbors` is set to all available samples (or `-1`), samples with NaN distances are still properly excluded from the mean calculation

---

### FR7: Reject LeaveOneOut in CalibratedClassifierCV

**Problem**: When `LeaveOneOut` cross-validation is used with `CalibratedClassifierCV`, the test splits contain only one sample each, which means not all classes can be present in test splits. This leads to calibration failures but the error message is unclear.

**Requirements**:
- Explicitly check if the cross-validation strategy is `LeaveOneOut` and raise a clear error
- The error message should explain why `LeaveOneOut` cannot be used and suggest alternatives

**Acceptance**:
- When `CalibratedClassifierCV` is instantiated with `cv=LeaveOneOut()` and `fit()` is called, a `ValueError` is raised
- The error message must match the pattern "LeaveOneOut cross-validation does" (indicating that LeaveOneOut cannot be used)
- The error is raised during `fit()` before attempting calibration, preventing cryptic downstream errors

---

### FR8: Clean Up Deprecated SAMME.R Algorithm in AdaBoostClassifier

**Problem**: The `SAMME.R` algorithm in `AdaBoostClassifier` was deprecated in a previous version and needs to be removed, with `SAMME` becoming the only algorithm.

**Requirements**:
- Remove the `SAMME.R` algorithm implementation
- Make `SAMME` the default (and only) algorithm
- Deprecate the `algorithm` parameter entirely since only one option exists
- Update default value to indicate deprecation and raise a warning when explicitly set
- Clean up related code paths that branched on algorithm type

**Acceptance**:
- When `AdaBoostClassifier` is created without specifying `algorithm`, no warning is raised and `SAMME` is used
- When `algorithm="SAMME"` is explicitly passed to `AdaBoostClassifier`, a `FutureWarning` is raised with message matching "The parameter 'algorithm' is deprecated"
- The classifier functions correctly for all use cases with the single algorithm
- `decision_function()` must return a 2D array where rows sum to 0 (symmetric constraint for multiclass)
- `staged_decision_function()` must yield arrays where rows sum to 0 (symmetric constraint for multiclass)
- For a classifier with a single weak learner, the decision function values must be in the set `{1, -1/(n_classes-1)}`

---

### FR9: Escape Double Quotes in Graphviz Tree Export

**Problem**: When exporting a decision tree to Graphviz format using `export_graphviz`, feature names or class names containing double quotes cause invalid DOT syntax because the quotes are not escaped.

**Requirements**:
- Escape double quotes in feature names when generating node labels
- Escape double quotes in class names when generating node labels
- Use proper escaping syntax for Graphviz DOT format (`\"`)

**Acceptance**:
- When a feature name contains a double quote (e.g., `'feature"0"'`), the exported DOT string must escape the quotes as `\"` in the label (e.g., `feature\"0\"`)
- When a class name contains a double quote (e.g., `'"yes"'`), the exported DOT string must escape the quotes as `\"` in the label (e.g., `class = \"yes\"`)
- The escaping must use the Graphviz DOT format backslash-quote sequence (`\"`)
- The generated DOT file can be parsed by Graphviz without syntax errors

---

### FR10: Improve HTML Display for FunctionTransformer

**Problem**: When `FunctionTransformer` is displayed in a Jupyter notebook or HTML representation, it shows the full estimator representation which can be verbose. The function name itself is not prominently displayed.

**Requirements**:
- Display the function name as the primary label for `FunctionTransformer` in HTML representation
- Show "FunctionTransformer" as a caption below the function name
- Handle different function types: regular functions, lambda functions, partial functions, and callable objects
- For lambda functions, display `<lambda>`
- For partial functions, display the wrapped function name
- For callable objects, display the class name with `(...)`

**Acceptance**:
- When a `FunctionTransformer` wrapping a regular function `my_func` is displayed in HTML, the label div must show `my_func` as the primary text
- A caption div with class `caption` must contain the text `FunctionTransformer`
- The HTML structure for the label must follow the pattern: `<div><div>{function_name}</div><div class="caption">FunctionTransformer</div></div>`
- When wrapping a lambda, the label shows `<lambda>` (HTML-escaped as `&lt;lambda&gt;`) with caption `FunctionTransformer`
- When wrapping a `functools.partial(some_func, ...)`, the label shows the wrapped function name (e.g., `dummy_function`) with caption `FunctionTransformer`
- When wrapping a callable object like `np.vectorize(...)`, the label shows `vectorize(...)` with caption `FunctionTransformer`
- The `_write_label_html` function must generate labels with the structure `<div><div>{name}</div></div>` (nested divs)

---

### FR11: Fix TransformedTargetRegressor Warning with Global set_output

**Problem**: When `set_config(transform_output="pandas")` or `set_config(transform_output="polars")` is set globally, `TransformedTargetRegressor` raises warnings during fitting because the internal `FunctionTransformer` used for target transformation inherits this setting, but target transformation should always produce NumPy arrays.

**User Report**:
```
When set_config(transform_output="pandas") is set globally,
TransformedTargetRegressor raises a warning during fit. The transformer
should use the default output format since it's transforming targets,
not features.
```

**Requirements**:
- When `TransformedTargetRegressor` creates an internal `FunctionTransformer` for target transformation, explicitly set its output to default (NumPy) regardless of global configuration
- Ensure no warnings are raised when fitting with global output configuration set

**Acceptance**:
- When `set_config(transform_output="pandas")` is active and `TransformedTargetRegressor` is fitted, no warnings of any kind are raised
- When `set_config(transform_output="polars")` is active and `TransformedTargetRegressor` is fitted, no warnings of any kind are raised
- The internal `FunctionTransformer` used for target transformation must explicitly set its output to default (NumPy) regardless of global configuration
- The transformed target is always a NumPy array regardless of global configuration

---

### FR12: Support Missing Values in ExtraTreesClassifier and ExtraTreesRegressor

**Problem**: `ExtraTreesClassifier` and `ExtraTreesRegressor` do not properly advertise support for missing values in their estimator tags, preventing their use in pipelines that check for NaN support.

**Requirements**:
- Update `ExtraTreesClassifier` to advertise NaN support via `_more_tags()` when using the random splitter with compatible criteria
- Update `ExtraTreesRegressor` to advertise NaN support via `_more_tags()` when using the random splitter with compatible criteria
- For classifiers, support criteria: `gini`, `log_loss`, `entropy`
- For regressors, support criteria: `squared_error`, `friedman_mse`, `poisson`
- Missing value support is only for dense arrays

**Acceptance**:
- `ExtraTreesClassifier` and `ExtraTreesRegressor` must support training on data containing NaN values
- Training on data with NaN values produces valid models with reasonable performance (at least 80% of the score compared to data without missing values)
- The missing value handling must work with random samples of NaN values in the training data
- NaN values can be predictive features (the presence/absence of NaN can correlate with the target)
- The estimator tags must correctly advertise NaN support via `__sklearn_tags__()` method

---

### FR13: Relax IncrementalPCA Sample Count Restriction

**Problem**: `IncrementalPCA.partial_fit` raises an error if `n_components` is greater than the batch size, even on subsequent calls after the initial fit. This restriction should only apply to the first `partial_fit` call.

**User Report**:
```
IncrementalPCA raises an error when partial_fit is called with a small
batch size, even though the initial call had sufficient samples. This
prevents processing remaining data in small final batches.
```

**Requirements**:
- Only enforce the `n_components <= batch_size` constraint on the first `partial_fit` call
- Allow subsequent `partial_fit` calls with smaller batch sizes
- Update the error message to clarify the restriction applies only to the first call

**Acceptance**:
- When `partial_fit` is first called with `n_samples >= n_components`, no error is raised
- When `partial_fit` is subsequently called with `n_samples < n_components` (even batch size of 1), no error is raised
- When `partial_fit` is first called with `n_samples < n_components`, a `ValueError` is raised with message containing "must be less or equal to the batch number of samples" and "for the first partial_fit call"
- After the first successful `partial_fit` call with sufficient samples, subsequent calls can have any batch size (including 1 sample at a time)

---

### FR14: Add normalize Parameter to LatentDirichletAllocation.transform

**Problem**: `LatentDirichletAllocation.transform` always returns normalized document-topic distributions, but users may need access to unnormalized values for certain use cases.

**Requirements**:
- Add a `normalize` parameter to `transform` method that defaults to `True`
- When `normalize=True`, return normalized document-topic distributions (current behavior)
- When `normalize=False`, return unnormalized document-topic distributions
- Add the same parameter to `fit_transform` method

**Acceptance**:
- `LatentDirichletAllocation.transform()` must accept a `normalize` parameter (default: `True`)
- When `transform(X)` is called (default `normalize=True`), the returned array rows sum to 1.0
- When `transform(X, normalize=False)` is called, the returned array contains unnormalized values
- The normalized output equals the unnormalized output divided by row sums: `X_normalized = X_unnormalized / X_unnormalized.sum(axis=1)[:, np.newaxis]`
- The `set_transform_request` method must be available to configure request for the `normalize` parameter (for metadata routing compatibility)

---

### FR15: Improve Regularization Messages for QuadraticDiscriminantAnalysis

**Problem**: When `QuadraticDiscriminantAnalysis` encounters collinear variables, it raises a generic "Variables are collinear" warning that does not provide helpful guidance on how to address the issue.

**Requirements**:
- Update the collinearity warning to specify which class has the rank-deficient covariance matrix
- Suggest increasing `reg_param` as a potential solution
- Use `LinAlgWarning` instead of generic warning for proper warning filtering
- Check for collinearity after applying regularization, not before

**Acceptance**:
- When fitting on data with collinear features or rank-deficient covariance matrix, a `scipy.linalg.LinAlgWarning` is raised
- The warning message must match the pattern "The covariance matrix of class .+ is not full rank"
- When `reg_param` is increased sufficiently (e.g., `reg_param=0.01`), no warning is raised and the model fits successfully
- When `n_samples < n_features` for a class (another rank deficiency case), the same `LinAlgWarning` is raised with the same message pattern

---

### FR16: Use scipy.special.inv_boxcox in PowerTransformer

**Problem**: `PowerTransformer` uses a custom implementation of the inverse Box-Cox transformation instead of the optimized SciPy implementation.

**Requirements**:
- Replace the custom `_box_cox_inverse_transform` method with `scipy.special.inv_boxcox`
- Maintain identical numerical results

**Acceptance**:
- The inverse Box-Cox transform must use `scipy.special.inv_boxcox` internally
- The inverse transform produces the same results as before (numerical equivalence)
- Round-trip transformation (transform followed by inverse_transform) returns approximately the original values
- When the input to `inverse_transform` would produce invalid values (e.g., negative inputs for certain lambda values), the output should be `np.nan`

---

### FR17: Fix TfidfVectorizer idf_ dtype Based on Input

**Problem**: `TfidfVectorizer` and `TfidfTransformer` do not consistently set the dtype of `idf_` based on the input data dtype, leading to unexpected dtype changes particularly with NumPy 2.0.

**Requirements**:
- Ensure `idf_` dtype matches the dtype of the input document-frequency array
- Use in-place operations to preserve dtype through the computation
- Maintain consistent behavior across NumPy versions

**Acceptance**:
- When fitting on float32 input, `idf_` has dtype float32
- When fitting on float64 input, `idf_` has dtype float64

---

### FR18: Parallelize Initial Binning in Histogram Gradient Boosting

**Problem**: The initial binning step in histogram-based gradient boosting trees processes features sequentially, which can be slow for datasets with many features.

**Requirements**:
- Parallelize the computation of binning thresholds across features
- Use thread-based parallelism to avoid GIL issues with Cython code
- Respect the `n_threads` parameter already available on the `_BinMapper`

**Acceptance**:
- When fitting on data with many features and multiple threads available, binning completes faster than sequential processing
- The binning thresholds are identical regardless of the number of threads used
- No race conditions or threading issues occur

---

## Additional Notes

### Deprecation Cleanup

This milestone also includes cleanup of previously deprecated functionality:
- `MiniBatchDictionaryLearning` deprecations
- `AgglomerativeClustering` deprecations
- `HDBSCAN` deprecations
- `log_logistic` function removal from `sklearn.utils.extmath`

### Build System Updates

- Require `meson-python >= 0.16` in `pyproject.toml` under `project.optional-dependencies.build`
- Use `python3` instead of `python` in build script shebangs
- The minimum version requirements in pyproject.toml must match those specified in `sklearn/_min_dependencies.py`

### Documentation Improvements

- Add links to examples in `manifold.MDS` docstring
- Fix typos in `LeaveOneGroupOut` and `NeighborhoodComponentAnalysis` documentation


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
