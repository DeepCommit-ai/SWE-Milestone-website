# Software Requirements Specification: Array API Support for Metrics and Preprocessing

## Overview

This milestone establishes Array API compatibility for scikit-learn metrics and preprocessing modules, enabling these components to work seamlessly with array libraries beyond NumPy (such as PyTorch, CuPy, and array-api-strict) when the `array_api_dispatch` configuration is enabled.

**Requirements Summary:**
1. FR1: Array API support for `mean_tweedie_deviance` regression metric
2. FR2: Array API support for `mean_absolute_error` regression metric
3. FR3: Array API support for `mean_squared_error` regression metric
4. FR4: Array API support for `d2_tweedie_score` regression metric
5. FR5: Array API support for `LabelEncoder` preprocessing transformer
6. FR6: Array API support for `cosine_similarity` pairwise metric
7. FR7: Fix device handling in `get_namespace_and_device` when Array API dispatch is disabled
8. FR8: NumPy wrapper namespace Array API compatibility

**Affected Modules:**
- `sklearn.metrics._regression`
- `sklearn.metrics.pairwise`
- `sklearn.preprocessing._label`
- `sklearn.utils._array_api`
- `sklearn.utils._encode`

---

## Requirements

### FR1: Array API Support for mean_tweedie_deviance

**Problem**: The `mean_tweedie_deviance` function only works with NumPy arrays and fails when provided Array API-compliant inputs from other array libraries.

**Requirements**:
- The `mean_tweedie_deviance` function must accept Array API-compliant array inputs when `array_api_dispatch=True`
- Internal computations must use array namespace operations (`xp.pow`, `xp.log`, `xp.where`) instead of NumPy-specific functions
- The function must return a Python float for consistent output across different array implementations
- The `_mean_tweedie_deviance` internal helper must also be updated to use array namespace operations

**Acceptance**:
- When `mean_tweedie_deviance` is called with `array_api_strict` arrays and `array_api_dispatch=True`, the function returns correct deviance values matching NumPy computation results
- The function produces numerically equivalent results for various power values (Normal, Poisson, Gamma distributions) across array implementations
- The function must support `sample_weight` parameter with Array API arrays

---

### FR2: Array API Support for mean_absolute_error

**Problem**: The `mean_absolute_error` function uses NumPy-specific operations and does not work with Array API-compliant inputs.

**Requirements**:
- The `mean_absolute_error` function must accept Array API-compliant array inputs when `array_api_dispatch=True`
- The function must use array namespace operations (`xp.abs`) instead of `np.abs`
- The function must use the Array API-compatible `_average` helper instead of `np.average`
- Multioutput mode must be preserved with Array API inputs
- The function must return a Python float (not an array scalar) for scalar outputs to ensure consistent return types across implementations

**Acceptance**:
- When `mean_absolute_error` is called with Array API-compliant arrays, it returns correct MAE values matching NumPy results
- Multioutput mode (`raw_values`) returns per-output errors as an array in the input's namespace

---

### FR3: Array API Support for mean_squared_error

**Problem**: The `mean_squared_error` function uses NumPy-specific averaging operations and does not work with Array API-compliant inputs.

**Requirements**:
- The `mean_squared_error` function must accept Array API-compliant array inputs when `array_api_dispatch=True`
- The function must use the Array API-compatible `_average` helper instead of `np.average`
- Dtype handling must use array namespace floating dtypes
- Multioutput mode must be preserved with Array API inputs
- The function must return a Python float (not an array scalar) for scalar outputs

**Acceptance**:
- When `mean_squared_error` is called with Array API-compliant arrays, it returns correct MSE values matching NumPy results
- Multioutput mode (`raw_values`) returns per-output errors as an array in the input's namespace

---

### FR4: Array API Support for d2_tweedie_score

**Problem**: The `d2_tweedie_score` function uses NumPy-specific operations (`np.squeeze`, `np.average`) and does not work with Array API-compliant inputs.

**Requirements**:
- The `d2_tweedie_score` function must accept Array API-compliant array inputs when `array_api_dispatch=True`
- The function must use array namespace operations (`xp.squeeze` with explicit `axis` parameter) instead of `np.squeeze`
- The function must use the Array API-compatible `_average` helper instead of `np.average`
- Dtype handling must use array namespace floating dtypes (`xp.float64`, `xp.float32`)

**Acceptance**:
- When `d2_tweedie_score` is called with `array_api_strict` arrays and `array_api_dispatch=True`, the function returns correct D2 scores matching NumPy computation results
- The function produces numerically equivalent results for various power values across array implementations
- The function must support `sample_weight` parameter with Array API arrays

---

### FR5: Array API Support for LabelEncoder

**Problem**: The `LabelEncoder` preprocessing transformer only works with NumPy arrays and fails when provided Array API-compliant inputs.

**Requirements**:
- The `LabelEncoder.transform` method must accept Array API-compliant array inputs and return arrays in the same namespace
- The `LabelEncoder.inverse_transform` method must accept Array API-compliant array inputs and return arrays in the same namespace
- The `LabelEncoder.fit_transform` method must maintain Array API compatibility
- The `classes_` attribute must be stored in the input array's namespace
- The transformer must use array namespace operations for empty array creation, set difference operations, and array indexing
- The encoder utility functions in `_encode.py` must be updated to support Array API operations:
  - `_unique_np` must use array namespace `unique_*` functions
  - `_encode` must use array namespace type checking (`xp.isdtype`) and search operations
  - `_check_unknown` must use array namespace operations for set operations and boolean masks
  - `_map_to_integer` must return arrays in the input namespace

**Acceptance**:
- When `LabelEncoder.fit` is called with Array API-compliant integer arrays, `classes_` is stored in the input's namespace
- When `LabelEncoder.transform` is called with Array API-compliant arrays, the output is in the same namespace
- When `LabelEncoder.inverse_transform` is called with Array API-compliant arrays, the output is in the same namespace
- The transformer produces numerically equivalent results to NumPy-based encoding
- `LabelEncoder._more_tags()` must return `{"array_api_support": True}` to signal Array API compatibility to scikit-learn's testing infrastructure
- `LabelEncoder.inverse_transform` must use `xp.take(self.classes_, y, axis=0)` for Array API-compatible array indexing instead of direct NumPy-style indexing (`self.classes_[y]`)

---

### FR6: Array API Support for cosine_similarity

**Problem**: The `cosine_similarity` pairwise metric only works with NumPy arrays and does not properly handle dtype inference for Array API inputs.

**Requirements**:
- The `check_pairwise_arrays` validation function must support Array API-compliant inputs
- Floating dtype inference must use `_find_matching_floating_dtype` for non-NumPy, non-sparse inputs
- The existing `_return_float_dtype` function must continue to be used for NumPy and sparse inputs

**Acceptance**:
- When `cosine_similarity` is called with Array API-compliant arrays, it returns correct similarity values in the input's namespace
- Dtype handling correctly infers appropriate floating point types for Array API inputs

---

### FR7: Fix Device Handling When Array API Dispatch is Disabled

**Problem**: The `get_namespace_and_device` utility function incorrectly attempts to access device information from arrays (such as PyTorch CPU tensors) when Array API dispatch is disabled, causing errors instead of treating inputs as regular NumPy-convertible arrays.

**Requirements**:
- When Array API dispatch is disabled (`array_api_dispatch=False`), `get_namespace_and_device` must return `None` as the device value
- The function must only call the `device()` function when Array API dispatch is actually enabled
- The function must return the NumPy wrapper namespace when dispatch is disabled

**Acceptance**:
- When passing PyTorch CPU tensors with `array_api_dispatch=False`, `get_namespace_and_device` returns `(numpy_wrapper, False, None)` without raising errors
- When passing arrays with `array_api_dispatch=True`, the function returns the appropriate namespace and device information

### FR8: NumPy Wrapper Namespace Array API Compatibility

**Problem**: The NumPy wrapper namespace used for Array API compatibility does not provide all operations needed by the metrics and preprocessing modules.

**Requirements**:
- The NumPy wrapper namespace must provide Array API-compatible interfaces for power operations
- The NumPy wrapper namespace must provide Array API-compatible interfaces for unique value operations that return all standard outputs (values, indices, inverse indices, counts)

**Acceptance**:
- Metrics functions can perform power computations through the NumPy wrapper namespace
- Encoding operations can obtain all unique value information through the NumPy wrapper namespace


---

## Infrastructure Requirements

### Array API Utility Functions

The following utility functions must be added or modified in `sklearn.utils._array_api` to support the above requirements:

- `_searchsorted`: Array API-compatible searchsorted operation with fallback to NumPy conversion
- `_setdiff1d`: Array API-compatible set difference operation
- `_isin`: Array API-compatible membership test operation
- `_in1d`: Helper function for membership tests using stable sorting
- `_NumPyAPIWrapper.pow`: Add power function wrapper for NumPy namespace
- `_NumPyAPIWrapper.unique_all`: Add unique_all function returning all unique outputs

These utilities enable the core functionality requirements above while maintaining compatibility with array libraries that have incomplete Array API coverage.


---

# Environment Dependency Changes (relative to Base Env)

## Python Packages
- array-api-compat 1.13.0 added
- array_api_strict 2.4.1 added
