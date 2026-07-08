# Software Requirements Specification: M12.3 - Infrastructure Foundation Phase 3a

## Overview

This milestone encompasses several categories of changes to the scikit-learn library:

1. **FR1**: Add `zero_division` parameter to `matthews_corrcoef` metric
2. **FR2**: Add metadata routing support to `permutation_test_score`
3. **FR3**: Deprecate `cv="prefit"` in `CalibratedClassifierCV` in favor of `FrozenEstimator`
4. **FR4**: Complete `categorical_features` default change in Histogram Gradient Boosting estimators
5. **FR5**: Remove deprecated `loss_function_` attribute from SGD-based classifiers
6. **FR6**: Handle deprecation of `sokalmichener` metric from SciPy
7. **FR7**: Add validation for 1D sparse arrays in `check_array`
8. **FR8**: Drop official PyPy support
9. **FR9**: Create `FrozenEstimator` meta-estimator module

**Affected Modules**:
- `sklearn.metrics._classification`
- `sklearn.model_selection._validation`
- `sklearn.calibration`
- `sklearn.frozen`
- `sklearn.ensemble._hist_gradient_boosting`
- `sklearn.linear_model._stochastic_gradient`
- `sklearn.metrics._dist_metrics`
- `sklearn.metrics.pairwise`
- `sklearn.neighbors._base`
- `sklearn.utils.validation`
- `sklearn.utils.fixes`

---

## Requirements

### FR1: Add `zero_division` Parameter to Matthews Correlation Coefficient

**Problem**: The `matthews_corrcoef` function silently returns 0.0 when the metric is undefined due to zero division (all predictions and labels are negative), providing no mechanism for users to customize this behavior or be warned.

**Requirements**:
- Add a `zero_division` parameter to the `matthews_corrcoef` function that controls the return value when the metric is undefined
- The parameter must accept values: `"warn"` (default), `0.0`, `1.0`, and `np.nan`
- When `zero_division="warn"`, return 0.0 and emit an `UndefinedMetricWarning` indicating the metric is ill-defined
- When `zero_division` is set to a numeric value or `np.nan`, return that value without warning
- Validate the parameter value using existing parameter validation infrastructure

**Acceptance**:
- `matthews_corrcoef()` signature: `matthews_corrcoef(y_true, y_pred, *, sample_weight=None, zero_division="warn")` - note `zero_division` is keyword-only
- When `zero_division="warn"`, emit `UndefinedMetricWarning` and return `0.0`
- When `zero_division` is `0.0`, `1.0`, or `np.nan`, return that value without warning
- Tests `test_matthews_corrcoef_zero_division`, `test_matthews_corrcoef`, and `test_matthews_corrcoef_multiclass` pass

---

### FR2: Add Metadata Routing Support to `permutation_test_score`

**Problem**: The `permutation_test_score` function does not support metadata routing for passing parameters to the underlying estimator's fit method, CV splitter, and scorer when metadata routing is enabled via `sklearn.set_config(enable_metadata_routing=True)`.

**Requirements**:
- Add a `params` parameter to `permutation_test_score` that accepts a dictionary of parameters to route (signature: `params=None`)
- When metadata routing is disabled (default), parameters from `params` are passed directly to the estimator's `fit` method
- When metadata routing is enabled, route parameters appropriately to the estimator, CV splitter, and scorer based on their metadata routing configuration
- Deprecate the existing `fit_params` parameter in favor of `params` with a `FutureWarning`
- Raise `ValueError` if both `params` and `fit_params` are provided
- When routing is enabled, raise `ValueError` if `groups` is passed directly instead of via `params`
- Raise an informative error when unset metadata is passed while routing is enabled

**Acceptance**:
- `permutation_test_score()` must accept `params: dict = None` as a keyword argument
- Using `fit_params` emits `FutureWarning` with message containing "`fit_params` is deprecated"
- Providing both `params` and `fit_params` raises `ValueError` with message containing "cannot both be provided"
- When routing is enabled and `groups` is passed directly, raise `ValueError` with message "`groups` can only be passed if"
- When routing is enabled, parameters are correctly routed to the estimator's fit method, CV splitter's split method, and scorer's score method
- When routing is disabled, `params` are passed to the estimator's fit method
- Tests `test_permutation_test_score_params`, `test_fit_param_deprecation`, `test_groups_with_routing_validation`, `test_passed_unrequested_metadata`, and `test_validation_functions_routing` pass for `permutation_test_score`

---

### FR3: Deprecate `cv="prefit"` in `CalibratedClassifierCV`

**Problem**: The `cv="prefit"` option in `CalibratedClassifierCV` for calibrating pre-fitted classifiers is being replaced by the more general `FrozenEstimator` pattern.

**Requirements**:
- Deprecate the `cv="prefit"` option with a `FutureWarning` indicating removal in version 1.8
- Import `FrozenEstimator` from `sklearn.frozen` to support calibrating pre-fitted classifiers
- Change the `ensemble` parameter default value from `True` to `"auto"`
- When `ensemble="auto"`, set `ensemble=False` if the estimator is a `FrozenEstimator`, and `True` otherwise
- Update documentation to recommend `CalibratedClassifierCV(FrozenEstimator(estimator))` instead of `CalibratedClassifierCV(estimator, cv="prefit")`
- Maintain backward compatibility during the deprecation period

**Acceptance**:
- `CalibratedClassifierCV.__init__()` signature: `ensemble="auto"` (default changed from `True`)
- `FrozenEstimator` must be importable from `sklearn.frozen`
- When `cv="prefit"` is used, a `FutureWarning` is emitted mentioning `FrozenEstimator`
- When a `FrozenEstimator` is passed with default `ensemble="auto"`, the calibrator uses `ensemble=False`
- Calibration results with `FrozenEstimator` match those from the deprecated `cv="prefit"` path
- Tests `test_calibration_prefit[csr_array]` and `test_calibration_prefit[csr_matrix]` pass
- Docstring updates must use `.. versionchanged::` directive (not `.. deprecated::` at class level) to pass numpydoc validation

---

### FR4: Complete `categorical_features` Default Change in Histogram Gradient Boosting

**Problem**: The `categorical_features` parameter in `HistGradientBoostingClassifier` and `HistGradientBoostingRegressor` has a deprecated default value of `"warn"` that was scheduled to change to `"from_dtype"` in version 1.6.

**Requirements**:
- Change the default value of `categorical_features` from `"warn"` to `"from_dtype"` in both `HistGradientBoostingClassifier` and `HistGradientBoostingRegressor`
- Remove the `"warn"` option from the parameter validation
- Remove the logic that emits `FutureWarning` when categorical columns are detected with the `"warn"` setting
- When `categorical_features="from_dtype"`, automatically detect and treat categorical dtype columns in DataFrames as categorical features

**Acceptance**:
- When fitting with a DataFrame containing categorical columns and default `categorical_features` parameter, categorical columns are automatically used as categorical features without warning
- The `"warn"` value is no longer accepted for the `categorical_features` parameter

---

### FR5: Remove Deprecated `loss_function_` Attribute from SGD Classifiers

**Problem**: The `loss_function_` attribute in `SGDClassifier`, `SGDOneClassSVM`, `PassiveAggressiveClassifier`, and `Perceptron` was deprecated in version 1.4 and is scheduled for removal in version 1.6.

**Requirements**:
- Remove the deprecated `loss_function_` property from `BaseSGD` and all subclasses
- Remove the associated deprecation warning decorator and logic
- Remove the attribute documentation from all affected class docstrings

**Acceptance**:
- Accessing `loss_function_` on fitted SGD-based classifiers raises an `AttributeError`
- No deprecation warning is emitted for `loss_function_` (since the attribute no longer exists)

---

### FR6: Handle Deprecation of `sokalmichener` Metric

**Problem**: The `sokalmichener` distance metric was deprecated in SciPy 1.15 and will be removed in SciPy 1.17, requiring scikit-learn to conditionally support this metric based on the installed SciPy version.

**Requirements**:
- Conditionally include `sokalmichener` in the `BOOL_METRICS` list only when the installed SciPy version is less than 1.17
- Add `sokalmichener` to a `DEPRECATED_METRICS` list when SciPy version is 1.15 or higher
- Update the metric validation lists in `sklearn.metrics._dist_metrics.pyx.tp`, `sklearn.metrics.pairwise`, and `sklearn.neighbors._base` to conditionally include `sokalmichener`
- Suppress deprecation warnings from SciPy when testing deprecated metrics
- Follow the existing pattern for `kulsinski` and `matching` metrics in `_dist_metrics.pyx.tp`

**Acceptance**:
- When SciPy version is less than 1.15, `sokalmichener` is available without deprecation tracking
- When SciPy version is 1.15 or higher but less than 1.17, `sokalmichener` is available and tracked as deprecated
- When SciPy version is 1.17 or higher, `sokalmichener` is not available via public API
- No errors occur when using other boolean distance metrics

---

### FR7: Add Validation for 1D Sparse Arrays

**Problem**: Starting with SciPy 1.14, iterating over sparse arrays yields 1D sparse arrays instead of 2D sparse matrices. When these 1D sparse arrays are passed to methods expecting 2D input, the error message is not informative.

**Requirements**:
- Add validation in `check_array` to detect 1D sparse arrays when `ensure_2d=True`
- Raise a `ValueError` with an informative error message explaining the expected shape and suggesting how to reshape the data

**Acceptance**:
- When passing a 1D sparse array to `check_array` with `ensure_2d=True` and `accept_sparse=True`, a `ValueError` is raised with a message mentioning the input shape and reshape suggestions
- The error message matches the format: "Expected 2D input, got input with shape {shape}. Reshape your data..."

---

### FR8: Drop Official PyPy Support

**Problem**: Due to limited maintainer resources and small number of users, official PyPy support needs to be discontinued.

**Requirements**:
- Remove the `_IS_PYPY` constant from `sklearn.utils.fixes`
- Deprecate the `IS_PYPY` attribute in `sklearn.utils` with a `FutureWarning` (for removal in 1.7)
- Remove all PyPy-specific workarounds and conditional code paths throughout the codebase
- Remove the `fails_if_pypy` pytest marker from `sklearn.utils._testing`
- Remove PyPy-specific CI infrastructure and lock files
- Update documentation to reflect that PyPy is not officially supported

**Acceptance**:
- Accessing `sklearn.utils.IS_PYPY` emits a `FutureWarning` about deprecation
- All PyPy-specific conditional code is removed from the codebase
- Tests pass on standard CPython without PyPy-specific markers

---

### FR9: Create `FrozenEstimator` Meta-estimator Module

**Problem**: There is no built-in way to embed an already-fitted estimator into a Pipeline or cross-validation workflow without it being refitted on each call to `pipeline.fit()`. Users must rely on workarounds like the `cv="prefit"` option in `CalibratedClassifierCV` (being deprecated in FR3). A general-purpose wrapper that freezes an estimator's fitted state would enable cleaner composition patterns.

**Requirements**:
- Create a new `sklearn/frozen/` subpackage with a `FrozenEstimator` meta-estimator class
- `FrozenEstimator` wraps a fitted estimator and prevents re-fitting, while transparently delegating all prediction and transformation calls
- Register `"frozen"` as a recognized submodule in `sklearn/__init__.py`

**Acceptance**:
- **Package structure**: `sklearn/frozen/__init__.py` (exports `FrozenEstimator`), `sklearn/frozen/_frozen.py` (implementation), `sklearn/frozen/tests/__init__.py`, `sklearn/frozen/tests/test_frozen.py`
- **Class**: `class FrozenEstimator(BaseEstimator)` with single constructor parameter `estimator`
- **`fit(self, X, y, *args, **kwargs)`**: no-op — checks the wrapped estimator is already fitted (raises `NotFittedError` if not), then returns `self` without any training
- **`__getattr__(self, name)`**: delegates attribute access to `self.estimator`, except:
  - `"fit_predict"` → raises `AttributeError("fit_predict is not available for frozen estimators.")`
  - `"fit_transform"` → raises `AttributeError("fit_transform is not available for frozen estimators.")`
- **`__sklearn_clone__(self)`**: returns `self` (identity clone — `clone(frozen) is frozen` must be `True`)
- **`__sklearn_is_fitted__(self)`**: returns `True` if the wrapped estimator is fitted, `False` otherwise
- **`get_params(self, deep=True)`**: always returns `{"estimator": self.estimator}` regardless of `deep` (does not expose inner estimator parameters)
- **`set_params(self, **kwargs)`**: only accepts `estimator=<new_estimator>`. Any other keyword arguments raise `ValueError` with message "You cannot set parameters of the inner estimator in a frozen estimator since calling `fit` has no effect."
- **Tags**: copy tags from the wrapped estimator but override `_skip_test = True`
- `"frozen"` must be added to the submodules list in `sklearn/__init__.py`
- `FrozenEstimator` must be importable via `from sklearn.frozen import FrozenEstimator`
- **`__getitem__(self, *args, **kwargs)`**: conditionally available only if the wrapped estimator supports indexing (e.g., `Pipeline`). Delegates to `self.estimator.__getitem__()`. Since `__getitem__` is a dunder method, it must be explicitly defined (not relying on `__getattr__` delegation)
- Fitted attributes of the wrapped estimator (e.g., `coef_`, `intercept_`, `classes_`) are directly accessible on the `FrozenEstimator` instance via delegation
- `is_classifier(frozen)`, `is_regressor(frozen)` correctly reflect the wrapped estimator's type


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
