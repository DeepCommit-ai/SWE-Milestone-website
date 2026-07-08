# Software Requirements Specification: M12.5 - Tags System and Validation Phase 4a

## Overview

This milestone addresses multiple enhancements and bug fixes across scikit-learn's validation, imputation, clustering, metadata routing, and model selection modules. The requirements span:

1. **FR1**: Add `force_writeable` parameter to `check_array` for read-only input handling
2. **FR2**: Fix `IterativeImputer` skipping iterative process when `keep_empty_features=True`
3. **FR3**: Fix `MeanShift` convergence criterion for constant data
4. **FR4**: Add metadata routing support to CV splitters in `RidgeCV` and `RidgeClassifierCV`
5. **FR5**: Exclude internal optimization parameters from metadata routing mechanism
6. **FR6**: Add `prefit` parameter to `FixedThresholdClassifier`
7. **FR7**: Enforce `ValueError` for `pandas.NA` in `ColumnTransformer` output
8. **FR8**: Update `SequentialFeatureSelector` error message for negative tolerance
9. **FR9**: Remove deprecated `metric=None` option from `FeatureAgglomeration`
10. **FR10**: Migrate estimator tag system from dictionaries to structured dataclasses

**Affected Modules**:
- `sklearn.utils.validation`
- `sklearn.utils._tags`
- `sklearn.utils.estimator_checks`
- `sklearn.utils._test_common`
- `sklearn.base`
- `sklearn.impute`
- `sklearn.cluster`
- `sklearn.linear_model`
- `sklearn.model_selection`
- `sklearn.compose`
- `sklearn.feature_selection`
- `sklearn.preprocessing`
- `sklearn.tree`
- `sklearn.feature_extraction`
- `sklearn.covariance`
- `sklearn.decomposition`
- `sklearn.cross_decomposition`
- `sklearn.isotonic`

---

## Requirements

### FR1: Add `force_writeable` Parameter to `check_array`

**Problem**: Estimators that perform in-place operations fail when receiving read-only input arrays (such as DataFrames backed by read-only buffers or memory-mapped arrays), causing unexpected errors during fitting or transformation.

**User Report**:
```
When passing a DataFrame backed by a read-only buffer to estimators like StandardScaler
or MinMaxScaler, an unexpected error is raised. This commonly occurs when using joblib
for parallel processing, which creates read-only memory-maps of large arrays.
```

**Requirements**:
- Add a new `force_writeable` parameter to `check_array` and `check_X_y` functions
- When `force_writeable=True`, guarantee the returned array is writeable, making a copy if necessary
- When `force_writeable=False` (default), preserve the writeability state of the input array
- Handle pandas DataFrames correctly, accounting for copy-on-write semantics in pandas 3.x
- Update estimators that perform in-place operations to use `force_writeable=True`

**Acceptance**:
- `check_array()` must accept parameter `force_writeable: bool = False`
- `check_X_y()` must accept parameter `force_writeable: bool = False`
- When `check_array` receives a read-only numpy array with `force_writeable=True`, it returns a writeable copy (verified via `np.may_share_memory()` returning `False` and `out.flags.writeable` being `True`)
- When `check_array` receives a writeable numpy array with `force_writeable=True`, it returns the same array without copying (verified via `np.may_share_memory()` returning `True`)
- When `check_array` receives a read-only memory-mapped array (created via `create_memmap_backed_data` with `mmap_mode="r"`) with `force_writeable=True`, it returns a writeable copy
- When `check_array` receives a writeable memory-mapped array (created with `mmap_mode="w+"`) with `force_writeable=True`, no copy is made
- When `check_array` receives a DataFrame backed by a read-only array with `force_writeable=True`, it returns a writeable array
- When `check_array` receives a DataFrame backed by a writeable array with `force_writeable=True`, no copy is made
- Estimators that perform in-place operations (e.g., `StandardScaler`, `MinMaxScaler` with `copy=False`) must use `force_writeable=True` internally so they can operate on read-only input without error and without modifying the original input array
- Add a new function `check_inplace_ensure_writeable(name, estimator_orig)` in `sklearn.utils.estimator_checks` module to verify that estimators handle read-only input correctly:
  - The function must be exported (importable) from `sklearn.utils.estimator_checks`
  - It should create a read-only input array using `X.setflags(write=False)`
  - Call `fit(X, y)` and optionally `transform(X)` on the estimator
  - Verify the original array remains unmodified and read-only after the operations

---

### FR2: Fix `IterativeImputer` Skipping Iterative Process with Empty Features

**Problem**: `IterativeImputer` incorrectly skips the iterative imputation process when `keep_empty_features=True` is set, resulting in incomplete imputation.

**User Report**:
```
When using IterativeImputer with keep_empty_features=True, the imputer skips the
iterative process entirely. The expected behavior is that empty features (columns
with all missing values) should be preserved and imputed with the initial imputation
value, while other columns should still go through the iterative imputation process.
```

**Requirements**:
- Ensure `IterativeImputer` correctly identifies empty features during fitting
- When `keep_empty_features=False`, drop empty features from both input and output
- When `keep_empty_features=True`, preserve empty features in output, imputing them with the initial imputation value
- The iterative process must still run for non-empty features regardless of the `keep_empty_features` setting
- Handle the special case where `initial_strategy="constant"` preserves empty features differently
- Ensure consistent behavior between `fit_transform` and `transform`

**Acceptance**:
- `IterativeImputer` must track empty features via an internal attribute `_is_empty_feature` (a boolean array indicating which columns are all-missing)
- When `keep_empty_features=True` on data with no empty features, `fit_transform()` results must match `keep_empty_features=False` results exactly (via `assert_allclose`)
- When `keep_empty_features=True` on data with empty features:
  - Empty feature columns are preserved in output
  - Empty feature values are filled with the initial imputation value (e.g., `fill_value` when `initial_strategy="constant"`, or 0 for other strategies with appropriate data)
  - For training data, `X_keep_empty[:, 0]` (the empty column) should equal the fill value
  - For training data, `X_keep_empty[:, 1:]` should equal `X_drop_empty` (via `assert_allclose`)
- When `keep_empty_features=False` on data with empty features, empty feature columns are dropped
- `fit_transform()` and `transform()` must produce outputs with consistent shapes: `X_train.shape[1] == X_test.shape[1]` for both settings of `keep_empty_features`

---

### FR3: Fix `MeanShift` Convergence Criterion for Constant Data

**Problem**: `MeanShift` clustering fails to converge when applied to constant (identical) data points, reaching the maximum iteration limit instead of recognizing convergence.

**User Report**:
```
When fitting MeanShift on 1D constant data (e.g., all values are 1.0), the algorithm
does not converge properly and runs until max_iter is reached. The convergence check
should recognize that the mean has not changed between iterations.
```

**Requirements**:
- Fix the convergence criterion in the mean shift single seed iteration
- The algorithm should recognize convergence when the mean shift distance is exactly zero (constant data case)
- Convergence should be detected in fewer iterations than `max_iter` for constant data

**Acceptance**:
- The convergence check in `_mean_shift_single_seed` must use `<=` (less than or equal) instead of `<` for the stop threshold comparison, i.e., `np.linalg.norm(my_mean - my_old_mean) <= stop_thresh`
- `MeanShift` must expose `n_iter_` attribute after fitting
- When fitting `MeanShift` on 1D constant data (e.g., `np.ones(10).reshape(-1, 1)`), `n_iter_` must be less than `max_iter`
- The clustering result is valid and does not raise errors

---

### FR4: Add Metadata Routing to CV Splitters in `RidgeCV` and `RidgeClassifierCV`

**Problem**: When using `RidgeCV` or `RidgeClassifierCV` with group-based CV splitters (like `GroupKFold`) and metadata routing enabled, groups are not correctly routed to the splitter, causing errors.

**User Report**:
```
When using RidgeCV with GroupKFold and metadata routing enabled, passing groups
to fit() raises "ValueError: The 'groups' parameter should not be None" or
UnsetMetadataPassedError when using default scoring.
```

**Requirements**:
- Add CV splitter to the metadata routing mechanism in `RidgeCV` and `RidgeClassifierCV`
- Route groups and other metadata correctly to the CV splitter's `split` method
- Fix the default scoring case where `UnsetMetadataPassedError` is raised
- When using default scoring (None), internally configure the scorer to accept `sample_weight`

**Acceptance**:
- `RidgeCV` and `RidgeClassifierCV` `get_metadata_routing()` must return a router that includes the CV splitter with method mapping `caller="fit", callee="split"`
- The `_get_scorer()` method must call `scorer.set_score_request(sample_weight=True)` when metadata routing is enabled and `self.scoring is None` (default scoring)
- When `RidgeCV` is configured with `GroupKFold` (e.g., `cv=GroupKFold(n_splits=2)`) and metadata routing is enabled, groups passed to `cross_validate(..., params={"groups": groups})` must be correctly routed during `fit` without raising `ValueError: The 'groups' parameter should not be None`
- When `RidgeClassifierCV` is used with default scoring (`scoring=None`) and `sample_weight` is passed to `fit()`, no `UnsetMetadataPassedError` is raised
- When nested in `cross_validate` with group-based CV, groups are routed correctly to both inner and outer CV splitters

---

### FR5: Exclude Internal Optimization Parameters from Metadata Routing

**Problem**: Method arguments intended for internal optimization (like `check_input`, `raw_X`, `raw_documents`, `K`, `T`, `X_test`) incorrectly appear in the metadata routing mechanism, generating unnecessary `set_{method}_request` methods.

**Requirements**:
- Mark internal optimization parameters as `UNUSED` in the metadata routing mechanism
- Affected estimators include: `ElasticNet`, `DecisionTreeClassifier`, `DecisionTreeRegressor`, `IncrementalPCA`, `FeatureHasher`, `CountVectorizer`, `DictVectorizer`, `KernelCenterer`, `IsotonicRegression`, `EmpiricalCovariance`
- Parameters to exclude: `check_input`, `raw_X`, `raw_documents`, `K`, `T`, `X_test`, `dict_type`

**Acceptance**:
- Internal optimization parameters must be marked as `UNUSED` using the `__metadata_request__{method}` class attribute pattern with `metadata_routing.UNUSED`
- Specific mappings required:
  - `DecisionTreeClassifier`: `__metadata_request__predict_proba = {"check_input": metadata_routing.UNUSED}`, `__metadata_request__fit = {"check_input": metadata_routing.UNUSED}`
  - `DecisionTreeRegressor`: `__metadata_request__fit = {"check_input": metadata_routing.UNUSED}`
  - `BaseDecisionTree`: `__metadata_request__predict = {"check_input": metadata_routing.UNUSED}`
  - `ElasticNet`: `__metadata_request__fit = {"check_input": metadata_routing.UNUSED}`
  - `IncrementalPCA`: `__metadata_request__partial_fit = {"check_input": metadata_routing.UNUSED}`
  - `FeatureHasher`: `__metadata_request__transform = {"raw_X": metadata_routing.UNUSED}`
  - `CountVectorizer`: `__metadata_request__fit = {"raw_documents": metadata_routing.UNUSED}`, `__metadata_request__transform = {"raw_documents": metadata_routing.UNUSED}`
  - `DictVectorizer`: `__metadata_request__inverse_transform = {"dict_type": metadata_routing.UNUSED}`
  - `KernelCenterer`: `__metadata_request__transform = {"K": metadata_routing.UNUSED}`, `__metadata_request__fit = {"K": metadata_routing.UNUSED}`
  - `IsotonicRegression`: `__metadata_request__predict = {"T": metadata_routing.UNUSED}`, `__metadata_request__transform = {"T": metadata_routing.UNUSED}`
  - `EmpiricalCovariance`: `__metadata_request__score = {"X_test": metadata_routing.UNUSED}`
- All estimator checks pass after the changes

---

### FR6: Add `prefit` Parameter to `FixedThresholdClassifier`

**Problem**: `FixedThresholdClassifier` always clones and refits the base estimator, even when the user has already fitted the estimator and wants to use it directly.

**Requirements**:
- Add a `prefit` boolean parameter to `FixedThresholdClassifier` (default `False`)
- When `prefit=True`, skip cloning and fitting the estimator; use the passed estimator directly
- When `prefit=True`, verify that the passed estimator is already fitted (raise `NotFittedError` if not)
- When `prefit=False`, maintain current behavior (clone and fit the estimator)

**Acceptance**:
- `FixedThresholdClassifier.__init__()` must accept parameter `prefit: bool = False`
- The `_parameter_constraints` dict must include `"prefit": ["boolean"]`
- When `prefit=True` and estimator is already fitted, `fit()` must assign `self.estimator_ = self.estimator` directly (same object reference, no cloning)
- When `prefit=True` and estimator is not fitted, `NotFittedError` is raised during `fit` (verified via `check_is_fitted(self.estimator)`)
- When `prefit=False`, the estimator is cloned and fitted normally via `clone(self.estimator).fit(...)`
- The `estimator_` attribute references the same object as the passed estimator when `prefit=True` (i.e., `clf.estimator_ is clf.estimator`)

---

### FR7: Enforce `ValueError` for `pandas.NA` in `ColumnTransformer` Output

**Problem**: `ColumnTransformer` only issues a `FutureWarning` when transformer output contains `pandas.NA` values, which causes downstream errors when converting to numpy arrays.

**Requirements**:
- Replace the `FutureWarning` with a `ValueError` when transformer output contains `pandas.NA`
- The error message should suggest solutions: (i) use `set_output(transform='pandas')` or (ii) modify the transformer to avoid `pandas.NA`
- No error should be raised when output is configured as pandas DataFrame

**Acceptance**:
- When transformer output contains `pandas.NA` (with pandas extension dtypes like `Float64Dtype`) and output is default (numpy), `ValueError` must be raised (not `FutureWarning`)
- The error message must contain the text `set_output(transform='pandas')` to guide users toward the solution
- When output is set to pandas via `set_output(transform='pandas')`, no error is raised
- When transformer output has no `pandas.NA` values (e.g., using `fillna(-1.0)` on the DataFrame), no error is raised
- When using non-extension dtypes with `np.nan` (not `pd.NA`), no warning or error should be raised

---

### FR8: Update `SequentialFeatureSelector` Error Message for Negative Tolerance

**Problem**: The error message for negative `tol` parameter in forward selection is ambiguous, stating "must be positive" which could be interpreted as "non-negative".

**Requirements**:
- Update the error message to explicitly state "strictly positive" for forward selection
- Update the documentation to clarify this requirement

**Acceptance**:
- When `SequentialFeatureSelector.fit()` is called with `tol < 0` and `direction="forward"`, a `ValueError` must be raised
- The error message must contain the exact text `"tol must be strictly positive"` (not just `"must be positive"`)

---

### FR9: Remove Deprecated `metric=None` Option from `FeatureAgglomeration`

**Problem**: The `metric=None` option in `FeatureAgglomeration` was deprecated in version 1.4 and scheduled for removal in 1.6.

**Requirements**:
- Remove `Hidden(None)` from the `metric` parameter constraints in `FeatureAgglomeration`
- Remove the deprecation warning from the documentation
- Passing `metric=None` should now raise a validation error

**Acceptance**:
- The `_parameter_constraints` dict for `FeatureAgglomeration` must NOT include `Hidden(None)` in the `"metric"` constraint list
- When `metric=None` is passed to `FeatureAgglomeration`, a parameter validation error is raised (since `None` is no longer a valid option)
- Documentation no longer mentions the deprecated `metric=None` option

---

### FR10: Migrate Estimator Tag System to Structured Dataclasses

**Problem**: The current estimator tag system uses untyped dictionaries via `_more_tags()` and `_get_tags()` methods, accessed through `_safe_tags()`. This approach lacks type safety, makes tag discovery difficult, and provides no IDE autocompletion. Tag keys like `"binary_only"`, `"multilabel"`, and `"requires_y"` are magic strings with no formal schema, making it easy to introduce typos or use obsolete keys.

**Requirements**:
- Replace the dictionary-based tag system with a hierarchy of typed dataclasses defined in `sklearn/utils/_tags.py`
- Provide public functions `default_tags(estimator)` and `get_tags(estimator)` as the standard API for tag retrieval
- Add `__sklearn_tags__()` method to `BaseEstimator` as the new override point, replacing `_more_tags()`
- Migrate all internal tag consumers from `_safe_tags()`/`_get_tags()` to `get_tags()`
- Add new API-level estimator checks that validate clone, repr, and tag migration
- Export all tag types and functions from `sklearn.utils`

**Acceptance**:
- **Tag dataclass hierarchy** (all `@dataclass` classes in `sklearn/utils/_tags.py`):
  - `InputTags`: `one_d_array: bool = False`, `two_d_array: bool = True`, `three_d_array: bool = False`, `sparse: bool = False`, `categorical: bool = False`, `string: bool = False`, `dict: bool = False`, `positive_only: bool = False`, `allow_nan: bool = False`, `pairwise: bool = False`
  - `TargetTags`: `required: bool` (no default — must be explicitly provided), `one_d_labels: bool = False`, `two_d_labels: bool = False`, `positive_only: bool = False`, `multi_output: bool = False`, `single_output: bool = True`
  - `ClassifierTags`: `poor_score: bool = False`, `multi_class: bool = True`, `multi_label: bool = False`
  - `RegressorTags`: `poor_score: bool = False`, `multi_label: bool = False`
  - `TransformerTags`: `preserves_dtype: list[str]` defaulting to `["float64"]`
  - `Tags`: `target_tags: TargetTags`, `transformer_tags: TransformerTags | None`, `classifier_tags: ClassifierTags | None`, `regressor_tags: RegressorTags | None`, `array_api_support: bool = False`, `no_validation: bool = False`, `non_deterministic: bool = False`, `requires_fit: bool = True`, `_skip_test: bool = False`, `_xfail_checks: dict[str, str]` (default empty dict), `input_tags: InputTags` (default `InputTags()`)
- **`default_tags(estimator) -> Tags`**: returns a `Tags` instance with automatic type detection:
  - `target_tags.required = True` if the estimator is a classifier or regressor
  - `transformer_tags = TransformerTags()` if the estimator has `transform` or `fit_transform`, else `None`
  - `classifier_tags = ClassifierTags()` if the estimator is a classifier, else `None`
  - `regressor_tags = RegressorTags()` if the estimator is a regressor, else `None`
- **`get_tags(estimator) -> Tags`**: calls `estimator.__sklearn_tags__()` if available; otherwise falls back to `default_tags(estimator)`
- **`BaseEstimator.__sklearn_tags__(self)`** returns `default_tags(self)`. Subclasses override this method by calling `super().__sklearn_tags__()` and modifying the returned `Tags` instance, replacing the old `_more_tags()` pattern
- All six dataclass types (`Tags`, `InputTags`, `TargetTags`, `ClassifierTags`, `RegressorTags`, `TransformerTags`) and both functions (`default_tags`, `get_tags`) must be exported from `sklearn.utils` and listed in `__all__`
- **New estimator checks** (in `sklearn/utils/estimator_checks.py`, yielded from `_yield_api_checks`):
  - `check_estimator_tags_renamed(name, estimator_orig)`: if an estimator does NOT have `__sklearn_tags__`, assert it also has no `_more_tags` or `_get_tags` (enforcing migration to the new system). If `__sklearn_tags__` is present, old methods are tolerated for multi-version backward compatibility
  - `check_estimator_cloneable(name, estimator_orig)`: verify `clone(estimator_orig)` does not raise
  - `check_estimator_repr(name, estimator_orig)`: verify `repr(clone(estimator_orig))` does not raise
  - `check_classifier_not_supporting_multiclass(name, estimator_orig)`: for classifiers whose `tags.classifier_tags.multi_class` is `False`, verify `fit()` on multiclass data raises `ValueError` with message containing "Only binary classification is supported."
- **`_construct_instances(Estimator)`** generator (in `sklearn/utils/_test_common/instance_generator.py`): replaces old `_construct_instance()`. Yields one or more estimator instances from an `INIT_PARAMS` dict keyed by estimator class. If the value is a list of param dicts, yield one instance per set; otherwise yield `Estimator()` with default params
- **`_NotAnArray.__array_function__`** (in `sklearn/utils/estimator_checks.py`): update to return `True` for `may_share_memory`; raise `TypeError` for all other array protocol functions


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
