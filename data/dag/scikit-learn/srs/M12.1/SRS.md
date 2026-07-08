# Software Requirements Specification - M12.1: Infrastructure Foundation Phase 1

## Overview

This milestone encompasses initial infrastructure improvements for scikit-learn 1.6, including documentation cleanup, license standardization, foundational API changes, and various bug fixes across multiple modules.

### Summary of Requirements

1. **FR1**: License and Author Attribution Standardization
2. **FR2**: New `fetch_file` Dataset Utility Function
3. **FR3**: `GroupKFold` Shuffle Parameter Support
4. **FR4**: `cohen_kappa_score` Zero Division Parameter
5. **FR5**: `ColumnTransformer` Callable `verbose_feature_names_out` Support
6. **FR6**: `SequentialFeatureSelector` Metadata Routing Support
7. **FR7**: Deprecate `max_error` Scorer in Favor of `neg_max_error`
8. **FR8**: `Ridge` and `RidgeCV` Coefficient Shape Consistency
9. **FR9**: `RidgeCV` Multi-output Sample Weight Scoring Fix
10. **FR10**: Accept Infinite `C` Parameter in SVC and SVR
11. **FR11**: `LocalOutlierFactor` Duplicate Values Warning
12. **FR12**: `KNNImputer` Column Filtering for All-NaN Training Columns
13. **FR13**: `PLSRegression` Invalid `n_components` Error
14. **FR14**: `RepeatedStratifiedKFold.split` Error Message Improvement
15. **FR15**: `roc_auc_score` Single Class Handling Consistency
16. **FR16**: Estimator Checks API/Legacy Categorization
17. **FR17**: F-Contiguous Array Common Estimator Test
18. **FR18**: `SGDOneClassSVM` Inheritance Order Fix
19. **FR19**: Parameter Name Typo Fix (`input_dtye` to `input_dtype`)
20. **FR20**: Pretty Printer Parameter Parsing Simplification
21. **FR21**: `HTMLDocumentationLinkMixin` URL Parameter Generator Fix
22. **FR22**: `GridSearchCV` Heterogeneous Parameter Grid Fix
23. **FR23**: `make_sparse_spd_matrix` Deprecation Cleanup
24. **FR24**: `_CurveScorer` Module Relocation
25. **FR25**: `ColumnTransformer` Performance Optimization
26. **FR26**: Refactor `GridSearchCV` parameter result construction into reusable function
27. **FR27**: Lazy `ThreadpoolController` initialization
28. **FR28**: Forward compatibility placeholders for later milestones

### Affected Modules

- `sklearn.datasets`
- `sklearn.model_selection`
- `sklearn.metrics`
- `sklearn.compose`
- `sklearn.feature_selection`
- `sklearn.linear_model`
- `sklearn.svm`
- `sklearn.neighbors`
- `sklearn.impute`
- `sklearn.cross_decomposition`
- `sklearn.utils`
- `sklearn.cluster`
- `sklearn.base`

---

## Functional Requirements

### FR1: License and Author Attribution Standardization

**Problem**: Inconsistent license headers and author attribution formats across the codebase make maintenance and legal compliance difficult.

**Requirements**:
- Replace individual author attributions with standardized "The scikit-learn developers" attribution
- Replace various license notices with standardized SPDX identifier format "SPDX-License-Identifier: BSD-3-Clause"
- Apply changes consistently across all affected modules

**Acceptance**:
- When viewing any module header, the author attribution follows the standardized format
- When viewing any module header, the license identifier uses SPDX format

---

### FR2: New `fetch_file` Dataset Utility Function

**Problem**: Users need a standardized way to download arbitrary data files from the web with local caching, integrity verification via SHA256 checksums, and automatic retry on HTTP errors.

**Requirements**:
- Implement a `fetch_file` function in the datasets module that downloads files from URLs
- Support local caching to avoid redundant downloads
- Support SHA256 checksum verification when provided
- Implement automatic retry logic for transient HTTP errors
- Derive folder and filename from URL when not explicitly provided
- Return the path to the locally cached file
- If a file already exists locally with matching checksum, skip re-download

**Acceptance**:
- `fetch_file` function must be exported from `sklearn.datasets` module
- `fetch_file(url, folder=None, local_filename=None, sha256=None, n_retries=3, delay=1)` signature must be implemented
- `fetch_file` must return a `Path` object pointing to the locally cached file
- When `fetch_file` is called with a valid URL, the file is downloaded and cached locally
- When `fetch_file` is called with a SHA256 checksum via `sha256` parameter, integrity is verified
- When downloading fails due to transient errors, the function retries before raising
- When the file already exists with matching checksum, no download occurs
- When checksum mismatch is detected on existing file, re-download is triggered with a warning
- Helper function `_derive_folder_and_filename_from_url(url)` must be implemented, returning `(folder, filename)` tuple
- URL parsing rules for `_derive_folder_and_filename_from_url`:
  - Remove query string (`?...`) and anchor (`#...`) before parsing
  - **Folder**: `{host}/{dir1}_{dir2}_{...}` format
    - Path directory segments (excluding filename) joined by `_`
    - Strip special chars (`@`, `-`, `_`, `.`) from start/end of each segment
    - Skip empty segments after stripping
  - **Filename**: last path segment
    - Strip leading/trailing special chars (`@`, `-`, `_`, `.`)
    - Replace spaces with hyphens
    - Default to `"downloaded_file"` if empty
  - Example: `https://example.com/path/@to/file.json?v=1` → `("example.com/path_to", "file.json")`

---

### FR3: `GroupKFold` Shuffle Parameter Support

**Problem**: `GroupKFold` does not support shuffling groups before splitting, limiting its flexibility for cross-validation scenarios where random group assignment to folds is desired.

**Requirements**:
- Add `shuffle` parameter to `GroupKFold` that defaults to `False`
- Add `random_state` parameter to `GroupKFold` for reproducibility when shuffling
- When `shuffle=True`, randomly distribute groups across folds
- When `shuffle=False`, maintain existing behavior of balancing samples across folds

**Acceptance**:
- `GroupKFold.__init__(n_splits=5, *, shuffle=False, random_state=None)` must accept `shuffle` and `random_state` as keyword-only parameters
- `GroupKFold` repr must include `shuffle` and `random_state` parameters (e.g., `GroupKFold(n_splits=2, random_state=None, shuffle=False)`)
- When `GroupKFold(shuffle=True)` is used, groups are randomly assigned to folds
- When different `random_state` values are used, different group assignments result
- When `shuffle=False`, existing balanced sample distribution behavior is maintained
- When `shuffle=True`, equal number of distinct groups are placed in each fold

---

### FR4: `cohen_kappa_score` Zero Division Parameter

**Problem**: `cohen_kappa_score` can produce undefined results when both labelings contain only one class or are empty, causing division by zero without user control over the return value.

**Requirements**:
- Add `zero_division` parameter to `cohen_kappa_score` accepting values: `"warn"`, `0.0`, `1.0`, or `np.nan`
- When `zero_division="warn"` (default), return `0.0` but emit an `UndefinedMetricWarning`
- When `zero_division` is a numeric value, return that value silently on zero division

**Acceptance**:
- `cohen_kappa_score(y1, y2, *, labels=None, weights=None, sample_weight=None, zero_division="warn")` must accept `zero_division` parameter
- The `zero_division` parameter must accept: `"warn"`, `0.0`, `1.0`, or `np.nan`
- When `cohen_kappa_score` encounters zero division with `zero_division="warn"`, an `UndefinedMetricWarning` is raised and 0.0 is returned
- When `zero_division=np.nan` is specified, `nan` is returned on zero division without warning
- When `zero_division=1.0` is specified, `1.0` is returned on zero division without warning
- When `zero_division=0` (int) is specified, `0.0` is returned on zero division without warning

---

### FR5: `ColumnTransformer` Callable `verbose_feature_names_out` Support

**Problem**: `ColumnTransformer.get_feature_names_out()` only supports boolean values for `verbose_feature_names_out`, limiting customization of output feature naming.

**Requirements**:
- Extend `verbose_feature_names_out` parameter to accept string format templates
- Extend `verbose_feature_names_out` parameter to accept callable functions
- For string format, support `{transformer_name}` and `{feature_name}` placeholders
- For callable, accept function with signature `(transformer_name: str, feature_name: str) -> str`
- Maintain backward compatibility with boolean values

**Acceptance**:
- `ColumnTransformer` constructor must accept `verbose_feature_names_out` as `bool`, `str`, or `callable`
- When `verbose_feature_names_out` is a string, it must support `{transformer_name}` and `{feature_name}` placeholders via `str.format()`
- When `verbose_feature_names_out` is a callable, it must receive `(transformer_name: str, feature_name: str)` and return `str`
- When `verbose_feature_names_out="{feature_name}-{transformer_name}"` is used, feature names are formatted accordingly
- When a callable is provided, it is called for each feature name transformation
- When `verbose_feature_names_out=True`, default `"{transformer_name}__{feature_name}"` format is used
- When `verbose_feature_names_out=False`, no prefix is added

---

### FR6: `SequentialFeatureSelector` Metadata Routing Support

**Problem**: `SequentialFeatureSelector` does not support metadata routing, preventing users from passing additional parameters like `sample_weight` to the underlying estimator, cross-validator, and scorer.

**Requirements**:
- Enable metadata routing for `SequentialFeatureSelector`
- Route metadata to the underlying estimator's `fit` method
- Route metadata to the cross-validator's `split` method
- Route metadata to the scorer's `score` method
- Add `get_metadata_routing` method returning appropriate `MetadataRouter`

**Acceptance**:
- `SequentialFeatureSelector.fit(X, y=None, **params)` must accept `**params` for metadata routing
- `SequentialFeatureSelector.get_metadata_routing()` must return a `MetadataRouter` object
- The `MetadataRouter` must include routing for: `estimator` (method mapping: fit→fit), `splitter` (method mapping: fit→split), `scorer` (method mapping: fit→score)
- When metadata routing is enabled and `sample_weight` is passed to `fit`, it is routed to the estimator
- When metadata routing is enabled and groups are passed, they are routed to the splitter
- When `get_metadata_routing` is called, a properly configured `MetadataRouter` is returned
- When metadata routing is disabled and extra params are passed, a `ValueError` is raised

---

### FR7: Deprecate `max_error` Scorer in Favor of `neg_max_error`

**Problem**: The `max_error` scorer name is inconsistent with other regression scorers that use the `neg_` prefix convention for metrics where lower is better.

**Requirements**:
- Add `neg_max_error` as the new scorer name
- Deprecate `max_error` scorer with a `DeprecationWarning`
- When `max_error` is used, emit deprecation warning indicating replacement with `neg_max_error`
- Maintain functional equivalence during deprecation period

**Acceptance**:
- `neg_max_error_scorer` must be added to `sklearn.metrics._scorer` module
- `neg_max_error` must be added to `_SCORERS` dictionary as the primary scorer name
- `max_error` must be removed from `_SCORERS` dictionary and handled via special case in `get_scorer()`
- When `scoring="neg_max_error"` is used, no deprecation warning is emitted
- When `scoring="max_error"` is used, a `DeprecationWarning` is emitted with message indicating rename to `neg_max_error`
- When either scorer is used, the same score values are produced

---

### FR8: `Ridge` and `RidgeCV` Coefficient Shape Consistency

**Problem**: `Ridge` and `RidgeCV` return `coef_` with inconsistent shape compared to other linear models when target is not multi-output.

**Requirements**:
- Ensure `coef_` attribute has shape `(n_features,)` for single-target problems
- Ensure `coef_` attribute has shape `(n_targets, n_features)` for multi-target problems
- Apply consistency to both `Ridge` and `RidgeCV` classes

**Acceptance**:
- When fitting `Ridge` with 1D target `y`, `coef_.shape` must be `(n_features,)` (1D array)
- When fitting `Ridge` with 2D single-column target `y[:, np.newaxis]`, `coef_.shape` must be `(n_features,)` (1D array)
- When fitting `Ridge` with multi-column target, `coef_.shape` must be `(n_targets, n_features)` (2D array)
- When fitting `RidgeCV` with single target, `coef_.shape` must be `(n_features,)` (1D array)
- `coef_` attribute must be `np.ndarray` type in all cases

---

### FR9: `RidgeCV` Multi-output Sample Weight Scoring Fix

**Problem**: `RidgeCV` fails when using non-default scoring with multioutput targets and sample weights.

**Requirements**:
- Fix scoring computation in `RidgeCV` to handle multioutput correctly with sample weights
- Ensure scorer receives properly shaped predictions and targets without unnecessary raveling

**Acceptance**:
- When `RidgeCV` is used with multioutput targets, sample weights, and custom scoring, no error occurs
- Scorer must receive `predictions` and `y` with preserved shape (no raveling for multioutput)
- When custom scoring is used, scores are computed correctly matching manual LOO-CV results

---

### FR10: Accept Infinite `C` Parameter in SVC and SVR

**Problem**: `SVC` and `SVR` do not accept `C=float("inf")` or `C=np.inf`, which should be valid for hard-margin classification/regression.

**Requirements**:
- Update parameter validation for `C` to accept positive infinity
- Treat infinite `C` as equivalent to a very large regularization value

**Acceptance**:
- Parameter validation for `C` in `BaseLibSVM` must use `Interval(Real, 0.0, None, closed="right")` to allow infinity
- When `SVC(C=float("inf"))` is instantiated and fit, no validation error occurs
- When `SVR(C=np.inf)` is instantiated and fit, no validation error occurs
- When infinite `C` is used, predictions are close to those with very large finite `C` (e.g., `C=1e10`)

---

### FR11: `LocalOutlierFactor` Duplicate Values Warning

**Problem**: `LocalOutlierFactor` can produce inaccurate outlier detection results when training data contains many duplicate values, without informing the user.

**Requirements**:
- Detect when duplicate values in training data cause extremely low negative outlier factor values
- Issue a `UserWarning` when `negative_outlier_factor_` contains values below an extreme threshold (e.g., -1e7)
- Recommend increasing `n_neighbors` as a potential remedy

**Acceptance**:
- Warning must be issued when `np.min(self.negative_outlier_factor_) < -1e7` and `novelty=False`
- Warning must be a `UserWarning` with message: "Duplicate values are leading to incorrect results. Increase the number of neighbors for more accurate results."
- When fitting `LocalOutlierFactor` on data with many duplicates causing extreme scores, a warning is raised
- When no problematic duplicates exist, no warning is raised

---

### FR12: `KNNImputer` Column Filtering for All-NaN Training Columns

**Problem**: `KNNImputer` incorrectly checks for missing values across all columns instead of only valid (non-all-NaN training) columns during transform.

**Requirements**:
- Filter missing value checks to only consider columns that were valid during training
- Skip imputation computation when no valid columns have missing values

**Acceptance**:
- When transforming data where only columns that were all-NaN during training have missing values, imputation is skipped efficiently
- When valid columns have missing values, imputation proceeds normally

---

### FR13: `PLSRegression` Invalid `n_components` Error

**Problem**: `PLSRegression` does not properly validate `n_components` upper bound when the number of samples is less than the number of features.

**Requirements**:
- Update `n_components` upper bound calculation to consider minimum of samples and features for regression deflation mode
- Raise appropriate error when `n_components` exceeds the valid upper bound

**Acceptance**:
- When `PLSRegression(n_components=k)` is used with `k > min(n_samples, n_features)`, a clear error is raised
- The error message indicates the correct upper bound

---

### FR14: `RepeatedStratifiedKFold.split` Error Message Improvement

**Problem**: `RepeatedStratifiedKFold.split` produces an unclear error message when called without the `y` argument.

**Requirements**:
- Validate `y` parameter in `RepeatedStratifiedKFold.split` before proceeding
- Provide clear error message when `y` is missing

**Acceptance**:
- `RepeatedStratifiedKFold.split(X, y, groups=None)` must override the base class `split` method
- The `y` parameter must be validated using `check_array(y, input_name="y", ensure_2d=False, dtype=None)` before calling `super().split()`
- When `split` is called without `y`, an informative error message is raised
- The error clearly indicates that `y` is required for stratification

---

### FR15: `roc_auc_score` and `det_curve` Single Class Handling Consistency

**Problem**: `roc_auc_score` raises an error when only one class is present in `y_true`, which is inconsistent with `roc_curve` behavior and prevents use in cross-validation scenarios where some folds may have single-class data. Similarly, `det_curve` should provide a clear error message for single-class input.

**Requirements**:
- When only one class is present in `y_true`, emit an `UndefinedMetricWarning` instead of raising an error for `roc_auc_score`
- Return `0.0` as the score when the metric is undefined due to single class
- For `det_curve`, raise a `ValueError` with message "Only one class is present in y_true" when only one class exists

**Acceptance**:
- When `roc_auc_score` is called with single-class `y_true`, a warning is emitted and 0.0 is returned
- When `roc_curve` and `roc_auc_score` are both called with single-class data, both handle it gracefully
- When `det_curve` is called with single-class `y_true`, a `ValueError` is raised with message containing "Only one class is present in y_true"

---

### FR16: Estimator Checks API/Legacy Categorization

**Problem**: Estimator checks in `check_estimator` and `parametrize_with_checks` are not categorized, making it difficult to distinguish between API compatibility checks and legacy checks.

**Requirements**:
- Categorize estimator checks into "API" checks and "legacy" checks
- Add `legacy` parameter (default `True`) to `check_estimator` and `parametrize_with_checks`
- API checks include: `check_no_attributes_set_in_init`, `check_fit_score_takes_y`, `check_estimators_overwrite_params`
- When `legacy=False`, only run API checks

**Acceptance**:
- `check_estimator(estimator=None, generate_only=False, *, legacy=True)` must accept `legacy` as keyword-only parameter
- `parametrize_with_checks(estimators, *, legacy=True)` must accept `legacy` as keyword-only parameter
- Internal function `_yield_all_checks(estimator, legacy: bool)` must accept `legacy` parameter
- API checks must be yielded from separate `_yield_api_checks(estimator)` function
- API checks must include: `check_no_attributes_set_in_init`, `check_fit_score_takes_y`, `check_estimators_overwrite_params`
- When `check_estimator(legacy=True)` is called, all checks run (API + legacy)
- When `check_estimator(legacy=False)` is called, only API checks run
- When `parametrize_with_checks(legacy=False)` is used, only API checks are parametrized

---

### FR17: F-Contiguous Array Common Estimator Test

**Problem**: Some estimators fail silently or produce incorrect results when given F-contiguous (column-major) array input.

**Requirements**:
- Add `check_f_contiguous_array_estimator` to common estimator tests
- Verify estimators can fit and predict/transform with F-contiguous arrays

**Acceptance**:
- Function `check_f_contiguous_array_estimator(name, estimator_orig)` must be added to `sklearn.utils.estimator_checks`
- The check must create F-contiguous arrays using `np.asfortranarray(X)`
- The check must be yielded from `_yield_checks(estimator)` in the standard check suite
- When `check_f_contiguous_array_estimator` runs on an estimator, it verifies fit, transform, and predict work with F-contiguous arrays

---

### FR18: `SGDOneClassSVM` Inheritance Order Fix

**Problem**: `SGDOneClassSVM` has incorrect method resolution order (MRO) due to base class ordering, causing issues with inherited methods.

**Requirements**:
- Correct the inheritance order to `OutlierMixin, BaseSGD` from `BaseSGD, OutlierMixin`

**Acceptance**:
- When `SGDOneClassSVM` methods are called, proper MRO is followed
- No attribute resolution errors occur from incorrect inheritance

---

### FR19: Parameter Name Typo Fix

**Problem**: Internal function `_prepare_fit_binary` has a typo in parameter name `input_dtye` instead of `input_dtype`.

**Requirements**:
- Rename parameter from `input_dtye` to `input_dtype`

**Acceptance**:
- The parameter is correctly named `input_dtype`
- No functional changes in behavior

---

### FR20: Pretty Printer Parameter Parsing Simplification

**Problem**: The estimator pretty printer uses unnecessary `OrderedDict` for parameter sorting.

**Requirements**:
- Simplify parameter parsing by removing `OrderedDict` usage
- Use direct `sorted()` on parameter items

**Acceptance**:
- Estimator pretty printing produces the same output
- Code is simplified without functional changes

---

### FR21: `HTMLDocumentationLinkMixin` URL Parameter Generator Fix

**Problem**: `_doc_link_url_param_generator` is called with `self` as argument when it should be called as a bound method without arguments.

**User Report**:
```
When overriding `_doc_link_url_param_generator` on an instance, the URL generation fails because the method is called incorrectly.
```

**Requirements**:
- Call `_doc_link_url_param_generator()` without passing `self` explicitly
- Update documentation examples to show correct usage with `types.MethodType` for instance overrides

**Acceptance**:
- `_get_doc_link()` must call `self._doc_link_url_param_generator()` without passing `self` explicitly
- When `_doc_link_url_param_generator` is defined as a class attribute function, it receives `self` automatically as first argument
- When overriding on an instance, `types.MethodType(url_param_generator, instance)` must be used to bind the method
- Documentation examples demonstrate proper usage with `types.MethodType` for instance overrides

---

### FR22: `GridSearchCV` Heterogeneous Parameter Grid Fix

**Problem**: `GridSearchCV` fails when parameter grid contains heterogeneous values that cause `numpy.result_type` to raise a `ValueError`.

**Requirements**:
- Handle `ValueError` in addition to `TypeError` when determining array dtype for parameter results
- Fall back to `object` dtype when type inference fails

**Acceptance**:
- In `BaseSearchCV._store_results`, the `except TypeError:` must be changed to `except (TypeError, ValueError):` when catching `np.result_type` failures
- When parameter grid contains heterogeneous values (e.g., estimator objects and strings), `GridSearchCV` completes without error
- Parameter values are correctly stored in `cv_results_` with `object` dtype when type inference fails

---

### FR23: `make_sparse_spd_matrix` Deprecation Cleanup

**Problem**: The deprecated `dim` parameter in `make_sparse_spd_matrix` needs to be removed and `n_dim` should have a proper default value.

**Requirements**:
- Remove deprecated `dim` parameter
- Set `n_dim` default value to `1` (previously `None` with deprecation handling)
- Update parameter validation to only accept `n_dim`

**Acceptance**:
- `make_sparse_spd_matrix(n_dim=1, *, alpha=0.95, norm_diag=False, smallest_coef=0.1, largest_coef=0.9, sparse_format=None, random_state=None)` must have `n_dim` default value of `1`
- The `dim` parameter must be completely removed from the function signature
- The `@validate_params` decorator must not include `dim` in the parameter schema
- When calling `make_sparse_spd_matrix()` with no arguments, `n_dim=1` is used
- When calling `make_sparse_spd_matrix(dim=...)`, a `TypeError` is raised (parameter no longer exists)
- When calling `make_sparse_spd_matrix(n_dim=k)`, the function works correctly

---

### FR24: `_CurveScorer` Module Relocation

**Problem**: `_CurveScorer` class is defined in `model_selection._classification_threshold` but is more appropriately located in the metrics module with other scorer classes.

**Requirements**:
- Move `_CurveScorer` class to `sklearn.metrics._scorer` (pure code migration, preserve existing API exactly)
- Move `_threshold_scores_to_class_labels` helper function to `sklearn.metrics._scorer`
- Update imports in `model_selection._classification_threshold`

**Note**: This is a pure code relocation task. The `_CurveScorer` class and `_threshold_scores_to_class_labels` function must be moved verbatim from their current location in `sklearn/model_selection/_classification_threshold.py` to `sklearn/metrics/_scorer.py`, preserving all existing functionality, method signatures, and behavior exactly as-is.

**Acceptance**:
- `_CurveScorer` class must be defined in `sklearn.metrics._scorer` module (moved from `model_selection._classification_threshold`)
- `_threshold_scores_to_class_labels` helper function must be defined in `sklearn.metrics._scorer` module
- `sklearn.model_selection._classification_threshold` must import `_CurveScorer` and `_threshold_scores_to_class_labels` from `sklearn.metrics._scorer`
- When importing from `sklearn.metrics._scorer`, `_CurveScorer` is available
- When using `TunedThresholdClassifierCV`, all functionality works via the relocated class
- All existing tests for `_CurveScorer` and `TunedThresholdClassifierCV` must continue to pass without modification

---

### FR25: `ColumnTransformer` Performance Optimization

**Problem**: `ColumnTransformer` passes full input data to transformers even when only specific columns are selected, causing performance regression.

**Requirements**:
- Pre-slice input data to selected columns before passing to transformer workers
- Avoid redundant column selection inside worker functions

**Acceptance**:
- In `ColumnTransformer._call_func_on_transformers`, data must be pre-sliced using `_safe_indexing(X, columns, axis=1)` before passing to transformer workers
- The `columns` parameter must not be passed to worker functions; only pre-sliced `X` is passed
- When `ColumnTransformer` transforms data, only selected columns are passed to each transformer
- Performance is improved for large datasets with column selection

---

### FR26: Refactor `GridSearchCV` Parameter Result Construction

**Problem**: The inline code in `BaseSearchCV._format_results` that converts parameter grids to masked arrays uses `np.result_type` and `np.min_scalar_type` for dtype inference. These fail with `ValueError` when parameter grids contain values of varying array sizes (e.g., lists `[1, 2, 3]` and `[1, 2]` as different candidates for the same hyperparameter). This causes `GridSearchCV` to crash during `cv_results_` construction even though the search itself completed successfully.

**Requirements**:
- Extract the parameter-to-masked-array conversion logic from `BaseSearchCV._format_results` into a dedicated generator function
- The function must handle parameters with different-length sequences, mixed types (strings, estimators, tuples), and partial presence across candidates
- Replace fragile dtype inference with numpy's natural type deduction via `np.array()`, falling back to `object` dtype when conversion fails

**Acceptance**:
- Define function `_yield_masked_array_for_each_param(candidate_params)` in `sklearn/model_selection/_search.py`
- The function is a generator that takes a sequence of parameter dicts (one per candidate) and yields `(key, MaskedArray)` tuples
  - Keys are prefixed with `"param_"` (e.g., parameter name `"foo"` → key `"param_foo"`)
  - Each `MaskedArray` has length equal to the number of candidates
  - Entries where a parameter is not present for a candidate are masked
  - When parameter values are strings or would create a multi-dimensional array (e.g., same-length tuples), `object` dtype is used
  - When parameter values contain sequences of different lengths, `object` dtype is used (caught via `ValueError` from `np.array()`)
- `BaseSearchCV._format_results` must call this function to populate parameter entries in `cv_results_`
- The function must not emit `RuntimeWarning` even with large numbers of candidates (e.g., 1000)

---

### FR27: Lazy `ThreadpoolController` Initialization

**Problem**: scikit-learn eagerly instantiates a `ThreadpoolController()` object at import time in `sklearn/__init__.py`, which forces loading numpy, scipy, and threadpoolctl before any user code can run. This adds unnecessary startup latency for users who only need lightweight operations (e.g., checking the version number or importing a single estimator class).

**Requirements**:
- Move the `ThreadpoolController` from eager instantiation at import time to a lazy singleton pattern in `sklearn/utils/parallel.py`
- Remove the eager imports of numpy and scipy from `sklearn/__init__.py` that existed solely to ensure BLAS libraries were loaded before the controller was created
- Provide a decorator alternative to the old `_threadpool_controller.wrap(...)` pattern that also defers library loading to call time

**Acceptance**:
- Define `_get_threadpool_controller()` function in `sklearn/utils/parallel.py`: returns a module-level `ThreadpoolController()` instance, created lazily on first call and reused thereafter (singleton pattern via a global variable `_threadpool_controller`)
- Define `_threadpool_controller_decorator(limits=1, user_api="blas")` decorator in the same module: wraps a function to execute within a threadpool limit context, calling `_get_threadpool_controller()` internally. This replaces the old `_threadpool_controller.wrap(...)` pattern
- Remove `from threadpoolctl import ThreadpoolController` and `_threadpool_controller = ThreadpoolController()` from `sklearn/__init__.py`
- Remove the `import numpy` and `import scipy.linalg` lines from `sklearn/__init__.py` that were there only for ThreadpoolController initialization
- Update Python call sites:
  - `sklearn/cluster/_kmeans.py`: replace `_threadpool_controller.wrap(...)` decorators with `_threadpool_controller_decorator(...)`, replace `_threadpool_controller.info()` with `_get_threadpool_controller().info()`, replace `_threadpool_controller.limit(...)` context managers with `_get_threadpool_controller().limit(...)`
  - `sklearn/utils/fixes.py`: replace `sklearn._threadpool_controller.info()` with `_get_threadpool_controller().info()`

---

### FR28: Forward Compatibility Placeholders

**Problem**: Since FR1 (license standardization) modifies many source files across the codebase, these modified files will be present in subsequent development environments. Some test modules import symbols that are defined in later milestones. If those symbols are missing from files that this milestone modifies, import errors will occur during testing of other components.

**Requirements**:
- In files modified by this milestone, add minimal placeholder definitions for symbols that will be fully implemented in later milestones
- Placeholders should be functional enough to prevent `ImportError` but may raise `NotImplementedError` if called

**Acceptance**:
- In `sklearn/base.py`, add a function `is_clusterer(estimator)` that returns `True` if `getattr(estimator, "_estimator_type", None) == "clusterer"`, `False` otherwise. This mirrors the existing `is_classifier` and `is_regressor` pattern
- In `sklearn/utils/__init__.py`, if the file is modified for license changes, ensure that `get_tags` is importable from this module. Add a compatibility bridge: `from ._tags import get_tags` (where `get_tags` in `_tags.py` falls back to `_safe_tags` if the new tag system is not yet implemented)

---

## Test Coverage

The following test categories validate the requirements:

- **Dataset tests**: `sklearn/datasets/tests/test_base.py` - covers FR2 (fetch_file)
- **Model selection tests**: `sklearn/model_selection/tests/test_split.py` - covers FR3 (GroupKFold shuffle)
- **Metrics tests**: `sklearn/metrics/tests/test_classification.py` - covers FR4 (cohen_kappa_score zero_division)
- **Scoring tests**: `sklearn/metrics/tests/test_score_objects.py` - covers FR7 (neg_max_error deprecation)
- **Column transformer tests**: `sklearn/compose/tests/test_column_transformer.py` - covers FR5 (verbose_feature_names_out)
- **Sequential feature selector tests**: `sklearn/feature_selection/tests/test_sequential.py` - covers FR6 (metadata routing)
- **Ridge tests**: `sklearn/linear_model/tests/test_ridge.py` - covers FR8, FR9 (coef_ shape, multioutput scoring)
- **SVM tests**: `sklearn/svm/tests/test_svm.py` - covers FR10 (infinite C)
- **LOF tests**: `sklearn/neighbors/tests/test_lof.py` - covers FR11 (duplicate values warning)
- **PLS tests**: `sklearn/cross_decomposition/tests/test_pls.py` - covers FR13 (n_components validation)
- **Ranking tests**: `sklearn/metrics/tests/test_ranking.py` - covers FR15 (roc_auc_score single class)
- **Estimator checks tests**: `sklearn/utils/tests/test_estimator_checks.py` - covers FR16, FR17 (check categorization, F-contiguous)
- **HTML repr tests**: `sklearn/utils/tests/test_estimator_html_repr.py` - covers FR21 (doc link mixin)
- **Search tests**: `sklearn/model_selection/tests/test_search.py` - covers FR22 (heterogeneous param grid)
- **Metaestimator routing tests**: `sklearn/tests/test_metaestimators_metadata_routing.py` - covers FR6 (SequentialFeatureSelector routing)


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
